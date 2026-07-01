/**
 * Cliente de API hacia el backend de OMI en Render.
 *
 * Todas las funciones reciben `getToken` (la función que devuelve
 * useAuth() de Clerk) para adjuntar el JWT de sesión en cada request.
 * Esto evita repetir la lógica de headers en cada componente.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type GetToken = () => Promise<string | null>;

async function authedFetch(
  path: string,
  getToken: GetToken,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

export interface AvailableCombination {
  version: string;
  module: string;
  country: string | null; // null = módulo sin variación por país
}

export interface UserMe {
  free_project_used: boolean;
  has_active_subscription: boolean;
  subscription_expires_at: string | null;
  monthly_export_count: number;
  monthly_export_limit: number;
}

export async function getUserMe(getToken: GetToken): Promise<UserMe> {
  const res = await authedFetch("/users/me", getToken);
  if (!res.ok) throw new Error("No se pudo cargar tu información de cuenta");
  return res.json();
}

export async function getAvailableCombinations(
  getToken: GetToken
): Promise<AvailableCombination[]> {
  const res = await authedFetch("/projects/available-combinations", getToken);
  if (!res.ok) throw new Error("No se pudieron cargar los módulos disponibles");
  return res.json();
}

export interface CreateProjectResult {
  project_id: string;
  status: string;
}

/** Crea el proyecto contenedor -- todavía sin ningún módulo/archivo. */
export async function createProject(
  getToken: GetToken,
  odooVersion: string,
  odooCountry?: string | null
): Promise<CreateProjectResult> {
  const res = await authedFetch("/projects", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ odoo_version: odooVersion, odoo_country: odooCountry ?? null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo crear el proyecto");
  }
  return res.json();
}

export interface ModuleUploadResult {
  project_id: string;
  module_id: string;
  odoo_module: string;
  status: string;
}

/** Sube (o re-sube, pisando el archivo anterior) un módulo dentro de un proyecto.
 * `odooCountry` solo hace falta la primera vez que se agrega un módulo cuyas
 * reglas varían por país y el proyecto todavía no tiene uno fijado -- una vez
 * fijado a nivel proyecto, se ignora cualquier valor distinto que se mande. */
export async function addModule(
  getToken: GetToken,
  projectId: string,
  odooModule: string,
  file: File,
  odooCountry?: string | null
): Promise<ModuleUploadResult> {
  const formData = new FormData();
  formData.append("odoo_module", odooModule);
  if (odooCountry) formData.append("odoo_country", odooCountry);
  formData.append("file", file);

  const res = await authedFetch(`/projects/${projectId}/modules`, getToken, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo subir el archivo");
  }
  return res.json();
}

export interface ModuleSummary {
  module_id: string;
  odoo_module: string;
  status: string;
  total_issues: number | null;
  missing_dependencies: string[];
}

export interface ProjectSummary {
  project_id: string;
  odoo_version: string;
  odoo_country: string | null;
  status: string;
  modules: ModuleSummary[];
}

export async function getProject(
  getToken: GetToken,
  projectId: string
): Promise<ProjectSummary> {
  const res = await authedFetch(`/projects/${projectId}`, getToken);
  if (!res.ok) throw new Error("No se pudo cargar el proyecto");
  return res.json();
}

export interface ValidationIssue {
  row_index: number;
  column: string;
  issue_type: string;
  message: string;
  current_value: unknown;
  suggested_fix: unknown;
  fix_is_automatic: boolean;
  fix_explanation: string | null;
}

export interface ValidationReport {
  project_id: string;
  module_id: string;
  total_rows: number;
  total_issues: number;
  columns_seen: string[];
  columns_expected_missing: string[];
  structural_mismatch: boolean;
  matched_columns_count: number;
  column_mapping: Record<string, string>;
  column_match_confidence: Record<string, "exact" | "synonym" | "fuzzy">;
  unmatched_columns: string[];
  preview_rows: Record<string, unknown>[];
  issues: ValidationIssue[];
  can_download: boolean;
}

export interface ModuleValidateStart {
  project_id: string;
  module_id: string;
  status: string;
}

/** Dispara la validación en background -- devuelve apenas el backend
 * confirma que arrancó (202), no espera a que termine. El reporte
 * completo se pide después con getReport(), una vez que
 * getValidationStatus() indique status "validated". */
export async function runValidation(
  getToken: GetToken,
  projectId: string,
  moduleId: string
): Promise<ModuleValidateStart> {
  const res = await authedFetch(
    `/projects/${projectId}/modules/${moduleId}/validate`,
    getToken,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("No se pudo iniciar la validación");
  return res.json();
}

export interface ModuleValidateStatus {
  status: "uploaded" | "validating" | "validated" | "failed";
  rows_processed: number;
  rows_total: number | null;
  started_at: string | null;
  error: string | null;
}

export async function getValidationStatus(
  getToken: GetToken,
  projectId: string,
  moduleId: string
): Promise<ModuleValidateStatus> {
  const res = await authedFetch(
    `/projects/${projectId}/modules/${moduleId}/validate-status`,
    getToken
  );
  if (!res.ok) throw new Error("No se pudo consultar el estado de la validación");
  return res.json();
}

export async function getReport(
  getToken: GetToken,
  projectId: string,
  moduleId: string
): Promise<ValidationReport> {
  const res = await authedFetch(
    `/projects/${projectId}/modules/${moduleId}/report`,
    getToken
  );
  if (!res.ok) throw new Error("No se pudo obtener el reporte");
  return res.json();
}

export interface PaymentStartResult {
  payment_id: string;
  receive_address: string;
  network: string;
  expected_amount_usd: number;
  expires_at: string;
}

export async function startPayment(
  getToken: GetToken,
  paymentType: "per_project" | "subscription",
  network: "polygon" | "base",
  projectId?: string
): Promise<PaymentStartResult> {
  const res = await authedFetch("/payments/start", getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment_type: paymentType,
      network,
      project_id: projectId ?? null,
    }),
  });
  if (!res.ok) throw new Error("No se pudo iniciar el pago");
  return res.json();
}

export interface PaymentStatusResult {
  payment_id: string;
  status: "pending" | "confirmed" | "expired";
  confirmations_seen: number;
  confirmations_required: number;
}

export async function getPaymentStatus(
  getToken: GetToken,
  paymentId: string
): Promise<PaymentStatusResult> {
  const res = await authedFetch(`/payments/${paymentId}/status`, getToken);
  if (!res.ok) throw new Error("No se pudo consultar el estado del pago");
  return res.json();
}

export function downloadUrl(projectId: string): string {
  return `${API_BASE}/projects/${projectId}/download`;
}

export interface ManualFix {
  row_index: number;
  column: string;
}

export async function applyFixes(
  getToken: GetToken,
  projectId: string,
  moduleId: string,
  fixes: ManualFix[]
): Promise<{ confirmed_count: number }> {
  const res = await authedFetch(
    `/projects/${projectId}/modules/${moduleId}/apply-fixes`,
    getToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // El backend espera la lista de fixes directo en el body, no
      // envuelta en un objeto (FastAPI trata `fixes: list[dict]` como el
      // body completo).
      body: JSON.stringify(fixes),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudieron guardar las correcciones");
  }
  return res.json();
}
