from __future__ import annotations

from pydantic import BaseModel


class AvailableCombination(BaseModel):
    version: str
    module: str
    country: str | None = None  # None = módulo sin variación por país


class ProjectCreateResponse(BaseModel):
    project_id: str
    status: str


class ValidationReportResponse(BaseModel):
    project_id: str
    total_rows: int
    total_issues: int
    columns_seen: list[str]
    columns_expected_missing: list[str]
    structural_mismatch: bool = False
    matched_columns_count: int = 0
    issues: list[dict]
    can_download: bool


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
