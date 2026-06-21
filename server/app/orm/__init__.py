"""app/orm 包初始化 (建议 124)."""

from app.orm.tenant_base import (
    TenantBase,
    _tenant_models,
    clear_tenant_models,
    get_tenant_models,
    get_tenant_table_class,
    list_tenant_tables,
    make_tenant_declarative_base,
)
from app.orm.tenant_meta import (
    TenantMetadataBuilder,
    list_active_tenant_ids,
)

__all__ = [
    "TenantBase",
    "TenantMetadataBuilder",
    "_tenant_models",
    "clear_tenant_models",
    "get_tenant_models",
    "get_tenant_table_class",
    "list_active_tenant_ids",
    "list_tenant_tables",
    "make_tenant_declarative_base",
]
