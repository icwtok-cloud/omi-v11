# OMI — Changelog y reglas para no romper el flujo

Este archivo es la memoria del proyecto. Antes de tocar `PaywallPanel.tsx`,
`validation_engine.py`, `tailwind.config.js` o el selector de módulos,
leé esto. Cada regla de abajo existe porque algo se rompió en producción
y costó tiempo diagnosticarlo.

Guardar este archivo como `CHANGELOG.md` en la raíz del repo (no en un
subdirectorio) para que cualquiera que clone el proyecto lo vea primero.

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
