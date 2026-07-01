# OMI — Changelog y reglas para no romper el flujo

Este archivo es la memoria del proyecto. Antes de tocar `PaywallPanel.tsx`,
`validation_engine.py`, `tailwind.config.js` o el selector de módulos,
leé esto. Cada regla de abajo existe porque algo se rompió en producción
y costó tiempo diagnosticarlo.

Guardar este archivo como `CHANGELOG.md` en la raíz del repo (no en un
subdirectorio) para que cualquiera que clone el proyecto lo vea primero.

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

Pensando como alguien que limpia datos para clientes de Odoo
(data analyst / partner de Odoo), lo que más valor agregaría después de
lo de arriba, en orden de impacto:

1. Mapeo de columnas **editable a mano** (hoy solo es informativo) --
   que el usuario pueda corregir un mapeo mal hecho o mapear una columna
   que el algoritmo de sinónimos no reconoció.
2. Guardar/reutilizar un mapeo de columnas como plantilla, para clientes
   que suben el mismo formato de CRM todos los meses.
3. Detección de duplicados contra la base real de Odoo del cliente (vía
   API), no solo duplicados internos del archivo subido.
4. Que la config de override del cliente (`client_config_override`, ya
   existe en el modelo) tenga un paso visible en la UI, no solo
   backend.
5. Modo "dry run" -- ver el archivo completo con fixes aplicados antes
   de pagar, no solo las 10 filas de preview.
6. Reporte exportable (PDF/Excel) del análisis, separado del archivo
   corregido, para que un partner se lo mande al cliente como evidencia.
7. Soporte multi-modelo en un mismo archivo (ej. Excel con hoja de
   Contactos + hoja de Direcciones relacionadas). Hoy `primary_model()`
   asume un solo modelo por archivo.

---

## Cómo actualizar este archivo

Cada vez que se resuelva un bug en producción (no en desarrollo local),
agregar una entrada nueva arriba con: qué pasaba (síntoma visible para
el usuario), causa real, fix aplicado, y la regla que evita que vuelva a
pasar. Si no le encontrás una regla concreta y reproducible, el bug
probablemente no está resuelto del todo.
