# Migraciones manuales

El repo no tiene Alembic inicializado todavía (deuda técnica conocida,
ver CHANGELOG.md). Hasta que se inicialice, cualquier cambio de schema
se corre a mano contra la base de Render vía psql, y se documenta acá
como un archivo `.sql` numerado secuencialmente — para que quede
registro de qué se corrió y cuándo, aunque no sea reproducible
automáticamente todavía.
