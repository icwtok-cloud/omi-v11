"""
Variables de entorno dummy para que los tests puedan importar `app.core.config`
(y todo lo que depende de él, como `rules_loader`) sin necesitar credenciales
reales de Clerk, la base de datos, o los RPC de Polygon/Base.

Esto se ejecuta antes de que pytest importe cualquier módulo de test, así que
toda la app ya ve estas variables seteadas en el momento en que algo hace
`from app.core.config import settings`.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("CLERK_SECRET_KEY", "test_dummy_secret")
os.environ.setdefault("CLERK_PUBLISHABLE_KEY", "test_dummy_publishable")
os.environ.setdefault("CLERK_WEBHOOK_SIGNING_SECRET", "test_dummy_webhook_secret")
os.environ.setdefault(
    "PAYMENT_RECEIVE_ADDRESS", "0x0000000000000000000000000000000000000000"
)
os.environ.setdefault("POLYGON_RPC_URL", "https://example.invalid/polygon")
os.environ.setdefault("BASE_RPC_URL", "https://example.invalid/base")
