"""Code generation models (Admin gen_table / gen_table_column -> zhs_ai_project)."""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func
from sqlalchemy.types import BigInteger as SABigInteger
from sqlalchemy.types import Integer as SAInteger

from app.database import Base
from app.models.base import TimestampMixin

# 主键类型: SQLite 走 Integer (rowid 自增), PostgreSQL 走 BigInteger
_IDType = SAInteger().with_variant(SABigInteger(), "postgresql")


class CodegenTable(TimestampMixin, Base):
    """业务表 gen_table -- stores imported tables for code generation."""

    __tablename__ = "gen_table"
    __table_args__ = (
        Index("ix_gen_table_create_by", "create_by"),
        Index("ix_gen_table_update_by", "update_by"),
    )

    table_id = Column(_IDType, primary_key=True, autoincrement=True, comment="编号")
    table_name = Column(String(200), nullable=False, default="", comment="表名称")
    table_comment = Column(String(500), default="", comment="表描述")
    sub_table_name = Column(String(200), default=None, comment="关联子表的表名")
    sub_table_fk_name = Column(String(200), default=None, comment="子表关联的外键名")
    class_name = Column(String(200), default="", comment="实体类名称")
    tpl_category = Column(String(10), default="crud", comment="使用的模板 crud/tree/sub")
    tpl_web_type = Column(String(10), default="element-ui", comment="前端类型")
    package_name = Column(String(100), default="", comment="生成包路径")
    module_name = Column(String(100), default="", comment="生成模块名")
    business_name = Column(String(100), default="", comment="生成业务名")
    function_name = Column(String(500), default="", comment="生成功能名")
    function_author = Column(String(100), default="", comment="生成作者")
    gen_type = Column(String(1), default="0", comment="生成代码方式 0=zip 1=自定义路径")
    gen_path = Column(String(200), default=None, comment="生成路径")
    options = Column(Text, default=None, comment="其它生成选项 (JSON)")

    create_by = Column(String(64), default="")
    create_time = Column(DateTime, default=func.now())
    update_by = Column(String(64), default="")
    update_time = Column(DateTime, default=func.now(), onupdate=func.now())
    remark = Column(Text, nullable=True)


class CodegenColumn(TimestampMixin, Base):
    """代码生成业务字段表 gen_table_column."""

    __tablename__ = "gen_table_column"
    __table_args__ = (
        Index("ix_gen_table_column_create_by", "create_by"),
        Index("ix_gen_table_column_update_by", "update_by"),
    )

    column_id = Column(_IDType, primary_key=True, autoincrement=True, comment="编号")
    table_id = Column(BigInteger, default=None, comment="归属表编号")
    column_name = Column(String(200), default="", comment="列名称")
    column_comment = Column(String(1000), default="", comment="列描述")
    column_type = Column(String(100), default="", comment="列类型")
    java_type = Column(String(100), default="", comment="Python/Java 类型")
    java_field = Column(String(200), default="", comment="字段名")
    is_pk = Column(String(1), default="0", comment="是否主键 1=是")
    is_increment = Column(String(1), default="0", comment="是否自增 1=是")
    is_required = Column(String(1), default="0", comment="是否必填 1=是")
    is_insert = Column(String(1), default="0", comment="是否为插入字段 1=是")
    is_edit = Column(String(1), default="0", comment="是否编辑字段 1=是")
    is_list = Column(String(1), default="0", comment="是否列表字段 1=是")
    is_query = Column(String(1), default="0", comment="是否查询字段 1=是")
    query_type = Column(String(200), default="EQ", comment="查询方式 EQ/NE/GT/LT/LIKE/BETWEEN")
    html_type = Column(
        String(200),
        default="input",
        comment="显示类型 input/textarea/select/checkbox/radio/datetime/image/upload/editor",
    )
    dict_type = Column(String(200), default="", comment="字典类型")
    sort = Column(Integer, default=0, comment="排序")

    create_by = Column(String(64), default="")
    create_time = Column(DateTime, default=func.now())
    update_by = Column(String(64), default="")
    update_time = Column(DateTime, default=func.now(), onupdate=func.now())
    remark = Column(Text, nullable=True)
