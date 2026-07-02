# OMI — Odoo Migration Inspector

OMI valida archivos de datos (CSV/Excel) contra las reglas reales de un
módulo y versión específica de Odoo, antes de que el usuario los importe.
Gratis: ves el reporte completo de errores y fixes sugeridos. De pago:
descargás el archivo corregido.

**El motor de validación es 100% determinístico — no usa IA.** Las reglas
se generan una sola vez, offline, leyendo el código fuente real de Odoo.

## Los tres subsistemas

```
omi/
├── rules-generator/   offline · genera los schemas de validación
├── backend/           Render  · API que valida archivos y cobra
└── frontend/          Vercel  · UI: subir, ver reporte, pagar, descargar
```

### 1. `rules-generator/`

Script que **no corre en producción**. Se ejecuta manualmente (o desde CI)
cuando:
- sale una versión nueva de Odoo a soportar
- querés refrescar las reglas de una versión existente

Pasos:
```bash
cd rules-generator/scripts
./clone_odoo.sh                  # clona las 6 versiones soportadas
python build_rules.py            # genera los 48 JSON (8 módulos x 6 versiones)
cp -r ../output/* ../../backend/rules/
```

Qué hace `build_rules.py` por cada módulo+versión:
1. **Introspección de modelos** (`introspect_models.py`): parsea con AST
   de Python los archivos `models/*.py` del addon correspondiente, sin
   levantar el runtime de Odoo. Extrae campos, tipos, `required`, y
   relaciones (`comodel_name`).
2. **Extracción de defaults** (`extract_default_data.py`): parsea los XML
   en `data/*.xml` para sacar los valores de fábrica (etapas de CRM,
   categorías de producto, plan de cuentas, monedas).
3. Combina todo en un JSON por módulo+versión, que el backend consume tal
   cual — el backend nunca vuelve a tocar código fuente de Odoo.

Ver `module_map.py` para el mapeo entre los 8 módulos "de cara al
usuario" (Contactos, CRM, Ventas, Facturación, Inventario, Productos,
Contabilidad, Compras) y sus addons/modelos técnicos reales en Odoo.

### 2. `backend/` (FastAPI, deploy en Render)

100% determinístico. Sin llamadas a ningún modelo de IA.

Piezas clave:
- `app/services/rules_loader.py` — carga los JSON de `rules/` generados
  por el subsistema 1.
- `app/services/validation_engine.py` + `format_rules.py` — el motor de
  validación: por cada fila del archivo subido, chequea campos
  obligatorios, formato (email, teléfono, CUIT...), y coherencia contra
  los valores reales de Odoo (relaciones, opciones de selección, defaults
  de fábrica o el override que el cliente haya provisto).
- `app/services/payment_matching.py` + `app/workers/payment_listener.py`
  — el flujo de pago cripto (ver sección de pagos abajo).
- `app/core/auth.py` — verifica el JWT de sesión de Clerk en cada request.

Correr en local:
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # completar con tus credenciales
uvicorn app.main:app --reload
```

El worker de pagos corre como **proceso separado** (no en el mismo
proceso que atiende HTTP):
```bash
python -m app.workers.payment_listener
```

Deploy en Render: `render.yaml` ya define ambos servicios (web + worker)
más la base Postgres. Conectá el repo en el dashboard de Render y va a
detectar el `render.yaml` automáticamente.

### 3. `frontend/` (Next.js, deploy en Vercel)

Flujo de pantallas:
1. `/app` — crear un Proyecto (versión + país de Odoo) y subir el
   primer módulo (requiere sesión de Clerk)
2. `/proyectos/[id]` — un Proyecto es un contenedor de hasta 8 módulos
   (Contactos, CRM, Ventas, etc.), cada uno con su propio archivo,
   reporte (errores, quality score, mapeo de columnas con nivel de
   confianza, detección de External ID) y fixes manuales/automáticos.
   Todo gratis de ver; también se puede descargar un reporte técnico
   en PDF por módulo sin pagar.
3. Pago (o proyecto gratis / cuota de suscripción disponible) →
   descarga de un ZIP con el archivo corregido de cada módulo
   validado, numerado según el orden de importación recomendado.

**Tiers**: Gratis (1 módulo, una vez por cuenta, incluye descarga) ·
$99 por proyecto (exportes ilimitados de ESE proyecto) · $149/mes
(hasta 5 proyectos exportados por mes calendario). El cobro/consumo de
cuota ocurre exactamente al exportar, no al validar ni al ver el
reporte -- ver `can_export_project()` en `entitlements.py`.

Correr en local:
```bash
cd frontend
npm install
cp .env.example .env.local   # completar con tus credenciales
npm run dev
```

## Flujo de pago cripto

No usa Stripe ni Mercado Pago — pagos directos en **USDC** sobre
**Polygon** o **Base**, a una dirección fija única.

El problema de "¿cómo sé de quién es cada pago que llega a la misma
dirección?" se resuelve con un **monto único por pago**: en vez de
cobrar exactamente $99.00, el backend genera $99.0034 (una
micro-variación de hasta 4 decimales sobre el precio base) y se la
muestra al usuario antes de que pague. Un worker en background
(`app/workers/payment_listener.py`) escucha los eventos `Transfer` del
contrato de USDC en cada red, y cuando ve una transferencia a nuestra
dirección por un monto que matchea exactamente un pago pendiente, lo
marca como confirmado tras esperar las confirmaciones de bloque
configuradas (protección contra reorgs).

Si dos pagos pendientes generaran el mismo monto por casualidad, el
generador reintenta — ver `generate_unique_amount()` en
`payment_matching.py`.

## Membresía anual de partner (activación manual)

Para partners que quieren estresar la herramienta con mucho volumen
(ej. $499/año, 5 millones de eventos, donde 1 evento = 1 fila
analizada por el motor de validación) hay un modo aparte de los tres
tiers normales. **No es autoservicio** -- no aparece en la landing, no
se paga con USDC, se activa a mano con un `UPDATE` directo en la base
de Render:

```sql
UPDATE users
SET annual_event_limit = 5000000
WHERE email = 'partner@ejemplo.com';
```

Con `annual_event_limit` seteado, esa cuenta queda **exenta** de todo
el gating normal de pago (proyecto gratis / pago puntual / cuota
mensual de suscripción) -- puede crear proyectos y descargar sin
límite. Lo único que se controla es la cuota anual de filas: cada
`validate()` cuenta todas las filas del archivo contra
`annual_events_used`, **incluso si se re-valida el mismo archivo**
(decisión explícita: mucho más simple de implementar y de auditar que
trackear qué filas ya se cobraron). Se resetea solo al cruzar a un año
calendario nuevo (ver `reset_annual_events_if_needed()` en
`entitlements.py`). Si un archivo llevaría la cuenta por encima del
límite, esa validación puntual queda en `failed` con un mensaje claro
-- no se cobra el intento fallido.

## Data Enrichment Engine

Etapa separada del pipeline (después de Validation, antes de
Report/Export) que genera campos TÉCNICOS seguros cuando faltan --
`default_code` (SKU) y `external_id` -- sin nunca inventar información
de negocio. Todo lo generado es determinístico (secuencial por fila,
nunca random), 100% opt-in (requiere confirmar explícitamente vía
`POST /projects/{id}/modules/{mid}/apply-enrichment`) y auditable (log
de qué se generó, viaja junto al archivo corregido en el ZIP). Ver
`app/services/enrichment_engine.py` y la entrada del CHANGELOG del
2026-07-01 para el detalle completo.

## Decisiones de diseño que vale la pena recordar

- **Por qué AST y no importar el ORM de Odoo de verdad**: importar Odoo
  requiere su runtime completo (Postgres, configuración, addons path).
  Parsear el árbol de sintaxis directamente da la misma información
  (declaración de campos) sin esa complejidad.
- **Por qué el generador de reglas vive separado del backend**: la
  introspección es lenta y solo cambia cuando sale una versión nueva de
  Odoo — no tiene sentido correrla por cada request de usuario.
- **Por qué defaults de fábrica + override de cliente, no solo uno de
  los dos**: muchos clientes personalizan sus categorías/etapas/plan de
  cuentas. Validar solo contra el default de fábrica daría falsos
  positivos a esos clientes; permitir override sin tener un default
  rompería la experiencia gratuita para el resto.
- **Por qué versiones EOL (14-16) y no solo las 3 oficialmente
  soportadas (17-19)**: ahí está la mayor urgencia real de migrar (Odoo
  cobra un recargo a quien sigue en versiones sin soporte).

## Fuera de alcance por ahora

- **No se puede borrar ni renombrar un Proyecto una vez creado.** No es
  un olvido silencioso -- se decidió no construirlo todavía porque
  `Project`/`ProjectModule`/`Payment` no tienen `ondelete` a nivel de
  DB (solo cascade a nivel ORM en `Project.modules`), y un borrado real
  necesitaría manejar esas foreign keys con cuidado para no dejar
  registros huérfanos ni romper el historial de pagos. Si un usuario
  crea un proyecto por error, hoy queda ahí (no afecta cuota ni cobro
  hasta que se paga/exporta).
