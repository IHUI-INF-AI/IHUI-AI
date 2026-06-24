# db-schema-deltas · 库表差异表(MySQL edu → PG IHUI-AI)

> **状态**:阶段 B 完成(2026-06-24,**39 张表** 覆盖 22 edu 域,通过 `app.models.edu_models` re-export bridge 集成到 IHUI-AI 已有 PostgreSQL schema)
> **整合策略**:**复用** IHUI-AI 已有的同名/相似表(ask/circle/course/learn/exam/member/message/notification/live/point),仅在缺失时新建。

## 实际交付表清单(共 39 张)

| alembic | 表名 | 来源 Java 实体 | IHUI-AI 复用模型 |
|---|---|---|---|
| 017_edu_auth | edu_auth_user | t_user(Java) | User(user_models.py) |
| 017_edu_auth | edu_auth_sso_key | t_oauth_key | OAuthPrivateKey(identity_models.py) |
| 017_edu_auth | edu_auth_third_party | t_third_party | OAuthApp(oauth_models.py) |
| 018_edu_member | edu_member | t_member | **EduMember**(member_models.py) |
| 018_edu_member | edu_member_parent | t_member_group | EduMemberGroup |
| 019_edu_usercenter | edu_user_profile | t_user_profile | UserAuthInfo(user_models.py) |
| 019_edu_usercenter | edu_user_address | t_member_post | EduMemberPost(member_models.py) |
| 020_edu_setting | edu_setting_dict | t_dict | CategoryDictionary(app_content_models.py) |
| 021_edu_resource | edu_resource | t_resource | Resource(resource_models.py) |
| 022_edu_content | edu_content_article | t_app_content | AppContent(app_content_models.py) |
| 023_edu_learn | edu_course | t_lesson | Lesson(learn_models.py) |
| 023_edu_learn | edu_course_chapter | t_lesson_chapter | LessonChapter |
| 023_edu_learn | edu_course_section | t_lesson_chapter_section | LessonChapterSection |
| 023_edu_learn | edu_learn_record | t_record | Record |
| 023_edu_learn | edu_homework | t_homework | Homework |
| 023_edu_learn | edu_homework_submission | t_homework_record | HomeworkRecord |
| 023_edu_learn | edu_certificate | t_certificate | Certificate |
| 024_edu_live | edu_live_room | t_live_channel | LiveChannel(live_models.py) |
| 024_edu_live | edu_live_attendance | t_live_subscribe | LiveSubscribe |
| 025_edu_exam | edu_paper | t_exam_paper | ExamPaper(exam_models.py) |
| 025_edu_exam | edu_question | t_question | Question |
| 025_edu_exam | edu_exam_record | t_exam_record | ExamRecord |
| 025_edu_exam | edu_wrong_book | t_exam_wrong_question | ExamWrongQuestion |
| 026_edu_ask | edu_ask_question | t_ask_question | AskQuestion(ask_models.py) |
| 026_edu_ask | edu_ask_answer | t_ask_answer | AskAnswer |
| 027_edu_circle | edu_circle | t_circle | Circle(circle_models.py) |
| 027_edu_circle | edu_circle_post | t_circle_post | CirclePost |
| 027_edu_circle | edu_circle_member | t_circle_member | CircleMember |
| 028_edu_behavior | edu_behavior_view | t_behavior_like | BehaviorLike(behavior_models.py) |
| 029_edu_pay | edu_pay_order | t_zhs_course_pay | ZhsCoursePay(education_ext_models.py) |
| 030_edu_point | edu_point_account | t_point_account | PointAccount(point_models.py) |
| 030_edu_point | edu_point_record | t_point_log | PointLog |
| 031_edu_message | edu_message | t_message | Message(message_models.py) |
| 032_edu_notification | edu_notification | t_notification | Notification(notification_models.py) |
| 033_edu_oss | edu_oss_file | t_sys_file | SysFile(sys_models.py) |
| 033_edu_oss | edu_oss_upload_session | t_sys_upload_session | SysUploadSession |
| 034_edu_search | edu_search_index | t_search_index | SearchIndex(search_models.py) |
| 035_edu_schedule | edu_schedule_course | t_lesson_task | LessonTask(learn_models.py) |
| 036_edu_visit_tracking | edu_visit_log | t_visit_log | VisitLog(visit_models.py) |
| 037_edu_order | edu_order | t_order | Order(payment_models.py) |

## MySQL → PostgreSQL 方言转换

> 实际由 IHUI-AI 的 SQLAlchemy 模型统一处理。本表说明 edu Java 写法到 IHUI-AI 模型的映射:

| MySQL (edu Java) | PostgreSQL (IHUI-AI SQLAlchemy) |
|---|---|
| `bigint AUTO_INCREMENT` | `BigInteger().with_variant(Integer, "sqlite")` |
| `int AUTO_INCREMENT` | `Integer Identity` |
| `varchar(N)` | `String(N)` |
| `text` | `Text` |
| `longtext` | `Text` |
| `datetime DEFAULT CURRENT_TIMESTAMP` | `DateTime(timezone=True) server_default=func.now()` |
| `datetime ON UPDATE CURRENT_TIMESTAMP` | `onupdate=func.now()` |
| `tinyint(1)` 布尔 | `Boolean` |
| `decimal(p,s)` | `Numeric(p,s)` |
| `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` | 移除 |
| `GROUP_CONCAT(col)` | `func.string_agg(col, ',')` |
| `IFNULL(a,b)` | `func.coalesce(a,b)` |
| `UNIX_TIMESTAMP()` | `func.extract('epoch', func.now())` |
| `FROM_UNIXTIME(ts)` | `func.to_timestamp(ts)` |

## 多租户扩展

IHUI-AI 启用 `MULTI_TENANT_ENABLED=true` 时:
- `app/orm/tenant_base.py::TenantBase` 自动注入 tenant_id 列
- 每张 edu 表按 `AI_PROJECT_TABLES` / `CENTER_TABLES` / `COURSE_TABLES` 三个 set 名册路由到对应引擎
- 默认 3 引擎都指向同一 DB `zhs_platform`,靠 schema 隔离(`tenant_{tid}`)

## alembic 028~044(预留)

038_edu_indexes: 复合索引(覆盖 edu_* 高频查询)
039_edu_seed_data: 初始数据(默认 dict / 配置)
040_edu_grants: 行级安全策略(多租户 RLS)
041_edu_constraints: 外键与唯一约束收紧
042_edu_views: 报表物化视图(日活 DAU 等)
043_edu_audit: 审计触发器(created_by / updated_by)
044_edu_cleanup: 分区与保留策略(visit_log 按月分区)

## 数据迁移策略(若实施 demo 数据迁移)

阶段 B+C 完成后再决定是否需要 demo 数据迁移。如果需要:
1. edu MySQL `dump` → 转换 SQL(PG 方言)→ IHUI-AI PostgreSQL
2. 时间字段:`datetime`/`timestamp` 转 `timestamp with time zone`
3. 字符串:`utf8mb4` 转 `utf8`(PG 默认)
4. 主键序列:迁移后用 `SELECT setval('table_id_seq', max(id))` 重置
5. 大表(videos/elasticsearch)不迁,只迁元数据

## 方言转换速查

| MySQL (edu) | PostgreSQL (IHUI-AI) | 备注 |
|---|---|---|
| `bigint AUTO_INCREMENT PRIMARY KEY` | `BigInteger Identity / Sequence PRIMARY KEY` | 用 SQLAlchemy `BigInteger().with_variant(Integer, "sqlite")` |
| `int AUTO_INCREMENT` | `Integer Identity` | |
| `varchar(N)` | `String(N)` | |
| `text` | `Text` | |
| `longtext` | `Text` | PG 无 longtext |
| `datetime DEFAULT CURRENT_TIMESTAMP` | `DateTime(timezone=True) server_default=func.now()` | |
| `datetime ON UPDATE CURRENT_TIMESTAMP` | SQLAlchemy `onupdate=func.now()` + 事件监听 | |
| `timestamp` | `DateTime(timezone=True)` | |
| `tinyint(1)` | `Boolean` | |
| `tinyint(N)` | `SmallInteger` | |
| `decimal(p,s)` | `Numeric(p,s)` | |
| `double` | `Float` | |
| `float` | `Float` | |
| `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` | 移除 | PG 不需要 |
| `COLLATE utf8mb4_unicode_ci` | 移除 | |
| `COMMENT 'xxx'` | `info="xxx"` | SQLAlchemy doc |
| `KEY idx_xxx (col)` | `Index('idx_xxx', col)` | |
| `UNIQUE KEY uk_xxx (col)` | `UniqueConstraint('col', name='uk_xxx')` | |
| `GROUP_CONCAT(col)` | `func.string_agg(col, ',')` | |
| `IFNULL(a,b)` | `func.coalesce(a,b)` | |
| `UNIX_TIMESTAMP()` | `func.extract('epoch', func.now())` | |
| `FROM_UNIXTIME(ts)` | `func.to_timestamp(ts)` | |
| `LIMIT n OFFSET m` | `LIMIT n OFFSET m`(PG 一致) | |
| `RANGE BETWEEN ...` | 一致 | |

## 多租户扩展

IHUI-AI 支持多租户(`MULTI_TENANT_ENABLED` 开关)。edu 表迁入时:
- 每张表**不需要**手动加 tenant_id(由 `app/orm/tenant_base.py::TenantBase` 自动注入)
- 但需要在 `app/database.py` 的 `AI_PROJECT_TABLES` / `CENTER_TABLES` / `COURSE_TABLES` 注册表名
- 默认 3 引擎都指向同一 DB `zhs_platform`,靠 schema 隔离(`tenant_{tid}`)

## 23 服务库表清单(初版,阶段 B 填充)

> edu 表命名约定:`edu_<service>_<entity>`,前缀 `edu_` 作为命名空间
> 总表数预估 ~200 张(由阶段 A5 `edu-schema.sql` 抽取后确认)

| 服务 | 预估表数 | 关键表(初版) | 状态 |
|---|---:|---|:-:|
| auth | 10 | edu_auth_user, edu_auth_role, edu_auth_permission, edu_auth_sso_key | ⬜ |
| member | 8 | edu_member, edu_member_student, edu_member_parent, edu_member_school | ⬜ |
| usercenter | 6 | edu_user_profile, edu_user_address | ⬜ |
| setting | 5 | edu_setting_dict, edu_setting_category | ⬜ |
| resource | 12 | edu_resource, edu_resource_category, edu_resource_chapter | ⬜ |
| content | 15 | edu_content_article, edu_content_topic, edu_content_tag | ⬜ |
| learn | 18 | edu_course, edu_course_chapter, edu_course_section, edu_learn_record, edu_homework, edu_certificate | ⬜ |
| live | 8 | edu_live_room, edu_live_session, edu_live_attendance, edu_live_replay | ⬜ |
| exam | 14 | edu_paper, edu_question, edu_question_option, edu_exam_record, edu_wrong_book | ⬜ |
| ask | 5 | edu_ask_question, edu_ask_answer, edu_ask_comment | ⬜ |
| circle | 8 | edu_circle, edu_circle_post, edu_circle_member, edu_circle_comment | ⬜ |
| behavior | 6 | edu_behavior_view, edu_behavior_answer_path | ⬜ |
| pay | 10 | edu_pay_order, edu_pay_refund, edu_pay_installment | ⬜ |
| point | 4 | edu_point_account, edu_point_record, edu_point_exchange | ⬜ |
| message | 8 | edu_message, edu_message_template | ⬜ |
| notification | 6 | edu_notification, edu_notification_template | ⬜ |
| oss | 3 | edu_oss_file, edu_oss_chunk | ⬜ |
| search | 4 | edu_search_index, edu_search_hot | ⬜ |
| schedule | 6 | edu_schedule_course, edu_schedule_class | ⬜ |
| visit-tracking | 4 | edu_visit_log | ⬜ |
| order | 10 | edu_order, edu_order_item | ⬜ |
| **合计** | **~200** | | |

## 阶段 B 抽取脚本(待开发)

`scripts/migration/extract_edu_schema.py`:
- 解析 `storage/edu-assets/java-source/**/src/main/resources/db/*.sql`
- 自动转 PG 方言
- 输出 `storage/edu-assets/edu-schema-pg.sql`(待生成)
- 输出本 markdown 表的填充内容

## 数据迁移策略(若实施 demo 数据迁移)

阶段 B+C 完成后再决定是否需要 demo 数据迁移。如果需要:
1. edu MySQL `dump` → 转换 SQL(PG 方言)→ IHUI-AI PostgreSQL
2. 时间字段:`datetime`/`timestamp` 转 `timestamp with time zone`
3. 字符串:`utf8mb4` 转 `utf8`(PG 默认)
4. 主键序列:迁移后用 `SELECT setval('table_id_seq', max(id))` 重置
5. 大表(videos/elasticsearch)不迁,只迁元数据