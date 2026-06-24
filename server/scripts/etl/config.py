"""ETL 迁移配置.

- H 盘: 22 个 Java 微服务的 MySQL 业务库
- G 盘: PostgreSQL `zhs_platform` (按 schema/库 分库)
- 批次号: vYYYY_MM_DD_NN
"""
import os
from dataclasses import dataclass, field
from typing import Any


# ===========================================================================
# 数据源
# ===========================================================================

@dataclass
class MySQLDataSource:
    """H 盘 MySQL 业务库连接配置."""

    host: str
    port: int
    user: str
    password: str
    database: str

    @property
    def url(self) -> str:
        return (
            f"mysql+pymysql://{self.user}:{self.password}"
            f"@{self.host}:{self.port}/{self.database}?charset=utf8mb4"
        )


# H 盘 22 个 Java 微服务的 MySQL 库 (H:ihui-ai-edu-* 的 service 数据库)
# 实际部署时, 多个微服务可共用一个 MySQL 实例, 这里按业务域分库
H_SOURCES: dict[str, MySQLDataSource] = {
    # 鉴权 / 会员 / 用户中心
    "ihui-ai-edu-auth-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_auth",
    ),
    "ihui-ai-edu-usercenter-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_usercenter",
    ),
    "ihui-ai-edu-member-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_member",
    ),
    "ihui-ai-edu-ask-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_ask",
    ),
    "ihui-ai-edu-circle-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_circle",
    ),
    "ihui-ai-edu-learn-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_learn",
    ),
    "ihui-ai-edu-exam-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_exam",
    ),
    "ihui-ai-edu-order-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_order",
    ),
    "ihui-ai-edu-pay-service": MySQLDataSource(
        host=os.getenv("H_MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("H_MYSQL_PORT", "3306")),
        user=os.getenv("H_MYSQL_USER", "readonly"),
        password=os.getenv("H_MYSQL_PASSWORD", ""),
        database="ihui_edu_pay",
    ),
    # ... 其余 13 个微服务类似配置, 此处省略
}


# ===========================================================================
# 批次定义
# ===========================================================================

@dataclass
class MigrationTask:
    """单张表的迁移任务."""

    source_table: str          # H 盘 t_xxx
    source_db: str             # H 盘 service 编码
    target_table: str          # G 盘 目标表
    pk_columns: list[str] = field(default_factory=lambda: ["id"])
    batch_size: int = 1000
    # 字段转换规则: {h_field: g_field} 留空表示同名
    field_map: dict[str, str] = field(default_factory=dict)
    # 单位转换: {field: "yuan_to_fen" | "fen_to_yuan" | "boolean_tinyint"}
    unit_convert: dict[str, str] = field(default_factory=dict)
    # 关联 id_mapping 的字段: {g_field: h_field_for_lookup}
    id_lookup: dict[str, str] = field(default_factory=dict)


@dataclass
class MigrationBatch:
    """一个迁移批次."""

    batch_id: str                              # v2026_06_24_01
    description: str                           # 业务说明
    depends_on: list[str] = field(default_factory=list)
    tasks: list[MigrationTask] = field(default_factory=list)


# ===========================================================================
# 7 个业务域批次 (按依赖顺序)
# ===========================================================================

BATCHES: list[MigrationBatch] = [
    # 01 会员 (无依赖, 最先)
    MigrationBatch(
        batch_id="v2026_06_24_01",
        description="会员域: edu_member + edu_member_company + edu_member_tag + edu_member_post + edu_member_group + edu_check_in + edu_follow",
        tasks=[
            MigrationTask(
                source_table="t_member", source_db="ihui-ai-edu-member-service",
                target_table="edu_member", pk_columns=["id"],
                field_map={"username": "username", "name": "name", "mobile": "mobile", "email": "email"},
            ),
            MigrationTask(
                source_table="t_member_company", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_company",
            ),
            MigrationTask(
                source_table="t_member_company_type", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_company_type",
            ),
            MigrationTask(
                source_table="t_member_company_member_relation", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_company_member_relation",
                id_lookup={"member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_member_tag", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_tag",
            ),
            MigrationTask(
                source_table="t_member_tag_member_relation", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_tag_member_relation",
                id_lookup={"member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_member_post", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_post",
            ),
            MigrationTask(
                source_table="t_member_post_member_relation", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_post_member_relation",
                id_lookup={"member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_member_group", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_group",
            ),
            MigrationTask(
                source_table="t_member_group_member_relation", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_group_member_relation",
                id_lookup={"member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_check_in", source_db="ihui-ai-edu-member-service",
                target_table="edu_check_in",
                id_lookup={"member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_check_in_record", source_db="ihui-ai-edu-member-service",
                target_table="edu_check_in_record",
                id_lookup={"member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_follow", source_db="ihui-ai-edu-member-service",
                target_table="edu_follow",
                id_lookup={"member_id": "t_member", "follow_member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_member_level", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_level",
            ),
            MigrationTask(
                source_table="t_member_level_relation", source_db="ihui-ai-edu-member-service",
                target_table="edu_member_level_relation",
                id_lookup={"member_id": "t_member"},
            ),
        ],
    ),

    # 02 课程 (依赖 01 会员)
    MigrationBatch(
        batch_id="v2026_06_24_02",
        description="课程域: t_lesson + t_category + t_topic + t_record + 证书 + 作业 + 学习地图",
        depends_on=["v2026_06_24_01"],
        tasks=[
            MigrationTask(
                source_table="t_category", source_db="ihui-ai-edu-learn-service",
                target_table="t_category",
            ),
            MigrationTask(
                source_table="t_category_relation", source_db="ihui-ai-edu-learn-service",
                target_table="t_category_relation",
            ),
            MigrationTask(
                source_table="t_topic_category", source_db="ihui-ai-edu-learn-service",
                target_table="t_topic_category",
            ),
            MigrationTask(
                source_table="t_topic_category_relation", source_db="ihui-ai-edu-learn-service",
                target_table="t_topic_category_relation",
            ),
            MigrationTask(
                source_table="t_lesson", source_db="ihui-ai-edu-learn-service",
                target_table="t_lesson",
                unit_convert={"price": "yuan_to_fen", "originalPrice": "yuan_to_fen"},
                id_lookup={"createUserId": "t_member", "companyId": "t_member_company", "departmentId": None},
            ),
            MigrationTask(
                source_table="t_lesson_chapter", source_db="ihui-ai-edu-learn-service",
                target_table="t_lesson_chapter",
                id_lookup={"lesson_id": "t_lesson"},
            ),
            MigrationTask(
                source_table="t_lesson_chapter_section", source_db="ihui-ai-edu-learn-service",
                target_table="t_lesson_chapter_section",
                id_lookup={"lesson_chapter_id": "t_lesson_chapter"},
            ),
            MigrationTask(
                source_table="t_lesson_category_relation", source_db="ihui-ai-edu-learn-service",
                target_table="t_lesson_category_relation",
                id_lookup={"lesson_id": "t_lesson", "category_id": "t_category"},
            ),
            MigrationTask(
                source_table="t_sign_up", source_db="ihui-ai-edu-learn-service",
                target_table="t_sign_up",
                id_lookup={"member_id": "t_member", "lesson_id": "t_lesson"},
            ),
            MigrationTask(
                source_table="t_record", source_db="ihui-ai-edu-learn-service",
                target_table="t_record",
                id_lookup={"member_id": "t_member", "lesson_id": "t_lesson", "sign_up_id": "t_sign_up"},
            ),
            MigrationTask(
                source_table="t_record_log", source_db="ihui-ai-edu-learn-service",
                target_table="t_record_log",
                id_lookup={"member_id": "t_member", "lesson_id": "t_lesson", "sign_up_id": "t_sign_up"},
            ),
            MigrationTask(
                source_table="t_rate", source_db="ihui-ai-edu-learn-service",
                target_table="t_rate",
                id_lookup={"member_id": "t_member", "lesson_id": "t_lesson", "sign_id": "t_sign_up"},
            ),
            MigrationTask(
                source_table="t_topic", source_db="ihui-ai-edu-learn-service",
                target_table="t_topic",
                unit_convert={"price": "yuan_to_fen", "originalPrice": "yuan_to_fen"},
                id_lookup={"createUserId": "t_member"},
            ),
            MigrationTask(
                source_table="t_topic_lesson", source_db="ihui-ai-edu-learn-service",
                target_table="t_topic_lesson",
                id_lookup={"topic_id": "t_topic", "lesson_id": "t_lesson"},
            ),
            MigrationTask(
                source_table="t_topic_topic_category_relation", source_db="ihui-ai-edu-learn-service",
                target_table="t_topic_topic_category_relation",
                id_lookup={"topic_id": "t_topic", "category_id": "t_topic_category"},
            ),
            MigrationTask(
                source_table="homework", source_db="ihui-ai-edu-learn-service",
                target_table="homework",
                id_lookup={"lesson_id": "t_lesson"},
            ),
            MigrationTask(
                source_table="t_homework_record", source_db="ihui-ai-edu-learn-service",
                target_table="t_homework_record",
                id_lookup={"member_id": "t_member", "lesson_id": "t_lesson", "sign_up_id": "t_sign_up"},
            ),
            MigrationTask(
                source_table="t_certificate_template", source_db="ihui-ai-edu-learn-service",
                target_table="t_certificate_template",
            ),
            MigrationTask(
                source_table="t_certificate", source_db="ihui-ai-edu-learn-service",
                target_table="t_certificate",
                id_lookup={"member_id": "t_member", "lesson_id": "t_lesson", "lesson_sign_id": "t_sign_up"},
            ),
            MigrationTask(
                source_table="t_certificate_serial_number", source_db="ihui-ai-edu-learn-service",
                target_table="t_certificate_serial_number",
            ),
            MigrationTask(
                source_table="t_learn_map", source_db="ihui-ai-edu-learn-service",
                target_table="t_learn_map",
                id_lookup={"createUserId": "t_member"},
            ),
            MigrationTask(
                source_table="t_learn_map_topic", source_db="ihui-ai-edu-learn-service",
                target_table="t_learn_map_topic",
                id_lookup={"learn_map_id": "t_learn_map", "topic_id": "t_topic"},
            ),
            MigrationTask(
                source_table="lesson_access", source_db="ihui-ai-edu-learn-service",
                target_table="lesson_access",
                id_lookup={"lesson_id": "t_lesson"},
            ),
            MigrationTask(
                source_table="t_exam_paper_record", source_db="ihui-ai-edu-learn-service",
                target_table="t_exam_paper_record",
                id_lookup={"member_id": "t_member", "lesson_id": "t_lesson", "sign_up_id": "t_sign_up"},
            ),
        ],
    ),

    # 03 考试 (依赖 01 会员)
    MigrationBatch(
        batch_id="v2026_06_24_03",
        description="考试域: exam 19 张表 + exam_chapter + paper_* + question_*",
        depends_on=["v2026_06_24_01"],
        tasks=[
            MigrationTask(source_table="t_category", source_db="ihui-ai-edu-exam-service", target_table="exam_category"),
            MigrationTask(source_table="t_category_relation", source_db="ihui-ai-edu-exam-service", target_table="exam_category_relation"),
            MigrationTask(source_table="t_exam", source_db="ihui-ai-edu-exam-service", target_table="exam"),
            MigrationTask(source_table="t_exam_category_relation", source_db="ihui-ai-edu-exam-service", target_table="exam_category_relation"),
            MigrationTask(source_table="t_paper", source_db="ihui-ai-edu-exam-service", target_table="exam_paper"),
            MigrationTask(source_table="t_paper_category", source_db="ihui-ai-edu-exam-service", target_table="paper_category"),
            MigrationTask(source_table="t_paper_category_relation", source_db="ihui-ai-edu-exam-service", target_table="paper_category_relation"),
            MigrationTask(source_table="t_paper_paper_category_relation", source_db="ihui-ai-edu-exam-service", target_table="paper_paper_category_relation"),
            MigrationTask(source_table="t_paper_question", source_db="ihui-ai-edu-exam-service", target_table="paper_question"),
            MigrationTask(source_table="t_paper_question_rule", source_db="ihui-ai-edu-exam-service", target_table="paper_question_rule"),
            MigrationTask(source_table="t_question", source_db="ihui-ai-edu-exam-service", target_table="question"),
            MigrationTask(source_table="t_question_category", source_db="ihui-ai-edu-exam-service", target_table="question_category"),
            MigrationTask(source_table="t_question_category_relation", source_db="ihui-ai-edu-exam-service", target_table="question_category_relation"),
            MigrationTask(source_table="t_question_and_category_relation", source_db="ihui-ai-edu-exam-service", target_table="question_and_category_relation"),
            MigrationTask(source_table="t_exam_chapter", source_db="ihui-ai-edu-exam-service", target_table="exam_chapter"),
            MigrationTask(source_table="t_exam_chapter_section", source_db="ihui-ai-edu-exam-service", target_table="exam_chapter_section"),
            MigrationTask(
                source_table="t_record", source_db="ihui-ai-edu-exam-service", target_table="exam_record",
                id_lookup={"member_id": "t_member", "exam_id": "t_exam", "sign_up_id": "t_sign_up"},
            ),
            MigrationTask(
                source_table="t_wrong_question", source_db="ihui-ai-edu-exam-service", target_table="exam_wrong_question",
                id_lookup={"member_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_sign_up", source_db="ihui-ai-edu-exam-service", target_table="exam_sign_up",
                id_lookup={"member_id": "t_member", "exam_id": "t_exam"},
            ),
        ],
    ),

    # 04 问答 (依赖 01 会员)
    MigrationBatch(
        batch_id="v2026_06_24_04a",
        description="问答域: ask 4 张主表 + 分类关系",
        depends_on=["v2026_06_24_01"],
        tasks=[
            MigrationTask(source_table="t_category", source_db="ihui-ai-edu-ask-service", target_table="ask_category"),
            MigrationTask(source_table="t_category_relation", source_db="ihui-ai-edu-ask-service", target_table="ask_category_relation"),
            MigrationTask(
                source_table="t_question", source_db="ihui-ai-edu-ask-service", target_table="ask_question",
                id_lookup={"memberId": "t_member"},
            ),
            MigrationTask(
                source_table="t_answer", source_db="ihui-ai-edu-ask-service", target_table="ask_answer",
                id_lookup={"memberId": "t_member"},
            ),
            MigrationTask(source_table="t_question_category_relation", source_db="ihui-ai-edu-ask-service", target_table="ask_question_category"),
        ],
    ),

    # 04 圈子 (依赖 01 会员)
    MigrationBatch(
        batch_id="v2026_06_24_04b",
        description="圈子域: circle 4 张主表",
        depends_on=["v2026_06_24_01"],
        tasks=[
            MigrationTask(source_table="t_category", source_db="ihui-ai-edu-circle-service", target_table="circle_category"),
            MigrationTask(source_table="t_category_relation", source_db="ihui-ai-edu-circle-service", target_table="circle_category_relation"),
            MigrationTask(
                source_table="t_circle", source_db="ihui-ai-edu-circle-service", target_table="circle",
                id_lookup={"memberId": "t_member"},
            ),
            MigrationTask(
                source_table="t_dynamic", source_db="ihui-ai-edu-circle-service", target_table="circle_post",
                id_lookup={"user_id": "t_member", "circle_id": "t_circle"},
            ),
            MigrationTask(
                source_table="t_circle_member", source_db="ihui-ai-edu-circle-service", target_table="circle_member",
                id_lookup={"user_id": "t_member", "circle_id": "t_circle"},
            ),
            MigrationTask(source_table="t_circle_category_relation", source_db="ihui-ai-edu-circle-service", target_table="circle_category_bind"),
        ],
    ),

    # 05 订单 (依赖 01 会员)
    MigrationBatch(
        batch_id="v2026_06_24_05a",
        description="订单域: edu_order + 订单项 + 支付流水 + 发票",
        depends_on=["v2026_06_24_01"],
        tasks=[
            MigrationTask(
                source_table="t_order", source_db="ihui-ai-edu-order-service", target_table="zhs_order",
                unit_convert={"total_amount": "yuan_to_fen", "pay_amount": "yuan_to_fen"},
            ),
            MigrationTask(
                source_table="t_order_item", source_db="ihui-ai-edu-order-service", target_table="edu_order_item",
                unit_convert={"original_price": "yuan_to_fen", "price": "yuan_to_fen", "payment_amount": "yuan_to_fen",
                              "discount_amount": "yuan_to_fen", "total_amount": "yuan_to_fen"},
            ),
            MigrationTask(
                source_table="t_order_payment", source_db="ihui-ai-edu-order-service", target_table="edu_order_payment",
                unit_convert={"amount": "yuan_to_fen"},
            ),
            MigrationTask(
                source_table="t_invoice_application", source_db="ihui-ai-edu-order-service", target_table="edu_invoice_application",
                unit_convert={"product_fee": "yuan_to_fen", "invoice_amount": "yuan_to_fen"},
                id_lookup={"user_id": "t_member"},
            ),
            MigrationTask(
                source_table="t_invoice_title", source_db="ihui-ai-edu-order-service", target_table="edu_invoice_title",
                id_lookup={"user_id": "t_member"},
            ),
        ],
    ),

    # 05 支付 (依赖 01 会员, 依赖 05a 订单)
    MigrationBatch(
        batch_id="v2026_06_24_05b",
        description="支付域: edu_payment + edu_payment_config",
        depends_on=["v2026_06_24_01", "v2026_06_24_05a"],
        tasks=[
            MigrationTask(
                source_table="t_payment", source_db="ihui-ai-edu-pay-service", target_table="edu_payment",
                unit_convert={"total_amount": "yuan_to_fen"},
                id_lookup={"user_id": "t_member", "department_id": None, "company_id": "t_member_company"},
            ),
            MigrationTask(
                source_table="t_payment_config", source_db="ihui-ai-edu-pay-service", target_table="edu_payment_config",
            ),
        ],
    ),
]


def get_batch(batch_id: str) -> MigrationBatch:
    """按 batch_id 查询批次配置."""
    for b in BATCHES:
        if b.batch_id == batch_id:
            return b
    raise KeyError(f"批次 {batch_id} 不存在, 可用批次: {[b.batch_id for b in BATCHES]}")
