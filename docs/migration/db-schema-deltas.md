# db-schema-deltas · 库表差异表(MySQL edu → PG IHUI-AI)

> **状态**:阶段 A 初版(目录骨架)
> **生成方式**:阶段 B 实施时,逐服务填充

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