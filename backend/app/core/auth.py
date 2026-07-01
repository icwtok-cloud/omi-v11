"""
Verificación de sesión de Clerk en el backend.

Clerk emite un JWT corto-vivo por sesión que el frontend manda en el
header Authorization. El backend lo verifica contra las claves públicas
de Clerk (JWKS) -- no hace falta llamar a la API de Clerk en cada
request, se valida la firma localmente.
"""

from __future__ import annotations

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.db_models import User

security = HTTPBearer()

_jwks_cache: dict | None = None


def _fetch_jwks() -> dict:
    # Clerk publica el JWKS en una URL bien conocida derivada del
    # publishable key -- en producción, Clerk te da la URL exacta
    # en el dashboard (Configure > JWT templates / API keys).
    resp = httpx.get(
        f"https://api.clerk.com/v1/jwks",
        headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        timeout=5.0,
    )
    resp.raise_for_status()
    return resp.json()


def _get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache
    if _jwks_cache is None or force_refresh:
        _jwks_cache = _fetch_jwks()
    return _jwks_cache


def _find_key(jwks: dict, kid: str) -> dict | None:
    return next((k for k in jwks["keys"] if k["kid"] == kid), None)


def _verify_clerk_token(token: str) -> dict:
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header["kid"]

        jwks = _get_jwks()
        key = _find_key(jwks, kid)
        if key is None:
            # El cache quedaba para SIEMPRE una vez poblado -- si Clerk
            # rota sus claves de firma (lo hacen periódicamente), todo
            # login nuevo empezaba a fallar con 401 hasta reiniciar el
            # proceso a mano (una caída total de autenticación
            # silenciosa). Antes de rechazar el token, se refresca el
            # JWKS una vez por si la clave es simplemente nueva.
            jwks = _get_jwks(force_refresh=True)
            key = _find_key(jwks, kid)
            if key is None:
                raise KeyError(f"kid '{kid}' no encontrado en el JWKS de Clerk")

        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
        payload = jwt.decode(token, public_key, algorithms=["RS256"], options={"verify_aud": False})
        return payload
    except (jwt.InvalidTokenError, StopIteration, KeyError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token de sesión inválido: {e}",
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    payload = _verify_clerk_token(credentials.credentials)
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Token sin subject")

    user = db.query(User).filter(User.id == clerk_user_id).first()
    if not user:
        # Defensivo: si por algún motivo el webhook de creación de Clerk
        # todavía no sincronizó al usuario, lo creamos al vuelo con lo
        # mínimo que tenemos del token, en vez de fallar la request.
        email = payload.get("email", f"{clerk_user_id}@unknown.local")
        user = User(id=clerk_user_id, email=email)
        db.add(user)
        db.commit()

    return user
