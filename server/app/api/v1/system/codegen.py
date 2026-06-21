"""
Code generation routes (Admin gen module -> FastAPI).

Endpoints:
  GET  /gen/list              -- list imported codegen tables
  GET  /gen/db/list           -- list database tables (from information_schema)
  GET  /gen/column/{table_id} -- columns of an imported table
  POST /gen/import_table      -- import DB table(s) into codegen
  GET  /gen/preview/{table_id} -- preview generated code
  GET  /gen/download/{table_name} -- download generated code as zip
"""

from __future__ import annotations

import io

from fastapi import APIRouter, Body, Depends, Path, Query
from fastapi.responses import StreamingResponse
from loguru import logger
from sqlalchemy import text

from app.database import engine1, get_session
from app.models.codegen_models import CodegenColumn, CodegenTable
from app.schemas.common import error, success
from app.security import require_login
from app.utils.codegen_util import (
    derive_names,
    download_code_zip,
    init_column_meta,
    preview_code,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Allowed DB names for information_schema queries
# ---------------------------------------------------------------------------
_DB_NAMES = ("zhs_ai_project", "zhs_center_project", "zhs_educational_training")


# ===========================================================================
# 1. GET /gen/list -- already-imported codegen tables
# ===========================================================================


@router.get("/gen/list", summary="List imported codegen tables")
async def gen_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    table_name: str | None = Query(None),
    table_comment: str | None = Query(None),
    user_uuid: str = Depends(require_login),
):
    """分页查询已导入的代码生成表列表"""
    with get_session() as db:
        try:
            q = db.query(CodegenTable)
            if table_name:
                q = q.filter(CodegenTable.table_name.like(f"%{table_name}%"))
            if table_comment:
                q = q.filter(CodegenTable.table_comment.like(f"%{table_comment}%"))
            q = q.order_by(CodegenTable.create_time.desc())
            total = q.count()
            rows = q.offset((page - 1) * limit).limit(limit).all()
            data = []
            for r in rows:
                data.append(
                    {
                        "table_id": r.table_id,
                        "table_name": r.table_name,
                        "table_comment": r.table_comment,
                        "class_name": r.class_name,
                        "package_name": r.package_name,
                        "module_name": r.module_name,
                        "business_name": r.business_name,
                        "function_name": r.function_name,
                        "gen_type": r.gen_type,
                        "gen_path": r.gen_path,
                        "create_time": str(r.create_time) if r.create_time else None,
                    }
                )
            return success(data, total=total)
        except Exception as e:
            logger.error(f"gen/list error: {e}")
            return error(str(e))


# ===========================================================================
# 2. GET /gen/db/list -- database tables from information_schema
# ===========================================================================


@router.get("/gen/db/list", summary="List database tables from information_schema")
async def gen_db_list(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    table_name: str | None = Query(None),
    table_comment: str | None = Query(None),
    user_uuid: str = Depends(require_login),
):
    """从 information_schema 查询数据库表列表"""
    offset = (page - 1) * limit
    conditions = ["t.table_schema IN :schemas"]
    params: dict = {"schemas": _DB_NAMES, "limit": limit, "offset": offset}

    if table_name:
        conditions.append("t.table_name LIKE :tname")
        params["tname"] = f"%{table_name}%"
    if table_comment:
        conditions.append("t.table_comment LIKE :tcomment")
        params["tcomment"] = f"%{table_comment}%"

    where = " AND ".join(conditions)

    sql_count = text(
        f"""
        SELECT COUNT(*) FROM information_schema.tables t
        WHERE {where}
    """
    )
    sql_data = text(
        f"""
        SELECT t.table_name    AS tableName,
               t.table_comment AS tableComment,
               t.create_time   AS createTime,
               t.table_schema  AS tableSchema
        FROM information_schema.tables t
        WHERE {where}
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.create_time DESC
        LIMIT :limit OFFSET :offset
    """
    )

    try:
        with engine1.connect() as conn:
            total = conn.execute(sql_count, params).scalar() or 0
            result = conn.execute(sql_data, params).mappings().all()
        data = [dict(row) for row in result]
        return success(data, total=total)
    except Exception as e:
        logger.error(f"gen/db/list error: {e}")
        return error(str(e))


# ===========================================================================
# 3. GET /gen/column/{table_id} -- columns of an imported table
# ===========================================================================


@router.get("/gen/column/{table_id}", summary="List columns for an imported table")
async def gen_column_list(
    table_id: int = Path(...),
    user_uuid: str = Depends(require_login),
):
    """查询已导入表的字段列表"""
    with get_session() as db:
        try:
            rows = db.query(CodegenColumn).filter(CodegenColumn.table_id == table_id).order_by(CodegenColumn.sort).all()
            data = []
            for r in rows:
                data.append(
                    {
                        "column_id": r.column_id,
                        "table_id": r.table_id,
                        "column_name": r.column_name,
                        "column_comment": r.column_comment,
                        "column_type": r.column_type,
                        "java_type": r.java_type,
                        "java_field": r.java_field,
                        "is_pk": r.is_pk,
                        "is_required": r.is_required,
                        "is_insert": r.is_insert,
                        "is_edit": r.is_edit,
                        "is_list": r.is_list,
                        "is_query": r.is_query,
                        "query_type": r.query_type,
                        "html_type": r.html_type,
                        "dict_type": r.dict_type,
                        "sort": r.sort,
                    }
                )
            return success(data, total=len(data))
        except Exception as e:
            logger.error(f"gen/column error: {e}")
            return error(str(e))


# ===========================================================================
# 4. POST /gen/import_table -- import DB table(s) into codegen
# ===========================================================================


@router.post("/gen/import_table", summary="Import database tables into codegen")
async def gen_import_table(
    tables: str = Body(..., embed=True, description="Comma-separated table names"),
    user_uuid: str = Depends(require_login),
):
    """导入数据库表结构到代码生成"""
    table_names = [t.strip() for t in tables.split(",") if t.strip()]
    if not table_names:
        return error("tables parameter is required")

    with get_session() as db:
        try:
            imported = 0
            for tname in table_names:
                # Check if already imported
                exists = db.query(CodegenTable).filter(CodegenTable.table_name == tname).first()
                if exists:
                    logger.info(f"Table {tname} already imported, skipping")
                    continue

                # Fetch table metadata from information_schema
                sql_table = text(
                    """
                    SELECT table_name, table_comment
                    FROM information_schema.tables
                    WHERE table_schema IN :schemas AND table_name = :tname
                """
                )
                with engine1.connect() as conn:
                    tinfo = conn.execute(sql_table, {"schemas": _DB_NAMES, "tname": tname}).mappings().first()
                if not tinfo:
                    logger.warning(f"Table {tname} not found in information_schema")
                    continue

                # Derive names
                names = derive_names(tname, tinfo["table_comment"] or "")

                # Insert gen_table row
                gen_table = CodegenTable(
                    table_name=tname,
                    table_comment=tinfo["table_comment"] or "",
                    class_name=names["class_name"],
                    package_name="app",
                    module_name=names["module_name"],
                    business_name=names["business_name"],
                    function_name=names["function_name"],
                    function_author="codegen",
                    tpl_category="crud",
                    tpl_web_type="element-ui",
                    gen_type="0",
                    create_by=user_uuid,
                )
                db.add(gen_table)
                db.flush()  # to get table_id

                # Fetch columns from information_schema
                sql_cols = text(
                    """
                    SELECT column_name, column_comment, column_type, column_default,
                           (CASE WHEN column_key = 'PRI' THEN '1' ELSE '0' END) AS is_pk
                    FROM information_schema.columns
                    WHERE table_schema IN :schemas AND table_name = :tname
                    ORDER BY ordinal_position
                """
                )
                with engine1.connect() as conn:
                    db_cols = conn.execute(sql_cols, {"schemas": _DB_NAMES, "tname": tname}).mappings().all()

                for idx, col in enumerate(db_cols):
                    col_dict = dict(col)
                    col_dict["table_id"] = gen_table.table_id
                    col_dict["sort"] = idx
                    init_column_meta(col_dict)

                    gen_col = CodegenColumn(
                        table_id=gen_table.table_id,
                        column_name=col_dict["column_name"],
                        column_comment=col_dict.get("column_comment", ""),
                        column_type=col_dict["column_type"],
                        java_type=col_dict["python_type"],
                        java_field=col_dict["python_field"],
                        is_pk=col_dict.get("is_pk", "0"),
                        is_increment=(
                            "1"
                            if col_dict.get("is_pk") == "1"
                            and (
                                "auto_increment" in col_dict.get("column_type", "").lower()
                                or "nextval" in str(col_dict.get("column_default", "")).lower()
                            )
                            else "0"
                        ),
                        is_required=col_dict.get("is_required", "0"),
                        is_insert=col_dict.get("is_insert", "1"),
                        is_edit=col_dict.get("is_edit", "0"),
                        is_list=col_dict.get("is_list", "0"),
                        is_query=col_dict.get("is_query", "0"),
                        query_type=col_dict.get("query_type", "EQ"),
                        html_type=col_dict.get("html_type", "input"),
                        dict_type=col_dict.get("dict_type", ""),
                        sort=idx,
                        create_by=user_uuid,
                    )
                    db.add(gen_col)

                imported += 1

            db.commit()
            return success({"imported": imported})
        except Exception as e:
            logger.error(f"gen/import_table error: {e}")
            return error(str(e))


# ===========================================================================
# 5. GET /gen/preview/{table_id} -- preview generated code
# ===========================================================================


@router.get("/gen/preview/{table_id}", summary="Preview generated code for a table")
async def gen_preview(
    table_id: int = Path(...),
    user_uuid: str = Depends(require_login),
):
    """预览生成的代码"""
    with get_session() as db:
        try:
            table = db.query(CodegenTable).filter(CodegenTable.table_id == table_id).first()
            if not table:
                return error("Table not found", "404")

            columns = (
                db.query(CodegenColumn).filter(CodegenColumn.table_id == table_id).order_by(CodegenColumn.sort).all()
            )

            table_meta = {
                "table_name": table.table_name,
                "table_comment": table.table_comment,
            }
            col_list = [
                {
                    "column_name": c.column_name,
                    "column_comment": c.column_comment,
                    "column_type": c.column_type,
                    "is_pk": c.is_pk,
                    "is_required": c.is_required,
                    "is_insert": c.is_insert,
                    "is_edit": c.is_edit,
                    "is_list": c.is_list,
                    "is_query": c.is_query,
                    "query_type": c.query_type,
                    "html_type": c.html_type,
                    "dict_type": c.dict_type,
                }
                for c in columns
            ]

            rendered = preview_code(table_meta, col_list)
            return success(rendered)
        except Exception as e:
            logger.error(f"gen/preview error: {e}")
            return error(str(e))


# ===========================================================================
# 6. GET /gen/download/{table_name} -- download generated code as zip
# ===========================================================================


@router.get("/gen/download/{table_name}", summary="Download generated code as zip")
async def gen_download(
    table_name: str = Path(...),
    user_uuid: str = Depends(require_login),
):
    """下载生成的代码 zip 文件"""
    with get_session() as db:
        try:
            table = db.query(CodegenTable).filter(CodegenTable.table_name == table_name).first()
            if not table:
                return error("Table not found", "404")

            columns = (
                db.query(CodegenColumn)
                .filter(CodegenColumn.table_id == table.table_id)
                .order_by(CodegenColumn.sort)
                .all()
            )

            table_meta = {
                "table_name": table.table_name,
                "table_comment": table.table_comment,
            }
            col_list = [
                {
                    "column_name": c.column_name,
                    "column_comment": c.column_comment,
                    "column_type": c.column_type,
                    "is_pk": c.is_pk,
                    "is_required": c.is_required,
                    "is_insert": c.is_insert,
                    "is_edit": c.is_edit,
                    "is_list": c.is_list,
                    "is_query": c.is_query,
                    "query_type": c.query_type,
                    "html_type": c.html_type,
                    "dict_type": c.dict_type,
                }
                for c in columns
            ]

            zip_bytes = download_code_zip(table_meta, col_list)
            return StreamingResponse(
                io.BytesIO(zip_bytes),
                media_type="application/octet-stream",
                headers={"Content-Disposition": f'attachment; filename="{table_name}_codegen.zip"'},
            )
        except Exception as e:
            logger.error(f"gen/download error: {e}")
            return error(str(e))


# ===========================================================================
# 7. PUT /gen -- update table/column metadata
# ===========================================================================


@router.put("/gen", summary="Update codegen table metadata")
async def gen_update(
    data: dict = Body(...),
    user_uuid: str = Depends(require_login),
):
    """修改代码生成业务配置"""
    table_id = data.get("table_id")
    if not table_id:
        return error("table_id is required")

    with get_session() as db:
        try:
            table = db.query(CodegenTable).filter(CodegenTable.table_id == table_id).first()
            if not table:
                return error("Table not found", "404")

            # Update table-level fields
            for field in (
                "table_comment",
                "class_name",
                "package_name",
                "module_name",
                "business_name",
                "function_name",
                "function_author",
                "tpl_category",
                "gen_type",
                "gen_path",
                "options",
            ):
                if field in data:
                    setattr(table, field, data[field])

            # Update columns if provided
            columns_data = data.get("columns")
            if columns_data:
                for col_data in columns_data:
                    col_id = col_data.get("column_id")
                    if not col_id:
                        continue
                    col = db.query(CodegenColumn).filter(CodegenColumn.column_id == col_id).first()
                    if not col:
                        continue
                    for cf in (
                        "column_comment",
                        "java_type",
                        "java_field",
                        "is_pk",
                        "is_required",
                        "is_insert",
                        "is_edit",
                        "is_list",
                        "is_query",
                        "query_type",
                        "html_type",
                        "dict_type",
                        "sort",
                    ):
                        if cf in col_data:
                            setattr(col, cf, col_data[cf])

            db.commit()
            return success()
        except Exception as e:
            logger.error(f"gen/update error: {e}")
            return error(str(e))


# ===========================================================================
# 8. DELETE /gen/{table_ids} -- delete imported tables
# ===========================================================================


@router.delete("/gen/{table_ids}", summary="Delete imported codegen tables")
async def gen_delete(
    table_ids: str = Path(..., description="Comma-separated table IDs"),
    user_uuid: str = Depends(require_login),
):
    """删除代码生成记录"""
    ids = [int(i.strip()) for i in table_ids.split(",") if i.strip().isdigit()]
    if not ids:
        return error("Invalid table_ids")

    with get_session() as db:
        try:
            db.query(CodegenColumn).filter(CodegenColumn.table_id.in_(ids)).delete(synchronize_session=False)
            db.query(CodegenTable).filter(CodegenTable.table_id.in_(ids)).delete(synchronize_session=False)
            db.commit()
            return success()
        except Exception as e:
            logger.error(f"gen/delete error: {e}")
            return error(str(e))
