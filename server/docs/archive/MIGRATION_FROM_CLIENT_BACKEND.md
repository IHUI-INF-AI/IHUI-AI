# Migration: `client/backend` → `server/app`

**Date:** 2026-06-18
**Goal:** Make `client/` a pure frontend project by migrating all Python backend assets to `server/app/`, with zero frontend code changes. All legacy routes are registered directly at their original paths; no ASGI path rewriting is used.

---

## What Was Migrated

### Services (10 modules)

| Original (`client/backend/services/`) | Migrated (`server/app/services/`) | Notes |
|---|---|---|
| `database_service.py` | `database_service.py` | Import changed: `from api.config` → `from app.services._legacy_settings` |
| `pdf_service.py` | `pdf_service.py` | Now reads `LEGACY_UPLOAD_DIR` / `LEGACY_LOCAL_UPLOADS_DIR` from `LegacySettings` |
| `auth_service.py` | *(skipped)* | Server already has `auth_service` with different interface; `legacy_local.py` stubs created |
| `audit_service.py` | `audit_service.py` | Import changed: `from services.database_service` → `from app.services.database_service` |
| `security_service.py` | `security_service.py` | Bug fix: syntax error `sanitized.replace(pattern.lower(), ")` → `sanitized.replace(pattern.lower(), "")` |
| `diff_service.py` | `diff_service.py` | Bug fix: unterminated strings at lines 83, 85 |
| `upload_service.py` | `upload_service.py` | — |
| `customer_service_db.py` | `customer_service_db.py` | Copied to `server/app/core/` |
| `version_service.py` | `version_service.py` | — |
| `rbac_service.py` | `rbac_service.py` | — |

### Models (4 modules)

| Original | Migrated |
|---|---|
| `client/backend/api/models.py` | `server/app/api/v1/_legacy_internal/models.py` |
| `client/backend/api/schemas.py` | `server/app/api/v1/_legacy_internal/schemas.py` |
| `client/backend/api/config.py` | `server/app/api/v1/_legacy_internal/config.py` |

### Routes (9 modules)

| Original (`client/backend/`) | Migrated (`server/app/`) |
|---|---|
| `api/pdf_routes.py` | `api/v1/pdf/pdf_routes.py` |
| `api/upload/routes.py` | `api/v1/upload/routes.py` |
| `api/version/routes.py` | `api/v1/version/routes.py` |
| `api/rbac/routes.py` | `api/v1/rbac/routes.py` |
| `api/audit/routes.py` | `api/v1/audit/routes.py` |
| `api/agent/routes.py` | `api/v1/agent/routes.py` |
| `api/customer_service/customer_service_routes.py` | `api/v1/customer_service/customer_service_routes.py` |
| `api/customer_service/ticket_routes.py` | `api/v1/customer_service/ticket_routes.py` |
| `api/auth/legacy_local.py` | `api/v1/auth/legacy_local.py` (stub `NotImplementedError` handlers) |

### Other Assets

- **`client/backend/docs/`** → **`server/app/api/v1/docs/`** (Java backend-docs module rewritten in Python)
  - `models.py`, `routes.py`, `schema.sql`, `README.md`
- **`client/backend/customer_service_db.py`** → **`server/app/core/customer_service_db.py`**
- **`client/backend/api/_api_key.py`** → **`server/app/api/v1/_legacy_internal/_api_key.py`**
- **`client/backend/api/auth.py`** → **`server/app/api/v1/_legacy_internal/auth.py`**

---

## Key Architecture Decisions

### 1. Direct Path Registration (No ASGI Rewriting)

All legacy routers are mounted **directly at their original paths** in `main.py`:

```python
app.include_router(_pdf_router, prefix="/api/pdf", tags=["Legacy PDF"])
app.include_router(_upload_router, prefix="/api/upload", tags=["Legacy Upload"])
app.include_router(_cs_router, prefix="/api/customer-service", tags=["Legacy CS"])
app.include_router(_ticket_router, prefix="/api/zhs_api_ticket", tags=["Legacy Tickets"])
```

Examples:
- `GET /api/pdf/list` → `api/v1/pdf/pdf_routes.py`'s `router.get("/list")`
- `GET /api/customer-service/tickets` → `api/v1/customer_service/customer_service_routes.py`'s `router.get("")`
- `GET /api/upload/files` → `api/v1/upload/routes.py`'s `router.get("/files")`

The frontend calls the same `/api/<domain>/*` paths it always has; no rewriting middleware needed.

### 2. Mock Routes Isolation

In `mock/__init__.py`, the `_MODULES` catch-all list excludes `"upload"`, `"customer-service"`, `"audit"`, `"agent"` to prevent mock handlers from intercepting real legacy routes:

```python
_MODULES = [
    "auth", "user", "vip", "wallet", "courses", "login",
    "ai-program", "skills", "feature-flags", "fund",
    "orders", "payment", "recharge", "service-appointment", "speech",
    "unified-ai", "models", "mobile", "admin", "agents",
    # upload, customer-service, audit, agent removed — real routes handle these
]
```

Mock routes for these modules are commented out in `api_router` declarations. Mock routers are still registered **after** all real legacy routers, so they only catch truly unmapped paths (acting as a last-resort catch-all in development).

### 3. Settings Isolation (`LegacySettings`)

The server uses Pydantic V2 `Settings` with many fields. To prevent server settings from flooding the legacy config, `LegacySettings` uses:

```python
class LegacySettings(BaseSettings):
    model_config = ConfigConfigDict(env_prefix="LEGACY_", extra="ignore")
```

Legacy env vars **must** be prefixed with `LEGACY_`:
```bash
LEGACY_API_DOMAIN=127.0.0.1:8000
LEGACY_UPLOAD_DIR=uploads
LEGACY_LOCAL_UPLOADS_DIR=./local_uploads
```

### 4. Import Path Remapping

Routes import from legacy paths that no longer exist. A shim package `_legacy_internal` provides the old import targets:

```python
# Old (no longer valid):
from api.config import settings
from api.models import ...
from services.database_service import ...

# New (via shim):
from app.services._legacy_settings import settings   # was: from api.config
from app.api.v1._legacy_internal.models import ...   # was: from api.models
from app.services.database_service import ...      # was: from services.database_service
```

### 5. Router Variable Standardization

All migrated routes use `router = APIRouter()` (not `pdf_router` or `agent_router`). The server's `main.py` mounts them under `/api/<domain>`.

### 6. Auth Service Stub

The server's existing `auth_service` has a completely different interface from the legacy `client/backend/services/auth_service.py`. The legacy auth handlers (`/login/pwd`, `/login/wechat`, etc.) are stubs in `legacy_local.py` that raise `NotImplementedError` — they need a proper implementation when ready.

---

## Deleted from `client/`

| Path | Reason |
|---|---|
| `client/backend/` | Migrated to `server/app/` |
| `client/backend-api-service/` | Java artifact, no longer needed |
| `client/lib/` | Python packages (bcrypt, paramiko, etc.), unused |
| `client/backend-docs/` | Migrated to `server/app/api/v1/docs/` |
| `client/start-pdf-service.bat` | Backend now at `server/`, starts via `npm run dev:backend` |

---

## Updated in `client/`

| File | Change |
|---|---|
| `package.json` | `dev:backend` → `cd ../server && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` |
| `start-frontend.bat` | Added comment noting backend moved to `server/` |
| `vite.config.ts` | Added migration header comment |

---

## New Files in `server/app/`

| File | Purpose |
|---|---|
| `services/_legacy_settings.py` | `LegacySettings` with `env_prefix="LEGACY_"` + `extra="ignore"` |
| `api/v1/_legacy_internal/__init__.py` | Shim package |
| `api/v1/_legacy_internal/config.py` | Shim for `from api.config` |
| `api/v1/_legacy_internal/auth.py` | Shim for `from api.auth` |
| `api/v1/_legacy_internal/_api_key.py` | Shim for `from api._api_key` |
| `api/v1/_legacy_internal/models.py` | Shim for `from api.models` |
| `api/v1/_legacy_internal/schemas.py` | Shim for `from api.schemas` |
| `api/v1/docs/models.py`, `routes.py`, `schema.sql`, `README.md` | Docs module (was Java) |
| `core/customer_service_db.py` | Customer service DB module |
| `services/markdown_converter.py` | Python rewrite of Java `MarkdownConverter` |

---

## Verified Endpoints

All legacy routes respond with real implementation (not mock):

| Module | Path | Verified |
|---|---|---|
| PDF | `/api/pdf/list` | ✅ |
| Upload | `/api/upload/files` | ✅ |
| Upload | `/api/upload/shares` | ✅ |
| RBAC | `/api/rbac/roles` | ✅ |
| Audit | `/api/audit/logs` | ✅ |
| Agent | `/api/agent/list` | ✅ |
| Customer Service | `/api/customer-service/tickets` | ✅ |
| Tickets | `/api/zhs_api_ticket` | ✅ |
| Docs | `/api/docs/list` | ✅ |

Ticket lifecycle verified: create → reply → audit → close → reopen → assign.

---

## Rollback

The full backup is at `.migration_backup/`:
- `.migration_backup/client_backend/` — `client/backend/` at migration time
- `.migration_backup/client_lib/` — `client/lib/` at migration time
- `.migration_backup/client_backend_api_service/` — `client/backend-api-service/` at migration time
- `.migration_backup/client_backend_docs/` — `client/backend-docs/` at migration time

To rollback: restore files from the backup directories.
