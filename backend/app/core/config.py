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
    # Uno o más orígenes permitidos para CORS, separados por coma (ej.
    # "https://omi.lat,https://www.omi.lat"). Necesario porque el apex
    # sin "www" suele hacer un redirect 308 al dominio con "www" (o
    # viceversa, según el proveedor DNS) -- el browser manda el Origin
    # real post-redirect, así que si solo se permite uno de los dos, el
    # otro queda bloqueado por CORS aunque el backend esté sano (bug real
    # detectado en producción: omi.lat -> www.omi.lat, y FRONTEND_URL solo
    # tenía el primero).
    frontend_url: str = "http://localhost:3000"

    @property
    def frontend_urls(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]

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
    price_annual_usd: float = 799.0

    # --- Lemon Squeezy (pagos con tarjeta, alternativa a cripto) ---
    lemonsqueezy_api_key: str = ""
    lemonsqueezy_store_id: str = ""
    lemonsqueezy_webhook_signing_secret: str = ""
    lemonsqueezy_variant_id_per_project: str = ""
    lemonsqueezy_variant_id_subscription: str = ""
    lemonsqueezy_variant_id_annual: str = ""

    # --- Archivos ---
    max_upload_size_mb: int = 25
    upload_storage_path: str = "/tmp/omi_uploads"

    # --- Reglas Odoo ---
    rules_base_path: str = "rules"


settings = Settings()  # type: ignore[call-arg]
