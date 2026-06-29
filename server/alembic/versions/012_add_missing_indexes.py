"""add missing indexes from INDEX_AUDIT report

Revision ID: 012_add_missing_indexes
Revises: 011_admin_tables
Create Date: 2026-06-20
"""
from alembic import op

revision = "012_add_missing_indexes"
down_revision = "011_admin_tables"


# 缺失索引清单 (表名, 字段名)，来源 INDEX_AUDIT.md 中所有 HIGH_FREQ 类型
_MISSING_INDEXES = [
    # 单字段缺失
    ("agent_billings", "status"),
    ("agent_buy_scheduled_tasks", "status"),
    ("agent_upload", "status"),
    ("agents", "user_id"),
    ("ai_about_us", "status"),
    ("ai_contact", "status"),
    ("ai_file_storage", "status"),
    ("ai_gc", "status"),
    ("ai_news", "status"),
    ("ai_user_feedback", "status"),
    ("app_content", "status"),
    ("app_version", "status"),
    ("ask_comment", "user_id"),
    ("behavior_sensitive", "status"),
    ("circle_member", "status"),
    ("circle_post_comment", "user_id"),
    ("exam_record", "status"),
    ("exchange_rate", "status"),
    ("live_comment", "user_id"),
    ("live_gift", "user_id"),
    ("message_template", "status"),
    ("notification_channel", "status"),
    ("notification_log", "user_id"),
    ("oauth_private_keys", "status"),
    ("point_rule", "status"),
    ("resource", "status"),
    ("search_index", "user_id"),
    ("sys_dict_data", "status"),
    ("sys_dict_type", "status"),
    ("sys_job_log", "status"),
    ("sys_logininfor", "status"),
    ("sys_oper_log", "status"),
    ("sys_post", "status"),
    ("tbox_bean", "status"),
    ("user_sk_info", "status"),
    ("user_vip", "status"),
    ("video_generation_tasks", "status"),
    ("vip_level", "status"),
    ("zhs_activity", "status"),
    ("zhs_agent_buy", "status"),
    ("zhs_agent_examine", "status"),
    ("zhs_agent_need_task", "status"),
    ("zhs_agent_rule", "status"),
    ("zhs_agent_withdrawal_detail", "status"),
    ("zhs_ai_model_info", "status"),
    ("zhs_banner_carousel", "status"),
    ("zhs_course_temp", "status"),
    ("zhs_course_video", "status"),
    ("zhs_course_video_temp", "status"),
    ("zhs_dictionary", "status"),
    ("zhs_education_platform", "status"),
    ("zhs_educational_course", "status"),
    ("zhs_exchange_rate", "status"),
    ("zhs_identity", "status"),
    ("zhs_identity_proportion", "status"),
    ("zhs_information", "status"),
    ("zhs_knowledge_planet", "status"),
    ("zhs_official_information", "status"),
    ("zhs_operate_token_flow", "user_id"),
    ("zhs_popular_courses", "status"),
    ("zhs_product", "status"),
    ("zhs_product_identity", "status"),
    ("zhs_resources", "status"),
    ("zhs_user_platform", "status"),
    # 双字段缺失
    ("behavior_comment", "user_id"),
    ("behavior_comment", "status"),
    ("behavior_report", "user_id"),
    ("behavior_report", "status"),
    ("gen_table", "create_by"),
    ("gen_table", "update_by"),
    ("gen_table_column", "create_by"),
    ("gen_table_column", "update_by"),
    ("sys_menu", "parent_id"),
    ("sys_menu", "status"),
    ("sys_notice", "status"),
    ("sys_notice", "create_by"),
    ("sys_user", "create_by"),
    ("sys_user", "update_by"),
    ("users", "status"),
    ("users", "parent_id"),
    ("zhs_agent_developer", "user_id"),
    ("zhs_agent_developer", "status"),
    ("zhs_category_dictionary", "parent_id"),
    ("zhs_category_dictionary", "status"),
    ("zhs_commission_flow", "user_id"),
    ("zhs_commission_flow", "status"),
    ("zhs_developer_link", "user_id"),
    ("zhs_developer_link", "status"),
    ("zhs_order", "user_id"),
    ("zhs_order", "status"),
    ("zhs_organization", "parent_id"),
    ("zhs_organization", "status"),
    ("zhs_user_video_comment", "parent_id"),
    ("zhs_user_video_comment", "status"),
    ("zhs_withdrawal_flow", "user_id"),
    ("zhs_withdrawal_flow", "status"),
    # 三字段缺失
    ("sys_dept", "parent_id"),
    ("sys_dept", "status"),
    ("sys_dept", "del_flag"),
    ("sys_job", "status"),
    ("sys_job", "create_by"),
    ("sys_job", "update_by"),
]


def upgrade() -> None:
    """创建所有缺失的高频查询索引. 表不存在时静默忽略 (CI/sqlite 多库拆分场景)."""
    for table, column in _MISSING_INDEXES:
        index_name = f"ix_{table}_{column}"
        try:
            op.create_index(index_name, table, [column])
        except Exception:
            pass


def downgrade() -> None:
    """删除所有缺失的高频查询索引."""
    for table, column in _MISSING_INDEXES:
        index_name = f"ix_{table}_{column}"
        try:
            op.drop_index(index_name, table_name=table)
        except Exception:
            pass
