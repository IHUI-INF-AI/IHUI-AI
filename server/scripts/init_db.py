"""数据库初始化脚本 — 创建所有历史业务表结构"""

import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from loguru import logger

from app.database import Base


def init_database():
    """创建所有表结构"""
    logger.info("=" * 70)
    logger.info("开始初始化数据库表结构")
    logger.info("=" * 70)

    # 导入所有模型以注册到 Base.metadata
    try:
        # 核心模型
        # 代码生成
        # 智能体模型
        # 内容模型
        from app.models import (
            activity_models,
            agent_misc_models,
            agent_models,
            agent_rule_models,
            agent_settlement,
            ai_gc_models,
            app_content_models,
            ask_models,
            behavior_models,
            circle_models,
            codegen_models,
            context_models,
            course_models,
            education_ext_models,
            exam_models,
            identity_models,
            live_models,
            message_models,
            notification_models,
            oauth_models,
            payment_models,
            point_models,
            resource_models,
            search_models,
            sys_models,
            token_models,
            user_models,
            visit_models,
        )
    except ImportError as e:
        logger.warning(f"模型导入警告 (部分模型可能未注册, Base.metadata 可能不完整): {e}")

    # 统计表数量
    tables = list(Base.metadata.tables.keys())
    logger.info(f"已注册 {len(tables)} 个表")

    # 按数据库引擎分组
    from app.database import ENGINES
    from sqlalchemy import text

    def get_sqlite_type(col):
        """获取列的 SQLite 类型"""
        type_name = str(col.type).upper()
        if 'VARCHAR' in type_name or 'CHAR' in type_name or 'TEXT' in type_name:
            length = col.type.length or 255
            return f'VARCHAR({length})'
        if 'BIGINT' in type_name:
            return 'BIGINT'
        if 'INT' in type_name:
            return 'INTEGER'
        if 'DATETIME' in type_name or 'TIMESTAMP' in type_name:
            return 'DATETIME'
        if 'FLOAT' in type_name or 'DECIMAL' in type_name or 'NUMERIC' in type_name:
            return 'FLOAT'
        if 'BOOLEAN' in type_name:
            return 'BOOLEAN'
        return 'TEXT'

    for eng_name, eng in ENGINES.items():
        try:
            url = str(eng.url)
            if url.startswith("sqlite"):
                # SQLite: 逐个创建表, 用 schema_translate_map 把 public 翻译为无 schema
                created, skipped = 0, 0
                for table in Base.metadata.tables.values():
                    conn = eng.connect().execution_options(schema_translate_map={"public": None})
                    try:
                        table.create(bind=conn, checkfirst=True)
                        conn.commit()
                        created += 1
                    except Exception as e:
                        logger.error(f"create table {table.name} failed: {e}")
                        skipped += 1
                    finally:
                        conn.close()
                logger.info(f"[{eng_name}] (SQLite) 创建 {created} 个表, 跳过 {skipped} 个")

                # 自动补齐缺失列
                with eng.connect() as conn:
                    result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
                    db_tables = {r[0] for r in result.fetchall()}

                added_cols = 0
                for tname, table in Base.metadata.tables.items():
                    pure_name = tname.split('.', 1)[1] if '.' in tname else tname
                    if pure_name not in db_tables:
                        continue
                    with eng.connect() as conn:
                        result = conn.execute(text(f"PRAGMA table_info({pure_name})"))
                        db_cols = {row[1] for row in result.fetchall()}
                    model_cols = {col.name: col for col in table.columns}
                    missing = set(model_cols.keys()) - db_cols
                    for col_name in missing:
                        col = model_cols[col_name]
                        sqlite_type = get_sqlite_type(col)
                        try:
                            with eng.connect() as conn:
                                conn.execute(text(f'ALTER TABLE {pure_name} ADD COLUMN {col_name} {sqlite_type}'))
                                conn.commit()
                            added_cols += 1
                        except Exception as e:
                            logger.debug(f"add column skipped (table={pure_name}, col={col_name}): {e}")
                if added_cols:
                    logger.info(f"[{eng_name}] (SQLite) 补齐 {added_cols} 列")
            else:
                Base.metadata.create_all(bind=eng, checkfirst=True)
                logger.info(f"[{eng_name}] 表结构创建完成 ({len(Base.metadata.tables)} 个表)")
        except Exception as e:
            logger.error(f"[{eng_name}] 创建失败: {e}")

    logger.info("=" * 70)
    logger.info("数据库初始化完成")
    logger.info("=" * 70)


if __name__ == "__main__":
    init_database()
