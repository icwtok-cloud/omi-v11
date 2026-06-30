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

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.auth import get_current_user
from app.models.db_models import User


@pytest.fixture()
def db_session():
    """Una base SQLite en memoria, nueva en cada test -- así los tests
    de API no dependen entre si ni tocan la base real de Render."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def test_user(db_session):
    user = User(id="user_test_123", email="test@example.com")
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture()
def client(db_session, test_user):
    """TestClient con get_db y get_current_user overrideados -- evita
    pegarle a Clerk de verdad o a la base de Render en cada test de API."""
    from app.main import app

    def _override_get_db():
        yield db_session

    def _override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
