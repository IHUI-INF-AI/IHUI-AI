"""
Code generation utility -- generates FastAPI/SQLAlchemy/Pydantic CRUD code.

Uses Jinja2 templates (stored as module-level strings) to produce:
  - API route file  (router + CRUD endpoints)
  - SQLAlchemy model file
  - Pydantic schema file

Logic ported from Admin VelocityUtils / GenUtils.
"""

from __future__ import annotations

import io
import re
import zipfile
from datetime import datetime
from typing import Any

from jinja2 import BaseLoader, Environment

# ---------------------------------------------------------------------------
# Type mapping: SQL column type -> Python type
# ---------------------------------------------------------------------------

_TYPE_MAP_STR = ("char", "varchar", "text", "longtext", "mediumtext", "tinytext", "enum", "set", "json", "nvarchar")
_TYPE_MAP_INT = ("tinyint", "smallint", "mediumint", "int", "integer")
_TYPE_MAP_BIG = ("bigint",)
_TYPE_MAP_FLOAT = ("float", "double", "real")
_TYPE_MAP_DECIMAL = ("decimal", "numeric")
_TYPE_MAP_DATE = ("date",)
_TYPE_MAP_DATETIME = ("datetime", "timestamp")
_TYPE_MAP_BOOL = ("bit", "boolean", "bool")


def _resolve_python_type(column_type: str, column_name: str) -> str:
    """Map a SQL column type to a Python type string."""
    ct = column_type.lower().split("(")[0].strip()
    if any(ct.startswith(t) for t in _TYPE_MAP_STR):
        return "str"
    if any(ct.startswith(t) for t in _TYPE_MAP_DATE):
        return "datetime.date"
    if any(ct.startswith(t) for t in _TYPE_MAP_DATETIME):
        return "datetime"
    if any(ct.startswith(t) for t in _TYPE_MAP_DECIMAL):
        return "Decimal"
    if any(ct.startswith(t) for t in _TYPE_MAP_FLOAT):
        return "float"
    if any(ct.startswith(t) for t in _TYPE_MAP_BIG):
        return "int"
    if any(ct.startswith(t) for t in _TYPE_MAP_INT):
        # check display width: tinyint(1) -> bool
        m = re.search(r"\((\d+)\)", column_type.lower())
        if ct == "tinyint" and m and int(m.group(1)) == 1:
            return "bool"
        return "int"
    if ct in _TYPE_MAP_BOOL:
        return "bool"
    return "str"


def _resolve_sa_type(column_type: str) -> str:
    """Map SQL column type to SQLAlchemy column type string."""
    ct = column_type.lower().split("(")[0].strip()
    # extract length/precision
    m = re.search(r"\((\d+)(?:,\s*(\d+))?\)", column_type)
    length = int(m.group(1)) if m else None

    if any(ct.startswith(t) for t in _TYPE_MAP_STR):
        if length:
            return f"String({length})"
        return "Text" if "text" in ct else "String(255)"
    if any(ct.startswith(t) for t in _TYPE_MAP_DATE):
        return "Date"
    if any(ct.startswith(t) for t in _TYPE_MAP_DATETIME):
        return "DateTime"
    if any(ct.startswith(t) for t in _TYPE_MAP_DECIMAL):
        if m and m.group(2):
            return f"Numeric({length}, {int(m.group(2))})"
        return "Numeric(10, 2)"
    if any(ct.startswith(t) for t in _TYPE_MAP_FLOAT):
        return "Float"
    if any(ct.startswith(t) for t in _TYPE_MAP_BIG):
        return "BigInteger"
    if any(ct.startswith(t) for t in _TYPE_MAP_INT):
        if ct == "tinyint" and m and int(m.group(1)) == 1:
            return "Boolean"
        return "Integer"
    return "String(255)"


# ---------------------------------------------------------------------------
# Naming helpers
# ---------------------------------------------------------------------------


def to_camel_case(name: str) -> str:
    """snake_case -> camelCase."""
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def to_pascal_case(name: str) -> str:
    """snake_case -> PascalCase."""
    return "".join(p.capitalize() for p in name.split("_"))


def strip_table_prefix(table_name: str, prefixes: tuple[str, ...] = ("sys_", "zhs_", "gen_")) -> str:
    """Remove common table prefixes."""
    for pfx in prefixes:
        if table_name.startswith(pfx):
            return table_name[len(pfx) :]
    return table_name


def derive_names(table_name: str, table_comment: str) -> dict[str, str]:
    """Derive class/module/business names from table name."""
    short = strip_table_prefix(table_name)
    class_name = to_pascal_case(short)
    # module = first segment before underscore, or the whole short name
    parts = short.split("_")
    module_name = parts[0] if len(parts) > 1 else short
    business_name = parts[-1] if len(parts) > 1 else short
    function_name = (table_comment or "").replace("表", "").strip() or class_name
    return {
        "class_name": class_name,
        "module_name": module_name,
        "business_name": business_name,
        "function_name": function_name,
        "table_name_lower": short,
    }


# ---------------------------------------------------------------------------
# Column metadata init (port of GenUtils.initColumnField)
# ---------------------------------------------------------------------------


def init_column_meta(col: dict[str, Any]) -> dict[str, Any]:
    """Enrich a column dict with derived metadata (python_field, python_type, etc.)."""
    col["python_field"] = to_camel_case(col["column_name"])
    col["python_type"] = _resolve_python_type(col["column_type"], col["column_name"])
    col["sa_type"] = _resolve_sa_type(col["column_type"])

    cn = col["column_name"]
    col.setdefault("is_pk", "1" if cn in ("id",) else "0")
    col.setdefault("is_required", "1" if col["is_pk"] == "1" else "0")
    col.setdefault("is_insert", "1")
    col.setdefault(
        "is_edit",
        (
            "0"
            if col["is_pk"] == "1" or cn in ("create_by", "create_time", "update_by", "update_time", "del_flag")
            else "1"
        ),
    )
    col.setdefault("is_list", "0" if col["is_pk"] == "1" or cn in ("create_by", "update_by", "del_flag") else "1")
    col.setdefault("is_query", "0")
    col.setdefault("query_type", "LIKE" if cn.endswith("name") else "EQ")
    col.setdefault("html_type", "input")
    col.setdefault("dict_type", "")

    # html_type heuristics
    if cn.endswith("status"):
        col["html_type"] = "radio"
    elif cn.endswith("type") or cn.endswith("sex"):
        col["html_type"] = "select"
    elif cn.endswith("content"):
        col["html_type"] = "textarea"
    elif cn.endswith("image"):
        col["html_type"] = "image-upload"
    elif cn.endswith("file"):
        col["html_type"] = "file-upload"

    return col


# ---------------------------------------------------------------------------
# Jinja2 templates (as strings)
# ---------------------------------------------------------------------------

_MODEL_TEMPLATE = r'''"""SQLAlchemy model for {{ function_name }} (auto-generated)."""

from sqlalchemy import Column, {{ sa_imports | join("", "") }}, func
from app.database import Base
from app.models.base import TimestampMixin


class {{ class_name }}(TimestampMixin, Base):
    __tablename__ = "{{ table_name }}"

{% for col in columns %}
    {{ col.python_field }} = Column({{ col.sa_type }}{% if col.is_pk == '1' %}, primary_key=True, autoincrement=True{% endif %}, comment="{{ col.column_comment }}")
{% endfor %}
'''

_SCHEMA_TEMPLATE = r'''"""Pydantic schemas for {{ function_name }} (auto-generated)."""

from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


class {{ class_name }}Base(BaseModel):
    """Shared properties."""
{% for col in columns if col.is_pk != '1' and col.column_name not in ('create_by', 'create_time', 'update_by', 'update_time', 'del_flag') %}
    {{ col.python_field }}: {{ col.python_type }}{% if col.is_required != '1' %} | None = None{% endif %}

{% endfor %}


class {{ class_name }}Create({{ class_name }}Base):
    """Properties to receive on creation."""
    pass


class {{ class_name }}Update({{ class_name }}Base):
    """Properties to receive on update -- all optional."""
{% for col in columns if col.is_pk != '1' and col.column_name not in ('create_by', 'create_time', 'update_by', 'update_time', 'del_flag') %}
    {{ col.python_field }}: {{ col.python_type }} | None = None
{% endfor %}


class {{ class_name }}Out({{ class_name }}Base):
    """Properties to return to client."""
    {{ pk_field }}: {{ pk_type }}

    model_config = {"from_attributes": True}
'''

_ROUTE_TEMPLATE = r'''"""CRUD routes for {{ function_name }} (auto-generated)."""

from fastapi import APIRouter, Depends, Query, Body, Path
from sqlalchemy import text
from app.security import require_login
from app.schemas.common import success, error
from app.database import get_session

router = APIRouter()

# ---- placeholder imports (uncomment after model/schema files exist) ----
# from app.models.{{ module_name }}_models import {{ class_name }}
# from app.schemas.{{ module_name }} import {{ class_name }}Create, {{ class_name }}Update, {{ class_name }}Out


@router.get("/{{ business_name }}/list", summary="List {{ function_name }}")
async def list_{{ business_name }}(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user_uuid: str = Depends(require_login),
):
    """分页查询{{ function_name }}列表"""
    with get_session() as db:
    from app.models.{{ module_name }}_models import {{ class_name }}
        q = db.query({{ class_name }})
        total = q.count()
        rows = q.offset((page - 1) * limit).limit(limit).all()
        return success([r.__dict__ for r in rows], total=total)
    except Exception as e:
        return error(str(e))


@router.get("/{{ business_name }}/{{ '{' }}{{ pk_field }}{{ '}' }}", summary="Get {{ function_name }} detail")
async def get_{{ business_name }}(
    {{ pk_field }}: {{ pk_type }} = Path(...),
    user_uuid: str = Depends(require_login),
):
    """查询{{ function_name }}详情"""
    with get_session() as db:
    from app.models.{{ module_name }}_models import {{ class_name }}
        row = db.query({{ class_name }}).filter({{ class_name }}.{{ pk_field }} == {{ pk_field }}).first()
        if not row:
            return error("Not found", "404")
        return success(row.__dict__)
    except Exception as e:
        return error(str(e))


@router.post("/{{ business_name }}", summary="Create {{ function_name }}")
async def create_{{ business_name }}(
    data: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """新增{{ function_name }}"""
    with get_session() as db:
    from app.models.{{ module_name }}_models import {{ class_name }}
        obj = {{ class_name }}(**data)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return success(obj.__dict__)
    except Exception as e:
        db.rollback()
        return error(str(e))


@router.put("/{{ business_name }}", summary="Update {{ function_name }}")
async def update_{{ business_name }}(
    data: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """修改{{ function_name }}"""
    with get_session() as db:
    from app.models.{{ module_name }}_models import {{ class_name }}
        pk = data.get("{{ pk_field }}")
        if not pk:
            return error("Missing primary key")
        obj = db.query({{ class_name }}).filter({{ class_name }}.{{ pk_field }} == pk).first()
        if not obj:
            return error("Not found", "404")
        for k, v in data.items():
            if k != "{{ pk_field }}" and hasattr(obj, k):
                setattr(obj, k, v)
        db.commit()
        return success()
    except Exception as e:
        db.rollback()
        return error(str(e))


@router.delete("/{{ business_name }}/{{ '{' }}{{ pk_field }}{{ '}' }}", summary="Delete {{ function_name }}")
async def delete_{{ business_name }}(
    {{ pk_field }}: {{ pk_type }} = Path(...),
    user_uuid: str = Depends(require_login),
):
    """删除{{ function_name }}"""
    with get_session() as db:
    from app.models.{{ module_name }}_models import {{ class_name }}
        obj = db.query({{ class_name }}).filter({{ class_name }}.{{ pk_field }} == {{ pk_field }}).first()
        if not obj:
            return error("Not found", "404")
        db.delete(obj)
        db.commit()
        return success()
    except Exception as e:
        db.rollback()
        return error(str(e))
'''

# ---------------------------------------------------------------------------
# Render functions
# ---------------------------------------------------------------------------

_jinja_env = Environment(loader=BaseLoader(), keep_trailing_newline=True)


def _build_context(table_meta: dict[str, Any], columns: list[dict[str, Any]]) -> dict[str, Any]:
    """Build the Jinja2 template context from table + column metadata."""
    names = derive_names(table_meta["table_name"], table_meta.get("table_comment", ""))

    # Resolve primary key
    pk_col = next(
        (c for c in columns if c.get("is_pk") == "1"),
        columns[0] if columns else {"python_field": "id", "python_type": "int"},
    )

    # SA imports needed
    sa_types_used = {c["sa_type"].split("(")[0] for c in columns}
    sa_imports = sorted(sa_types_used | {"String", "Integer"})

    return {
        "table_name": table_meta["table_name"],
        "table_comment": table_meta.get("table_comment", ""),
        "class_name": names["class_name"],
        "module_name": names["module_name"],
        "business_name": names["business_name"],
        "function_name": names["function_name"],
        "columns": columns,
        "pk_field": pk_col["python_field"],
        "pk_type": pk_col["python_type"],
        "sa_imports": sa_imports,
        "now": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def preview_code(table_meta: dict[str, Any], columns: list[dict[str, Any]]) -> dict[str, str]:
    """
    Render all templates and return ``{filename: source_code}`` for preview.
    """
    ctx = _build_context(table_meta, columns)
    names = derive_names(table_meta["table_name"], table_meta.get("table_comment", ""))
    mn = names["module_name"]

    result: dict[str, str] = {}
    for tpl_name, template_str in [
        (f"models/{mn}_models.py", _MODEL_TEMPLATE),
        (f"schemas/{mn}.py", _SCHEMA_TEMPLATE),
        (f"api/v1/{mn}/{mn}.py", _ROUTE_TEMPLATE),
    ]:
        tpl = _jinja_env.from_string(template_str)
        result[tpl_name] = tpl.render(**ctx)
    return result


def download_code_zip(table_meta: dict[str, Any], columns: list[dict[str, Any]]) -> bytes:
    """
    Render all templates and return a ZIP archive (bytes).
    """
    rendered = preview_code(table_meta, columns)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, content in rendered.items():
            zf.writestr(filename, content)
    return buf.getvalue()
