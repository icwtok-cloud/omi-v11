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

export async function createProject(
  getToken: GetToken,
  odooModule: string,
  odooVersion: string,
  file: File,
  odooCountry?: string | null
): Promise<CreateProjectResult> {
  const formData = new FormData();
  formData.append("odoo_module", odooModule);
  formData.append("odoo_version", odooVersion);
  if (odooCountry) formData.append("odoo_country", odooCountry);
  formData.append("file", file);

  const res = await authedFetch("/projects", getToken, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo subir el archivo");
  }
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
  total_rows: number;
  total_issues: number;
  columns_seen: string[];
  columns_expected_missing: string[];
  structural_mismatch: boolean;
  matched_columns_count: number;
  column_mapping: Record<string, string>;
  unmatched_columns: string[];
  preview_rows: Record<string, unknown>[];
  issues: ValidationIssue[];
  can_download: boolean;
}

export async function runValidation(
  getToken: GetToken,
  projectId: string
): Promise<ValidationReport> {
  const res = await authedFetch(`/projects/${projectId}/validate`, getToken, {
    method: "POST",
  });
  if (!res.ok) throw new Error("No se pudo validar el archivo");
  return res.json();
}

export async function getReport(
  getToken: GetToken,
  projectId: string
): Promise<ValidationReport> {
  const res = await authedFetch(`/projects/${projectId}/report`, getToken);
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
  fixes: ManualFix[]
): Promise<{ confirmed_manual_fixes: ManualFix[] }> {
  const res = await authedFetch(`/projects/${projectId}/apply-fixes`, getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fixes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudieron guardar las correcciones");
  }
  return res.json();
}
