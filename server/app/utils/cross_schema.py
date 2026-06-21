"""Cross-schema utilities: classify tables, get sessions, application-level join."""

from typing import Any

# 表名 → 引擎分类映射
_TABLE_CLASSIFICATION = {
    # center (zhs_center_project)
    "users": "center",
    "user_margin": "center",
    "user_auth_info": "center",
    "user_third_party_accounts": "center",
    "vip_level": "center",
    "admin_user": "center",
    "admin_role": "center",
    "admin_menu": "center",
    "admin_dept": "center",
    "admin_user_role": "center",
    "admin_role_menu": "center",
    "admin_role_dept": "center",
    "admin_dict_type": "center",
    "admin_dict_data": "center",
    "admin_config": "center",
    "admin_notice": "center",
    "admin_login_info": "center",
    "admin_oper_log": "center",
    "admin_job": "center",
    "admin_job_log": "center",
    # course (zhs_course_project)
    "zhs_course": "course",
    "zhs_chapter": "course",
    "zhs_lesson": "course",
    "zhs_course_category": "course",
    "zhs_course_progress": "course",
    "zhs_course_enrollment": "course",
    # ai (zhs_ai_project)
    "agents": "ai",
    "zhs_agent": "ai",
    "zhs_agent_examine": "ai",
    "zhs_agent_buy": "ai",
    "zhs_agent_developer": "ai",
    "zhs_agent_settlement": "ai",
    "zhs_category": "ai",
    "zhs_activity": "ai",
    "zhs_video_generation_tasks": "ai",
    "zhs_information": "ai",
    "zhs_about_us": "ai",
    "zhs_product": "ai",
    "zhs_product_identity": "ai",
    "zhs_commission": "ai",
    "zhs_finance": "ai",
    "zhs_withdrawal": "ai",
    "zhs_fund": "ai",
    "zhs_admin": "ai",
    "zhs_audit": "ai",
    "zhs_model_info": "ai",
    "zhs_developer_link": "ai",
    "zhs_rule_params": "ai",
    "zhs_rules": "ai",
    "zhs_heat": "ai",
    "zhs_aigc": "ai",
    "zhs_courses_ext": "ai",
}


def classify_table(table_name: str) -> str:
    """根据表名返回所属引擎: center / course / ai."""
    return _TABLE_CLASSIFICATION.get(table_name, "center")


def get_session_for_engine(engine: str):
    """根据引擎名返回对应的 SessionFactory.

    Args:
        engine: "center" / "course" / "ai"

    Returns:
        SessionFactory1 (center) / SessionFactory2 (course/ai)

    Raises:
        ValueError: 未知引擎
    """
    from app.database import SessionFactory1, SessionFactory2

    mapping = {
        "center": SessionFactory1,
        "course": SessionFactory2,
        "ai": SessionFactory2,
    }
    factory = mapping.get(engine)
    if factory is None:
        raise ValueError(f"Unknown engine: {engine!r}, expected one of {list(mapping)}")
    return factory


def application_join(
    primary: list[Any],
    secondary: list[Any],
    primary_key: str,
    secondary_key: str,
    how: str = "left",
) -> list[dict]:
    """应用层 JOIN: 把 secondary 按 key 关联到 primary.

    Args:
        primary: 主表行列表 (对象或 dict)
        secondary: 副表行列表 (对象或 dict)
        primary_key: 主表关联字段名
        secondary_key: 副表关联字段名
        how: "left" (保留全部 primary) / "inner" (只保留匹配的)

    Returns:
        list of dict, 每行含 primary 字段 + "secondary" 字段 (匹配的副表行或 None)
    """
    # 构建 secondary 索引
    sec_index: dict = {}
    for s in secondary:
        sv = getattr(s, secondary_key, None) if not isinstance(s, dict) else s.get(secondary_key)
        sec_index[sv] = s

    out: list[dict] = []
    for p in primary:
        pv = getattr(p, primary_key, None) if not isinstance(p, dict) else p.get(primary_key)
        matched = sec_index.get(pv)
        if matched is None and how == "inner":
            continue
        # 把 primary 转成 dict
        row = dict(p) if isinstance(p, dict) else {k: getattr(p, k, None) for k in dir(p) if not k.startswith("_")}
        row["secondary"] = matched
        out.append(row)
    return out
