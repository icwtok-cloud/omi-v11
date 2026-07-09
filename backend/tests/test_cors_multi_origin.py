"""Bug real de producción: omi.lat hace 308 redirect a www.omi.lat, y
FRONTEND_URL solo tenía el primero -- el browser manda Origin:
https://www.omi.lat post-redirect y CORSMiddleware lo rechazaba, tirando
"No se pudieron cargar los módulos disponibles" en el frontend aunque el
backend estuviera 100% sano. frontend_url ahora acepta una lista separada
por coma."""

from app.core.config import Settings


class TestFrontendUrlsMultiOrigin:
    def test_un_solo_origen_sigue_funcionando_como_antes(self):
        s = Settings(frontend_url="https://omi.lat", database_url="sqlite:///:memory:",
                     clerk_secret_key="x", clerk_publishable_key="x",
                     clerk_webhook_signing_secret="x", payment_receive_address="0x0",
                     polygon_rpc_url="https://x", base_rpc_url="https://x")
        assert s.frontend_urls == ["https://omi.lat"]

    def test_multiples_origenes_separados_por_coma(self):
        s = Settings(frontend_url="https://omi.lat, https://www.omi.lat",
                     database_url="sqlite:///:memory:",
                     clerk_secret_key="x", clerk_publishable_key="x",
                     clerk_webhook_signing_secret="x", payment_receive_address="0x0",
                     polygon_rpc_url="https://x", base_rpc_url="https://x")
        assert s.frontend_urls == ["https://omi.lat", "https://www.omi.lat"]
