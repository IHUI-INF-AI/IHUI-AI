<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 飞书 / 钉钉考勤同步器 — 开发方案

> 目标：把当前「手动导出文件→上传」升级为「API 直连定时自动拉取」，实现无感同步，同时**保留现有人工裁决安全闸**。  
> 状态：设计稿（本轮不含代码实现与凭证申请）  
> 日期：2026-11-13  
> 事实口径：本仓架构部分基于已核实的 `apps/api/src/services/hr-import*.ts`；飞书/钉钉 API 端点已于 2026-11-13 联网核实（见 §7，含新发现的钉钉 userid 映射缺口）。

---

## 1. 背景与现状

**已有能力**（HR-5 第 2 期，2026-11-12 落地）：
- `/api/hr-import/batches` 文件上传链路，支持 `attendance`/`leave`/`overtime`/`outgoing` 四类
- 中文表头别名自动映射、SHA-256 判重、暂存→裁决→确认三段式
- 人工裁决闸：`conflict` 行不裁决不能确认，绝不自动覆盖正式考勤

**痛点**：每次都要人从飞书/钉钉后台导出 xlsx 再上传，不是真正的"无感流转"。

**本方案要解决的**：让员工在飞书/钉钉打卡请假后，系统**自动**把数据拉过来进入同一套暂存/裁决/确认流程，HR 只需处理差异，不再手动导出上传。

---

## 2. 设计原则（不可妥协）

1. **复用现有安全链路**：同步器只负责"拉数据 + 规范化"，落库必须走现有 `createAnyImportBatch` → 暂存 → 人工裁决 → `confirmAnyImportBatch`。**绝不新增绕过裁决闸的直写通道**。
2. **幂等**：同一份数据重复拉取不产生重复批次（复用 SHA-256 判重 + `externalId` 天然幂等键）。
3. **最小权限**：飞书/钉钉应用只申请考勤/审批**只读**权限，不申请写权限（同步是单向拉取）。
4. **失败可观测**：拉取失败、解析失败、裁决超时都要有日志和告警，不留静默失败。
5. **增量优先**：按"最近更新时间"增量拉，避免全量重拉。

---

## 3. 总体架构

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  飞书开放平台 │      │  IHUI-AI 同步器   │      │  现有导入链路     │
│  钉钉开放平台 │─────▶│  (新 service +    │─────▶│  createAnyImport │
│  企业微信(可选)│ API  │   定时调度)       │ 规范化│  Batch → 暂存    │
└─────────────┘      └──────────────────┘      │  → 裁决 → 确认   │
                                                └─────────────────┘
```

**新增组件**（仅 2 个，不改动现有路由/表）：
1. `apps/api/src/services/attendance-sync/` — 各平台拉取适配器 + 规范化器
   - `feishu-provider.ts`：调飞书 API 拉打卡/审批，规范化成 `HrImportParsedFields` 形状
   - `dingtalk-provider.ts`：同上，对接钉钉
   - `sync-runner.ts`：编排"拉取→规范化→调 `createAnyImportBatch` 建暂存批次"
2. 定时调度：复用项目现有调度机制（见 §5），周期触发 `sync-runner`

**关键点**：同步器产出的就是**和文件上传一模一样的暂存批次**（含 `batchId`/`conflictRows`），后续裁决/确认完全复用现有 `POST /rows/:rowId/resolve` 和 `POST /batches/:id/confirm`，前端导入页无需大改。

---

## 4. 数据流：拉取 → 规范化 → 暂存

### Step 1：拉取（各 provider）

按记录类型分别拉（对齐四类 `importKind`）：

| importKind | 飞书数据源（待核实端点） | 钉钉数据源（待核实端点） |
|---|---|---|
| `attendance` | 考勤打卡结果（打卡流水/统计） | 考勤打卡结果 |
| `leave` | 审批实例（请假模板） | OA 审批（请假） |
| `overtime` | 审批实例（加班模板） | OA 审批（加班） |
| `outgoing` | 审批实例（外出模板） | OA 审批（外出） |

每条记录规范化成统一形状（与 `hr-import-leave.ts` 的 `HrLeaveImportFields` 等对齐）：
```
{ employeeNo, employeeName, leaveTypeText, startDate, endDate, totalDays, reason, statusText, externalId }
```

**`externalId` 是关键**：飞书审批实例 ID / 钉钉审批单号，天然唯一，作为幂等键。打卡记录用 `员工+日期` 组合键。

### Step 2：规范化器（mapping）

把平台原始字段映射到系统字段。例如飞书请假：
- `leave_type`（假别枚举）→ `leaveTypeText`
- `start_time` / `end_time` → `startDate` / `endDate`
- 实例 ID → `externalId`

映射表集中在各 provider 内，**与现有别名表同一真相源原则**（飞书/钉钉枚举值→系统枚举值，如"事假/年假"对齐系统假别字典）。

### Step 3：建暂存批次

调用现有 `createAnyImportBatch`，但**不传 buffer，传已解析的结构化行**。为此需给 `createAnyImportBatch` 增加一个入口：接受"已解析行数组"（文件上传是"buffer → 解析 → 行"，同步器是"API → 规范化 → 行"，后段一致）。

产出与文件上传完全一致的批次结构，进入 `pending_review`，等人工裁决/确认。

---

## 5. 定时调度

**调度频率建议**：
- 打卡：每日凌晨拉前一日（打卡是高频增量）
- 请假/加班/外出：每日一次增量（按审批实例更新时间）

**实现选项**（择一，取决于项目现有基础设施）：
- **A. 应用内 cron**：若 API 服务已有定时任务框架，注册同步 job
- **B. 独立 worker + 队列**：拉取任务入队，worker 消费（适合多平台、量大）
- **C. 复用现有 guardian 调度**：项目已有 5 分钟级调度器（见 AGENTS.md），可挂载同步 job

**拉取窗口与幂等**：
- 每次拉取记录 `lastSyncCursor`（平台游标或时间戳）存 DB
- 下次从 cursor 增量拉，避免重复
- 同 `externalId` 重复拉到 → 跳过或更新暂存行，不新建批次

---

## 6. 凭证与权限（需申请）

### 飞书（待核实具体 scope 名）

| 需申请 | 用途 |
|---|---|
| App ID + App Secret | 应用凭证（企业自建应用） |
| 考勤**只读**权限 | 拉打卡记录 |
| 审批**只读**权限（考勤类模板） | 拉请假/加班/外出审批实例 |
| 通讯录**只读**（可选） | 工号/姓名对齐 |

申请入口：飞书开放平台 → 企业自建应用 → 权限管理。

### 钉钉（待核实具体权限名）

| 需申请 | 用途 |
|---|---|
| AppKey + AppSecret | 应用凭证 |
| 考勤**只读**权限 | 拉打卡结果 |
| OA 审批**只读**权限 | 拉请假/加班/外出 |

申请入口：钉钉开放平台 → 应用开发 → 权限申请。

**凭证存放**：走服务端环境变量/密钥管理，**绝不写进代码或仓库**（遵守项目安全规范）。

---

## 7. 平台端点核实（2026-11-13 已联网核对官方文档）

两平台核心端点已核实。**以下为唯一事实源，provider 实现以此为准，不在代码里重复罗列。**

> **实现状态（2026-11-13 本轮）**：飞书 + 钉钉的**打卡（attendance）provider 已实现**（token 缓存 + 端点拉取 + 字段映射 → SyncRow）；审批三类（leave/overtime/outgoing）端点已核实、枚举映射待补，暂抛未实现（501）。**飞书打卡目标工号来源已接**（名册全量 ∩ 可选白名单，见 §7.5）；钉钉走人工 userid 映射（见 §7.3），未配置时返回 0 行空批次，不报错。

### 7.1 飞书（open.feishu.cn）

| 用途 | 端点 | 关键入参 | 备注 |
|---|---|---|---|
| token（历史版，可用） | `POST /open-apis/auth/v3/tenant_access_token/internal` | body `{app_id, app_secret}` | → `tenant_access_token`/`expire`，约 2h |
| token（新版，官方推荐） | `POST https://accounts.feishu.cn/oauth/v3/token` | `grant_type=client_credentials` + client_id/secret | → JWT `access_token`（官方建议预留 4KB 存储） |
| 打卡结果 | `POST /open-apis/attendance/v1/user_tasks/query` | query `employee_type=employee_id\|employee_no`；body `{user_ids(≤50), check_date_from/to(int yyyyMMdd), need_overtime_result}` | 权限"导出打卡数据"，仅自建应用；→ `user_task_results[].records` |
| 打卡流水（要位置/方式时） | `POST /open-apis/attendance/v1/user_flows/query` | body `{user_ids(≤50), check_time_from/to(秒级时间戳,左闭右开)}` | 权限"导出打卡数据" |
| 审批数据（请假/加班/外出/出差） | `/open-apis/attendance/v1/user_approval/query` | — | 权限"导出打卡数据" |
| 事件订阅（可选实时推送） | `attendance.user_flow.created_v1` | — | 打卡成功推送 |

**飞书映射决策**：`user_tasks/query` 的 `employee_type` 支持 `employee_no`（工号）。系统用工号对齐 → 打卡拉取走 `employee_no`，**免额外查"平台 user_id↔工号"映射**。

### 7.2 钉钉（oapi.dingtalk.com）

| 用途 | 端点 | 关键入参 | 备注 |
|---|---|---|---|
| token | `GET /gettoken` | query `appkey`/`appsecret` | → `access_token`/`expires_in`(7200s)；已完成升级、不再新增能力，未接入者建议用新版 `accessToken` 接口 |
| 打卡结果 | `POST /attendance/list` | query `access_token`；body `{workDateFrom/To(yyyy-MM-dd HH:mm:ss, 相隔≤7天), userIdList(≤50), offset, limit(≤50)}` | 权限"企业考勤数据读"；→ `recordresult[]`；**不支持查半年前** |
| 打卡详情（要位置/设备时） | `POST /attendance/listRecord` | body `{userIds(≤50), checkDateFrom/To(≤7天)}` | — |
| 用户当天考勤（含流水+结果+审批） | `POST /topapi/attendance/getupdatedata` | body `{userid, work_date}` | 仅企业内部应用 |

**钉钉字段口径（已核实）**：`/attendance/list` 返回 `recordresult[]`，含 `checkType`(OnDuty/OffDuty)、`timeResult`(Normal/Late/Early/…/NotSigned)、`userCheckTime`(毫秒时间戳)、`workDate`、`sourceType`、`procInstId`（关联审批实例，非空=请假/加班/外出相关）。

### 7.3 本轮核实发现的新缺口：钉钉 userId 映射

钉钉 `/attendance/list` 只认**平台 userid**（`userIdList`），不像飞书那样支持直接用工号。因此钉钉拉取前必须先有「钉钉 userid ↔ 系统工号」映射。两条出路：

1. 调钉钉通讯录接口（`topapi/v2/user/list` 等按部门拉成员，含 userid + 工号）先建映射表并缓存；
2. 人工维护映射表。

**已落地（P1 采纳方案 2）**：钉钉 provider 从 `system_configs` 读人工维护的 JSON 映射（键 `sync:dingtalk:userid-map:{userId}`，形如 `{"工号":"userid"}`）。未配置 → 返回 0 行空批次（不报错）。**取舍**：不引入通讯录拉取依赖、实现最简；代价是需运维维护映射，成员变动时要更新。若后续成员量大或变动频繁，升级到方案 1（通讯录自动拉取）。

飞书侧无需映射：`user_tasks/query` 走 `employee_type=employee_no`，工号直用。

### 7.4 仍未核实（实现前补）

- 各平台**枚举值完整映射表**（假别/加班类型/审批状态 → 系统字典）：飞书审批枚举、钉钉请假/OA 审批枚举，本轮未逐值核对。
- 审批类拉取的**分页与模板 code 过滤**细节（请假/加班/外出按模板区分）。
- 各平台**调用配额/限流**精确值（飞书打卡接口标注约 50 次/秒；钉钉标准版约 1 万次/月，需确认对目标企业规模是否够）→ 决定拉取频率与分批。

> 已核实端点与字段口径上表为凭；上述未核实项实现前补齐，否则易因枚举/分页/配额不符导致返工。

### 7.5 飞书打卡目标工号来源（已落地）

飞书 `user_tasks/query` 用工号（`employee_type=employee_no`）直接拉取，故须先定「拉哪些工号」。**「两者结合」口径（机主 2026-11-13 拍板）**，实现在 `attendance-sync/feishu-employee-source.ts` 的 `resolveFeishuEmployeeNos(userId)`：

1. **默认读名册表** `user_profiles.employee_no`（所有非空工号，去重去空白）→ 免人工维护，与系统工号天然一致。
2. **可选白名单收窄**：`system_configs` 键 `sync:feishu:employee-nos:{userId}`（JSON 字符串数组，如 `["E001","E002"]`）。配置后取**名册 ∩ 白名单**——白名单只收窄不扩张（同步只读、范围越小越安全，且免额外模式开关）。白名单里不在名册的工号忽略（只拉系统已知员工）。
3. 名册为空 → 返回 `[]`（provider 返 0 行空批次）；白名单非法/空 → 视为不收窄（返回名册全量，不崩溃）。

**取舍**：默认免维护；需临时只同步部分员工时配白名单收窄，无需改代码。钉钉不用本模块（钉钉只认平台 userid，走 §7.3 人工映射）。

---

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 平台 API 配额不足 | 增量拉取 + 错峰调度 + 限流退避；量大时改事件订阅 |
| 平台字段/枚举变更 | 映射表集中管理 + 版本化；解析失败进暂存异常态，不静默丢弃 |
| 工号/姓名对不齐（`not_found`） | 优先用工号对齐；提供"平台用户ID↔系统工号"映射表 |
| 自动拉取被误当"自动落库" | 明确：同步只到**暂存**，确认仍需人工点（或需显式开启 auto-confirm 且仅对 `matched` 行） |
| 凭证泄露 | 密钥走密钥管理，不入仓；只读权限最小化 |
| 重复同步 | `externalId` 幂等 + `lastSyncCursor` |

**关于"是否要 auto-confirm"**：默认**不开启**。自动同步只到暂存，保留人工确认闸。若未来 HR 强烈要求全自动，可做"仅 `matched` 行自动确认、`conflict` 行仍人工"的可配置开关，但这是 P2 决策，需机主拍板。

---

## 9. 分期落地建议

| 阶段 | 内容 | 前置 |
|---|---|---|
| **P1-MVP** | 飞书打卡 + 飞书请假，每日增量，只到暂存，人工确认 | 飞书凭证申请 + §7 核实 |
| **P1.5** | 飞书加班/外出 + 钉钉四类 | 钉钉凭证 |
| **P2** | 企业微信（可选）+ 失败告警 + 同步监控看板（监控已落地，见 §11） | — |
| **P2+** | auto-confirm 可配置开关（机主拍板） | 安全评审 |

---

## 10. 开发第一步清单（可执行）

- [x] 联网核实平台端点（2026-11-13，见 §7；钉钉 userid 映射缺口需拍板，枚举/分页/配额仍待补）
- [x] 落实钉钉「平台 userid↔工号」映射来源（P1 采纳方案 2：`system_configs` 人工维护映射，见 §7.3）
- [x] 接飞书打卡目标工号来源（名册全量 ∩ 可选白名单，见 §7.5 / `feishu-employee-source.ts`）
- [ ] 机主/管理员申请飞书企业自建应用 + 考勤/审批只读权限（人工操作，非代码）
- [ ] 申请钉钉应用 + 考勤/OA 审批只读权限（人工操作，非代码）
- [x] 建 `attendance-sync/` service：`types` + `feishu-provider` + `dingtalk-provider` + `im-adapter-credentials`（凭证单源）+ `sync-runner` + `sync-cursor` + `index`
- [x] 注册定时调度 job（`hr-attendance-sync-daily`，每日 02:00，全局开关默认关）
- [x] 建 `lastSyncCursor` 存储（`system_configs` KV，schema 零改动）+ 幂等校验（复用 `createAnyImportBatch` 的 SHA-256 判重）
- [ ] 联调：飞书沙箱拉一批→进暂存→走现有裁决/确认页核对端到端（待凭证申请后）
- [x] 写测试钉住：CSV→现有 parse* 复用命门 + provider 月份窗口切片 + 飞书工号来源（名册/白名单/收窄/非法容错，共 10 项单测全绿）
- [ ] 审批类枚举映射（leave/overtime/outgoing）：待 §7.4 核实后补，暂抛 501

> **实现进度（2026-11-13）**：同步器**代码框架已全部落地**——凭证单源读取、CSV 规范化复用现有判重/暂存流水线（零复制）、游标存储、定时 job 遍历用户、全局开关默认关。**打卡 provider 已实现**（飞书 + 钉钉，且飞书目标工号来源已接），审批三类 provider 端点已核实但枚举映射待补，暂抛 501（不报错、不空跑）。`tsc --noEmit` 0 错误、ESLint 通过、10 项命门单测全绿。**剩余**：① 凭证/scope 人工申请（飞书+钉钉）；② 审批枚举核实（§7.4）；③ 端到端联调（待凭证）。

---

## 11. 同步监控（已落地 2026-11-13）

job 每次跑完（含「禁用」分支）把最近一次运行快照写进 `system_configs`（`sync-status.ts`，schema 零改动），运维查表即可确认每日同步是否正常：

| 字段 | 含义 |
|---|---|
| 键名 | `sync:attendance:last-run` |
| `enabled` | 本次运行时同步总开关状态（false=被禁用，cron 空跑） |
| `scannedUsers` | 扫到的、启用了飞书/钉钉适配器的用户数 |
| `attempted` | 实际尝试的（用户×kind）拉取次数 |
| `syncedBatches` | 成功产出暂存批次数 |
| `skippedNotImplemented` | 因 provider 未实现（501）跳过的次数（审批三类枚举补齐前正常存在） |
| `errors` | 失败明细（用户/kind/错误消息），空数组=全部成功 |
| `finishedAt` | 本次运行完成时间（ISO 字符串） |

**用途**：仅记录「最近一次」用于运维巡检，不是审计流水 —— 需要历史趋势时查 cron 日志或后续 P2 接入告警/看板。写入为最佳努力（`.catch(()=>{})`），状态持久化失败不影响同步主流程。

---

**关联现有代码**：
- 路由：`apps/api/src/routes/hr-import.ts`
- 服务：`apps/api/src/services/hr-import.ts`（打卡）、`hr-import-entry.ts`（四类分发）、`hr-import-leave.ts`（请假/加班/外出 + 别名表）
- 复用入口：`createAnyImportBatch` / `confirmAnyImportBatch` / `resolveImportRow`
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
