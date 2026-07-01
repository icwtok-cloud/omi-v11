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
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.auth import get_current_user
from app.models.db_models import User


@pytest.fixture()
def test_sessionmaker():
    """El sessionmaker de la base sqlite en memoria de este test --
    expuesto aparte (no solo la sesión ya abierta) para que `client`
    pueda parchear con esto el `SessionLocal` que usan los background
    tasks (ver `_run_validation_job` en app/api/projects.py), que abren
    su PROPIA sesión con `SessionLocal()` en vez de la dependency
    `get_db` -- sin este parche, apuntarían a la base real de
    `DATABASE_URL` (un `test.db` vacío) en vez de a esta.

    `poolclass=StaticPool` es necesario acá: FastAPI corre los endpoints
    (incluso los `def` sync) en un thread del threadpool, distinto al
    thread donde corre este fixture. Sin StaticPool, una engine sqlite
    ':memory:' le da a cada thread una conexión a una base en memoria
    DISTINTA (vacía) -- "no such table" apenas el endpoint intenta leer
    algo que no se haya cacheado antes en el thread principal. StaticPool
    fuerza a que todos los threads compartan la misma conexión real."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal


@pytest.fixture()
def db_session(test_sessionmaker):
    """Una sesión nueva por test contra la base en memoria de
    `test_sessionmaker` -- así los tests de API no dependen entre sí ni
    tocan la base real de Render."""
    session = test_sessionmaker()
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
def client(db_session, test_user, test_sessionmaker, monkeypatch):
    """TestClient con get_db y get_current_user overrideados -- evita
    pegarle a Clerk de verdad o a la base de Render en cada test de API."""
    from app.main import app
    import app.api.projects as projects_module

    def _override_get_db():
        yield db_session

    def _override_get_current_user():
        return test_user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_user] = _override_get_current_user

    # _run_validation_job (background task de /validate) abre su propia
    # sesión llamando a SessionLocal() directo, sin pasar por get_db --
    # hay que parchear esa referencia para que apunte a la misma base en
    # memoria de este test, si no "no such table" apenas corre en background.
    monkeypatch.setattr(projects_module, "SessionLocal", test_sessionmaker)

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
