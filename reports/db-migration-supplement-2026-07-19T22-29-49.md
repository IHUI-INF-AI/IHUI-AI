# D 盘 27 张表补迁移报告

- **报告时间**: 2026-07-19T22:29:49
- **任务来源**: 架构迁移审计（`reports/migration-audit-db-schema-2026-07-19T12-48-44.csv`）
- **D 盘 SQL 源**: `D:\历史项目存档\code\edu\service\service\init_database.sql`
- **目标仓库**: `g:\IHUI-AI\packages\database\src\schema\`
- **执行人**: TRAE subagent

---

## 1. 总览

### 1.1 27 张表最终状态分布

| #  | D 盘表名 | 状态 | 归属文件 | 说明 |
|----|---------|------|----------|------|
| 1  | `circle_dynamic` | 已迁移 | `relation-tables.ts` | D 盘 bigint vs 现代 serial，语义等价 |
| 2  | `t_dynamic` | **新建** | `social-supplement.ts` | bigserial 主键 |
| 3  | `t_favorite` | **新建** | `social-supplement.ts` | 与现代版 user_favorites 共存（不同表名/字段） |
| 4  | `t_follow` | **新建** | `social-supplement.ts` | 与现代版 user_follows 共存 |
| 5  | `t_like` | **新建** | `social-supplement.ts` | bigint 主键 |
| 6  | `t_private_letter` | **新建** | `social-supplement.ts` | senderId/receiverId varchar(100) |
| 7  | `t_content` | **新建** | `social-supplement.ts` | 与 search_content 类似但字段更简 |
| 8  | `live_channel_lecturer` | 已迁移 | `live-extended.ts` | 字段完全等价（仅 create_time→created_at 命名规范化） |
| 9  | `live_subscribe` | 已迁移 | `live-extended.ts` | 已含 isNotify 扩展字段 |
| 10 | `live_tencent_cloud_live_stream` | 已迁移 | `live-extended.ts` | 字段完全等价 |
| 11 | `t_tencent_cloud_live_stream` | **新建** | `live-supplement.ts` | legacy 备份/旧版 |
| 12 | `learn_homework` | 已迁移 | `learn-extended.ts` | UUID 版，含 chapterId/title/dueDate 等扩展字段 |
| 13 | `learn_homework_record` | 已迁移 | `learn-extra-extended.ts` | UUID 版，注释明确标注 "历史 learn_homework_record" |
| 14 | `learn_sign_up` | 已迁移 | `relation-tables.ts` | serial 版，注释明确标注 "历史 learn_sign_up" |
| 15 | `exam_sign_up` | 已迁移 | `relation-tables.ts` | serial 版，注释明确标注 "历史 exam_sign_up" |
| 16 | `t_homework` | **新建** | `learn-homework.ts` | 通用作业备份/旧版 |
| 17 | `t_check_in_record` | **新建** | `learn-homework.ts` | type: 签到类型 |
| 18 | `resource_resource_download` | 已迁移 | `relation-tables.ts` | serial 版，注释 "会员下载记录" |
| 19 | `resource_resource_search_record` | 已迁移 | `relation-tables.ts` | serial 版，注释 "会员搜索记录" |
| 20 | `t_resource_download` | **新建** | `resource-download.ts` | legacy 备份/旧版 |
| 21 | `search_content` | **新建** | `resource-download.ts` | 单数表名 vs 现代版 search_contents 复数，不冲突 |
| 22 | `t_certificate` | **新建** | `admin-extended.ts` | 与现代版 certificates（UUID）共存 |
| 23 | `t_certificate_template` | **新建** | `admin-extended.ts` | 与现代版 certificate_templates（UUID）共存 |
| 24 | `t_department` | **新建** | `admin-extended.ts` | id 为 bigint DEFAULT 0（非自增，手工分配） |
| 25 | `t_lecturer` | **新建** | `admin-extended.ts` | 讲师扩展信息 |
| 26 | `t_manager` | **新建** | `admin-extended.ts` | 上级领导关联 |
| 27 | `t_sensitive_word` | **新建** | `admin-extended.ts` | 与现代版 sensitive_words（含 category/level）字段更简 |

### 1.2 数量统计

- **27 张表全部完成迁移覆盖** ✅
- **新建 schema 文件**: 5 个（social-supplement.ts / live-supplement.ts / learn-homework.ts / resource-download.ts / admin-extended.ts）
- **新建表数（D 盘原始字段）**: 17 张
- **已迁移表数（在其他文件发现）**: 10 张
  - `live-extended.ts` 3 张：live_channel_lecturer / live_subscribe / live_tencent_cloud_live_stream
  - `learn-extended.ts` 1 张：learn_homework
  - `learn-extra-extended.ts` 1 张：learn_homework_record
  - `relation-tables.ts` 5 张：circle_dynamic / exam_sign_up / learn_sign_up / resource_resource_download / resource_resource_search_record
- **修改文件**: `schema/index.ts`（追加 5 个 export）

---

## 2. 字段映射（D 盘 SQL → Drizzle pgTable）

### 2.1 字段类型映射规则（适用所有新建表）

| D 盘 MySQL 类型 | Drizzle pg-core 类型 | 说明 |
|----------------|---------------------|------|
| `bigint NOT NULL AUTO_INCREMENT` | `bigserial('id', { mode: 'number' }).primaryKey()` | 自增主键 |
| `bigint NOT NULL` | `bigint('col', { mode: 'number' }).notNull()` | 64 位整数 |
| `bigint NULL` / `bigint` | `bigint('col', { mode: 'number' })` | 可空 bigint |
| `bigint NOT NULL DEFAULT 0`（非自增） | `bigint('col', { mode: 'number' }).default(0).notNull().primaryKey()` | 手工分配主键 |
| `int NOT NULL DEFAULT N` | `integer('col').default(N).notNull()` | 整数 |
| `varchar(N) NOT NULL` | `varchar('col', { length: N }).notNull()` | |
| `varchar(N) NULL DEFAULT ''` | `varchar('col', { length: N }).default('')` | |
| `varchar(N) NOT NULL DEFAULT 'xxx'` | `varchar('col', { length: N }).default('xxx').notNull()` | |
| `text NOT NULL` | `text('col').notNull()` | |
| `timestamp NULL DEFAULT CURRENT_TIMESTAMP` | `timestamp('col', { withTimezone: true }).defaultNow()` | |
| `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` | `timestamp('col', { withTimezone: true }).defaultNow().notNull()` | |
| `datetime NULL DEFAULT NULL` | `timestamp('col', { withTimezone: true })` | MySQL datetime → PG timestamp |
| `tinyint NOT NULL DEFAULT 1` | `boolean('col').default(true).notNull()` | 0/1 → false/true |
| `tinyint NOT NULL DEFAULT 0` | `boolean('col').default(false).notNull()` | |

### 2.2 命名映射规则

- **DB 列名**: snake_case（与 D 盘保持一致）
- **TS 变量名**: camelCase
  - `member_id` → `memberId`
  - `circle_id` → `circleId`
  - `create_time` → `createTime`（D 盘原命名保留，不强制 createdAt）
- **TS 类型名**: PascalCase，前缀 `T` 表示 D 盘 legacy 表（如 `TDynamic` / `TFavorite` / `TContent`）
- **保留 D 盘原字段名作为注释**：每个字段行尾附 `// D 盘: <原列名> <类型>`

### 2.3 17 张新建表字段映射详情

#### 2.3.1 social-supplement.ts（6 张表）

##### `t_dynamic`（通用动态表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| content text NOT NULL | content | text().notNull() |
| member_id bigint | memberId | bigint().notNull() |
| image varchar(3000) DEFAULT '' | image | varchar({ length: 3000 }).default('') |
| status varchar(100) | status | varchar({ length: 100 }).notNull() |
| circle_id bigint | circleId | bigint().notNull() |
| create_time timestamp | createTime | timestamp().defaultNow() |
| update_time timestamp | updateTime | timestamp().defaultNow() |

##### `t_favorite`（收藏表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| topic_id bigint | topicId | bigint().notNull() |
| topic_type varchar(50) | topicType | varchar({ length: 50 }).notNull() |
| member_id bigint | memberId | bigint().notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_follow`（关注表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| member_id bigint | memberId | bigint().notNull() |
| follow_member_id bigint | followMemberId | bigint().notNull() |
| status varchar(100) DEFAULT 'follow' | status | varchar({ length: 100 }).default('follow').notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_like`（点赞表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| topic_id bigint | topicId | bigint().notNull() |
| topic_type varchar(50) | topicType | varchar({ length: 50 }).notNull() |
| member_id bigint | memberId | bigint().notNull() |
| status tinyint DEFAULT 1 | status | boolean().default(true).notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_private_letter`（私信表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| sender_id varchar(100) | senderId | varchar({ length: 100 }).notNull() |
| receiver_id varchar(100) | receiverId | varchar({ length: 100 }).notNull() |
| content text | content | text().notNull() |
| read_time timestamp NULL | readTime | timestamp() |
| is_read tinyint DEFAULT 0 | isRead | boolean().default(false).notNull() |
| status varchar(30) | status | varchar({ length: 30 }).notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_content`（可搜索内容表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| topic_id bigint | topicId | bigint().notNull() |
| topic_title varchar(2000) | topicTitle | varchar({ length: 2000 }).notNull() |
| topic_type varchar(50) | topicType | varchar({ length: 50 }).notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

#### 2.3.2 live-supplement.ts（1 张表）

##### `t_tencent_cloud_live_stream`（腾讯云直播流 legacy）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| channel_id bigint | channelId | bigint().notNull() |
| stream_name varchar(200) | streamName | varchar({ length: 200 }).notNull() |
| app_name varchar(200) DEFAULT 'live' | appName | varchar({ length: 200 }).default('live').notNull() |
| create_time NOT NULL | createTime | timestamp().defaultNow().notNull() |
| update_time NOT NULL | updateTime | timestamp().defaultNow().notNull() |

#### 2.3.3 learn-homework.ts（2 张表）

##### `t_homework`（通用作业表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| lesson_id bigint | lessonId | bigint().notNull() |
| url varchar(3000) DEFAULT '' | url | varchar({ length: 3000 }).default('').notNull() |
| content text | content | text().notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_check_in_record`（签到记录表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| member_id bigint | memberId | bigint().notNull() |
| type varchar(20) | type | varchar({ length: 20 }).notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

#### 2.3.4 resource-download.ts（2 张表）

##### `t_resource_download`（资源下载 legacy）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| member_id bigint | memberId | bigint().notNull() |
| resource_id bigint | resourceId | bigint().notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `search_content`（可搜索内容索引）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| topic_id bigint | topicId | bigint().notNull() |
| topic_title varchar(2000) | topicTitle | varchar({ length: 2000 }).notNull() |
| topic_type varchar(50) | topicType | varchar({ length: 50 }).notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

#### 2.3.5 admin-extended.ts（6 张表）

##### `t_certificate`（证书表，27 字段完整迁移）
| D 盘字段 | Drizzle 字段 | 类型 | 备注 |
|---------|-------------|------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() | |
| create_time datetime NOT NULL | createTime | timestamp().defaultNow().notNull() | |
| update_time datetime NOT NULL | updateTime | timestamp().defaultNow().notNull() | |
| deleted tinyint DEFAULT 0 | deleted | boolean().default(false).notNull() | 逻辑删除 |
| version int DEFAULT 1 | version | integer().default(1).notNull() | 乐观锁 |
| certificate_id bigint NULL | certificateId | bigint() | 证书 ID |
| code varchar(64) | code | varchar({ length: 64 }) | 证书编号 |
| name varchar(128) | name | varchar({ length: 128 }) | 证书名称 |
| description varchar(2000) | description | varchar({ length: 2000 }) | 描述 |
| awarding_organization varchar(128) | awardingOrganization | varchar({ length: 128 }) | 颁发机构 |
| awarder_name varchar(64) | awarderName | varchar({ length: 64 }) | 颁发人 |
| awarder_position varchar(64) | awarderPosition | varchar({ length: 64 }) | 颁发人职位 |
| design varchar(512) | design | varchar({ length: 512 }) | 模板设计 URL |
| award_conditions varchar(2000) | awardConditions | varchar({ length: 2000 }) | 颁发条件 |
| validity_policy varchar(1024) | validityPolicy | varchar({ length: 1024 }) | 有效期策略 |
| award_date datetime NULL | awardDate | timestamp() | 颁发日期 |
| validity datetime NULL | validity | timestamp() | 有效期限 |
| status varchar(32) | status | varchar({ length: 32 }) | 状态 |
| member_id bigint NULL | memberId | bigint() | 获证人员 ID |
| lesson_id bigint NULL | lessonId | bigint() | 课程 ID |
| lesson_sign_id bigint NULL | lessonSignId | bigint() | 报名 ID |
| lesson_sign_time datetime NULL | lessonSignTime | timestamp() | 报名时间 |
| lesson_complete_time datetime NULL | lessonCompleteTime | timestamp() | 完成时间 |
| score varchar(32) | score | varchar({ length: 32 }) | 成绩 |
| company_id bigint NULL | companyId | bigint() | 公司 ID |
| create_user_id bigint NULL | createUserId | bigint() | 创建人 ID |
| create_user_name varchar(64) | createUserName | varchar({ length: 64 }) | 创建人名称 |
| update_user_id bigint NULL | updateUserId | bigint() | 修改人 ID |
| update_user_name varchar(64) | updateUserName | varchar({ length: 64 }) | 修改人名称 |

**索引**：t_certificate_certificate_id_idx / t_certificate_member_idx / t_certificate_lesson_idx / t_certificate_status_idx / t_certificate_company_idx（与 D 盘 INDEX 一一对应）

##### `t_certificate_template`（证书模板表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| name varchar(200) DEFAULT '' | name | varchar({ length: 200 }).default('').notNull() |
| description varchar(1000) DEFAULT '' | description | varchar({ length: 1000 }).default('') |
| awarding_organization varchar(200) | awardingOrganization | varchar({ length: 200 }).default('') |
| awarder_name varchar(100) | awarderName | varchar({ length: 100 }).default('') |
| awarder_position varchar(100) | awarderPosition | varchar({ length: 100 }).default('') |
| design varchar(1000) | design | varchar({ length: 1000 }).default('') |
| award_conditions varchar(500) | awardConditions | varchar({ length: 500 }).default('') |
| validity_policy varchar(500) | validityPolicy | varchar({ length: 500 }).default('') |
| status varchar(30) DEFAULT 'inactive' | status | varchar({ length: 30 }).default('inactive').notNull() |
| company_id bigint NULL | companyId | bigint() |
| create_user_id bigint NULL | createUserId | bigint() |
| create_user_name varchar(100) | createUserName | varchar({ length: 100 }).default('') |
| update_user_id bigint NULL | updateUserId | bigint() |
| update_user_name varchar(100) | updateUserName | varchar({ length: 100 }).default('') |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

**索引**：t_certificate_template_status_idx / t_certificate_template_company_idx / t_certificate_template_create_time_idx

##### `t_department`（部门表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint NOT NULL DEFAULT 0 | id | bigint().default(0).notNull().primaryKey() | ⚠️ 非自增，手工分配 |
| code varchar(50) | code | varchar({ length: 50 }).notNull() |
| name varchar(50) | name | varchar({ length: 50 }).notNull() |
| short_name varchar(50) DEFAULT '' | shortName | varchar({ length: 50 }).default('').notNull() |
| enabled tinyint DEFAULT 1 | enabled | boolean().default(true).notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_lecturer`（讲师表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| user_id bigint | userId | bigint().notNull() |
| title varchar(100) DEFAULT '' | title | varchar({ length: 100 }).default('').notNull() |
| introduction varchar(2000) DEFAULT '' | introduction | varchar({ length: 2000 }).default('').notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_manager`（上级领导关联表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| user_id bigint | userId | bigint().notNull() |
| manager_id bigint | managerId | bigint().notNull() | 上级领导 ID |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

##### `t_sensitive_word`（敏感词 legacy 表）
| D 盘字段 | Drizzle 字段 | 类型 |
|---------|-------------|------|
| id bigint AUTO_INCREMENT | id | bigserial().primaryKey() |
| name varchar(100) | name | varchar({ length: 100 }).notNull() |
| create_time / update_time | createTime / updateTime | timestamp().defaultNow() |

---

## 3. 文件归属一览

| 文件路径 | 表数 | 表清单 |
|----------|------|--------|
| `g:\IHUI-AI\packages\database\src\schema\social-supplement.ts` | 6 | t_dynamic / t_favorite / t_follow / t_like / t_private_letter / t_content |
| `g:\IHUI-AI\packages\database\src\schema\live-supplement.ts` | 1 | t_tencent_cloud_live_stream |
| `g:\IHUI-AI\packages\database\src\schema\learn-homework.ts` | 2 | t_homework / t_check_in_record |
| `g:\IHUI-AI\packages\database\src\schema\resource-download.ts` | 2 | t_resource_download / search_content |
| `g:\IHUI-AI\packages\database\src\schema\admin-extended.ts` | 6 | t_certificate / t_certificate_template / t_department / t_lecturer / t_manager / t_sensitive_word |
| `g:\IHUI-AI\packages\database\src\schema\index.ts` | - | 追加 5 个 `export * from './xxx.js'` |
| **合计新建表** | **17** | |

**已迁移表（不重复定义）**: 10 张
- `live-extended.ts`: 3 张（live_channel_lecturer / live_subscribe / live_tencent_cloud_live_stream）
- `learn-extended.ts`: 1 张（learn_homework）
- `learn-extra-extended.ts`: 1 张（learn_homework_record）
- `relation-tables.ts`: 5 张（circle_dynamic / exam_sign_up / learn_sign_up / resource_resource_download / resource_resource_search_record）

---

## 4. 验证结果

### 4.1 typecheck

```bash
pnpm --filter @ihui/database typecheck
```

**结果**: 退出码 0 ✅

```
> @ihui/database@0.0.0 typecheck G:\IHUI-AI\packages\database
> tsc --noEmit
```

### 4.2 build

```bash
pnpm --filter @ihui/database build
```

**结果**: 退出码 0 ✅

```
> @ihui/database@0.0.0 build G:\IHUI-AI\packages\database
> tsc --build --force
```

---

## 5. 后续任务建议

### 5.1 drizzle-kit generate（建议立即执行）

新增的 17 张表 schema 已就位，但还未生成对应的 SQL migration 文件。建议用户运行：

```bash
pnpm --filter @ihui/database db:generate
```

该命令会在 `packages/database/migrations/` 目录下生成一个新的 `*.sql` migration 文件，包含 17 张表的 `CREATE TABLE` 语句。

### 5.2 drizzle-kit migrate（待用户决策）

生成 migration 文件后，若需要应用到数据库：

```bash
pnpm --filter @ihui/database db:migrate
```

⚠️ 注意：执行前请确认数据库环境（开发/测试/生产），并备份现有数据。

### 5.3 API 端点补开发（独立任务，本任务不涉及）

补迁移的 17 张 D 盘 legacy 表对应的 API 端点尚未开发。如需为这些表提供 CRUD 接口，需在 `apps/api` 单独创建路由（本任务范围内**不**修改 `apps/*`）。

涉及的 API 端点（建议优先级）：
- **P0**: t_private_letter（私信收发）/ t_follow（关注）/ t_like（点赞）
- **P0**: t_certificate（证书查询）/ t_certificate_template（模板管理）
- **P1**: t_department / t_lecturer / t_manager（管理后台组织架构）
- **P1**: t_homework / t_check_in_record（作业/签到）
- **P2**: t_dynamic / t_content / t_resource_download / search_content（内容索引）

### 5.4 数据迁移脚本（独立任务）

如需将 D 盘历史数据导入新 schema，需编写一次性数据迁移脚本。注意：
- D 盘 MySQL bigint 主键 → PostgreSQL bigserial（保留原 ID 或重映射）
- D 盘 `create_time` / `update_time` → 新表 `create_time` / `update_time`（命名一致，无需转换）
- 与现代版表（如 user_follows / certificates）的数据合并需谨慎，避免重复

### 5.5 审计 CSV 与现状差异说明

迁移审计 CSV（`migration-audit-db-schema-2026-07-19T12-48-44.csv`）中标记为 `missing` 的 27 张表，实际有 10 张已在仓库其他 schema 文件中迁移（详见第 1.1 节）。审计基于精确表名匹配，未捕获以下情况：
- `live_channel_lecturer` / `live_subscribe` / `live_tencent_cloud_live_stream` — 已在 `live-extended.ts` 中以相同表名迁移
- `learn_homework` / `learn_homework_record` — 已在 `learn-extended.ts` / `learn-extra-extended.ts` 中以相同表名迁移（UUID 版）
- `circle_dynamic` / `exam_sign_up` / `learn_sign_up` / `resource_resource_download` / `resource_resource_search_record` — 已在 `relation-tables.ts` 中以相同表名迁移（serial 版）

本任务通过新建 17 张表 + 文档化 10 张已迁移表，完成 27 张表的完整覆盖。

---

## 6. 守门脚本合规性自查

| 规则 | 状态 | 说明 |
|------|------|------|
| 文件修改持久化（Rule 13） | ✅ | typecheck + build 退出码 0 验证文件已正确落地 |
| 不修改 apps/* | ✅ | 仅修改 packages/database/src/schema/ |
| 不修改 PROJECT_PLAN.md / AGENTS.md | ✅ | 未触碰 |
| 不创建 migration SQL 文件 | ✅ | 由 drizzle-kit generate 自动生成 |
| 不删除任何现有 schema 文件 | ✅ | 仅新建 5 个文件 + 扩展 index.ts |
| 不用 git add . / git add -A | ✅ | 未执行 git 操作（任务要求不 commit） |
| Drizzle ORM 0.38 API | ✅ | 使用 pgTable / bigserial / bigint / varchar / text / timestamp / boolean / integer / index |
| 字段名 snake_case | ✅ | D 盘原命名保留 |
| 保留 D 盘原字段名注释 | ✅ | 每行字段附 `// D 盘: <原列名> <类型>` |

---

## 7. 一句话总结

27 张 D 盘历史项目表 schema 补迁移完成：新建 5 个 schema 文件（social-supplement.ts / live-supplement.ts / learn-homework.ts / resource-download.ts / admin-extended.ts）覆盖 17 张全新表，文档化 10 张已在其他文件迁移的同名表；typecheck + build 退出码 0 全绿；建议用户运行 `pnpm --filter @ihui/database db:generate` 生成 migration SQL 文件。
