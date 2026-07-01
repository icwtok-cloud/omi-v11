"""
Tests de la ronda de hardening operacional: el JWKS de Clerk se
cacheaba para siempre una vez poblado -- si Clerk rota sus claves de
firma, todo login nuevo empezaba a fallar con 401 hasta reiniciar el
proceso a mano. Ahora, si el `kid` del token no está en el cache, se
refresca el JWKS una vez antes de rechazar.
"""

import jwt as pyjwt
import pytest

import app.core.auth as auth_module
from app.core.auth import _verify_clerk_token


@pytest.fixture(autouse=True)
def _reset_jwks_cache():
    auth_module._jwks_cache = None
    yield
    auth_module._jwks_cache = None


def _fake_jwk(kid: str) -> dict:
    # Un JWK RSA sintético alcanza para el test -- no hace falta que
    # sea una clave real, solo que `_find_key` lo encuentre por kid.
    return {
        "kid": kid, "kty": "RSA", "alg": "RS256", "use": "sig",
        "n": "sZ8", "e": "AQAB",
    }


def test_usa_el_cache_sin_volver_a_pedir_el_jwks(monkeypatch):
    calls = []

    def fake_fetch():
        calls.append(1)
        return {"keys": [_fake_jwk("kid-actual")]}

    monkeypatch.setattr(auth_module, "_fetch_jwks", fake_fetch)
    monkeypatch.setattr(
        auth_module.jwt, "get_unverified_header", lambda t: {"kid": "kid-actual"}
    )
    monkeypatch.setattr(
        pyjwt.algorithms.RSAAlgorithm, "from_jwk", staticmethod(lambda k: "clave-fake")
    )
    monkeypatch.setattr(
        auth_module.jwt, "decode", lambda *a, **kw: {"sub": "user_123"}
    )

    _verify_clerk_token("token-1")
    _verify_clerk_token("token-2")

    assert len(calls) == 1  # el 2do token no volvió a pedir el JWKS


def test_kid_desconocido_refresca_el_jwks_una_vez_antes_de_rechazar(monkeypatch):
    """Simula una rotación de claves de Clerk: el cache tiene la clave
    VIEJA, llega un token firmado con la NUEVA. Antes de este fix, esto
    tiraba 401 para siempre hasta reiniciar el proceso -- ahora se
    refresca el JWKS una vez y encuentra la clave nueva."""
    fetch_count = {"n": 0}

    def fake_fetch():
        fetch_count["n"] += 1
        if fetch_count["n"] == 1:
            return {"keys": [_fake_jwk("kid-vieja")]}
        return {"keys": [_fake_jwk("kid-vieja"), _fake_jwk("kid-nueva")]}

    monkeypatch.setattr(auth_module, "_fetch_jwks", fake_fetch)
    monkeypatch.setattr(
        auth_module.jwt, "get_unverified_header", lambda t: {"kid": "kid-nueva"}
    )
    monkeypatch.setattr(
        pyjwt.algorithms.RSAAlgorithm, "from_jwk", staticmethod(lambda k: "clave-fake")
    )
    monkeypatch.setattr(
        auth_module.jwt, "decode", lambda *a, **kw: {"sub": "user_123"}
    )

    # Primer llamado puebla el cache con la clave vieja (nunca vio la nueva).
    auth_module._get_jwks()
    assert fetch_count["n"] == 1

    payload = _verify_clerk_token("token-con-clave-nueva")
    assert payload == {"sub": "user_123"}
    assert fetch_count["n"] == 2  # se refrescó una vez


def test_kid_que_no_existe_en_ningun_jwks_da_401(monkeypatch):
    monkeypatch.setattr(
        auth_module, "_fetch_jwks", lambda: {"keys": [_fake_jwk("kid-real")]}
    )
    monkeypatch.setattr(
        auth_module.jwt, "get_unverified_header", lambda t: {"kid": "kid-que-no-existe"}
    )

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        _verify_clerk_token("token-invalido")
    assert exc_info.value.status_code == 401
