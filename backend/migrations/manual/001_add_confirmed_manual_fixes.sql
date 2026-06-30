-- 2026-06-30 — confirmed_manual_fixes
-- Corrida manualmente vía psql (no hay Alembic en el repo todavía).
-- Ver CHANGELOG.md, sección "Pendiente inmediato" del 2026-06-30.
--
-- Habilita la persistencia de fixes manuales aplicados por el usuario
-- en el reporte de validación (issue: el botón "Aplicar fix" en
-- IssueRow.tsx solo cambiaba estado local de React, sin guardar nada).

ALTER TABLE projects ADD COLUMN confirmed_manual_fixes json;
