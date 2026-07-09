# OMI — Changelog y reglas para no romper el flujo

Este archivo es la memoria del proyecto. Antes de tocar `PaywallPanel.tsx`,
`validation_engine.py`, `tailwind.config.js` o el selector de módulos,
leé esto. Cada regla de abajo existe porque algo se rompió en producción
y costó tiempo diagnosticarlo.

Guardar este archivo como `CHANGELOG.md` en la raíz del repo (no en un
subdirectorio) para que cualquiera que clone el proyecto lo vea primero.

## 2026-07-02 (4) — Traducción completa a portugués: producto funcional + 12 hubs SEO/GEO

**Cierre de la traducción completa** pedida explícitamente después de
la entrada anterior (que solo cubría la landing). Dos fases más:

**Fase 2 — producto funcional** (`app/pt/app/page.tsx`,
`app/pt/proyectos/[id]/page.tsx`): espejo exacto de la lógica de las
páginas en español (mismo polling, mismo backoff, misma protección
de confirmación extra en fixes de `negative_value`) con todo el texto
en portugués. `IssueRow`, `DataPreview` y `PaywallPanel` ganan prop
`locale` opcional (default `"es"`, no rompe ningún uso existente).
`middleware.ts` protege `/pt/proyectos(.*)` igual que `/proyectos(.*)`.
Los valores de módulo/país enviados al backend siguen en español (son
el contrato real de la API); solo cambian los rótulos que ve el usuario.

**Fase 3 — 12 hubs de contenido SEO/GEO** (13 archivos: guías, guía
de preparar datos, migraciones, desarrollo, preguntas frecuentes,
datos, comparativas, excel-vs-omi, glosario, compatibilidad, casos
frecuentes, empresas, versiones): mismo patrón de duplicar bajo
`/pt/<hub>` en vez de tocar el original, mismo JSON-LD
(BreadcrumbList/Article/FAQPage/DefinedTermSet) con URLs y contenido
en portugués. `SiteHeader` y `RelatedHubs` ganan prop `locale` para
que los hubs en portugués enlacen entre sí y a la landing `/pt` sin
mezclar idiomas.

**Omitido a propósito, documentado, no un descuido:** `IntentCTASlot`
(`components/IntentEngine.tsx`, el motor de detección de intención
con CTA progresiva) no se tradujo -- su copy está hardcodeado en
español y agregarle locale toca lógica de scoring, no solo texto. Se
omitió de los hubs en portugués en vez de mostrar un CTA en español
en medio de una página en portugués.

**Verificación:** `tsc --noEmit` limpio en ambas fases; `curl` contra
el servidor de desarrollo confirmó 200 en `/pt/app`,
`/pt/proyectos/{id}` (protegido idéntico a su par ES), y las 13 rutas
`/pt/<hub>`, con el contenido correcto en cada una, cross-links entre
hubs funcionando, y cero regresión verificada en las páginas ES
equivalentes (mismo comportamiento, mismo contenido).

**Alcance final de la traducción:** landing, producto funcional
completo y los 12 hubs -- los tres bajo `/pt`, sin tocar una sola
línea de las páginas en español existentes en ningún punto de las
tres fases.

**Rollback:** sin migración de DB. Todas las rutas `/pt/*` son
aditivas -- revertir cualquiera de los tres commits no afecta ninguna
ruta en español existente.

## 2026-07-02 (3) — Landing en portugués (toggle ES/PT) + segunda instancia de la promesa de privacidad falsa

**Contexto:** pedido explícito de agregar soporte de portugués. Se
midió el alcance real antes de tocar código: ~3.400 líneas de copy
entre landing, 12 hubs SEO/GEO y las páginas funcionales del producto
(`/app`, `/proyectos/[id]`, ~1.430 líneas). Traducir todo eso con
calidad nativa, routing por idioma y metadata SEO duplicada es
trabajo de días, no de una noche -- se acotó el alcance explícitamente
para no arriesgar el flujo funcional (upload/validación/pago) horas
antes del piloto.

**Qué se tradujo esta noche:** la landing principal completa, en una
ruta nueva `/pt` (`app/pt/page.tsx`) -- hero, trust points, pain
cards, antes/después, cómo funciona, personas, sección LatAm, FAQ y
precios, programa de partners, CTA final. Toggle ES↔PT real en el
header de ambas versiones (desktop y menú móvil).

**Qué NO se tradujo, a propósito:** `/app` y `/proyectos/[id]` (el
producto funcional en sí) siguen en español -- reescribir ~1.430
líneas de UI en producción bajo presión de tiempo es el tipo de
cambio que puede romper lo que se lanza mañana. Tampoco se tradujeron
los 12 hubs de contenido SEO/GEO -- son para tráfico orgánico, no
bloquean el piloto, y traducirlos apurado perjudicaría el SEO en
portugués más que no tenerlos todavía.

**Arquitectura:** en vez de duplicar componentes, `ProductDemo` y
`SiteFooter` ganaron un prop opcional `locale` (`"es" | "pt"`,
default `"es"`) -- no rompe ninguno de los usos existentes en los 12
hubs. `sitemap.ts` incluye `/pt` y `/privacidad`; `layout.tsx` declara
el `alternates.languages` (hreflang es/pt) para SEO.

**Bug encontrado de paso, mismo tipo que el de la entrada anterior:**
`lib/faq-data.ts` tenía su propia copia de la promesa "el archivo
original se elimina automáticamente" -- la misma afirmación falsa ya
corregida en `TRUST_POINTS` de la landing, pero en un archivo
separado, embebida además en el JSON-LD `FAQPage` (citable
textualmente por buscadores e IA) tanto en la landing como en
`/preguntas-frecuentes`. Corregida para reflejar el comportamiento
real (`_ensure_corrected_file()` en el backend).

**Verificación:** `tsc --noEmit` limpio; `curl` contra el servidor de
desarrollo confirmó: `/pt` sirve 200 con el contenido traducido, el
toggle PT aparece en `/`, los 12 hubs conservan su footer en español
sin cambios (regresión descartada), y la respuesta de privacidad
corregida aparece tanto en `/` como en `/preguntas-frecuentes`.

**Rollback:** sin migración de DB. `/pt` es una ruta nueva y aditiva;
revertir el commit no afecta ninguna ruta existente.

## 2026-07-02 (2) — Fix UX pre-piloto, parte 2: contradicción de precios, chip de Brasil, página de privacidad

**Continuación de la entrada anterior** -- misma auditoría, hallazgos
que habían quedado sin resolver en la primera tanda.

**1. El titular de la sección Precios ("Pagás en cripto, sin
suscripciones escondidas") se contradecía con el plan mensual de $149
que aparecía dos tarjetas al lado**, y encima vendía la mayor barrera
de conversión del producto (cripto-only) como si fuera un beneficio.
**Fix:** titular neutral ("Precios simples, pagás cuando estás
listo"), el detalle de USDC/Polygon/Base pasa al subtítulo como dato,
no como gancho.

**2. La tarjeta de $99 mezclaba en la misma lista de bullets lo que ya
es gratis (reporte completo) con lo que efectivamente se paga (el
export).** Un lector rápido no podía distinguir qué estaba comprando.
**Fix:** el primer bullet ahora es explícitamente lo que se paga
("Export listo para Odoo, todos los módulos"); el reporte gratis pasa
a una línea aclaratoria separada.

**3. El hero prometía "Resultados en segundos"**, contradicho por los
propios mensajes de `ValidationProgress` en `/proyectos/[id]` ("esto
puede tardar unos minutos con archivos grandes"). **Fix:** cambiado a
"Reporte gratis, primera descarga incluida" -- no promete una
velocidad que el propio producto desmiente en el flujo real.

**4. El chip de "Brasil" en la sección LatAm se mostraba resaltado
(borde y texto de marca)**, justo arriba de un párrafo que aclara que
Brasil es el único país sin soporte de idioma todavía ("interfaz en
español; soporte en portugués, próximamente") -- resaltar visualmente
la única excepción negativa manda la señal opuesta a la intención.
**Fix:** chip de Brasil ahora con el mismo estilo neutral que el resto.

**5. El footer no linkeaba ninguna página de privacidad**, pese a que
el producto le pide a consultoras subir datos de sus propios clientes.
**Fix:** nueva página `/privacidad` (`app/privacidad/page.tsx`),
enlazada desde `SiteFooter.tsx`. Contenido grounded únicamente en
comportamiento verificado del código (retención de archivos según
`_ensure_corrected_file()`, método de pago actual, cómo pedir
borrado por mail) -- deliberadamente NO incluye términos de servicio
ni política de reembolso: son decisiones de negocio/legales que el
equipo tiene que tomar, no algo para inventar en una pasada de UX.

**Verificación:** `tsc --noEmit` limpio; contenido confirmado por
`curl` contra el servidor de desarrollo (landing y `/privacidad`
sirven el HTML esperado).

**Rollback:** sin migración de DB. `git revert` alcanza; `/privacidad`
es una página nueva, revertirla no rompe ningún link existente salvo
el que agrega este mismo commit en el footer.

## 2026-07-02 — Fix UX pre-piloto: login en /app, listado de proyectos, menú móvil, copy engañoso

**Contexto:** auditoría UX/UI end-to-end del flujo landing → auth →
upload → validación → paywall → export, hecha la noche antes del
lanzamiento del MVP. Se priorizaron 5 hallazgos accionables sin tocar
arquitectura backend.

**1. `/app` estaba protegido por el middleware de Clerk, matando el
flujo de "ver el valor antes de pedir login".** `middleware.ts` tenía
`/app(.*)` en `isProtectedRoute`, así que Clerk redirigía a su pantalla
de login ANTES de que Next.js sirviera la página -- el código en
`app/app/page.tsx` que muestra "Necesitás ingresar para subir un
archivo" + `SignInButton` en modal (pensado para que el visitante vea
el formulario primero) era inalcanzable, dead code en la práctica.
**Fix:** se saca `/app` de `isProtectedRoute`, queda solo
`/proyectos(.*)` protegido (ahí sí hay datos de un proyecto real).
Verificado con `curl`: `GET /app` devuelve 200 con el HTML real en vez
de redirect.

**2. No existía forma de volver a un proyecto sin la URL exacta de
`/proyectos/{id}`.** Un usuario que subía un archivo, cerraba la
pestaña y volvía a `/app` no tenía ningún listado de sus proyectos
anteriores -- el producto era de facto de un solo uso por sesión.
**Fix:** nuevo endpoint `GET /projects` (`backend/app/api/projects.py`,
`ProjectListItemResponse` en `schemas.py`) que lista los proyectos del
usuario logueado, más nuevo primero. Nueva función `listProjects()` en
`lib/api.ts` y sección "Tus proyectos" en `app/app/page.tsx` que
renderiza la lista con link directo a cada uno.

**3. La landing y la demo animada afirmaban que "OMI detecta el
módulo, la versión y el país" del archivo subido.** Es falso: el
usuario los elige de dropdowns ANTES de subir (ver `selectedVersion` /
`selectedModule` / `selectedCountry` en `app/app/page.tsx`) -- no hay
ninguna detección automática en el backend. **Fix:** copy corregido en
`app/page.tsx` ("Elegís el módulo...") y en `ProductDemo.tsx` (paso
"Detectar módulo" → "Confirmar módulo", con aclaración visual
"Elegiste esto antes de subir").

**4. El trust point "Tus datos no quedan guardados -- El archivo
original se borra automáticamente" era una promesa de privacidad falsa
en producción.** El código de `_ensure_corrected_file()` en
`projects.py` mantiene explícitamente el archivo original en disco
mientras el módulo exista (comentario en el código: la limpieza
"queda como tarea de limpieza programada aparte, no acá" -- nunca
implementada). Publicar esa promesa expone al producto a un reclamo
de privacidad verificable como falso. **Fix:** reescrito a "Tus
datos, bajo tu control -- se guarda solo mientras el proyecto exista
en tu cuenta, podés pedir el borrado escribiéndonos".

**5. Header sin menú en mobile (nav con `hidden md:flex`, sin
alternativa) y footer sin ningún contacto ni identidad de empresa.**
**Fix:** menú `<details>/<summary>` nativo (sin JS extra, mantiene
`SiteHeader.tsx` como server component) en la landing y en
`SiteHeader.tsx` (compartido por los 12 hubs de contenido).
`SiteFooter.tsx` ahora incluye `hello@alterego.lat` y "un producto de
Alterego" -- antes el footer de todo el sitio no identificaba a la
empresa detrás del producto.

**Pendiente, no resuelto hoy:** pago fiat (Stripe no disponible para
cuentas argentinas sin LLC en EE.UU.; se evalúa Lemon Squeezy en
verificación + Binance Pay como alternativa cripto con polling en vez
de webhook). El MVP lanza con el flujo USDC/MetaMask existente sin
cambios.

**Verificación:** `tsc --noEmit` limpio en frontend, `py_compile`
limpio en los archivos de backend tocados, contenido verificado por
`curl` contra el servidor de desarrollo (HTML servido contiene todos
los textos y componentes nuevos, tanto en `/`, `/app` como en
`/guias`).

**Rollback:** sin migración de DB. `git revert` del commit alcanza;
el endpoint `GET /projects` es aditivo (no rompe nada si se revierte).

## 2026-07-09 — Fix producción: CORS bloqueaba omi.lat por el redirect a www

**Síntoma:** en producción, `omi.lat/app` autenticado mostraba "No se
pudieron cargar los módulos disponibles" con los selectores de
Versión/Módulo vacíos y deshabilitados. El backend estaba sano
(`/health` 200, `/projects/available-combinations` 200 con datos vía
curl directo), lo que hacía parecer un problema de Clerk o de Vercel.

**Causa raíz:** `https://omi.lat` hace un **308 redirect a
`https://www.omi.lat`** (el dominio real donde sirve Vercel). El
browser del usuario, después de seguir ese redirect, manda el fetch a
`/projects/available-combinations` con `Origin: https://www.omi.lat`.
Pero `FRONTEND_URL` en Render solo tenía `https://omi.lat` (sin
`www`), y `CORSMiddleware` en `main.py` solo aceptaba ese único origen
-- el preflight con `Origin: https://www.omi.lat` devolvía `400
Disallowed CORS origin` sin header `access-control-allow-origin`, así
que el browser bloqueaba la respuesta antes de que
`frontend/lib/api.ts` pudiera leerla. Como `authedFetch` colapsa
cualquier falla (red, CORS, timeout) al mismo mensaje genérico, en
pantalla no había forma de distinguir esto de un problema de token de
Clerk. Un chequeo manual con `curl -H "Origin: https://omi.lat"` daba
falso positivo porque ese no es el origen real al que llega el
browser tras el redirect.

**Fix:**
- `app/core/config.py`: `frontend_url` ahora puede traer varios
  orígenes separados por coma; nueva property `frontend_urls` que los
  parsea en una lista.
- `app/main.py`: `CORSMiddleware(allow_origins=settings.frontend_urls)`
  en vez de `[settings.frontend_url]` (que con una coma adentro se
  convertía en un único origen inválido).
- `app/core/error_handling.py`: el handler de errores 500 (que corre
  fuera de `CORSMiddleware` y setea el header a mano) ahora refleja el
  `Origin` real de la request si está en la whitelist, en vez de
  asumir siempre el primero de la lista -- si no, un 500 real con
  Origin `www` hubiera quedado igual de bloqueado.
- **Acción pendiente en Render (no es código):** actualizar
  `FRONTEND_URL` en el dashboard de `omi-backend` a
  `https://omi.lat,https://www.omi.lat` (o al dominio real que
  corresponda) y redeployar.

**Tests:** `tests/test_cors_multi_origin.py` -- un solo origen sigue
funcionando igual que antes, y separado por coma se parsea en una
lista de N orígenes. 149/149 tests pasando.

**Rollback:** sin migración de DB, `git revert` alcanza. Si hace falta
revertir solo la env var, volver a poner `FRONTEND_URL=https://omi.lat`
en Render (aunque eso reintroduce el bug si el dominio real sigue
siendo `www.omi.lat`).

## 2026-07-02 — Fix crítico: validación de `vat` ignoraba el país del proyecto

**Bug:** `format_rules.check()` validaba el campo `vat` contra `CUIT_RE`
(formato argentino `XX-XXXXXXXX-X`) sin importar el país del proyecto.
Un RFC mexicano o un RUT chileno válidos se marcaban como
`invalid_format` en cualquier país que no fuera AR. Afectaba a los 3
módulos con reglas por país (`COUNTRY_SCOPED_MODULES = {"contactos",
"contabilidad", "facturacion"}`).

**Causa raíz:** el dato correcto ya existía en disco -- cada
`rules/{version}/{module}/{country}.json` trae un bloque
`country_rules.tax_id.regex` generado por `rules-generator` (ej. para MX:
`^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$`, label "RFC"). Pero `RuleSchema.__init__`
en `rules_loader.py` no leía esa clave del JSON, así que nunca llegaba al
validador -- un cable sin conectar, no un bug de regex.

**Fix:**
- `rules_loader.py`: `RuleSchema` ahora expone `self.country_rules`
  (`raw.get("country_rules") or {}`).
- `format_rules.py`: `check()` acepta un nuevo parámetro opcional
  `country_rules`. Si trae `tax_id.regex`, se usa esa regex (con el
  `label` del país en el mensaje de error, ej. "no tiene formato de RFC
  válido"). Si no hay regla de país, cae al `CUIT_RE` legacy -- mismo
  comportamiento de antes para AR o países sin l10n reconocido.
  `CUIT_RE` no se eliminó, solo pasó a ser el fallback.
- `validation_engine.py`: el único call site (línea ~351) ahora pasa
  `country_rules=schema.country_rules`.

**Por qué así y no distinto:** cambio mínimo, sin tocar la firma de
ningún otro chequeo de `format_rules.check()`, sin nueva dependencia, sin
cambiar la arquitectura del validation engine. Los módulos sin campo
`vat` relevante (ventas, crm, inventario, productos, compras) no se ven
afectados -- `country_rules` llega vacío (`{}`) en esos schemas y el
`elif column in VAT_FIELDS` ni se evalúa si la columna no está mapeada.

**Tests:** `tests/test_validation_engine.py::TestValidacionVatPorPais`
(4 tests nuevos: CUIT argentino sigue validando igual, RFC mexicano
válido ya no marca error, RUT chileno válido ya no marca error, RFC
mexicano inválido sí sigue marcando error con el mensaje correcto).
Verificado por reversión: revertir el fix temporalmente hace fallar 3 de
los 4 tests nuevos exactamente como se espera; restaurado, 138/138
pasan.

**Rollback:** no hay migración de DB involucrada -- es lógica pura, un
`git revert` del commit alcanza.

## 2026-07-01 — Feature: Data Enrichment Engine — genera campos técnicos seguros (SKU, External ID) sin inventar datos de negocio

**Qué cambia:** nueva etapa del pipeline, DESPUÉS de Validation y
ANTES de Report/Export, completamente independiente (no mezcla
responsabilidades con matching/validation): `app/services/enrichment_engine.py`.

Principio innegociable que se mantiene: OMI nunca inventa información
de negocio (precio, categoría, impuesto, proveedor). Lo nuevo es que
ahora SÍ puede generar, con consentimiento explícito del usuario,
identificadores TÉCNICOS que faltan en el archivo y que Odoo necesita
para un import prolijo:

- **`default_code` (SKU/código interno)** -- secuencial y
  determinístico: `OMI-<MODULO>-NNNNNN`. Solo se ofrece si el modelo
  de Odoo del módulo elegido realmente tiene ese campo.
- **`external_id`** -- formato que Odoo reconoce para imports:
  `omi_import.<modulo>_NNNNNN`. Se ofrece si el archivo no trae
  ninguna columna de External ID (antes solo se *avisaba* que faltaba,
  ver `has_external_id_column()`; ahora, si el usuario lo pide, se
  genera).

**Todo lo generado es**: determinístico (mismo archivo → mismo valor
siempre, nunca `random`/`uuid4`), único y estable dentro del archivo
(secuencial por fila), **100% opt-in** (nunca se aplica sin
confirmación explícita vía el nuevo endpoint), y **auditable**: cada
valor generado queda en un log (`{module}_enriquecimiento.json`,
viaja junto al corregido en el mismo ZIP) con fila, campo, valor
generado y algoritmo usado, y el archivo corregido agrega una columna
`omi_generated_fields` que dice qué se tocó en cada fila -- nunca se
mezcla en silencio con los datos originales del cliente.

**Nuevo endpoint:** `POST /projects/{id}/modules/{mid}/apply-enrichment`
(`{"fields": ["default_code", "external_id"]}`) -- deliberadamente
SEPARADO de `apply-fixes`: "corregir un dato existente" y "generar un
dato técnico que no existía" son decisiones distintas del usuario.
Reusa el mismo patrón de invalidación de cache que ya existía para
fixes manuales y re-uploads (centralizado ahora en
`_invalidate_corrected_cache()`, que también borra el log de
auditoría viejo si quedó desactualizado).

**Reporte:** `ValidationReport` gana `enrichment_opportunities`
(informativo, NO cuenta contra el `quality_score` ni se mezcla con
`issues` -- son campos que se PUEDEN generar, no defectos del
archivo). El reporte PDF ahora incluye una sección listando qué se
podría generar, si aplica.

**Migración de Alembic:** `0007_module_confirmed_enrichments.py`
(revises `0006`) -- agrega `confirmed_enrichments` (JSON, nullable) a
`project_modules`. Puramente aditiva. **Rollback:** `alembic downgrade -1`.

**Nunca se toca**: ningún campo de negocio (precio, categoría,
impuesto, proveedor, cuenta contable) -- el registro de reglas
(`ENRICHMENT_RULES`) es explícito y acotado a `default_code`/`external_id`
a propósito; agregar un enriquecimiento nuevo en el futuro es agregar
una entrada al registro, sin tocar el parser ni el validation engine
(escalable/modular, como pedía el diseño).

**Tests:** `test_enrichment_engine.py` (13, unitarios: generadores
determinísticos, detección no modifica nada, nunca toca columnas de
negocio) + `test_enrichment_api.py` (6, integración end-to-end:
reporte expone oportunidades, endpoint rechaza campos desconocidos,
corregido + log de auditoría en el ZIP, **re-confirmar sin campos
invalida el enriquecimiento previo -- verificado que ese test falla
sin el fix**, revirtiéndolo temporalmente antes de commitear). 134/134
backend pasan, **cero regresiones** en los 115 tests preexistentes.

## 2026-07-01 — Telemetría: cerrando huecos (reporte PDF sin instrumentar, fixes automáticos sin contar)

**Qué cambia:** en la ronda anterior de observabilidad se instrumentó
`ExportGenerated`/`ExportDownloaded` para el ZIP, pero el endpoint del
**reporte PDF** (`GET .../report.pdf`) quedó sin ningún `log_event` --
un hueco real, ya que es un endpoint gratis y de alto uso (no requiere
pago, se puede pedir por cada módulo). Se agrega `PDFGenerated`
(`pdf_size_bytes`). Además, `ValidationFinished` ahora incluye
`auto_fix_count` (cuántos issues se corrigieron solos vs. cuántos
requieren intervención manual) -- no amerita un evento aparte
(`AutoFixApplied`) porque se computa en el mismo momento sobre el
mismo report, así que va como un campo más del mismo evento en vez de
duplicar un `log_event()` por validación.

**Por qué:** encontrado en una revisión fresca de Phase 2 (telemetría)
contra la lista completa de eventos pedida -- el reporte PDF y el
conteo de fixes automáticos habían quedado afuera de la primera
pasada.

**Tests:** `backend/tests/test_observability.py` +2 (`PDFGenerated` se
loguea al descargar el reporte, `auto_fix_count` presente en
`ValidationFinished`). 115/115 backend pasan.

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.

## 2026-07-01 — P1: el JWKS de Clerk se cacheaba para siempre — una rotación de claves tumbaba el login de todos

**Qué cambia:** `_get_jwks()` (`app/core/auth.py`) cacheaba el JWKS de
Clerk en una variable global, poblada una sola vez, sin TTL ni
invalidación. Si Clerk rota sus claves de firma (algo que hacen
periódicamente, es una práctica de seguridad estándar), cualquier
token nuevo firmado con la clave nueva no encontraba su `kid` en el
cache viejo -- el `next()` que busca la clave tira `StopIteration`,
capturado como 401 genérico ("Token de sesión inválido"). **Todos los
logins nuevos habrían empezado a fallar, indefinidamente, hasta
reiniciar el proceso a mano** (lo único que repuebla el cache es un
restart). Fix: si el `kid` no está en el JWKS cacheado, se refresca
una vez antes de rechazar el token -- si la clave es simplemente
nueva, se encuentra; si el token es realmente inválido, ahí sí se
rechaza.

**Por qué:** encontrado en la ronda 2 de hardening operacional (Phase
5, JWT handling) -- es el tipo de falla que es imposible de reproducir
en desarrollo (Clerk no rota claves todos los días) pero causa una
caída total de autenticación en producción el día que sí rota.

**Tests:** nuevo `backend/tests/test_auth_jwks.py` (3 tests: el cache
se reusa entre tokens con el mismo `kid`, un `kid` desconocido
refresca el JWKS una vez y encuentra la clave nueva, un `kid` que no
existe en NINGÚN JWKS sigue devolviendo 401 limpio -- **verificado que
el test de rotación falla sin el fix**, revirtiéndolo temporalmente
antes de commitear). 114/114 backend pasan.

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.

## 2026-07-01 — P1: el worker de pagos podía quedar trabado para siempre si un RPC provider se cuelga

**Qué cambia:** `ChainListener` (`app/workers/payment_listener.py`)
creaba el `Web3.HTTPProvider` sin timeout explícito. `run_forever()` es
single-threaded y secuencial entre Polygon y Base -- si el RPC
provider de una red se cuelga (no rechaza la conexión, simplemente no
responde nunca), la llamada bloqueante nunca retorna, y el worker
entero queda trabado para SIEMPRE sin confirmar pagos en NINGUNA red,
sin ningún error visible en logs (nunca se llega a loguear nada porque
la llamada nunca retorna). Se agrega `request_kwargs={"timeout": 15}`
al `HTTPProvider` -- ahora un RPC colgado dispara un
`requests.exceptions.Timeout`, que ya cae en el `try/except` de
`run_forever()` (logueado como `PaymentListenerPollError`) sin matar
el worker ni bloquear la otra red.

**Por qué:** encontrado en la ronda de hardening operacional (Phase 3,
timeouts) -- es exactamente el tipo de falla silenciosa que la nueva
telemetría de esta misma ronda está pensada para exponer, así que vale
la pena cerrarla de una.

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.

## 2026-07-01 — Observabilidad de producción: request ID, health/readiness real, telemetría de negocio

**Qué cambia:**
- **Correlation ID por request** (`app/main.py`): middleware nuevo que
  genera un `request_id` por request, lo devuelve en el header
  `X-Request-ID`, y loguea una línea de access log (`method`, `path`,
  `status`, `duration_ms`) por cada request -- antes no existía NINGÚN
  log de qué requests llegaban al backend, solo el handler de errores
  no manejados logueaba algo. El `support_id` que ve el usuario en un
  error 500 ahora reusa este mismo `request_id` en vez de generar uno
  aparte, para que sea un solo ID de punta a punta.
- **Header `X-Content-Type-Options: nosniff`** en todas las respuestas
  -- barato, sin downside, protege los endpoints de descarga (ZIP/PDF)
  contra MIME-sniffing.
- **`/health/ready` (nuevo, además de `/health`)**: `/health` sigue
  siendo liveness puro (el proceso responde). `/health/ready` además
  verifica que puede hablar con Postgres (`SELECT 1`) -- antes
  `/health` devolvía `{"status":"ok"}` SIEMPRE, incluso con la base
  caída, así que un deploy con `DATABASE_URL` mal o Postgres caído
  pasaba el health check igual. `render.yaml` ahora apunta
  `healthCheckPath` a `/health/ready`, así Render no manda tráfico real
  a una instancia nueva hasta que puede hablar con la DB de verdad.
- **Telemetría de negocio** (`log_event`, que ya existía pero tenía
  CERO call sites en toda la app): se instrumentan los eventos clave
  del producto -- `ProjectCreated`, `ModuleUploaded`,
  `ValidationStarted`/`ValidationFinished`/`ValidationFailed` (con
  `rows`, `issues`, `quality_score`, `duration_ms`, `rows_per_sec`),
  `LargeFileProcessed` (≥100k filas), `PartnerValidation` (cuentas con
  membresía anual), `ManualFixApplied`, `ExportGenerated`/
  `ExportDownloaded`, `PaymentStarted`/`PaymentConfirmed`, y en el
  worker de pagos: `PaymentListenerStarted`,
  `PaymentListenerPollError`, `UnmatchedPaymentReceived` (reemplazan
  los `print()` sueltos que tenía ese worker, sin ninguna estructura).
  Todos los campos loguean solo metadata (IDs, conteos, duraciones) --
  respeta la regla existente de `safe_logging.py` de nunca loguear
  contenido de archivo/fila/valor de campo.

**Por qué:** antes de esta ronda, un problema en producción (una
validación que tarda demasiado, un pago que no confirma, un archivo
grande que falla) no dejaba NINGÚN rastro diagnosticable -- había que
reproducir el bug a mano para entender qué pasó. Ahora cada evento de
negocio importante queda en logs estructurados, correlacionables por
`request_id`, y Render deja de creer que el backend está sano cuando
en realidad no puede hablar con la base.

**Tests:** nuevo `backend/tests/test_observability.py` (9 tests: header
`X-Request-ID` presente y distinto por request, `nosniff` presente,
`/health/ready` ok y 503 cuando la DB no responde, y que
`ProjectCreated`/`ModuleUploaded`/`ValidationStarted`/
`ValidationFinished`/`PaymentStarted` efectivamente se logueen).
111/111 backend pasan.

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.
Revertir el commit alcanza.

## 2026-07-01 — Feature: membresía anual de partner (activación manual, no autoservicio)

**Qué cambia:** nuevo modo de acceso para partners que quieren
estresar la herramienta con mucho volumen ($499/año, 5M eventos = 5M
filas analizadas). No es un tier más en la landing -- se activa a
mano con un `UPDATE users SET annual_event_limit = 5000000 WHERE
email = '...'` directo en la base de Render (ver README, sección
"Membresía anual de partner"). Con `annual_event_limit` seteado, la
cuenta queda exenta de todo el gating normal de pago
(`can_export_project()` la deja pasar directo) y en cambio se le
cuenta cada fila que pasa por `validate()` contra su cuota anual --
incluso re-validar el mismo archivo cuenta de nuevo (decisión
explícita del producto: mucho más simple que trackear qué filas ya se
cobraron). Se resetea solo al cruzar a un año calendario nuevo. Si un
archivo llevaría la cuenta por encima del límite, esa validación
puntual queda `failed` con mensaje claro, sin cobrar el intento.

**Por qué:** un partner (10 clientes de ~500k filas c/u = 5M filas/año)
necesita poder probar/estresar la plataforma sin las fricciones de los
tiers pensados para un cliente final individual (proyecto gratis único,
$99/proyecto, $149/mes con tope de 5 exportes).

**Migración de Alembic:** `0006_annual_membership.py` (revises `0005`)
-- agrega `annual_event_limit`, `annual_events_used`,
`annual_events_reset_at` a `users`. Puramente aditiva, todas
nullable/con default -- usuarios existentes no se ven afectados
(`annual_event_limit IS NULL` = comportamiento idéntico a antes).
**Rollback:** `alembic downgrade -1` desde `0006`, sin pérdida de datos
relevantes (dropea columnas que solo importan para este modo).

**Tests:** nuevo `backend/tests/test_annual_membership.py` (6 tests:
usuario sin membresía no se ve afectado, validar incrementa el
contador, re-validar el mismo archivo cuenta de nuevo, superar el
límite deja el módulo en `failed` sin incrementar el contador, reset
al cruzar de año, y que la membresía exime del gating normal de
pago/descarga). 102/102 backend pasan.

## 2026-07-01 — BUG P0: confirmar nuevos fixes manuales no invalidaba el corregido ya descargado + validaciones atascadas para siempre si el proceso se reinicia

**P0 -- mismo bug de fondo que el de re-subir con el mismo nombre,
esta vez disparado por el flujo de fixes manuales:** `apply_module_fixes`
(`backend/app/api/projects.py`) guardaba `confirmed_manual_fixes` en
la DB pero nunca invalidaba el `.corrected.csv` ya generado en disco.
Secuencia real: validar → descargar (genera el cache) → volver y
confirmar un fix manual NUEVO vía "Aplicar fix" → descargar de nuevo
→ la segunda descarga servía en silencio el corregido VIEJO, sin el
fix que el usuario acababa de confirmar. **Verificado que el test de
regresión falla sin el fix** (revirtiendo el cambio temporalmente).

**Fix, en dos partes:**
1. `apply_module_fixes` ahora borra el `.corrected.csv` cacheado (si
   existe) al confirmar fixes, igual que ya hacía `upload_module` al
   re-subir.
2. Esto exponía un problema más de fondo: `_ensure_corrected_file`
   borraba el archivo ORIGINAL apenas generaba el corregido por primera
   vez ("zero-retention"). Sin el original, invalidar el cache no
   alcanzaba -- la regeneración fallaba con `FileNotFoundError` en vez
   de servir los datos correctos. Se deja de borrar el original: ahora
   persiste mientras el módulo exista, para que siempre se pueda
   regenerar el corregido con los fixes más recientes. La limpieza de
   archivos de proyectos abandonados (nunca descargados) queda como
   tarea de limpieza programada aparte (backlog P2 -- no existe hoy
   ningún cron de limpieza en este proyecto).

**P1 -- validación trabada para siempre si el proceso se reinicia:**
si Render reinicia/redeploya el proceso web mientras
`_run_validation_job` corre en background (un archivo grande puede
tardar minutos), el `except` que marca `status=failed` nunca llega a
ejecutarse -- el módulo quedaba en "validating" indefinidamente, sin
ningún cron que lo detecte, y el usuario solo veía un spinner infinito
sin ninguna señal de error. Fix: `GET .../validate-status` ahora
detecta si `validating` lleva más de 15 minutos desde
`validation_started_at` y lo marca `failed` con un mensaje claro -- el
frontend ya tenía un botón "Reintentar" para el estado `failed` (y
otro por estancamiento del lado del cliente a los 10'), así que esto
cierra el círculo sin tocar nada del lado del frontend.

**Tests:** `test_confirmar_un_nuevo_fix_invalida_el_corregido_ya_generado`
(`test_apply_fixes.py`, verificado que falla sin el fix),
`test_validating_atascado_pasado_el_timeout_se_marca_failed` y
`test_validating_reciente_no_se_marca_failed` (`test_validate_async.py`).
96/96 backend pasan.

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.

## 2026-07-01 — BUG P0: re-subir un archivo con el mismo nombre podía servir datos VIEJOS en la descarga + duplicados no detectaban mayúsculas/espacios

**P0 -- corrupción de datos silenciosa, el más serio encontrado en toda
la sesión:** `_ensure_corrected_file` (`backend/app/api/projects.py`)
cachea el archivo corregido en disco como
`storage_path.with_suffix(".corrected.csv")` y lo devuelve tal cual si
ya existe, sin regenerarlo. `storage_path` se arma como
`f"{project.id}_{module_id}_{file.filename}"` -- si el usuario
re-sube un archivo NUEVO para el mismo módulo pero con el MISMO NOMBRE
DE ARCHIVO que la vez anterior (algo extremadamente común: re-exportar
desde Odoo/Excel siempre genera "contactos.csv"), `storage_path` da
IDÉNTICO al de antes. Si ya existía un `.corrected.csv` de una
descarga previa de ese módulo bajo esa ruta, la próxima descarga
servía en silencio los datos del archivo VIEJO en vez del nuevo -- en
una herramienta cuyo propósito es preparar datos para importar a
Odoo, esto es corrupción de datos real: el cliente podía terminar
important registros de una versión anterior y descartada del archivo.

**Fix:** al re-subir un módulo existente, se borra el
`.corrected.csv` viejo (si existía) ANTES de sobreescribir
`storage_path`, así `_ensure_corrected_file` se ve obligado a
regenerarlo desde el archivo nuevo la próxima vez que se pida.

**P1 -- detección de duplicados no ignoraba mayúsculas/espacios:**
`check_duplicates()` (`backend/app/services/format_rules.py`)
comparaba con `str(value).strip()` -- "ABC-123" y "abc-123" (típico en
`default_code`/SKU) no se marcaban como duplicados, dejando pasar dos
registros que Odoo terminaría tratando como entidades distintas. Fix:
se normaliza a minúsculas y se colapsan espacios internos antes de
comparar (el mensaje de error sigue mostrando el valor original, sin
normalizar, para no confundir al usuario).

**Tests:** nuevo
`test_re_subir_mismo_nombre_de_archivo_no_sirve_el_corregido_viejo`
(reproduce el bug end-to-end: sube, valida, paga, descarga, re-sube
con MISMO nombre pero datos distintos, valida, descarga de nuevo,
confirma que el contenido es el nuevo y no el viejo -- **verificado que
falla sin el fix, revirtiendo el cambio temporalmente antes de
commitear**) + `test_duplicado_se_detecta_ignorando_mayusculas_y_espacios`.
93/93 backend pasan.

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.

## 2026-07-01 — P1: pago no resumible si se cierra la pestaña + tope de pagos pendientes por usuario

**P1 -- riesgo de doble pago real en USDC:** el estado del pago
(`payment_id`, monto, dirección) vivía solo en `useState` de
`PaywallPanel.tsx`. Si el usuario cerraba la pestaña o recargaba
mientras esperaba la confirmación on-chain (puede tardar minutos), y la
transferencia se confirmaba en background mientras estaba ausente, al
volver no había forma de ver "ya pagaste" -- el único camino visible
era iniciar un pago NUEVO, arriesgando pagar dos veces de verdad en
USDC (dinero real, no reversible).

**Fix:** el resultado de `startPayment()` se persiste en
`localStorage` (`omi_pending_payment_{projectId}`). Al montar el
componente, si hay un pago guardado sin expirar, se consulta su estado
(`GET /payments/{id}/status`) antes de mostrar la pantalla de elegir
plan -- si ya confirmó, va directo a "Pago confirmado"; si sigue
pendiente, retoma el polling donde lo dejó; si expiró, se limpia y
sigue el flujo normal. Se limpia el localStorage al confirmar, expirar,
o al tocar "Intentar de nuevo".

**P1 -- sin tope de pagos pendientes simultáneos:** `POST
/payments/start` no tenía ningún límite por usuario -- un usuario
autenticado podía spamear el endpoint y consumir gran parte del pool
finito de montos únicos que genera `generate_unique_amount()`,
disparando el 503 de "no se pudo generar un monto único" (agregado en
el fix anterior) para otros usuarios legítimos. Se agrega un tope de 3
pagos PENDIENTES simultáneos por usuario (count query simple contra la
misma tabla, sin Redis ni slowapi) -- devuelve 429 con mensaje claro si
se supera.

**Tests:** nuevo `backend/tests/test_payments.py` (3 tests: pago normal
funciona, el 4to pago pendiente se rechaza con 429, un pago ya
confirmado no cuenta para el tope). 91/91 backend pasan. Frontend
typecheck limpio (`npx tsc --noEmit`).

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.

## 2026-07-01 — BUG P0: borrar una cuenta de Clerk rompía el webhook + race condition en el monto único de pago

**P0 #1 -- `user.deleted` nunca se completaba de verdad:**
`backend/app/api/webhooks.py` hacía `db.delete(user)` directo apenas
Clerk avisaba que se borró una cuenta. `Project.owner_id` y
`Payment.user_id` son FK `NOT NULL` sin `ondelete` ni cascade
configurado (`db_models.py:88,178`) -- así que borrar cualquier usuario
que alguna vez creó un Proyecto o un Pago disparaba un
`IntegrityError` sin manejar: 500 sin capturar, y Clerk reintentando el
webhook para siempre. El borrado de cuenta **nunca se completaba**
para ningún usuario real (todos tienen al menos un proyecto).

**Fix:** en vez de borrar la fila, se anonimiza -- se reemplaza el
email por un placeholder (`deleted-{clerk_id}@deleted.omi.lat`), el
único dato personal identificable en este modelo, y se preserva la fila
para no romper la integridad referencial ni perder el historial de
pagos/proyectos (que además tiene valor contable).

**P0 #2 -- race condition en el monto único de pago:**
`generate_unique_amount()` (`backend/app/services/payment_matching.py`)
hace un SELECT ("¿este monto ya está en uso?") y el INSERT llega
después, en el caller (`payments.py`, `POST /payments/start`) -- sin
nada que lo proteje a nivel de DB. Dos requests concurrentes podían
elegir el mismo monto candidato antes de que cualquiera comiteara,
resultando en dos Payments PENDING con el mismo
`expected_amount_usd` -- rompiendo la premisa central del diseño (el
monto único es lo que identifica a qué Payment corresponde una
transferencia entrante on-chain).

**Fix:** índice único PARCIAL sobre `expected_amount_usd` (solo para
`status='pending'` -- migración `0005`, no rompe la reutilización
legítima de montos una vez que un Payment se confirma o expira) +
retry-on-conflict en `POST /payments/start` (hasta 5 intentos con un
monto nuevo si choca contra el índice, en vez de un 500).

**Migraciones de Alembic:** `0005_unique_pending_amount.py` (revises
`0004`) -- `CREATE UNIQUE INDEX ix_payments_pending_amount_unique ON
payments (expected_amount_usd) WHERE status = 'pending'`. **Rollback:**
`alembic downgrade -1` desde `0005` (dropea el índice, no toca datos).

**Tests:** 88/88 backend siguen pasando (los tests usan
`Base.metadata.create_all`, no corren migraciones de Alembic
directamente -- la sintaxis del índice parcial se verificó a mano
contra SQLite antes de commitear).

## 2026-07-01 — BUG P0: upload de archivos podía agotar la memoria del dyno + defensa contra pago duplicado

**P0 encontrado en auditoría:** `POST /projects/{id}/modules`
(`backend/app/api/projects.py`, `upload_module`) hacía `contents =
await file.read()` -- leía el archivo COMPLETO a memoria ANTES de
chequear el límite de tamaño (`max_upload_size_mb`, 25MB por defecto).
Starlette/FastAPI no limitan el tamaño del body por defecto, así que un
upload de varios GB (malicioso o por error) podía agotar la memoria
del dyno web de Render antes de llegar siquiera al 413 -- y ese dyno
sirve a TODOS los usuarios conectados en ese momento, no solo al que
subió el archivo.

**Fix:** se lee en chunks de 1MB con `file.read(chunk_size)` en un
loop, cortando con 413 apenas se supera `max_upload_size_mb` sin seguir
leyendo el resto del archivo.

**Tests:** nuevo `test_archivo_que_supera_el_limite_se_rechaza_con_413`
en `backend/tests/test_projects_multimodule.py` (baja el límite a ~1
byte vía monkeypatch para no tener que generar un archivo real
gigante).

**Además, defensa en profundidad para pagos (P1, no explotado
todavía):** el listener de pagos cripto
(`backend/app/workers/payment_listener.py`) solo chequeaba "¿ya existe
un Payment con este tx_hash?" a nivel de aplicación, sin ningún
constraint de DB de respaldo. Hoy el listener corre secuencial y de a
un solo proceso, así que el riesgo real es bajo, pero si en el futuro
se escalara a más de un worker (o corriera una segunda instancia por
error durante un deploy), dos instancias podrían procesar el mismo
evento de blockchain y, para pagos de suscripción, duplicar la
extensión de `subscription_expires_at` (60 días en vez de 30). Se
agrega un índice único sobre `payments.tx_hash` (migración de Alembic
`0004`, ver abajo) y un `try/except IntegrityError` en el listener que
trata una colisión como "ya lo procesó otra instancia", no como error.

**Migración de Alembic:** `0004_unique_tx_hash.py` (revises `0003`) --
`CREATE UNIQUE INDEX ix_payments_tx_hash_unique ON payments (tx_hash)`.
Es compatible con filas existentes: `tx_hash` es nullable y Postgres no
considera dos NULLs iguales para un índice único, así que los Payments
pendientes sin tx_hash todavía conviven sin problema. **Rollback:**
`alembic downgrade -1` desde `0004` (dropea el índice, no toca datos).

## 2026-07-01 — BUG P0: race condition en la cuota de exportes (bypass de pago)

**Encontrado en auditoría, no reportado por usuarios:** `GET
/projects/{id}/download` (`backend/app/api/projects.py`) chequeaba
`can_export_project()` y recién después, en un paso separado sin lock,
incrementaba `user.monthly_export_count` (o marcaba
`user.free_project_used`) en el mismo commit. El comentario del código
decía "atómico, evita doble conteo en un retry" pero no lo era: dos
requests concurrentes a `/download` (doble click, retry por timeout de
red, o abuso deliberado en paralelo) podían leer la misma cuota
disponible (`monthly_export_count < 5` o `free_project_used == False`)
ANTES de que cualquiera de las dos comiteara el incremento -- ambas
pasaban, y el contador solo subía una vez (el incremento de Python
`+=` se computa sobre un valor en memoria potencialmente stale, no es
un `UPDATE ... SET count = count + 1` atómico de SQL). Resultado: un
usuario podía obtener exportes ilimitados más allá de su cuota pagada
o de su proyecto gratis con requests en paralelo -- un bypass de pago
real en la única función que monetiza el producto.

**Fix:** `download_project` ahora toma un row lock real sobre la fila
del usuario (`db.query(User)...with_for_update()`) ANTES de llamar a
`can_export_project()`, y lo mantiene hasta el `commit()` que persiste
el incremento -- una segunda request concurrente queda bloqueada por
Postgres hasta que la primera termina su transacción, y ve el contador
ya actualizado. En SQLite (tests) `with_for_update()` es un no-op
inofensivo (SQLite no soporta locking de filas, pero ya serializa
escrituras a nivel de archivo), así que no rompe la suite existente.

**Tests:** nuevo `test_download_bloquea_la_fila_del_usuario_para_evitar_doble_conteo`
en `backend/tests/test_entitlements_quota.py` -- confirma que el
endpoint efectivamente invoca `with_for_update()` antes de decidir si
el export está permitido. 87/87 tests pasan.

**Rollback:** sin cambios de schema -- no aplica rollback de Alembic.
Revertir el commit alcanza (el `with_for_update()` es puramente lógica
de aplicación, no toca la DB).

## 2026-07-01 — BUG P0: el botón de descarga no funcionaba (sin auth header) + reporte PDF

**Bug encontrado de paso, no buscado:** al integrar el botón de
descarga del nuevo reporte PDF, se encontró que el botón de descarga
del ZIP (`<a href={downloadUrl(projectId)}>` en `PaywallPanel.tsx`) es
una navegación de browser plana, SIN el header `Authorization`. El
backend (`GET /projects/{id}/download`) exige JWT de Clerk vía Bearer
token (`HTTPBearer`, sin fallback de cookie de sesión en ningún
endpoint de este backend) -- así que un click en "Descargar archivo
corregido" devolvía 401/403 en vez de descargar el archivo. **El
workflow central de todo el producto (pagar y descargar) estaba roto.**

**Fix:** nuevo `triggerAuthedDownload(getToken, url, filename)` en
`frontend/lib/api.ts` -- trae el archivo con `fetch()` (que sí puede
llevar el header), arma un blob, y dispara la descarga con un `<a>`
temporal apuntando a un `blob:` URL. `PaywallPanel.tsx` ahora usa esto
en vez de un `<a href>` directo.

**Qué más cambia:** nuevo endpoint `GET
/projects/{id}/modules/{mid}/report.pdf` (`backend/app/services/report_pdf.py`,
con `reportlab` -- pure Python, sin dependencias nativas de sistema,
seguro para el build de Render a diferencia de WeasyPrint) -- informe
técnico (no "bonito": sin logos ni colores de marca) con el mismo
contenido que el reporte JSON: resumen, desglose del quality score,
mapeo de columnas, columnas ignoradas, detalle de hasta 200 issues.
Gratis (mismo gate que ver el reporte en pantalla, no requiere pago).
Botón "Descargar reporte (PDF)" en el header del reporte de cada
módulo -- usa el mismo `triggerAuthedDownload()`.

**Por qué:** era el ítem #5 acordado ("reporte PDF profesional... un
informe técnico que un Partner pueda enviar directamente al cliente").
El bug de auth se encontró de casualidad al recablear el botón de
descarga para el PDF -- de no ser por eso, hubiera seguido sin
detectarse.

**Tests:** `TestReportePdf` en `backend/tests/test_projects_multimodule.py`
(PDF válido tras validar, 404 sin validar).

**Sin cambios de schema** -- no aplica rollback de Alembic. Nueva
dependencia de Python (`reportlab==4.2.5`, agregada a
`requirements.txt`) -- sin impacto en el build de Render (pure Python).

---

## 2026-07-01 — Detección/explicación de External ID (sin generarlos)

**Qué cambia:** nuevo `has_external_id_column()` en
`backend/app/services/column_matcher.py` -- detecta si el archivo trae
una columna de External ID de Odoo (headers típicos: "id", "External
ID", "ID Externo", "xml_id", etc., ver `_EXTERNAL_ID_HEADERS`).
`ValidationReport` expone `has_external_id: bool`. En el frontend, si
falta y el archivo no tiene mismatch estructural, se muestra un panel
explicando qué es un External ID, por qué importa (Odoo lo usa para
saber "este registro ya existe, actualizalo" en vez de duplicarlo), y
cuándo conviene agregarlo (si vas a reimportar el mismo archivo más de
una vez).

**Por qué:** era la recomendación #1 de la segunda auditoría de
producto de esta sesión y del refinamiento del usuario ("el siguiente
gran diferencial de OMI... no digo que OMI tenga que generarlos, pero
sí debería detectar/explicar/advertir"). Alcance deliberadamente
acotado: OMI NO genera External IDs (dependen del sistema de origen
del cliente), solo detecta su ausencia y explica el riesgo real de
reimportar sin ellos (duplicados en Odoo).

**Tests:** `TestExternalIdDetection` en
`backend/tests/test_validation_engine.py` (sin columna = False, "id"
literal = True, "ID Externo" en español = True).

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Desglose del Quality Score + checklist post-descarga

**Qué cambia:**
1. `_compute_quality_score()` (`backend/app/services/validation_engine.py`)
   ahora devuelve también `quality_score_breakdown`: una lista de
   `{issue_type, rows_affected, points_deducted}` que explica QUÉ restó
   puntaje. Cada fila con problema manual se atribuye a un solo
   `issue_type` (el de mayor prioridad, ver `_ISSUE_TYPE_PRIORITY`) para
   que la suma del desglose coincida exactamente con el descuento total
   -- una fila con 2 problemas distintos no debía restar doble. Se
   muestra en el reporte, debajo del badge de calidad.
2. Nuevo `PostDownloadChecklist` en `frontend/components/PaywallPanel.tsx`
   -- una checklist estática (backup, modo desarrollador, orden de
   importación, impuestos/listas de precio, multi-compañía, probar con
   un lote chico) que aparece junto al botón de descarga.

**Por qué:** ambos surgieron de la segunda auditoría de producto de
esta sesión (persona "OMI Product Auditor" + refinamiento del usuario)
-- "un número solo sirve para marketing, un número con desglose sirve
para trabajar", y el momento de mayor riesgo real (la importación en
Odoo) es justo donde el producto se desentendía sin dar ninguna guía.
Se descartó explícitamente ir más allá (ej. conectarse a Odoo para
ejecutar la importación) -- ver discusión en el mismo hilo: OMI prepara
y valida, la importación sigue siendo responsabilidad del usuario/partner.

**Tests:** `TestQualityScore` extendido en
`backend/tests/test_validation_engine.py` (la suma del desglose
coincide con el descuento total; una fila con 2 tipos de problema
distintos se cuenta una sola vez).

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Modal de Clerk seguía oscuro con el SO en modo oscuro

**Qué cambia:** `frontend/app/globals.css` declara `color-scheme: light`
en `html`.

**Por qué:** el theming de `appearance.variables`/`appearance.elements`
del `ClerkProvider` (arreglado en la Fase 1 de esta sesión) ya forzaba
fondo blanco y texto oscuro vía CSS de autor -- pero sin declarar
`color-scheme`, el navegador sigue su default (`light dark`) y pinta
los CONTROLES NATIVOS de formulario (inputs, selects, checkboxes,
incluidos los del modal de Clerk) con el render "dark" de la interfaz
del sistema operativo si el usuario tiene el SO en modo oscuro -- esto
pasa a nivel del motor de renderizado nativo del navegador, no del CSS
de fondo/color de la página, así que ningún override de `elements` lo
tapaba. Es el bug clásico "mi sitio claro muestra inputs oscuros en
modo oscuro del SO". OMI no tiene (ni tenía planeado) modo oscuro, así
que forzar `light` es correcto para todo el sitio, no solo para Clerk.

**Nota:** no se pudo verificar visualmente en este entorno (el sandbox
no puede resolver `localhost` en el navegador de preview, limitación ya
confirmada antes en esta sesión) -- pedir confirmación visual en
producción con el SO en modo oscuro.

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Índice de calidad del archivo (quality_score)

**Qué cambia:** nuevo `quality_score: int` (0-100) en `ValidationReport`
(`backend/app/services/validation_engine.py`), calculado como
`100 - % de filas con al menos un problema que requiere revisión
manual`. Los fixes automáticos no restan puntaje (ya están resueltos).
`structural_mismatch` da 0 directo (el archivo no corresponde al
módulo). Se propaga en `ValidationReportResponse` y en
`ModuleSummaryResponse` (para verlo en el resumen del proyecto sin
abrir el reporte completo). En el frontend, nuevo badge "Calidad:
X/100" en el header del reporte de cada módulo (verde ≥90, ámbar ≥60,
rojo por debajo).

**Por qué:** era el ítem #7 del roadmap nuevo acordado con el usuario
("índice de calidad del archivo") -- un número único le da al usuario
(pensando como Odoo Partner) una primera impresión del estado de la
migración sin tener que leer fila por fila el reporte completo.

**Tests:** `TestQualityScore` en
`backend/tests/test_validation_engine.py` (archivo limpio = 100,
mismatch estructural = 0, mitad de filas con problema manual = 50, fix
automático no resta puntaje).

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — PaywallPanel no saltaba el pago para suscriptores con cuota disponible

**Qué cambia:** `PaywallPanel.tsx` ahora consulta también
`has_active_subscription` y `monthly_export_count`/`monthly_export_limit`
de `GET /users/me` -- si el usuario ya tiene una suscripción activa con
cuota disponible este mes, el panel muestra directo la opción
"Tu suscripción (X/5)" y un botón "Descargar" que salta el flujo de
USDC (igual que ya pasaba con el proyecto gratis), en vez de ofrecerle
pagar $149 de nuevo por una suscripción que ya tiene.

**Por qué:** gap real detectado y anotado como tarea aparte a mitad de
esta sesión (spawn_task) mientras se armaba el rediseño de tiers de
precio (Fase 3) -- el backend (`can_export_project()`) ya autorizaba
la descarga gratis para un suscriptor con cuota, pero el frontend
siempre mostraba el flujo completo de pago con wallet, sin detectar
que ya estaba cubierto. Un suscriptor activo podía terminar pagando
(o intentando pagar) por algo que ya tenía incluido.

**Sin cambios de backend ni de schema** -- no aplica rollback de
Alembic.

---

## 2026-07-01 — Detección de duplicados no funcionaba con headers en español

**Qué cambia:** `check_duplicates()` en
`backend/app/services/format_rules.py` ahora recibe `column_mapping`
(columna del archivo → campo técnico) en vez de la lista cruda de
headers, y busca duplicados en la columna real del archivo que mapea a
cada campo único conocido (`vat`, `default_code`, `code`, `barcode`).

**Por qué:** exactamente el mismo bug que ya se encontró y arregló dos
veces esta sesión para otras partes del motor (columnas requeridas
faltantes, mapeo de columnas) -- `check_duplicates` comparaba los
headers crudos del archivo contra nombres técnicos (`"CUIT" in
{"vat", ...}` es `False`), así que un archivo con headers en español
(el caso normal, no el raro) nunca activaba la detección de CUIT/SKU
duplicado, silenciosamente.

**Fix:** `check_duplicates(df, column_mapping)` construye
`field_to_col` (técnico → columna real) y valida sobre esa columna.

**Tests:** `test_duplicado_se_detecta_con_header_en_espanol` en
`backend/tests/test_validation_engine.py`.

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Confidence score en el matching de columnas

**Qué cambia:** `match_columns()` en
`backend/app/services/column_matcher.py` se separó en
`match_columns_with_confidence()`, que devuelve además con qué nivel
se hizo cada match: `"exact"` (nombre técnico literal), `"synonym"`
(diccionario de sinónimos en español) o `"fuzzy"` (similitud de texto,
el único no-determinista). `match_columns()` se mantiene como wrapper
compatible para no romper el único call site existente.
`ValidationReport` expone el nuevo campo `column_match_confidence`
(dict columna→nivel), propagado en el reporte serializado y en
`ValidationReportResponse`. En el frontend, `ColumnMappingPanel` marca
con un badge "revisar" las columnas que matchearon por fuzzy.

**Por qué:** era el ítem #2 del roadmap nuevo acordado con el usuario
("confidence score"). Un match "fuzzy" (ej. una variante de header no
prevista en el diccionario de sinónimos) puede estar equivocado -- sin
distinguirlo de un match exacto/sinónimo, el usuario no tenía forma de
saber cuáles vale la pena revisar a ojo en el panel de mapeo de
columnas (agregado hoy mismo, ver entrada anterior).

**Tests:** `TestColumnMatchConfidence` en
`backend/tests/test_validation_engine.py` (exact/synonym/fuzzy).

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Mostrar el mapeo de columnas en el reporte (antes invisible)

**Qué cambia:** nuevo panel colapsable "Cómo interpretamos las
columnas de tu archivo" en `ModuleReportView`
(`frontend/app/proyectos/[id]/page.tsx`), con dos listas: columnas
reconocidas (`"Nombre" → name`) y columnas ignoradas (no matchean
ningún campo conocido).

**Por qué:** `column_mapping` y `unmatched_columns` ya venían del
backend en el reporte desde el rediseño original -- pero nunca se
mostraban en ningún lado del frontend. El usuario no tenía forma de
confirmar que "Nombre" se interpretó como `name` y no, por ejemplo,
quedó ignorado por un typo en el header. Era el ítem #3 del roadmap
nuevo acordado con el usuario ("columnas no mapeadas explicadas") --
resultó ser trabajo 100% de frontend, los datos ya estaban ahí.

**Sin cambios de backend ni de schema** -- no aplica rollback de
Alembic.

---

## 2026-07-01 — Normalización numérica regional (decimal "," de LatAm/ES)

**Qué cambia:** nuevo `_parse_regional_number()` en
`backend/app/services/format_rules.py`, usado en vez de `float()` a
secas para validar `PRICE_FIELDS` y `STOCK_FIELDS`. Entiende
"1.234,56" (miles con punto, decimal con coma -- formato es-AR/es-ES) y
"1,234.56" (formato EE.UU.), decidiendo cuál separador es el decimal
según cuál aparece más a la derecha.

**Por qué:** mismo patrón de bug que ya se arregló para el separador
de CSV y el encoding del archivo -- un archivo exportado con
configuración regional LatAm escribe los precios como "1.234,56", y
`float("1.234,56")` tira `ValueError`. Un precio perfectamente válido
se reportaba como "no es un número válido para 'list_price'", un falso
positivo justo en el caso más común (nadie exporta con formato
numérico de EE.UU. desde una PC configurada en español).

**Tests:** `TestNormalizacionNumericaRegional` en
`backend/tests/test_validation_engine.py` (formato LatAm con miles,
solo decimal, formato EE.UU., negativo en formato LatAm, texto
realmente inválido sigue siendo error).

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Aviso de dependencia faltante entre módulos del proyecto

**Qué cambia:** `GET /projects/{id}` ahora incluye
`missing_dependencies: string[]` por módulo -- las dependencias
conocidas (ver `module_dependencies.py`) que NO están presentes en el
mismo proyecto. En el frontend, si algún módulo tiene dependencias
faltantes, se muestra un aviso no bloqueante debajo de las tabs de
módulos (ej. "crm suele depender de contactos...").

**Por qué:** extensión natural del fix de orden de importación en el
ZIP (mismo día) -- si un usuario sube "ventas" sin haber subido
"contactos" en el mismo proyecto, hoy no hay forma de que se entere
antes de exportar. Es informativo, no bloqueante (puede estar migrando
contactos por separado, o va a agregar el módulo después).

**Tests:** `TestMissingDependenciesEnResumenDeProyecto` en
`backend/tests/test_projects_multimodule.py`.

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Orden de importación recomendado en el ZIP de descarga

**Qué cambia:** nuevo `backend/app/services/module_dependencies.py`
con un mapa estático de dependencias entre los 6 módulos que soporta
OMI hoy (`contactos`, `productos` sin dependencias; `crm` depende de
`contactos`; `inventario` de `productos`; `ventas`/`compras` de
`contactos` y `productos`). `GET /projects/{id}/download` ahora ordena
los archivos del ZIP según ese orden topológico y los numera
(`01_contactos_corregido.csv`, `02_crm_corregido.csv`, ...) en vez de
alfabético.

**Por qué:** era el ítem #1 del roadmap nuevo acordado con el usuario
("dependencias entre módulos") y también el ítem 11 del backlog
("dependencias/orden de importación multi-archivo dentro del ZIP").
Importar "ventas" antes que "contactos" en Odoo hace que cada pedido
con un partner nuevo se rechace o importe con la relación vacía,
porque ese contacto todavía no existe -- el orden alfabético del ZIP no
reflejaba esto para nada, y un Odoo Partner tenía que darse cuenta solo.

**Alcance de esta primera versión:** solo reordena/numera los archivos
del ZIP -- no bloquea ni advierte todavía si falta un módulo del que
otro depende (ej. subir "ventas" sin "contactos" en el mismo proyecto).
Eso queda para una iteración futura si se valida que hace falta.

**Tests:** `backend/tests/test_module_dependencies.py` (orden
topológico, múltiples dependientes, módulo sin mapear no rompe) +
`TestDescargaMultiModulo` actualizado para verificar el numerado.

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Fallback de encoding cp1252 para CSV (LatAm/Excel Windows)

**Qué cambia:** `_read_tabular_file()` en `backend/app/api/projects.py`
ahora intenta leer el CSV como `utf-8-sig` primero (UTF-8 con o sin
BOM) y, si eso falla con `UnicodeDecodeError`, reintenta con
`cp1252` antes de dar error.

**Por qué:** un export de Excel en Windows guardado como "CSV" (no
explícitamente "CSV UTF-8") usa cp1252/Latin-1 por default -- muy
común en archivos LatAm con acentos o "ñ". `_detect_csv_separator()`
ya toleraba esto (`errors="replace"`, solo para sniffear el
separador), pero `pd.read_csv()` no tenía encoding explícito y caía en
el UTF-8 default de pandas, rompiendo con un mensaje genérico de
"columnas desparejas" que no apuntaba al problema real.

**Fix:** intento en cascada utf-8-sig → cp1252, y mensaje de error
actualizado para mencionar encoding explícitamente si ambos fallan.

**Tests:** `backend/tests/test_projects_multimodule.py::TestArchivoConEncodingCP1252`
(CSV con "José Muñoz" codificado en cp1252 se valida y previsualiza
correctamente).

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Aviso no bloqueante: contacto sin email ni teléfono

**Qué cambia:** nuevo `issue_type: "missing_contact_info"` en
`validate_dataframe()` (`backend/app/services/validation_engine.py`) --
si el modelo tiene campos `email`/`phone`/`mobile` mapeados y una fila
no tiene ninguno de los tres cargado, se agrega un issue informativo
(`fix_is_automatic: false`, sin `suggested_fix`).

**Por qué:** ninguno de esos 3 campos es `required` en el schema de
Odoo (la constraint real es de negocio, no de la API), así que hoy un
contacto sin ningún dato de contacto pasa la validación con "0
errores" -- técnicamente válido para importar, pero inútil en la
práctica (nadie puede contactarlo). Era el ítem "alerta no bloqueante
para campos críticos vacíos" del backlog de este mismo archivo.

**No bloquea nada:** igual que el resto de los issues, no afecta
`can_export_project()` ni el gate de pago -- es puramente informativo
en el reporte, agrupado junto al resto bajo la etiqueta "Sin datos de
contacto" en `frontend/app/proyectos/[id]/page.tsx`.

**Tests:** `backend/tests/test_validation_engine.py::TestMissingContactInfo`
(fila sin ninguno de los 3 campos dispara el aviso; fila con solo
teléfono no lo dispara).

**Sin cambios de schema** -- no aplica rollback de Alembic.

---

## 2026-07-01 — Confirmación extra antes de "Aplicar a todas" en valores negativos

**Qué cambia:** el botón "Aplicar a todas" del grupo `negative_value`
(precio o stock negativo) ahora pide una confirmación extra
(`window.confirm`) antes de aplicar el fix automático (`abs(valor)`) a
todas las filas del grupo de una sola vez.

**Por qué:** ya estaba documentado en el backlog del CHANGELOG (sección
"Otras ideas", ítem 10) como riesgo real: un precio negativo puede ser
una nota de crédito legítima, no siempre un error. Con un solo click en
"Aplicar a todas" sobre un grupo de miles de filas, se puede convertir
notas de crédito reales en ventas positivas sin que el usuario se dé
cuenta -- un bug de negocio silencioso, no un error de código.

**Fix:** en `frontend/app/proyectos/[id]/page.tsx`, `onToggleGroup`
ahora recibe también `issue_type`; si es `negative_value` y se está
pasando de "nada seleccionado" a "todo seleccionado", se muestra un
`window.confirm` con el conteo de filas afectadas antes de aplicar.
Los toggles individuales por fila (sin pasar por "aplicar a todas") no
llevan esta confirmación extra porque ahí el usuario ya está revisando
caso por caso.

**Sin cambios de schema ni de backend** -- no aplica rollback de
Alembic.

---

## 2026-06-30 — Fase 4: progreso real de validación (async + polling)

**Qué cambia:** antes, `POST /validate` corría el motor de validación
100% sincrónico -- la request HTTP quedaba colgada hasta terminar, y el
frontend solo mostraba "Analizando tu archivo..." estático, sin ninguna
señal de que no se había colgado con un archivo de 150.000 filas.

**Backend:**
- `validate_dataframe()` (`validation_engine.py`) gana un parámetro
  `on_progress: Callable[[int, int], None] | None` -- se llama cada
  `max(500, total//100)` filas (no en cada una, para no pagar un
  commit a DB por fila) y una vez más al terminar.
- `POST /projects/{id}/modules/{mid}/validate` ahora es asíncrono:
  marca `status=validating`, dispara `_run_validation_job()` vía
  `BackgroundTasks` de FastAPI, y devuelve `202` de inmediato (antes
  devolvía `200` con el reporte completo -- rompe cualquier cliente que
  esperara la forma vieja).
- `_run_validation_job()` corre después de que la response ya se
  mandó, abre su PROPIA sesión de DB (`SessionLocal()`, no puede reusar
  la del request), persiste `rows_processed`/`rows_total` en cada
  callback de progreso, y en cualquier excepción deja
  `status=failed` + `validation_error` -- nunca un módulo trabado en
  "validating" para siempre.
- Nuevo `GET /projects/{id}/modules/{mid}/validate-status` ->
  `{status, rows_processed, rows_total, started_at, error}`, para que
  el frontend haga polling.

**Frontend** (`proyectos/[id]/page.tsx`): el párrafo estático se
reemplaza por `<ValidationProgress>`, que hace polling cada 1.5s y
muestra "Fila X de Y" + barra de progreso + mensajes rotativos
tranquilizadores + tiempo transcurrido. Si `status` da `failed`, o pasan
más de 10 minutos sin terminar (estancamiento), se ofrece un botón
"Reintentar" que vuelve a llamar a validate (idempotente).

**Bug de test encontrado y arreglado de paso** (más sutil que el de
`StaticPool` de la Fase 2, mismo tipo de familia): `_run_validation_job`
abre su propia sesión de DB, que en los tests apuntaba al motor real de
`DATABASE_URL` (un `test.db` vacío) en vez de a la base en memoria del
fixture -- se agregó `test_sessionmaker` (fixture nuevo, expone el
sessionmaker en vez de solo la sesión ya abierta) y `client` ahora
parchea `app.api.projects.SessionLocal` con él. Un segundo bug de test,
específico de este parche: si el test consulta un objeto por la MISMA
sesión (`db_session`) que después usa el endpoint, el identity map de
SQLAlchemy devuelve el objeto cacheado en vez de releer lo que el
background job (con su propia sesión) commiteó -- hace falta
`db_session.expire_all()` DESPUÉS de disparar la validación y ANTES
del chequeo final. No aplica a producción (cada request tiene su propia
sesión, sin identity map compartido).

**Bug pre-existente encontrado de paso (no de esta fase, pero
relacionado) y arreglado**: la página del proyecto usaba el mismo
estado `error` tanto para "no se pudo cargar el proyecto" (error de
página completa) como para "falló la validación de este módulo" --
cualquier fallo de un módulo tiraba abajo toda la pantalla del
proyecto en vez de mostrarse inline. Separado en `projectError` (guard
de página completa) y `error` (inline, con botón de reintentar, dentro
del módulo activo). Se notó más con esta fase porque ahora los fallos
de validación son explícitos y visibles (antes, una excepción
sincrónica simplemente colgaba la request).

**Tests**: `TestOnProgressCallback` (2 casos) en `test_validation_engine.py`,
nuevo `test_validate_async.py` (3 casos: 202 inmediato, status final
validated con rows completos, path de excepción a failed). 56/56 tests
pasan.

**Regla para no repetirlo:**
> Cualquier código que abra su propia sesión de DB fuera del ciclo
> normal de `Depends(get_db)` (background tasks, workers, jobs) necesita
> su propio mecanismo de test explícito -- no alcanza con el fixture
> `client` existente, hay que exponer el sessionmaker (no solo la
> sesión) para poder parchear hacia dónde apunta ese código. Y si en un
> test se toca el mismo objeto desde dos sesiones distintas (la del
> fixture y la de un job en background), expirar explícitamente antes
> de volver a leer -- si no, el identity map de SQLAlchemy miente con
> total confianza.

---

## 2026-06-30 — Fase 3: nuevos tiers de precio + cuota aplicada al exportar

**Qué cambia:** antes había dos planes (por proyecto $99, mensual $149
"ilimitado"). Ahora hay tres:

- **Gratis**: 1 proyecto, 1 módulo, reporte + descarga incluidos, una
  vez por cuenta -- para poder probar que la plataforma funciona de
  verdad antes de pagar.
- **Por proyecto ($99)**: sin cambios en el precio, pero ahora cubre
  hasta 8 módulos del mismo proyecto (consistente con el rediseño
  multi-módulo de la Fase 2).
- **Mensual ($149)**: ya NO es ilimitado -- hasta 5 proyectos
  exportados por mes calendario.

**Regla de negocio clave**: el cobro/cuota se aplica exactamente al
EXPORTAR (descargar), no al crear un proyecto ni al validar módulos --
el usuario puede subir y re-validar libremente sin gastar nada de su
cuota.

**Schema** (migración `0003_add_user_quota_fields.py`, aditiva, probada
contra Postgres local igual que la 0002 -- ciclo completo
upgrade→downgrade→upgrade limpio): `User` gana `free_project_used`
(bool), `monthly_export_count` (int) y `monthly_export_reset_at`
(datetime).

**Lógica** (`backend/app/services/entitlements.py`):
- `can_export_project(db, user, project)` decide si ESTE export
  específico está permitido y por qué vía (proyecto ya pagado /
  proyecto gratis / cuota de suscripción), sin incrementar nada --
  el incremento real lo hace `GET /projects/{id}/download` en el mismo
  commit que el cambio de estado del proyecto (atómico, evita doble
  conteo en un retry).
- `reset_monthly_counter_if_needed(user)` resetea el contador al cruzar
  a un mes calendario nuevo (no 30 días rodantes desde que se
  suscribió -- más simple de explicar y de implementar).
- Regla del "proyecto gratis": es automáticamente el primer proyecto de
  la cuenta (`count() == 1`), sin que el usuario elija nada explícito.
  Un segundo proyecto NO es gratis aunque la cuota nunca se haya usado.
- Tope de 1 módulo en el proyecto gratis, enforced en
  `POST /projects/{id}/modules` -- deja de aplicar en cuanto
  `free_project_used` pasa a `True` (ya no tiene sentido limitarlo, el
  usuario paga o se suscribe para seguir agregando módulos a ESE
  proyecto).

**Nuevo endpoint** `GET /users/me` (`backend/app/api/users.py`):
`{free_project_used, has_active_subscription, subscription_expires_at,
monthly_export_count, monthly_export_limit}` -- para que el frontend
sepa qué mostrar en el paywall sin duplicar la lógica de entitlements.

**Frontend**: `PaywallPanel.tsx` agrega una tercera opción "Gratis · 1
módulo" (visible solo si `!free_project_used`) que salta directo a la
descarga sin pasar por USDC. La landing (`app/page.tsx`) muestra las 3
cards de precio, con el copy de "Mensual" corregido (ya no dice
"ilimitado").

**Gap encontrado y anotado para después (no arreglado en esta sesión,
para no mezclar scope)**: un usuario con suscripción activa y cuota
disponible sigue viendo la pantalla de pago con USDC en vez de poder
descargar directo -- el backend ya lo autorizaría, el frontend todavía
no lo consulta antes de mostrar el flujo de pago. Ver chip de tarea
spawneado en la sesión (`PaywallPanel no salta el pago para
suscriptores con cuota`).

**Tests**: `test_entitlements_quota.py` (14 casos nuevos: reset
mensual, las 4 ramas de `can_export_project`, tope de módulo gratis,
que un pago puntual no incremente ningún contador). Actualizados
`test_projects_multimodule.py` (5 tests que acumulaban módulos sin
pagar ahora simulan explícitamente que ya se usó la cuota gratis, ya
que testean otra cosa). 51/51 tests pasan.

**Regla para no repetirlo:**
> Cuando se agrega un tope nuevo (como el de 1 módulo del proyecto
> gratis acá), revisar qué tests existentes asumían el comportamiento
> viejo ("todo gratis, sin límite") -- van a fallar de golpe y hay que
> decidir, test por test, si el test necesita simular el estado
> "ya gasté mi cuota" (porque prueba otra cosa) o si el test en
> realidad está probando el tope nuevo y hay que dejarlo como está.

---

## 2026-06-30 — Falso positivo de "faltan columnas obligatorias" + sin vista previa en el reporte

**Síntomas reportados por el usuario (2 en la misma captura):**

1. En un módulo CRM el reporte decía "Filas sin errores: 6/6" y "No
   encontramos errores, está listo para descargar" -- pero AL MISMO
   TIEMPO mostraba un banner rojo "Faltan columnas obligatorias: name,
   type", sin ninguna opción para corregirlo ni manual ni
   automáticamente. Contradictorio: ¿está listo o le faltan columnas?
2. En un módulo Contactos con 0 errores, no había forma de ver qué
   había en el archivo -- "si está correcto, ¿qué es lo que está
   correcto? no me muestra la previsualización".

**Causa del primero (backend, bug real):**
`validate_dataframe()` en `backend/app/services/validation_engine.py`
calculaba `columns_expected_missing` ANTES de correr el matching de
columnas, comparando contra `columns_seen` (los headers crudos del
archivo) en vez de contra los campos técnicos ya mapeados
(`column_mapping.values()`). Resultado: un campo requerido que SÍ vino
en el archivo pero con un header en español (ej. "Nombre" en vez de
literal `name`, reconocido perfectamente por `FIELD_SYNONYMS` en
`column_matcher.py`) se reportaba igual como "columna faltante" -- un
falso positivo exactamente en el caso normal, porque nadie exporta un
CSV con headers técnicos en inglés.

**Causa del segundo (frontend, feature ya construida pero nunca
conectada):** `backend` ya calculaba y devolvía `preview_rows` (primeras
10 filas reales) en cada `ValidationReport`, y ya existía un componente
`frontend/components/DataPreview.tsx` completo para mostrarlas -- pero
nunca se importó ni se renderizó en `proyectos/[id]/page.tsx` (ni en la
versión vieja de un solo módulo, ni en la nueva multi-módulo). De paso,
`DataPreview.tsx` tenía su propio bug latente sin detectar:
`bg-paper-dim` no es una clase válida de Tailwind (`paper` es un color
plano, no una escala con sufijos numéricos) -- el script
`check-tailwind-colors.js` no lo pescaba porque su heurística de
"color base" (`"paper-dim".split("-")[0]` = `"paper"`, que sí existe)
asume shades numéricos, dando un falso negativo. Nadie lo notó porque
el componente nunca se usó hasta ahora.

**Fix:**
- `validate_dataframe()`: `columns_expected_missing` ahora se calcula
  después de `column_mapping`, comparando contra
  `set(column_mapping.values())`.
- `proyectos/[id]/page.tsx`: se importa y renderiza `<DataPreview>` en
  la vista de cada módulo, siempre (no solo cuando hay 0 errores),
  usando `report.columns_seen` / `report.preview_rows` que el backend
  ya mandaba.
- `DataPreview.tsx`: `bg-paper-dim` → `bg-canvas`.
- El banner de columnas realmente faltantes ahora aclara por qué no
  tiene botón de corrección ("el dato no está en tu archivo, agregalo
  en el origen y volvé a subirlo") en vez de dejarlo mudo.

**Tests:** nuevo
`test_validation_engine.py::TestValidacionNormal::test_columna_requerida_presente_via_sinonimo_no_se_reporta_como_faltante`.
37/37 tests pasan.

**Regla para no repetirlo:**
> Cuando dos piezas del mismo reporte pueden contradecirse ("0 errores"
> + "faltan columnas obligatorias"), es señal de que se están
> calculando con criterios distintos -- no parchear el mensaje, buscar
> por qué disienten. Y antes de dar una feature por "no hace falta,
> es un nice-to-have", revisar si ya existe construida en el código
> (como pasó con `DataPreview.tsx`) -- conectarla es más barato que
> reinventarla, y dejarla sin usar significa que sus bugs (como el de
> `bg-paper-dim`) tampoco se detectan.

---

## 2026-06-30 — No se podía cambiar el archivo elegido sin recargar la página

**Síntoma reportado por el usuario:** en la home (`/app`), una vez que
se elegía un archivo (drag&drop o manual), la zona de upload solo
mostraba el nombre del archivo en un `<p>` sin ningún elemento
clickeable -- si el usuario se equivocaba de archivo, la única salida
era recargar la página entera y volver a elegir versión/módulo/país
desde cero.

**Causa:** el `<label>` con el `<input type="file">` oculto solo se
renderizaba en la rama `!file` del condicional -- una vez que `file`
tenía un valor, esa rama dejaba de existir y no quedaba ningún control
para reabrir el selector de archivos. (La pantalla de "Agregar módulo"
en `proyectos/[id]/page.tsx` no tiene este bug: ahí el nombre del
archivo está envuelto DENTRO del `<label>`, así que siempre queda
clickeable.)

**Fix:** `frontend/app/app/page.tsx` -- cuando hay un archivo elegido,
se muestran dos acciones en vez de un texto estático: "cambiar archivo"
(reabre el selector) y "quitar" (limpia la selección y vuelve a la
zona de drag&drop). Mismo patrón de siempre-clickeable que ya
funcionaba en la pantalla de agregar módulo.

**Regla para no repetirlo:**
> Cualquier estado de formulario que se pueda completar ("archivo
> elegido", "opción seleccionada") necesita una salida visible para
> deshacerlo SIN recargar la página -- si armar el flujo felíz hace que
> el control de entrada desaparezca del DOM, revisar antes de dar por
> terminada la pantalla.

---

## 2026-06-30 — "Failed to fetch" con un CSV real de Odoo v14 (separador ';')

**Síntoma reportado por el usuario:** subir un export real de contactos
de Odoo v14 (`;` como separador, típico de un CSV guardado desde Excel
en configuración regional es-AR/es-ES) hacía que la pantalla del
proyecto mostrara literalmente "Failed to fetch" -- sin ningún mensaje
útil, ni siquiera el genérico. La pregunta correcta del usuario: "¿es
realmente incompatible? es un CSV real de Odoo, debería ser de los más
compatibles" -- la respuesta es que el archivo estaba perfecto, el bug
era nuestro.

**Causa raíz, dos bugs distintos apilados:**

1. `_read_tabular_file()` en `backend/app/api/projects.py` siempre
   asumía `sep=","` para CSV. Este archivo usa `;` (y tiene un valor con
   una coma adentro, la etiqueta `"Cliente, VIP"`), así que pandas
   rompía con `pandas.errors.ParserError: Expected N fields, saw N+1` --
   una excepción NO atrapada en ningún lado.
2. Esa excepción no atrapada llegaba a `unhandled_exception_handler`
   (`backend/app/core/error_handling.py`), que ya devolvía un JSON
   prolijo con `support_id`... pero Starlette registra los handlers de
   `add_exception_handler(Exception, ...)` en `ServerErrorMiddleware`,
   que queda **por fuera** de `CORSMiddleware`. Esa respuesta nunca
   llevaba el header `Access-Control-Allow-Origin`, así que el
   navegador la bloqueaba antes de que el frontend pudiera leer nada --
   de ahí el "Failed to fetch" genérico tapando un mensaje que en
   realidad estaba bien escrito.

**Fix:**

- `_read_tabular_file()` ahora sniffea el separador real con
  `csv.Sniffer()` sobre una muestra del archivo (`_detect_csv_separator()`),
  en vez de asumir `,` siempre -- soporta `,`, `;`, tab y `|`. Cualquier
  error de parseo restante (`ParserError`, `UnicodeDecodeError`,
  `ValueError`) se envuelve en un `HTTPException(400, ...)` con un
  mensaje accionable ("revisá que todas las filas tengan la misma
  cantidad de columnas... probá guardarlo como CSV UTF-8"), en vez de
  dejarlo propagar como 500 sin explicación.
- `unhandled_exception_handler()` ahora setea `Access-Control-Allow-Origin`
  y `Access-Control-Allow-Credentials` a mano en la respuesta, porque
  `CORSMiddleware` nunca la toca. Esto es una corrección general -- de
  ahora en más, CUALQUIER excepción no prevista (no solo esta) va a
  llegarle al frontend como un mensaje legible en vez de "Failed to
  fetch".

**Tests:** `test_projects_multimodule.py::TestArchivoConSeparadorPuntoYComa`
(1 caso, con el mismo patrón del archivo real reportado). 36/36 tests
pasan.

**Regla para no repetirlo:**
> "Failed to fetch" en el navegador casi nunca significa "no se pudo
> conectar" -- en este stack, con CORS configurado, generalmente
> significa que el backend devolvió un error sin headers de CORS (o
> crasheó antes de que el middleware corriera). Si aparece ese mensaje
> genérico, lo primero es mirar los logs de Render buscando un
> `UNHANDLED support_id=...`, no asumir un problema de red. Y antes de
> asumir que un archivo real del cliente "no es compatible", probarlo
> literalmente con el parser (pandas) antes que con hipótesis -- este
> archivo era 100% válido, el bug estaba en la asunción de separador.

---

## ⚠️ 2026-06-30 — Rediseño de schema: Project como contenedor multi-módulo

**Contexto:** Fase 2 del roadmap de sesión. Antes, 1 Project = 1 archivo
= 1 módulo. El nuevo modelo de precios ($99 = proyecto completo con
hasta 8 módulos, plan gratis de prueba, suscripción con tope mensual)
necesita que un Project sea el contenedor de la migración completa de
un cliente, con módulos acumulados adentro sin perder progreso entre
uno y otro.

**Cambio de schema (corte limpio, confirmado con el dueño del producto
-- no hay pagos reales ni proyectos de clientes en la base de Render
todavía):**

- `Project` pierde `odoo_module`, `original_filename`, `storage_path`,
  `validation_report`, `client_config_override`, `confirmed_manual_fixes`
  -- se mudan a la tabla nueva `ProjectModule` (FK a `project_id`, UNIQUE
  por `(project_id, odoo_module)` -- re-subir el mismo módulo pisa la
  fila existente, no crea una nueva).
- `ProjectStatus` cambia de `uploaded/validated/paid/downloaded` a
  `active/paid/exported` (el estado por-archivo ahora vive en
  `ModuleStatus` de cada `ProjectModule`: `uploaded/validating/validated/failed`).
- Tope de 8 módulos por proyecto, enforced en la API (`POST
  /projects/{id}/modules`), no en la DB.
- Migración Alembic `0002_split_project_into_project_module.py`: crea
  `project_modules`, dropea las columnas viejas de `projects`, migra el
  enum de status con el patrón tipo-nuevo→migrar-columna→dropear-viejo
  (Postgres no permite editar valores de un enum in-place). **Sin
  migración de datos** -- si en algún momento hay datos reales, esta
  migración deja de ser aplicable tal cual.
- **Rollback:** `alembic downgrade -1` desde el backend (revierte el
  enum y las columnas, sin recuperar datos -- el downgrade tampoco
  preserva datos, ídem el upgrade).

**Endpoints reshapeados** (`app/api/projects.py`):
`POST /projects` (crea el contenedor vacío) · `GET /projects/{id}`
(resumen + lista de módulos, nuevo) · `POST /projects/{id}/modules`
(sube/re-sube un módulo) · `POST .../modules/{mid}/validate` ·
`GET .../modules/{mid}/report` · `POST .../modules/{mid}/apply-fixes` ·
`GET /projects/{id}/download` (ahora entrega un **ZIP** con un archivo
corregido por módulo validado, en vez de un solo CSV).

**Bug de test encontrado y arreglado de paso:** `tests/conftest.py`
usaba SQLite `:memory:` sin `StaticPool` -- FastAPI corre los endpoints
en threads del threadpool, y sin StaticPool cada thread nuevo se
conectaba a una base en memoria DISTINTA y vacía ("no such table").
Los tests viejos no lo notaban porque tocaban `test_user.id` en el
fixture antes de la request HTTP (quedaba cacheado en memoria); los
tests nuevos de multi-módulo lo expusieron. Fix: `poolclass=StaticPool`
en el engine de test.

**Bug de frontend encontrado y arreglado de paso:** `lib/api.ts`
mandaba `applyFixes` como `{fixes: [...]}`, pero el endpoint espera la
lista directo en el body (`fixes: list[dict]` en FastAPI = el body
completo, no envuelto en un objeto). No se había notado porque nunca se
hizo el test E2E manual con un archivo real.

**Tests:** `test_apply_fixes.py` actualizado a `Project`+`ProjectModule`,
nuevo `test_projects_multimodule.py` (crear proyecto, acumular módulos,
tope de 8, re-subida limpia, resumen, descarga en ZIP). 32/32 tests
pasan.

**Regla para no repetirlo:**
> Un cambio de schema que dropea columnas en producción es la acción
> más difícil de revertir de todo este roadmap -- antes de pushear,
> confirmar explícitamente con el dueño del producto que no hay datos
> reales en juego (no asumirlo por el estado del CHANGELOG), y que el
> downgrade de Alembic existe y al menos se validó la cadena de
> revisiones (`alembic history`) aunque no se haya podido correr contra
> Postgres real antes del deploy.

**Actualización -- el primer intento falló en Render, ya arreglado y
reprobado:** el primer push de esta migración rompió el deploy con
`psycopg2.errors.DuplicateObject: type "modulestatus" already exists`.
Causa: `op.create_table()` de Alembic crea automáticamente cualquier
tipo `Enum` que aparezca en sus columnas -- si ADEMÁS se llama
`enum.create(bind, checkfirst=True)` a mano antes de `create_table`
(como hacía esta migración, siguiendo el patrón del baseline `0001`),
la creación automática de `create_table` NO respeta ese `checkfirst` y
revienta contra un tipo que ya existe, en la misma transacción. Fix:
sacar la llamada manual a `.create()` y dejar que `create_table` sea el
único que cree el tipo. El `downgrade()` tenía además un bug separado
(`Enum.create()` no acepta un kwarg `name`).

Se instaló Postgres local (Homebrew, sin Docker disponible), se
reconstruyó a mano el schema que YA existe en Render (el que describe
el baseline `0001`, vía SQL directo -- no ejecutando `0001.upgrade()`,
que tiene el mismo bug pero nunca corre en prod porque ahí se usa
`alembic stamp head`), se stampeó en `0001`, y se corrió el ciclo
completo `upgrade → downgrade → upgrade` contra ese Postgres real antes
de reintentar el push. Los tres pasos corrieron limpios y el schema
resultante coincide con lo esperado (`projectstatus` = `active/paid/exported`,
`modulestatus` = `uploaded/validating/validated/failed`, tabla
`project_modules` con el `UNIQUE(project_id, odoo_module)`).

**Regla para no repetirlo (actualiza la de arriba):**
> Nunca llamar a mano `enum.create(bind, checkfirst=True)` para un tipo
> que también se usa como tipo de columna dentro del mismo
> `op.create_table()` -- Alembic ya lo crea solo. Y antes de pushear
> cualquier migración con DDL de Postgres (enums, ALTER TYPE), probarla
> contra un Postgres real (Homebrew/Docker/lo que haya a mano) en vez
> de confiar en que "la cadena de revisiones es válida" (`alembic
> history`) es suficiente -- eso no ejecuta ni una sola línea de SQL.
> El baseline `0001` tiene el mismo bug latente (nunca se manifestó
> porque en prod se usa `stamp`, no `upgrade`) -- queda como deuda
> técnica conocida, no se tocó en esta sesión para no ampliar el
> blast radius de este cambio.

**Segundo bug encontrado en producción tras el deploy (reportado por el
usuario con captura de pantalla):** con el proyecto ya migrado en vivo,
se podía crear un proyecto y subir un primer módulo que no necesita
país (ej. CRM), pero al agregar después un módulo country-scoped (ej.
Contactos) el formulario de "Agregar módulo" no tenía selector de país
-- el backend rechazaba con "El módulo 'contactos' requiere un país" y
no había forma de resolverlo desde la UI. Causa: `odoo_country` es una
propiedad del Project completo (una sola instancia de Odoo), pero el
formulario de agregar módulo se diseñó asumiendo que ya estaría fijado
desde la creación del proyecto, sin contemplar que el primer módulo
elegido puede no necesitarlo.

Fix: `POST /projects/{id}/modules` acepta ahora un `odoo_country`
opcional que fija `project.odoo_country` la primera vez que hace falta
(si el proyecto ya tiene país, se ignora cualquier valor distinto que
venga en el request -- el país es del proyecto, no del módulo).
`frontend/app/proyectos/[id]/page.tsx` muestra el selector de país en
el formulario de "Agregar módulo" solo cuando el módulo elegido lo
necesita Y el proyecto todavía no tiene uno fijado. Nuevos tests en
`test_projects_multimodule.py` (`TestPaisSeFijaAlAgregarUnModuloQueLoNecesita`,
3 casos). 35/35 tests pasan.

**Regla para no repetirlo:**
> Cuando un campo pasa de "por módulo" a "por proyecto" en un rediseño
> de schema (como pasó acá con `odoo_country`), repasar CADA punto de
> entrada donde antes se pedía ese campo (alta inicial, alta de un ítem
> adicional) -- no alcanza con migrar el campo en la DB, hay que migrar
> todos los flujos de UI que lo completan. El caso que se nos escapó fue
> justo el más común en la práctica: la mayoría de los proyectos reales
> van a mezclar al menos un módulo country-scoped con uno que no lo es.

---

## 2026-06-30 — Theming del modal de Clerk + explicación de fixes en el reporte

**Contexto:** arranque de un roadmap más grande (ver plan de sesión:
Clerk, roles, tiers, proyectos multi-módulo, progreso real de
validación, explicación de fixes). Estas dos fases (1 y 5 del plan) son
de bajo riesgo, sin cambios de schema, y se hicieron primero.

**Fase 1 — Modal de Clerk no respetaba la landing:**
`ClerkProvider` en `frontend/app/layout.tsx` solo tenía `appearance.variables`
(colores/radius/fuente), pero Clerk usa `appearance.elements` para el
padding/sombras/estructura real de cada sub-componente — sin eso, el
modal se veía "ajeno" al resto de la UI aunque los colores fueran
correctos. Fix: se agregó `appearance.elements` mapeando `card`,
`headerTitle`, `formButtonPrimary`, `formFieldInput`,
`socialButtonsBlockButton`, `footer`, etc. a los tokens de la landing, y
se unificó `borderRadius` a `0.375rem` (antes `0.5rem`, no coincidía con
`rounded-md` de Tailwind usado en toda la landing).

Aclaración para el dueño del producto: el campo "imagen de perfil"
opcional que aparece en el signup de Clerk es un toggle del Dashboard de
Clerk (User & Authentication → Personal Information), no código — solo
alimenta el avatar de `UserButton`, nunca se usa en la generación de
reportes ni en el archivo exportado (confirmado por grep, no hay
`imageUrl`/`profileImageUrl` fuera de `layout.tsx`).

**Rollback:** revertir el commit; no toca DB, sin migración.

**Fase 5 — El reporte no explicaba qué hace cada fix antes de aplicarlo:**
Se agregó el campo `fix_explanation: str | None` a `FormatIssue`
(`backend/app/services/format_rules.py`) y a `FieldIssue`
(`backend/app/services/validation_engine.py`), poblado en los únicos
casos donde hay `suggested_fix` real: normalización de teléfono (único
`fix_is_automatic: true` que existe hoy), precio negativo, stock
negativo, y Selection con opción inválida. El resto de los tipos de
issue (`missing_required`, email/CUIT/precio-en-cero inválidos,
`unknown_relation`, `duplicate`) no tienen fix posible, así que
`fix_explanation` queda en `None` — no hay nada que explicar.

En el frontend, `IssueRow.tsx` muestra la explicación en una línea
itálica bajo el mensaje del issue, y el header de cada grupo en
`proyectos/[id]/page.tsx` (`IssueGroupList`) la muestra una sola vez
(es igual para todo el grupo, mismo `issue_type`+columna).

Tests nuevos en `backend/tests/test_validation_engine.py`
(`TestFixExplanation`, 5 casos) verifican que la explicación aparece
donde corresponde y es `None` donde no hay fix. 24/24 tests pasan.

**Regla para no repetirlo:**
> Un botón de "aplicar fix" sin explicar qué hace es una caja negra
> para alguien que está limpiando datos de un cliente real — antes de
> agregar cualquier fix automático o sugerido nuevo, escribirle su
> `fix_explanation` en el mismo commit, no como deuda para después.

**Rollback:** revertir el commit; `fix_explanation` es un campo nuevo
opcional (default `None`), no rompe compatibilidad con reportes viejos
si hiciera falta revertir parcialmente.

**Pendiente de verificación manual:** la verificación visual del modal
de Clerk y de la explicación en pantalla no se pudo hacer con el
navegador de preview automatizado en esta sesión (limitación de
sandboxing del entorno, no del código — `curl` a `localhost:3000`
respondía 200 pero el navegador de preview no conectaba). Falta
confirmar visualmente corriendo `npm run dev` localmente.

---

## 2026-06-30 — Agrupamiento de issues por tipo+columna (UX con archivos grandes)

**Problema:** con un archivo de 20.000 filas y un error de formato en
la columna `phone` en todas las filas, el reporte mostraba 20.000
`IssueRow` individuales en una lista plana — inutilizable, nadie puede
leer eso ni decidir qué hacer.

**Fix:** se reemplazó la lista plana por `IssueGroupList`, un componente
nuevo dentro de `page.tsx` que agrupa los issues por `issue_type +
column` antes de renderizar. Cada grupo muestra: tipo de error, columna,
cantidad de filas afectadas, y estado del fix. Los detalles individuales
se pueden ver colapsando/expandiendo el grupo.

Para grupos de fixes manuales con `suggested_fix`, se agregó un botón
"Aplicar a todas" que marca/desmarca todos los índices del grupo de una
sola vez — sin tener que expandir y clickear fila por fila.

**Regla para no repetirlo:**
> Antes de renderizar una lista de longitud variable que depende de
> datos del usuario, preguntarse: ¿qué pasa si son 20.000 ítems?
> Si la respuesta es "se rompe la UX", agrupar o paginar antes de
> mostrar. Un reporte de validación que el usuario no puede leer no
> es un reporte — es ruido.

---

## ⚠️ 2026-06-30 — CI ROTO desde hace 4 commits (sesión cortada, sin diagnosticar)

**Detectado al final de la sesión, sin tiempo de diagnosticar -- primer
pendiente de la próxima sesión, antes que cualquier otra cosa.**

GitHub Actions viene en rojo (❌) desde el commit `9fbebf8` ("test:
agregar tests de apply-fixes") en adelante -- 4 commits seguidos
fallando: `9fbebf8`, `d66764b`, `9430493`, `f352cb0`. Esto contradice
directamente la regla que el propio changelog establece más abajo
("Antes de mergear a producción: correr pytest en backend/ y confirmar
que el workflow de CI está verde. Si no está verde, no se deploya") --
se pusheó sin verificar el estado de Actions después del commit de
tests nuevos.

**Lo confuso del caso:** localmente, con Python 3.9 +
`eval_type_backport`, la suite completa corrió 19/19 en verde
(`python3 -m pytest -v` desde `backend/`). Así que el problema no es
que el test esté mal escrito en sí -- es probable que sea una
diferencia de entorno entre la máquina local y el runner de GitHub
Actions. Hipótesis a revisar primero, en este orden:

1. **Versión de Python en el workflow.** Si `.github/workflows/ci.yml`
   especifica una versión de Python distinta a 3.9 (probablemente una
   más nueva, ya que el código usa `str | None` que rompe en 3.9 sin
   el backport), revisar si `eval_type_backport` quedó realmente
   necesario ahí o si el problema es otra cosa específica del runner
   (variables de entorno faltantes para `Settings`, por ejemplo --
   ver que el workflow tenga seteadas las mismas dummy env vars que
   `conftest.py` espera, o que dependa de ellas estar en el entorno
   del job y no solo en `conftest.py`).
2. **Revisar el log real del job que falla** en
   github.com/icwtok-cloud/omi-v11/actions -- no se llegó a abrir el
   log de ningún run fallido en esta sesión, solo se vio la lista en
   rojo. Sin el log real no se puede saber si es el mismo error de
   tipos de Python 3.9, un problema de SQLite en el runner, una
   dependencia faltante en `requirements.txt`/`requirements-dev.txt`,
   o algo del todo distinto.
3. Una vez identificada la causa real, agregar el fix correspondiente
   Y confirmar que el run de Actions pasa a verde antes de dar por
   cerrado este pendiente -- no alcanza con que ande local.

**Regla para no repetirlo (refuerzo de la regla ya existente):**
> "Pytest en verde localmente" no es lo mismo que "CI en verde". Antes
> de dar un cambio por terminado, abrir
> github.com/icwtok-cloud/omi-v11/actions y confirmar el ✅ real del
> commit pusheado -- no asumirlo porque local funcionó. Esto es
> particularmente cierto cuando el entorno local tiene parches
> específicos (como `eval_type_backport` para Python 3.9) que el CI
> puede o no necesitar de la misma forma.

---

## 2026-06-30 — Fixes manuales: cerrado end-to-end (DB + frontend + tests)

Se completaron los 3 pendientes que habían quedado abiertos al cortarse
la sesión anterior (ver "Pendiente inmediato" más abajo en este mismo
archivo, ahora resuelto):

**1. Migración de DB.** El repo no tiene Alembic inicializado todavía
(deuda técnica conocida, sin resolver). Se corrió el `ALTER TABLE`
manual directo contra Postgres de Render vía `psql`, y se documentó en
`backend/migrations/manual/001_add_confirmed_manual_fixes.sql` para que
quede registro de qué se corrió y cuándo. La columna
`confirmed_manual_fixes` (json, nullable) ya existe en producción.

**2. Frontend cableado al endpoint real.** `IssueRow.tsx` ya estaba bien
armado (solo necesitaba el callback correcto desde el padre). Se agregó
`applyFixes()` en `lib/api.ts` y, en
`app/proyectos/[id]/page.tsx`, un botón explícito "Confirmar
correcciones" (en vez de mandar al backend en cada toggle) que junta los
issues marcados, los mapea a `{row_index, column}` usando los datos
reales del issue (no el índice del array), y llama a
`POST /projects/{id}/apply-fixes`. El botón queda deshabilitado si no
hay nada seleccionado, y muestra estado de guardado/error explícito.

**3. Test automático del endpoint.** Antes solo estaba cubierto
`validate_dataframe()` a nivel motor (`test_validation_engine.py`); el
endpoint que persiste y aplica `confirmed_manual_fixes` no tenía
ningún test. Se agregó `backend/tests/test_apply_fixes.py` (6 tests) y
se amplió `conftest.py` con fixtures de `db_session`/`test_user`/`client`
que overridean `get_db` y `get_current_user` -- permite testear
endpoints de la API contra una SQLite en memoria, sin pegarle a Clerk
ni a la base real de Render. Cubre: el endpoint guarda/rechaza
correctamente, y -- más importante -- que `_ensure_corrected_file()`
solo aplica el fix si fue confirmado vía el endpoint (un fix marcado en
pantalla pero nunca confirmado NO debe tocar el archivo final).

**Nota de entorno:** correr pytest local con Python 3.9 (el de Xcode
CommandLineTools en macOS) rompe la importación de `app/api/schemas.py`
por la sintaxis `str | None` de Pydantic v2. Se agregó
`eval_type_backport` a `requirements-dev.txt` como parche -- si en algún
momento se actualiza a Python 3.10+, se puede sacar esa dependencia.

**Regla para no repetirlo:**
> Un fix backend "listo" sin su test de endpoint no está realmente
> probado -- los tests de `validation_engine.py` confirman que la
> lógica de negocio funciona, pero no que el endpoint la invoque bien,
> ni que el modelo de autorización (`_get_owned_project`) la proteja
> correctamente. Cuando un endpoint nuevo persiste algo que después se
> usa para generar el archivo que el cliente paga y descarga, necesita
> tests a nivel API, no solo a nivel motor.

**Pendiente:** falta el test E2E manual real (subir archivo por la UI,
marcar un fix, confirmar, pagar, descargar, abrir el CSV) -- los tests
automáticos de hoy dan confianza en la lógica, pero no reemplazan
probar el flujo completo con Clerk real en el browser.

---

## 2026-06-30 — Agrupamiento de issues por tipo+columna (UX con archivos grandes)

**Problema:** con un archivo de 20.000 filas y un error de formato en
la columna `phone` en todas las filas, el reporte mostraba 20.000
`IssueRow` individuales en una lista plana — inutilizable, nadie puede
leer eso ni decidir qué hacer.

**Fix:** se reemplazó la lista plana por `IssueGroupList`, un componente
nuevo dentro de `page.tsx` que agrupa los issues por `issue_type +
column` antes de renderizar. Cada grupo muestra: tipo de error, columna,
cantidad de filas afectadas, y estado del fix. Los detalles individuales
se pueden ver colapsando/expandiendo el grupo.

Para grupos de fixes manuales con `suggested_fix`, se agregó un botón
"Aplicar a todas" que marca/desmarca todos los índices del grupo de una
sola vez — sin tener que expandir y clickear fila por fila.

**Regla para no repetirlo:**
> Antes de renderizar una lista de longitud variable que depende de
> datos del usuario, preguntarse: ¿qué pasa si son 20.000 ítems?
> Si la respuesta es "se rompe la UX", agrupar o paginar antes de
> mostrar. Un reporte de validación que el usuario no puede leer no
> es un reporte — es ruido.

---

## ⚠️ 2026-06-30 — CI ROTO desde hace 4 commits (sesión cortada, sin diagnosticar)

**Detectado al final de la sesión, sin tiempo de diagnosticar -- primer
pendiente de la próxima sesión, antes que cualquier otra cosa.**

GitHub Actions viene en rojo (❌) desde el commit `9fbebf8` ("test:
agregar tests de apply-fixes") en adelante -- 4 commits seguidos
fallando: `9fbebf8`, `d66764b`, `9430493`, `f352cb0`. Esto contradice
directamente la regla que el propio changelog establece más abajo
("Antes de mergear a producción: correr pytest en backend/ y confirmar
que el workflow de CI está verde. Si no está verde, no se deploya") --
se pusheó sin verificar el estado de Actions después del commit de
tests nuevos.

**Lo confuso del caso:** localmente, con Python 3.9 +
`eval_type_backport`, la suite completa corrió 19/19 en verde
(`python3 -m pytest -v` desde `backend/`). Así que el problema no es
que el test esté mal escrito en sí -- es probable que sea una
diferencia de entorno entre la máquina local y el runner de GitHub
Actions. Hipótesis a revisar primero, en este orden:

1. **Versión de Python en el workflow.** Si `.github/workflows/ci.yml`
   especifica una versión de Python distinta a 3.9 (probablemente una
   más nueva, ya que el código usa `str | None` que rompe en 3.9 sin
   el backport), revisar si `eval_type_backport` quedó realmente
   necesario ahí o si el problema es otra cosa específica del runner
   (variables de entorno faltantes para `Settings`, por ejemplo --
   ver que el workflow tenga seteadas las mismas dummy env vars que
   `conftest.py` espera, o que dependa de ellas estar en el entorno
   del job y no solo en `conftest.py`).
2. **Revisar el log real del job que falla** en
   github.com/icwtok-cloud/omi-v11/actions -- no se llegó a abrir el
   log de ningún run fallido en esta sesión, solo se vio la lista en
   rojo. Sin el log real no se puede saber si es el mismo error de
   tipos de Python 3.9, un problema de SQLite en el runner, una
   dependencia faltante en `requirements.txt`/`requirements-dev.txt`,
   o algo del todo distinto.
3. Una vez identificada la causa real, agregar el fix correspondiente
   Y confirmar que el run de Actions pasa a verde antes de dar por
   cerrado este pendiente -- no alcanza con que ande local.

**Regla para no repetirlo (refuerzo de la regla ya existente):**
> "Pytest en verde localmente" no es lo mismo que "CI en verde". Antes
> de dar un cambio por terminado, abrir
> github.com/icwtok-cloud/omi-v11/actions y confirmar el ✅ real del
> commit pusheado -- no asumirlo porque local funcionó. Esto es
> particularmente cierto cuando el entorno local tiene parches
> específicos (como `eval_type_backport` para Python 3.9) que el CI
> puede o no necesitar de la misma forma.

---

## 2026-06-30 — Fixes manuales: cerrado end-to-end (DB + frontend + tests)

Se completaron los 3 pendientes que habían quedado abiertos al cortarse
la sesión anterior (ver "Pendiente inmediato" más abajo en este mismo
archivo, ahora resuelto):

**1. Migración de DB.** El repo no tiene Alembic inicializado todavía
(deuda técnica conocida, sin resolver). Se corrió el `ALTER TABLE`
manual directo contra Postgres de Render vía `psql`, y se documentó en
`backend/migrations/manual/001_add_confirmed_manual_fixes.sql` para que
quede registro de qué se corrió y cuándo. La columna
`confirmed_manual_fixes` (json, nullable) ya existe en producción.

**2. Frontend cableado al endpoint real.** `IssueRow.tsx` ya estaba bien
armado (solo necesitaba el callback correcto desde el padre). Se agregó
`applyFixes()` en `lib/api.ts` y, en
`app/proyectos/[id]/page.tsx`, un botón explícito "Confirmar
correcciones" (en vez de mandar al backend en cada toggle) que junta los
issues marcados, los mapea a `{row_index, column}` usando los datos
reales del issue (no el índice del array), y llama a
`POST /projects/{id}/apply-fixes`. El botón queda deshabilitado si no
hay nada seleccionado, y muestra estado de guardado/error explícito.

**3. Test automático del endpoint.** Antes solo estaba cubierto
`validate_dataframe()` a nivel motor (`test_validation_engine.py`); el
endpoint que persiste y aplica `confirmed_manual_fixes` no tenía
ningún test. Se agregó `backend/tests/test_apply_fixes.py` (6 tests) y
se amplió `conftest.py` con fixtures de `db_session`/`test_user`/`client`
que overridean `get_db` y `get_current_user` -- permite testear
endpoints de la API contra una SQLite en memoria, sin pegarle a Clerk
ni a la base real de Render. Cubre: el endpoint guarda/rechaza
correctamente, y -- más importante -- que `_ensure_corrected_file()`
solo aplica el fix si fue confirmado vía el endpoint (un fix marcado en
pantalla pero nunca confirmado NO debe tocar el archivo final).

**Nota de entorno:** correr pytest local con Python 3.9 (el de Xcode
CommandLineTools en macOS) rompe la importación de `app/api/schemas.py`
por la sintaxis `str | None` de Pydantic v2. Se agregó
`eval_type_backport` a `requirements-dev.txt` como parche -- si en algún
momento se actualiza a Python 3.10+, se puede sacar esa dependencia.

**Regla para no repetirlo:**
> Un fix backend "listo" sin su test de endpoint no está realmente
> probado -- los tests de `validation_engine.py` confirman que la
> lógica de negocio funciona, pero no que el endpoint la invoque bien,
> ni que el modelo de autorización (`_get_owned_project`) la proteja
> correctamente. Cuando un endpoint nuevo persiste algo que después se
> usa para generar el archivo que el cliente paga y descarga, necesita
> tests a nivel API, no solo a nivel motor.

**E2E manual (parcial -- ver hallazgos abajo):** se probó subiendo un
archivo real de Contactos (1340 filas, export de un CRM) por la UI
completa hasta el panel de pago. El flujo de subida → reporte → panel
de pago funcionó visualmente bien. PERO el archivo de prueba dio "0
errores", así que el botón "Confirmar correcciones" nunca llegó a
aparecer (`hasManualFixableIssues` es `false` sin issues manuales) --
no se alcanzó a probar el path de fix manual → confirmar → pagar →
descargar → verificar CSV. Falta repetir la prueba con un archivo que
tenga al menos un error de formato real con `fix_is_automatic: false`.

**Hallazgos del E2E que abren 2 pendientes nuevos (no bugs confirmados,
a investigar):**

1. La columna "Empresa" del archivo de prueba quedó en "columnas que no
   encontramos en el módulo elegido", a pesar de que el sinónimo
   `Empresa→parent_id` se agregó hoy mismo a `FIELD_SYNONYMS` (ver
   entrada de arriba sobre column_matcher). Sospecha: `parent_id` es un
   campo de relación (`comodel_name` a `res.partner`), y el matching
   por nombre técnico simple capaz no alcanza para campos de relación
   -- a confirmar si `column_matcher.py` necesita lógica especial para
   esos casos, o si el sinónimo no está siendo aplicado por algún otro
   motivo.

2. El archivo de prueba tenía casi todos los emails vacíos y el reporte
   igual dijo "0 errores". Es el mismo patrón ya documentado en el bug
   #3 original (required_fields() de Odoo no marca `email` como
   required a nivel de field para `res.partner`, aunque en la práctica
   importe mucho para un partner real). No es un bug técnico -- el
   motor está validando exactamente lo que se le pidió -- pero sí una
   limitación de producto real a evaluar: ¿conviene una alerta
   no-bloqueante tipo "X% de filas sin email/teléfono" aunque el campo
   no sea `required` técnico en Odoo? Discutir antes de implementar,
   no es obvio que el approach correcto sea bloquear como
   `structural_mismatch`.

---

## 2026-06-30 — Matching de columnas: sinónimos en español + fuzzy (no más falsos "archivo ajeno")

**Qué pasaba:** archivos 100% legítimos (ej. un export de Contactos con
columnas como `Nombre`, `Empresa`, `Cargo`, `Email`) se marcaban como
`structural_mismatch: true` ("este archivo no parece corresponder al
módulo elegido"), bloqueando la descarga/pago de un archivo que en
realidad era válido y tenía errores reales para corregir.

**Causa real:** el `match_ratio` (ver bug #3 más abajo) comparaba las
columnas del archivo contra `fields_by_name`, que usa los nombres
**técnicos** de Odoo (`name`, `email`, `parent_id`, `function`...). El
schema generado por rules-generator nunca trae el label en español de
cada campo, solo el nombre técnico y a veces un `help_text`. Como casi
ningún usuario sube un archivo con headers ya en inglés técnico de Odoo
(`name` en vez de `Nombre`, `email` en vez de `Correo`), el matching
literal daba 0% incluso en archivos perfectos, y el chequeo estructural
del bug #3 — pensado para frenar archivos *realmente* ajenos — terminaba
frenando archivos legítimos por una razón equivocada.

**Fix:** se agregó `backend/app/services/column_matcher.py`, que mapea
columna del archivo → campo técnico de Odoo en 3 niveles: (1) exact
match contra el nombre técnico, (2) diccionario de sinónimos en español
normalizado (sin acentos/mayúsculas: `Nombre`→`name`, `Correo`/`Mail`→
`email`, `Empresa`→`parent_id`, `Cargo`→`function`, etc.), (3) fuzzy
match (`difflib.SequenceMatcher`, umbral 0.82) como último recurso para
variantes no previstas. `validate_dataframe()` ahora usa este mapeo
tanto para calcular `match_ratio` como para la validación fila por fila
— el campo técnico correcto se valida aunque el header venga en
español, y el mensaje de error sigue mostrando el nombre de columna tal
cual lo puso el usuario (no el técnico), para que tenga sentido en
pantalla.

**Ojo con el fuzzy match:** un sinónimo demasiado genérico puede
colisionar con palabras no relacionadas por simple similitud de letras
(ej. se probó con `"contacto"` como sinónimo de `name`, y matcheaba por
error con la columna `"Contactado"` de un CRM, que es un concepto
completamente distinto — "¿lo contactaron?" vs "nombre de la persona").
Se sacó ese sinónimo. Cualquier sinónimo nuevo que se agregue a
`FIELD_SYNONYMS` en `column_matcher.py` hay que probarlo contra
columnas parecidas pero semánticamente distintas antes de confiarlo.

**Regla para no repetirlo:**
> El chequeo estructural (`match_ratio`, bug #3) solo es confiable si el
> matching de columnas entiende variantes humanas/en español, no solo
> nombres técnicos en inglés. Si agregás un campo nuevo a un schema de
> `rules-generator/` y querés que el matching lo reconozca en archivos
> reales, agregá también sus sinónimos en español a `FIELD_SYNONYMS` en
> `column_matcher.py` — no asumas que el fuzzy match (nivel 3) lo va a
> cubrir solo, el umbral es conservador a propósito para evitar falsos
> positivos como el de `"Contactado"`/`"contacto"`.

---

## 2026-06-30 — Mapeo de columnas visible + preview de filas + base para fixes manuales

**Mapeo de columnas + preview (en producción, completo):**
Se agregaron dos secciones nuevas al reporte de validación, visibles
tanto cuando el archivo está OK como cuando hay `structural_mismatch`:

- **Mapeo de columnas** (`ColumnMappingTable.tsx`): muestra explícitamente
  qué columna del archivo se interpretó como qué campo de Odoo (ej.
  `Nombre → name`), y cuáles columnas quedaron sin interpretar (no es un
  error, simplemente se ignoran). Antes de esto, el usuario solo veía un
  número ("3 de 13 columnas coinciden") sin saber cuáles ni por qué.
- **Vista previa** (`DataPreview.tsx`): muestra las primeras 10 filas
  reales del archivo, tal cual vinieron, sin pasar por el motor de
  validación. Permite confirmar visualmente "esto es lo que subí" antes
  de pagar o de decidir cambiar de módulo.

Backend: `validate_dataframe()` ahora expone `column_mapping`,
`unmatched_columns` y `preview_rows` en el reporte (antes se calculaba
`column_mapping` internamente para el chequeo estructural pero se
descartaba). Ver `ValidationReport.to_dict()` en `validation_engine.py`.

**Regla para no repetirlo:**
> Si el motor calcula algo internamente para tomar una decisión (ej. el
> mapeo de columnas para `match_ratio`), evaluar si esa información
> también le sirve al usuario antes de descartarla. Mostrar "por qué"
> además de "qué" es la diferencia entre un reporte útil y un reporte
> que genera más preguntas de las que responde.

---

**Fixes manuales: backend listo, frontend y DB pendientes (NO está
funcionando todavía end-to-end, ver sección de pendientes al final del
archivo):**

Se descubrió que el botón "Aplicar fix" en `IssueRow.tsx` solo cambiaba
estado local de React (`manualFixesApplied`) sin mandar nada al backend.
El endpoint `POST /projects/{id}/apply-fixes` mencionado en el docstring
de `projects.py` nunca había sido implementado. Resultado: un usuario
podía marcar 50 fixes manuales como "aplicados" en pantalla, pagar,
descargar, y el archivo seguía teniendo exactamente los mismos errores.

Se implementó el lado backend:
- `Project.confirmed_manual_fixes` (JSON, lista de `{row_index, column}`)
  nuevo campo en `db_models.py`.
- `POST /projects/{id}/apply-fixes` ahora existe y guarda esa lista.
- `_ensure_corrected_file()` ahora aplica tanto los fixes con
  `fix_is_automatic=True` como los manuales confirmados vía ese endpoint,
  usando `(row_index, column)` como clave de matching (no el índice del
  array de issues, para no depender del orden).

**Regla para no repetirlo:**
> Un botón que cambia solo estado visual sin persistir nada en el
> backend es un bug de confianza, no una feature a medias. Si un fix
> "se aplica" en pantalla, tiene que aplicarse de verdad en el archivo
> que el usuario termina pagando y descargando — sin excepción, y sin
> dejarlo para "después" sin un test o un TODO explícito que lo marque
> como roto.

---

## 2026-06-30 — Tests de regresión + CI

A partir de hoy, los 3 bugs principales del 2026-06-29 (botón sin texto,
serialización de numpy, archivos sin relación con el módulo) tienen tests
automáticos que corren en cada push/PR a `main` vía GitHub Actions
(`.github/workflows/ci.yml`). Si rompés alguno de estos, no es un "lo
vemos en producción" — el CI te lo dice antes de mergear.

**Backend (`backend/tests/test_validation_engine.py`, corre con
`pytest`):**
- `TestToNative` — confirma que escalares numpy se casteen a tipos nativos.
- `TestSerializacionDeReporte` — confirma que un reporte con issues en
  columnas enteras serialice a JSON sin explotar.
- `TestMismatchEstructural` — confirma que un archivo sin relación con el
  módulo elegido se marque `structural_mismatch: true` y no "0 errores".
- `TestValidacionNormal` — red de seguridad para que los fixes de arriba
  no rompan el caso feliz (archivo limpio, error de formato real,
  columnas requeridas faltantes).

Correr local: `cd backend && pip install -r requirements-dev.txt && pytest`

**Frontend (`frontend/scripts/check-tailwind-colors.js`):**
- Escanea todos los `.tsx/.ts/.jsx/.js` de `app/` y `components/` buscando
  clases `text-X`/`bg-X`/`border-X` que no estén declaradas en
  `tailwind.config.js`. Es el chequeo que hubiera atajado el bug de
  `text-paper` antes de que llegara a producción.

Correr local: `cd frontend && npm run check:colors` (también
`npm run check:types` para errores de TypeScript sin necesitar variables
de entorno reales).

**Regla para no repetir esto:**
> Si agregás un test nuevo para un bug que encontraste, hacelo en el mismo
> commit que el fix — no después. Un fix sin su test de regresión es un
> fix que puede desaparecer en el próximo refactor sin que nadie se
> entere hasta que el usuario se vuelva a quejar.

**Pendiente:** el repo no tiene `package-lock.json` committeado, así que
el job de frontend en CI usa `npm install` en vez de `npm ci` (más lento,
y no garantiza versiones exactas reproducibles). Generar el lockfile
local (`npm install` en `frontend/`) y commitearlo apenas se pueda, y
después cambiar el workflow a `npm ci`.

---



### 1. Botón de pago/upload negro sin texto

**Qué pasaba:** el botón "Continuar con USDC" (`PaywallPanel.tsx`), el
botón "Analizar archivo gratis" (`app/page.tsx`) y el botón "Ingresar"
se veían negros, sin texto visible.

**Causa real:** las tres clases usaban `text-paper`, pero `paper` nunca
se definió en la paleta de colores de `tailwind.config.js`. Tailwind
descarta en silencio cualquier clase que no reconoce — no tira error en
build ni en consola. El texto quedaba sin color explícito, heredaba
negro, y el fondo también era negro (`bg-ink`). Resultado: texto
invisible, pero el botón "funcionaba" (el click sí disparaba el handler),
por eso no era obvio que era un bug visual y no funcional.

**Fix:** se agregó `paper: "#FFFFFF"` a `theme.extend.colors` en
`tailwind.config.js`.

**Regla para no repetirlo:**
> Cualquier clase de color de Tailwind (`text-x`, `bg-x`, `border-x`)
> que no sea un color estándar de Tailwind (`white`, `black`, `gray-500`,
> etc.) TIENE que existir en `tailwind.config.js` antes de usarse en un
> componente. Si agregás un color nuevo en un componente, agregalo al
> config en el mismo commit. Si ves un botón "negro sin texto", esta es
> la primera causa a chequear — no es un bug de lógica, es un nombre de
> clase que no existe.

---

### 2. El reporte de validación no mostraba el detalle de errores (solo contadores)

**Qué pasaba:** `/proyectos/[id]` mostraba "Filas totales / Filas sin
errores / Se corrigen solas", pero nunca la tabla de issues individuales
— a veces, no siempre.

**Causa real:** `FieldIssue.current_value` y `suggested_fix` se llenaban
con el valor crudo de una celda de pandas (`row[col_name]`). Cuando la
columna era numérica entera, ese valor es `numpy.int64`, que **no es
JSON-serializable** por `json.dumps` estándar ni por el encoder default
de FastAPI. Si el archivo subido tenía al menos un issue sobre una
columna entera (cantidades, códigos, etc.), la respuesta de
`/validate` o `/report` fallaba al serializarse. Si el archivo solo
tenía issues en columnas de texto o float, andaba bien — por eso
parecía "intermitente" cuando en realidad dependía pura y exclusivamente
del tipo de dato de la columna con el error.

**Fix:** se agregó `_to_native()` en `validation_engine.py`, que castea
cualquier escalar de numpy/pandas a tipo nativo de Python (`int`, `float`,
`str`, `None`) antes de meterlo en un `FieldIssue`. Se aplicó en los 3
lugares donde se asignaba `value` crudo.

**Regla para no repetirlo:**
> Ningún valor que salga directo de un DataFrame de pandas (`df.at[...]`,
> `row[col]`, `df[col].items()`, etc.) puede ir directo a un campo que
> termine en una respuesta JSON de la API. Siempre pasarlo por
> `_to_native()` (o equivalente) antes. Si agregás una regla de
> validación nueva en `format_rules.py` o `validation_engine.py` que lea
> un valor de columna, no asumas que ya es `int`/`float`/`str` de Python
> — nunca lo es, viene de numpy.

---

### 3. Archivos sin relación con el módulo elegido se marcaban "sin errores"

**Qué pasaba:** se subió un archivo de estructura de bot (columnas como
`intent_name`, `trigger_phrase`) como si fuera un archivo de Contactos,
y el sistema respondió "511 filas, 0 errores, listo para descargar".

**Causa real:** el motor de validación solo chequea (a) campos marcados
`required` en el JSON de reglas generado por introspección de Odoo, y
(b) reglas de formato sobre columnas que sí matchean algún campo del
modelo. El problema: Odoo **no marca `required=True` a nivel de field**
en muchos casos donde el campo es obligatorio en la práctica (ej.
`res.partner.name` se valida vía constraint, no vía atributo del field).
Resultado: para Contactos, `required_fields()` devuelve una lista
*vacía*. Si además ninguna columna del archivo matchea ningún campo
del modelo, no hay nada que chequear fila por fila → "0 errores", aunque
el archivo no tenga absolutamente nada que ver con el módulo elegido.

**Fix:** se agregó un chequeo estructural en `validate_dataframe()`: se
calcula qué porcentaje de las columnas del archivo matchea algún campo
del modelo (`match_ratio`). Si es menor a 20%, el reporte devuelve
`structural_mismatch: true` y corta ahí — no sigue validando fila por
fila ni dice "sin errores". El frontend muestra un mensaje explícito
("este archivo no parece corresponder al módulo elegido") y bloquea la
descarga/pago.

**Regla para no repetirlo:**
> No confiar en `required_fields()` como única fuente de verdad sobre si
> un archivo es válido para un módulo. Es una lista generada por
> introspección automática del código de Odoo y **puede estar vacía o
> incompleta** aunque el modelo tenga reglas de negocio reales. El
> chequeo estructural (`match_ratio` de columnas) es la red de seguridad
> que cubre ese hueco — no lo borres ni lo deshabilites sin reemplazarlo
> por algo equivalente. Si agregás un módulo nuevo al rules-generator,
> verificá manualmente cuántos campos quedan con `required: true` — si
> es 0 o muy pocos, es esperable, no un bug del generador.

---

### 4. UX: no se podía volver atrás después de subir un archivo

**Qué pasaba:** una vez subido el archivo y mostrado el reporte, no
había forma de volver a la pantalla de carga sin tocar la URL a mano.

**Fix:** se agregó un link "← Subir otro archivo" en
`/proyectos/[id]/page.tsx` (y "Volver a subir un archivo" en la pantalla
de `structural_mismatch`).

**Regla para no repetirlo:**
> Toda pantalla que sea el final de un flujo (reporte, confirmación,
> error) tiene que tener una salida visible hacia atrás o hacia el
> siguiente paso. No asumir que el usuario va a usar el botón "atrás"
> del browser.

---

### 5. El selector de módulos demora ~1 minuto en cargar, "a veces sí, a veces no"

**Causa real:** no es un bug de código. El backend está en el plan free
de Render, que apaga la instancia tras ~15 min de inactividad y tarda
~50 segundos en volver a arrancar en el primer request. Si el backend ya
estaba despierto (alguien lo usó hace poco), carga rápido; si no, tarda.
De ahí la sensación de "intermitencia".

**Fix aplicado (parcial):** se agregó un estado de carga visible en el
selector de módulos ("Cargando módulos…" + aviso de que puede tardar),
para que al menos no parezca roto mientras se despierta.

**Pendiente real (no es un fix de código, es de infraestructura):**
> Para eliminar esto de raíz hay dos caminos: (a) pasar el backend a un
> plan de Render que no duerma, o (b) agregar un cron job externo
> (ej. cron-job.org, GitHub Actions con schedule) que haga un ping a
> `/health` o `/projects/available-combinations` cada ~10 minutos para
> mantenerlo despierto. Esto es deuda técnica conocida, no algo para
> "arreglar en el código del validador".

---

## Reglas generales para cualquier cambio futuro en OMI

1. **Si tocás `validation_engine.py` o `format_rules.py`:** corré los
   tests de regresión (`backend/tests/`) antes de pushear. Si agregás
   una regla de validación nueva, agregá también un test que la cubra.
2. **Si tocás `tailwind.config.js`:** no borres ni renombres un color
   sin buscar (`grep -rn "text-NOMBRE\|bg-NOMBRE\|border-NOMBRE"`) todos
   los usos en `frontend/`. Un color "no usado" puede estar en un
   componente que no se renderiza en el path que probaste.
3. **Si agregás un módulo/país nuevo en `rules-generator/`:** no asumas
   que `required_fields()` te va a salvar de archivos basura. El
   chequeo estructural (`match_ratio`) es la defensa real.
4. **Cualquier valor que venga de un DataFrame y vaya a la API:** pasarlo
   por `_to_native()`. Sin excepciones.
5. **Antes de mergear a producción:** correr `pytest` en `backend/` y
   confirmar que el workflow de CI (`.github/workflows/`) está verde.
   Si no está verde, no se deploya — no importa cuán chico sea el cambio.

---

## ⚠️ Pendiente inmediato (sesión cortada por tiempo, 2026-06-30)

Para retomar en la próxima sesión, en este orden:

1. **Migración de DB — `confirmed_manual_fixes`.** El modelo
   `Project.confirmed_manual_fixes` (JSON, nullable) ya está en
   `db_models.py` y el endpoint `apply-fixes` ya lo usa, pero la columna
   real en Postgres (Render) todavía NO existe. SQLAlchemy no crea
   columnas automáticamente. Hay que: (a) confirmar si el repo tiene
   Alembic inicializado (`alembic.ini` en la raíz de `backend/`, carpeta
   `alembic/versions/`) — si no, inicializarlo; (b) generar la migración
   (`alembic revision --autogenerate -m "add confirmed_manual_fixes"`)
   o, más rápido para no bloquear, correr manualmente en la base de
   Render: `ALTER TABLE projects ADD COLUMN confirmed_manual_fixes JSON;`
   (c) aplicar la migración en producción.

2. **Frontend — cablear el botón de fix manual al backend real.** Hoy
   `IssueRow.tsx` + `page.tsx` solo cambian estado local
   (`manualFixesApplied`), sin llamar a la API. Falta:
   - Agregar `applyFixes()` en `lib/api.ts` (POST a
     `/projects/{id}/apply-fixes` con body
     `{fixes: [{row_index, column}, ...]}`).
   - En `page.tsx`, juntar los issues marcados en `manualFixesApplied`
     (mapeando índice → `{row_index, column}` del issue correspondiente)
     y mandarlos al backend. Decidir UX: ¿se manda en cada toggle, o se
     agrega un botón explícito "Confirmar correcciones" antes de mostrar
     el `PaywallPanel`? (recomendado: botón explícito, más claro para el
     usuario que "esto ya quedó guardado").
   - Mientras este paso no esté, el botón "Aplicar fix" sigue siendo
     decorativo — no rompe nada, pero tampoco corrige nada en el archivo
     final. No anunciar esta feature a usuarios reales hasta que esté
     conectada de punta a punta.

3. **Verificar con un test E2E manual** (no hay test automático de esto
   todavía): subir un archivo con al menos un issue con
   `fix_is_automatic: false` y `suggested_fix` no nulo, marcarlo como
   aplicado en la UI, confirmar el fix (paso 2), pagar, descargar, y
   abrir el CSV resultante para confirmar que el valor corregido está
   ahí. Si se puede, agregar un test de `apply-fixes` en
   `backend/tests/` que cubra esto a nivel API (hoy solo está cubierto
   `validate_dataframe()` a nivel motor, no el endpoint que persiste y
   aplica `confirmed_manual_fixes`).

## Deuda técnica de seguridad (no urgente — pre-lanzamiento, sin pagos reales todavía)

- **Pagos crypto:** revisar `entitlements.py` / lógica de confirmación
  de pago — validar que se chequee monto exacto, red correcta, y que un
  `payment_id` no se pueda reusar para destrabar descargas sin pagar (o
  pagando de menos). No se llegó a revisar este archivo en detalle.
- **Rate limiting:** no hay límite a creación de proyectos/validaciones
  por usuario/IP. Riesgo de abuso del validador gratis o de saturar el
  free tier de Render.
- **CORS:** no se revisó `app/main.py` — confirmar que el backend solo
  acepta requests desde el dominio real del frontend (`omi.lat`), no
  desde cualquier origen.
- **CSV formula injection:** el archivo corregido (`_ensure_corrected_file`)
  no sanitiza celdas que empiecen con `=`, `+`, `-`, `@` — pueden
  ejecutarse como fórmulas si el usuario abre el CSV en Excel. Impacto
  bajo-medio, pero es una corrección barata.
- **Token de GitHub expuesto:** en algún momento de este historial de
  chat se pegó un PAT de GitHub real en texto plano. Si todavía no se
  revocó (aunque se haya generado uno nuevo después), revocarlo.

## Otras ideas (no bugs, mejoras a futuro -- backlog, no urgente)

**Actualizado 2026-06-30** tras una auditoría de producto desde la
perspectiva de un partner Odoo senior (15+ años, migraciones reales) +
refinamiento del dueño del producto. Reemplaza la lista anterior --
conclusión de la auditoría: OMI hoy resuelve bien "¿mi archivo tiene
errores de formato obvios?" pero todavía no resuelve el problema caro
de una migración real: coherencia *entre módulos* y contra el sistema
destino. Orden de prioridad estratégica acordado:

1. **Dependencias entre módulos** (crítico, barato de construir). Un
   mapa estático `{ventas: [contactos, productos], facturacion:
   [contactos], ...}` -- cuando `unknown_relation` es alto en un módulo
   y su dependencia todavía no está en el proyecto, explicarlo: "este
   error probablemente desaparece cuando importes Contactos. Orden
   recomendado: Contactos → Productos → Ventas." Antes que el confidence
   score en la secuencia porque es más rápido de construir e igual de
   alto impacto.
2. **Confidence score visible en el column_mapping** + revisión manual
   para matches por debajo de un umbral (ej. fuzzy match < 90%). Hoy el
   mapeo se aplica silenciosamente; el usuario no puede auditar ni
   corregir un match dudoso antes de que se apliquen fixes basados en
   él.
3. **Explicar qué pasa con las columnas no mapeadas** (`unmatched_columns`)
   -- ¿se conservan en el CSV final, se descartan, pertenecen a otro
   módulo, no tienen equivalente en Odoo? Hoy no se dice nada, genera
   desconfianza real ("subí 15 columnas, el reporte no menciona 3, ¿a
   dónde fueron?").
4. **Normalización de formato numérico regional** (decimales/miles,
   `1.234,56` vs `1,234.56`) -- mismo patrón de bug que el separador de
   CSV de hoy, pero en números. Prioridad alta para AR/BR/ES.
5. **Reconocer y explicar External IDs** (`__export__.res_partner_101_xxx`)
   sin obligarlos -- detectar la columna, explicar su rol, advertir
   cuando faltan en escenarios donde son recomendables para poder
   re-importar sin duplicar.
6. **Modo "Connected" opcional** (capa premium, NO requisito del
   producto base): el usuario conecta su instancia real de Odoo y ahí
   sí OMI compara contra la base real -- duplicados existentes,
   referencias, `company_id`, External IDs. El modo offline (actual)
   se mantiene como el producto principal; esto es un upsell, no un
   reemplazo -- OMI no debe depender de acceso a producción del cliente
   para su propuesta de valor central.
7. **Índice de calidad del archivo** (ej. "Calidad: 92/100", desglosado
   en completitud / consistencia / compatibilidad Odoo / riesgo de
   importación) -- una síntesis que un cliente no técnico entiende en
   3 segundos, en vez de 15 stats sueltas.
8. **Simulación del resultado de la importación** antes de descargar:
   registros que importarían bien, bloqueados, relaciones pendientes,
   riesgo estimado. Esto es lo que acerca a OMI de "limpiador
   inteligente de CSV" a "preparación real para Odoo".
9. **Reporte exportable (PDF/Excel)** del análisis, separado del
   archivo corregido, para que un partner se lo mande al cliente como
   evidencia -- después de consolidar el núcleo funcional (es
   comunicación, no validación).
10. **Confirmación adicional para fixes con riesgo contable/inventario**
    (precio o stock negativo) antes de aplicar "a todas" -- un precio
    negativo puede ser una nota de crédito legítima, no siempre un
    error; un solo click hoy puede convertir eso en una venta positiva
    y duplicar ingresos si se aplica sin pensar.
11. **Dependencias/orden de importación multi-archivo dentro del ZIP
    final** -- nombrar o numerar los CSVs del ZIP según el orden
    recomendado de importación (ver ítem 1), no solo alfabético por
    nombre de módulo.
12. **Mapeo de columnas editable a mano** (hoy solo informativo).
13. **Modo "dry run" completo** -- ver el archivo entero con fixes
    aplicados antes de pagar, no solo 10 filas de preview. Cuidar
    rendimiento en archivos grandes (posible modo bajo demanda).
14. **Detección de encoding** con warning si el archivo no es UTF-8.

**Reservado para un plan Enterprise/consultora** (no para el usuario
ocasional del plan gratis o $99): plantillas de mapeo de columnas
reutilizables, para consultoras que suben el mismo formato de CRM todo
los meses.

**Explícitamente descartado tras la discusión**: soporte multi-país
dentro de un mismo proyecto. Una migración corresponde a una empresa o
grupo concreto -- si una consultora trabaja con varios países, es más
limpio (reglas, config, trazabilidad) que cada proyecto represente una
migración distinta.

También sigue pendiente, sin repriorizar: soporte multi-modelo en un
mismo archivo (ej. Excel con hoja de Contactos + hoja de Direcciones
relacionadas) -- hoy `primary_model()` asume un solo modelo por
archivo.

---

## Cómo actualizar este archivo

Cada vez que se resuelva un bug en producción (no en desarrollo local),
agregar una entrada nueva arriba con: qué pasaba (síntoma visible para
el usuario), causa real, fix aplicado, y la regla que evita que vuelva a
pasar. Si no le encontrás una regla concreta y reproducible, el bug
probablemente no está resuelto del todo.
