/**
 * Cliente de API hacia el backend de OMI en Render.
 *
 * Todas las funciones reciben `getToken` (la función que devuelve
 * useAuth() de Clerk) para adjuntar el JWT de sesión en cada request.
 * Esto evita repetir la lógica de headers en cada componente.
 *
 * Toda respuesta pasa por un único handler (`handleResponse`) que
 * SIEMPRE parsea el body de error, sea GET o POST, y entiende los dos
 * formatos que produce el backend:
 *   - HTTPException de FastAPI:        { detail: string }
 *   - errores no controlados (500):    { error, message, support_id }
 * El support_id existe justamente para que el usuario lo pegue en un
 * ticket -- perderlo era perder la única forma de correlacionar el
 * error con los logs de Render.
 */

function resolveApiBase(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) return url;
  // En producción, caer en silencio a localhost:8000 significa que el
  // navegador del usuario intenta pegarle a SU PROPIA máquina -- el
  // síntoma es un "Failed to fetch" genérico imposible de diagnosticar
  // desde un reporte de usuario. Mejor romper el build/arranque con un
  // mensaje que apunte directo a la variable que falta en Vercel.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_API_URL no está configurada. Definila en las " +
        "variables de entorno del deploy (Vercel) antes de buildear."
    );
  }
  return "http://localhost:8000";
}

const API_BASE = resolveApiBase();

/** Timeout por defecto para requests JSON normales. */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Timeout para uploads y descargas de archivos (pueden ser de hasta
 * 25MB sobre conexiones lentas). */
const FILE_TRANSFER_TIMEOUT_MS = 120_000;

/** Reintentos ante fallas transitorias (red caída, 5xx de un cold start
 * de Render). Solo para GETs -- ver `authedFetch`. */
const RETRY_DELAYS_MS = [500, 1500];

export class ApiError extends Error {
  status: number | null;
  supportId: string | null;

  constructor(message: string, status: number | null, supportId: string | null = null) {
    // El support_id va DENTRO de message (no solo como propiedad) a
    // propósito: casi todos los componentes muestran errores vía
    // `e.message` -- si solo viviera en la propiedad, ningún usuario
    // lo vería jamás y volveríamos al bug original.
    super(supportId ? `${message} (ID de soporte: ${supportId})` : message);
    this.name = "ApiError";
    this.status = status;
    this.supportId = supportId;
  }
}

type GetToken = () => Promise<string | null>;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handler único de respuestas: si `res.ok`, la devuelve tal cual; si
 * no, arma un ApiError con el mejor mensaje disponible en el body.
 * Nunca tira "raw" -- todo error de API que ve un componente es un
 * ApiError con mensaje humano.
 */
async function handleResponse(res: Response, fallbackMessage: string): Promise<Response> {
  if (res.ok) return res;

  let message = fallbackMessage;
  let supportId: string | null = null;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string" && body.detail) {
      message = body.detail;
    } else if (typeof body?.message === "string" && body.message) {
      message = body.message;
    }
    if (typeof body?.support_id === "string") {
      supportId = body.support_id;
    }
  } catch {
    // body no-JSON (ej. HTML de un 502 de Render) -- se queda el fallback
  }
  throw new ApiError(message, res.status, supportId);
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(
        "El servidor está tardando más de lo normal en responder. Probá de nuevo en unos segundos.",
        null
      );
    }
    // Error de red puro (sin respuesta HTTP): fetch tira TypeError con
    // un mensaje críptico ("Failed to fetch") -- se traduce acá una
    // sola vez en vez de en cada llamada.
    throw new ApiError(
      "No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
      null
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch autenticado con timeout, parseo de errores garantizado, y
 * retry automático para GETs (2 reintentos con backoff 500ms/1500ms).
 *
 * No se reintentan métodos de mutación (POST) -- un POST de pago o de
 * upload reintentado a ciegas puede duplicar efectos. Tampoco se
 * reintentan 4xx: son errores del request, repetirlo da lo mismo.
 */
async function authedFetch(
  path: string,
  getToken: GetToken,
  fallbackMessage: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const retriable = method === "GET";
  const maxAttempts = retriable ? RETRY_DELAYS_MS.length + 1 : 1;

  let lastError: ApiError | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAYS_MS[attempt - 1]);

    // El token se pide adentro del loop: es corto-vivo, y en un retry
    // tardío (timeout de 30s + backoff) el del primer intento puede
    // haber expirado.
    const token = await getToken();
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    try {
      const res = await fetchWithTimeout(
        `${API_BASE}${path}`,
        { ...options, headers },
        timeoutMs
      );
      return await handleResponse(res, fallbackMessage);
    } catch (e) {
      const apiError = e instanceof ApiError ? e : new ApiError(fallbackMessage, null);
      const isClientError =
        apiError.status !== null && apiError.status >= 400 && apiError.status < 500;
      if (!retriable || isClientError || attempt === maxAttempts - 1) {
        throw apiError;
      }
      lastError = apiError;
    }
  }
  // Inalcanzable (el loop siempre retorna o tira), pero TypeScript no lo sabe.
  throw lastError ?? new ApiError(fallbackMessage, null);
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
  const res = await authedFetch(
    "/users/me", getToken, "No se pudo cargar tu información de cuenta"
  );
  return res.json();
}

export async function getAvailableCombinations(
  getToken: GetToken
): Promise<AvailableCombination[]> {
  const res = await authedFetch(
    "/projects/available-combinations", getToken,
    "No se pudieron cargar los módulos disponibles"
  );
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
  const res = await authedFetch("/projects", getToken, "No se pudo crear el proyecto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ odoo_version: odooVersion, odoo_country: odooCountry ?? null }),
  });
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

  const res = await authedFetch(
    `/projects/${projectId}/modules`, getToken, "No se pudo subir el archivo",
    { method: "POST", body: formData },
    FILE_TRANSFER_TIMEOUT_MS
  );
  return res.json();
}

export interface ModuleSummary {
  module_id: string;
  odoo_module: string;
  status: string;
  total_issues: number | null;
  quality_score: number | null;
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
  const res = await authedFetch(
    `/projects/${projectId}`, getToken, "No se pudo cargar el proyecto"
  );
  return res.json();
}

export interface ProjectListItem {
  project_id: string;
  odoo_version: string;
  odoo_country: string | null;
  status: string;
  modules_count: number;
  created_at: string;
}

/** Lista los proyectos del usuario logueado, más nuevo primero -- para
 * que quien vuelve a /app encuentre lo que ya subió en vez de depender
 * de tener guardada la URL exacta de /proyectos/{id}. */
export async function listProjects(getToken: GetToken): Promise<ProjectListItem[]> {
  const res = await authedFetch(
    "/projects", getToken, "No se pudieron cargar tus proyectos"
  );
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
  quality_score: number;
  quality_score_breakdown: { issue_type: string; rows_affected: number; points_deducted: number }[];
  has_external_id: boolean;
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
    getToken, "No se pudo iniciar la validación",
    { method: "POST" }
  );
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
    getToken, "No se pudo consultar el estado de la validación"
  );
  return res.json();
}

export async function getReport(
  getToken: GetToken,
  projectId: string,
  moduleId: string
): Promise<ValidationReport> {
  const res = await authedFetch(
    `/projects/${projectId}/modules/${moduleId}/report`,
    getToken, "No se pudo obtener el reporte"
  );
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
  const res = await authedFetch("/payments/start", getToken, "No se pudo iniciar el pago", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payment_type: paymentType,
      network,
      project_id: projectId ?? null,
    }),
  });
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
  const res = await authedFetch(
    `/payments/${paymentId}/status`, getToken,
    "No se pudo consultar el estado del pago"
  );
  return res.json();
}

export interface LemonSqueezyCheckoutResult {
  payment_id: string;
  checkout_url: string;
}

export async function startLemonSqueezyCheckout(
  getToken: GetToken,
  paymentType: "per_project" | "subscription" | "annual",
  projectId?: string
): Promise<LemonSqueezyCheckoutResult> {
  const res = await authedFetch(
    "/payments/lemonsqueezy/start", getToken, "No se pudo iniciar el pago con tarjeta",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_type: paymentType,
        project_id: projectId ?? null,
      }),
    }
  );
  return res.json();
}

export function downloadUrl(projectId: string): string {
  return `${API_BASE}/projects/${projectId}/download`;
}

export function reportPdfUrl(projectId: string, moduleId: string): string {
  return `${API_BASE}/projects/${projectId}/modules/${moduleId}/report.pdf`;
}

/**
 * Descarga un archivo autenticado (ZIP del proyecto, PDF del reporte).
 *
 * Estos endpoints requieren el JWT de Clerk en el header Authorization
 * -- el backend no acepta cookie de sesión como fallback. Un <a
 * href={...}> plano no manda ese header (es una navegación normal del
 * browser, sin JS), así que el click devolvía 401/403 en vez de
 * descargar el archivo. Por eso hay que traer el archivo con fetch()
 * (que sí puede llevar el header) y generar la descarga a mano con un
 * <a> temporal apuntando a un blob: URL.
 *
 * No pasa por authedFetch porque la URL ya viene completa (no un path
 * relativo) y una descarga no debe reintentarse sola: GET /download
 * consume cuota de exportes en el backend.
 */
export async function triggerAuthedDownload(
  getToken: GetToken,
  url: string,
  filename: string
): Promise<void> {
  const token = await getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetchWithTimeout(url, { headers }, FILE_TRANSFER_TIMEOUT_MS);
  await handleResponse(res, "No se pudo descargar el archivo");

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
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
    getToken, "No se pudieron guardar las correcciones",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // El backend espera la lista de fixes directo en el body, no
      // envuelta en un objeto (FastAPI trata `fixes: list[dict]` como el
      // body completo).
      body: JSON.stringify(fixes),
    }
  );
  return res.json();
}
