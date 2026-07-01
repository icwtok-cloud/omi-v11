from __future__ import annotations

from pydantic import BaseModel


class AvailableCombination(BaseModel):
    version: str
    module: str
    country: str | None = None  # None = módulo sin variación por país


class ProjectCreateRequest(BaseModel):
    odoo_version: str
    odoo_country: str | None = None


class ProjectCreateResponse(BaseModel):
    project_id: str
    status: str


class ModuleUploadResponse(BaseModel):
    project_id: str
    module_id: str
    odoo_module: str
    status: str


class ModuleSummaryResponse(BaseModel):
    module_id: str
    odoo_module: str
    status: str
    total_issues: int | None = None


class ProjectSummaryResponse(BaseModel):
    project_id: str
    odoo_version: str
    odoo_country: str | None = None
    status: str
    modules: list[ModuleSummaryResponse] = []


class ValidationReportResponse(BaseModel):
    project_id: str
    module_id: str
    total_rows: int
    total_issues: int
    columns_seen: list[str]
    columns_expected_missing: list[str]
    structural_mismatch: bool = False
    matched_columns_count: int = 0
    column_mapping: dict[str, str] = {}
    unmatched_columns: list[str] = []
    preview_rows: list[dict] = []
    issues: list[dict]
    can_download: bool


class UserMeResponse(BaseModel):
    free_project_used: bool
    has_active_subscription: bool
    subscription_expires_at: str | None = None
    monthly_export_count: int
    monthly_export_limit: int


class PaymentStartRequest(BaseModel):
    payment_type: str  # "per_project" | "subscription"
    network: str        # "polygon" | "base"
    project_id: str | None = None


class PaymentStartResponse(BaseModel):
    payment_id: str
    receive_address: str
    network: str
    expected_amount_usd: float
    expires_at: str


class PaymentStatusResponse(BaseModel):
    payment_id: str
    status: str
    confirmations_seen: int
    confirmations_required: int
