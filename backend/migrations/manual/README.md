# Migraciones manuales (legado)

⚠️ Esta carpeta queda como **archivo histórico** de los cambios de schema
que se corrieron a mano por psql antes de tener Alembic. A partir de la
migración `0001_baseline` (en `backend/alembic/versions/`), todo cambio
de schema nuevo se hace con Alembic:

```bash
# después de cambiar un modelo en app/models/db_models.py
alembic revision --autogenerate -m "descripción del cambio"
alembic upgrade head
```

No se agregan más archivos `.sql` acá.

