"""
Configuración central del backend, leída de variables de entorno.

En Render, estas variables se configuran en el dashboard del servicio
(Environment). En local, se pueden poner en un archivo .env (no versionado).
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- General ---
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"

    # --- Base de datos (Render Postgres) ---
    database_url: str

    # --- Clerk (auth) ---
    clerk_secret_key: str
    clerk_publishable_key: str
    # webhook de Clerk para sincronizar usuarios (creación/borrado) a nuestra DB
    clerk_webhook_signing_secret: str

    # --- Pagos cripto ---
    # Dirección fija única donde recibimos USDC en todas las redes soportadas.
    payment_receive_address: str

    # RPC endpoints por red. Usar un proveedor administrado (Alchemy/Infura/
    # un nodo público) -- no requieren wallet propia, solo lectura.
    polygon_rpc_url: str
    base_rpc_url: str

    # Contratos de USDC en cada red (son direcciones públicas y fijas,
    # no son secretas, pero las dejamos configurables por si cambian
    # de proveedor de stablecoin en el futuro, ej a USDT).
    polygon_usdc_contract: str = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
    base_usdc_contract: str = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

    # Cuántas confirmaciones de bloque esperar antes de considerar un pago
    # definitivo (protege contra reorgs). L2s como Polygon/Base son rápidas
    # pero no instantáneas.
    confirmations_required: int = 20

    # --- Precios ---
    price_per_project_usd: float = 99.0
    price_subscription_monthly_usd: float = 149.0

    # --- Archivos ---
    max_upload_size_mb: int = 25
    upload_storage_path: str = "/tmp/omi_uploads"

    # --- Reglas Odoo ---
    rules_base_path: str = "rules"


settings = Settings()  # type: ignore[call-arg]
