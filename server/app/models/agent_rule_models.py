"""Agent 规则与需求任务正式 model.

旧规则路由 (agents/rules.py) 使用裸 SQL,本模块提供 ORM 版本.
"""

from sqlalchemy import BigInteger, Column, DateTime, Index, Integer, String, Text, func

from app.database import Base
from app.models.base import TimestampMixin, id_column


class AgentRule(TimestampMixin, Base):
    """Agent 规则(绑定到具体 Agent 的执行规则).

    旧表名: agent_rule(来自 P3 coze_zhs_py)
    """

    __tablename__ = "zhs_agent_rule"
    __table_args__ = (
        Index("idx_rule_agent_id", "agent_id"),
        Index("ix_zhs_agent_rule_status", "status"),
    )

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=False, comment="所属 Agent ID")
    rule_name = Column(String(128), nullable=False, comment="规则名称")
    rule_code = Column(Text, nullable=False, comment="规则内容/代码")
    rule_type = Column(String(32), default="text", comment="规则类型 text/regex/llm")
    priority = Column(Integer, default=0, comment="优先级 越大越先")
    status = Column(Integer, default=1, comment="0 禁用 1 启用")
    description = Column(String(255), default="", comment="备注")


class AgentNeedTask(TimestampMixin, Base):
    """Agent 需求任务(用户提交给开发者的需求).

    旧表名: agent_need_task
    """

    __tablename__ = "zhs_agent_need_task"
    __table_args__ = (
        Index("idx_need_task_user", "user_id"),
        Index("idx_need_task_agent", "agent_id"),
        Index("ix_zhs_agent_need_task_status", "status"),
    )

    id = id_column(comment="ID")
    user_id = Column(String(64), nullable=False, comment="发起人")
    agent_id = Column(String(64), default="", comment="关联 Agent")
    task_name = Column(String(128), nullable=False, comment="需求名")
    task_desc = Column(Text, default="", comment="需求详情")
    reward_tokens = Column(Integer, default=0, comment="悬赏 token")
    status = Column(Integer, default=0, comment="0 待接 1 进行中 2 完成 3 关闭")
    accept_user_id = Column(String(64), default="", comment="接单人")
    deadline = Column(DateTime, default=None, comment="截止时间")


class AgentRuleParam(TimestampMixin, Base):
    """Agent 规则参数.

    旧表名: agent_rule_param
    """

    __tablename__ = "agent_rule_param"
    __table_args__ = (Index("idx_rule_param_rule_id", "rule_id"),)

    id = id_column(comment="ID")
    rule_id = Column(BigInteger, nullable=False, comment="所属规则 ID")
    param_name = Column(String(128), nullable=False, comment="参数名称")
    param_value = Column(Text, nullable=True, comment="参数值")
    param_type = Column(String(32), default="string", comment="参数类型 string/int/float/json")
    create_time = Column(DateTime, server_default=func.now(), comment="创建时间")


class AgentCategoryLink(TimestampMixin, Base):
    """Agent 与分类的关联关系.

    旧表名: agent_category_link
    """

    __tablename__ = "agent_category_link"
    __table_args__ = (
        Index("idx_category_link_agent", "agent_id"),
        Index("idx_category_link_category", "category_id"),
        {"extend_existing": True},
    )

    id = id_column(comment="ID")
    agent_id = Column(String(64), nullable=False, comment="Agent ID")
    category_id = Column(BigInteger, nullable=False, comment="分类 ID")
    create_time = Column(DateTime, server_default=func.now(), comment="创建时间")
