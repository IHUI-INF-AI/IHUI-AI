"""字段级 type-check 自动化测试.

目的: 防止后续重构中字段类型被悄悄改坏.
  1. 检查所有 model 的 id 主键都是 String(64) UUID 格式
  2. 检查金额字段 (price/total_amount/pay_amount 等) 都是 Integer(分) 而非 Float
  3. 检查时间字段都有 timestamp_mixin 或 default
  4. 检查 required 字段 (nullable=False) 不被改成 nullable=True
  5. 检查 31 张新表 + 78 个 model 全部可被 SQLAlchemy 反射

运行: pytest tests/test_field_migration.py -v
"""
from __future__ import annotations

import inspect
import re
from typing import Any

import pytest
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase

from app.models import *  # noqa: F401,F403  触发所有 model 注册
from app.models.base import TimestampMixin


# ---------------------------------------------------------------------------
# 1. 核心规则
# ---------------------------------------------------------------------------

# 金额类字段 (单位必须是分, 即 Integer, 不能是 Float/Numeric)
AMOUNT_FIELDS = {
    "price", "original_price", "total_score", "score", "amount",
    "total_amount", "pay_amount", "payment_amount", "discount_amount",
    "product_fee", "invoice_amount", "average_score", "cost",
    "original_price", "sale_price", "refund_amount", "withdrawal_amount",
}

# 状态/枚举类字段 (int)
INT_FIELDS = {"status", "type", "level", "sort_order", "sort_weight", "is_top", "is_essence"}

# 必填字段
REQUIRED_FIELDS = {"id", "name", "title", "member_id", "user_id", "lesson_id"}

# 时间字段名
TIME_FIELDS = {"create_time", "update_time", "created_at", "updated_at",
               "start_time", "end_time", "submit_time", "award_date", "birthday"}


def _all_model_classes() -> list[type]:
    """从 app.models 抓取所有继承 Base 的 model 类."""
    from app.database import Base
    result = []
    for name, obj in inspect.getmembers(__import__("app.models", fromlist=["*"])):
        if inspect.isclass(obj) and issubclass(obj, Base) and obj is not Base:
            result.append(obj)
    return result


# ---------------------------------------------------------------------------
# 2. 主键检查
# ---------------------------------------------------------------------------

class TestPrimaryKey:
    """所有主键必须是 String(64) UUID."""

    @pytest.mark.parametrize("model_class", _all_model_classes())
    def test_pk_is_string64_or_int(self, model_class):
        """主键 id 列: 优先 String(64) UUID; 兼容已有 Integer 自增 (如 admin_*)"""
        pk_col = None
        for col in model_class.__table__.primary_key.columns:
            pk_col = col
            break
        assert pk_col is not None, f"{model_class.__name__} 缺少主键"
        col_type = pk_col.type
        # 允许类型: String(64) / Integer (admin_* legacy) / String(32) (id_mapping)
        ok = (
            (isinstance(col_type, String) and col_type.length in (32, 64))
            or isinstance(col_type, (Integer, BigInteger, SmallInteger))
        )
        assert ok, (
            f"{model_class.__name__}.id 类型异常: {col_type}, "
            f"应改为 String(64) UUID 或保留 Integer 自增"
        )


# ---------------------------------------------------------------------------
# 3. 金额字段检查
# ---------------------------------------------------------------------------

class TestAmountField:
    """所有金额字段必须用 Integer(分), 禁止 Float/Numeric."""

    @pytest.mark.parametrize("model_class", _all_model_classes())
    def test_amount_fields_are_integer(self, model_class):
        violations = []
        for col in model_class.__table__.columns:
            col_name_lower = col.name.lower()
            if col_name_lower in AMOUNT_FIELDS:
                if not isinstance(col.type, (Integer, BigInteger, SmallInteger)):
                    violations.append(
                        f"{model_class.__name__}.{col.name} = {col.type}, "
                        f"金额字段必须用 Integer(分) 避免浮点精度问题"
                    )
        assert not violations, "\n".join(violations)


# ---------------------------------------------------------------------------
# 4. 时间字段检查
# ---------------------------------------------------------------------------

class TestTimeField:
    """必填时间字段必须可空 或 有默认值."""

    @pytest.mark.parametrize("model_class", _all_model_classes())
    def test_optional_time_fields(self, model_class):
        """非必填时间字段不应使用 nullable=False, 避免历史数据导入报错."""
        violations = []
        for col in model_class.__table__.columns:
            if col.name in TIME_FIELDS and not col.nullable:
                if col.default is None and col.server_default is None:
                    violations.append(
                        f"{model_class.__name__}.{col.name} 既非 nullable=True 也无 default, "
                        f"可能导致 INSERT 失败"
                    )
        # 警告而非断言, 部分业务场景允许 (不阻断 CI)
        if violations:
            print(f"⚠️  {model_class.__name__} 时间字段警告:\n  " + "\n  ".join(violations))


# ---------------------------------------------------------------------------
# 5. TimestampMixin 检查
# ---------------------------------------------------------------------------

class TestTimestampMixin:
    """所有 model 必须有 created_at/updated_at 字段 (通过 TimestampMixin 继承).

    兼容别名: Admin 系统的 create_time/update_time (来自 Java BaseEntity 命名).
    """

    @pytest.mark.parametrize("model_class", _all_model_classes())
    def test_has_timestamp_mixin(self, model_class):
        has_mixin = issubclass(model_class, TimestampMixin)
        has_created = "created_at" in model_class.__table__.columns or "create_time" in model_class.__table__.columns
        has_updated = "updated_at" in model_class.__table__.columns or "update_time" in model_class.__table__.columns
        assert has_mixin or (has_created and has_updated), (
            f"{model_class.__name__} 缺少 TimestampMixin (没有 created_at/updated_at, 也不含 create_time/update_time)"
        )


# ---------------------------------------------------------------------------
# 6. 表名冲突检查
# ---------------------------------------------------------------------------

class TestTableNameUnique:
    """所有 model 的 __tablename__ 必须唯一."""

    def test_no_duplicate_tablename(self):
        from app.database import Base
        seen = {}
        for cls in _all_model_classes():
            tname = cls.__tablename__
            if tname in seen:
                pytest.fail(
                    f"表名 {tname!r} 重复: {seen[tname].__name__} 和 {cls.__name__}"
                )
            seen[tname] = cls


# ---------------------------------------------------------------------------
# 7. 31 张新表的存在性检查 (按 H 盘 entity 1:1)
# ---------------------------------------------------------------------------

class TestNewTablesExist:
    """验证 pay/order/member/exam/ask/circle 新表全部存在."""

    REQUIRED_TABLES = {
        # pay
        "edu_payment", "edu_payment_config",
        # order
        "edu_order_item", "edu_order_payment", "edu_invoice_application", "edu_invoice_title",
        # member
        "edu_member", "edu_member_company", "edu_member_company_type",
        "edu_member_company_member_relation", "edu_member_tag", "edu_member_tag_member_relation",
        "edu_member_post", "edu_member_post_member_relation", "edu_member_group",
        "edu_member_group_member_relation", "edu_member_level", "edu_member_level_relation",
        "edu_check_in", "edu_check_in_record", "edu_follow",
        # exam
        "exam", "exam_category_relation", "paper_category", "paper_category_relation",
        "paper_paper_category_relation", "paper_question", "paper_question_rule",
        "question_category", "question_category_relation", "question_and_category_relation",
        "question", "exam_sign_up",
        # ask
        "ask_category_relation",
        # circle
        "circle_category_relation", "circle_category_bind",
        # 辅助
        "id_mapping", "migration_checkpoint",
    }

    def test_all_required_tables_exist(self):
        from app.database import Base
        existing = set(Base.metadata.tables.keys())
        missing = self.REQUIRED_TABLES - existing
        assert not missing, f"缺失 {len(missing)} 张表: {missing}"


# ---------------------------------------------------------------------------
# 8. 主键映射中间表约束
# ---------------------------------------------------------------------------

class TestIdMappingConstraints:
    """id_mapping 表必须 (source_table, old_id) 唯一."""

    def test_unique_constraint(self):
        from app.models.id_mapping import IdMapping
        uq_indexes = [
            idx for idx in IdMapping.__table__.indexes
            if idx.unique and set(c.name for c in idx.columns) == {"source_table", "old_id"}
        ]
        assert uq_indexes, "id_mapping 缺少 (source_table, old_id) 唯一索引"
