<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 号池 ↔ 签到助手双向同步设计(account-pool-checkin-sync)

> 2026-10-23 立 · 状态: 设计定稿待评审
> 关联: ai_relay_account_pool(号池, apps/api) × checkin_accounts(签到助手, apps/ai-service)

## 1. 背景与问题

两条线当前**完全不通**:

| | 号池(relay) | 签到助手(checkin) |
|---|---|---|
| 承载体 | `apps/api`(Node/Fastify) | `apps/ai-service`(Python/FastAPI) |
| 表 | `ai_relay_account_pool` | `checkin_accounts` |
| 分池维度 | providerCode: trae / workbuddy / codearts / qoder | platform: trae / qoder / workbuddy / minimax |
| 凭证加密 | AES-256-GCM(`encryptField`) | Fernet(`_encrypt_jwt`) |
| 用途 | relay 转发选号 | 每日自动签到领免费积分 |
| 归属 | 无 owner(运营级全局池) | owner_user_id(平台用户) |

三个具体缺陷:

1. **号池导入的账号不进签到助手** → 不签到、不领每日免费积分,手工在签到侧重录一遍不现实(号池按批数百个);
2. **凭证双写漂移**: 号池 adapter 刷新 token 只写号池表; 签到引擎(Qoder 401 自刷新)只写 device_map。同一账号两套凭证各自演化,互相不知道;
3. **状态不联动**: 号池停用/删除一个账号,签到侧照打不误(死号每天白打,是最典型的封号前兆信号)。

## 2. 目标 / 非目标

**目标**:
- G1 号池账号(导入/覆盖)自动出现在签到助手,按平台进入对应签到窗口,每日自动签到领积分;
- G2 号池 ↔ 签到凭证双向同步,**版本化 CAS,旧凭证永不覆盖新凭证**;
- G3 启用/停用/删除状态实时联动;
- G4 断链自愈: ai-service 不在时号池导入不阻塞,恢复后自动补齐; 回写失败自动重试;
- G5 定期对账收敛器,任何方向的漏推/丢包都能自愈;
- G6 系统账号与用户账号严格隔离,用户态 API 零感知;
- G7 admin 面可见每个号池账号的签到同步状态与积分。

**非目标(明确不做)**:
- N1 不把签到助手的**用户个人账号**反向塞进运营号池(归属与安全决策,另案);
- N2 不给 codearts 造签到引擎(华为码道无每日签到活动实证; 号池侧照常转发,签到侧如实跳过);
- N3 不改签到引擎的上游协议与风控三件套(错峰/代理/出站闸门),系统账号全额继承;
- N4 不做签到积分反哺 relay 转发的额度计算(积分归属平台的免费额度,由既有 Quota 查询按需展示)。

## 3. 核心设计决策

### D1 凭证双存储 + 版本化 CAS —— "一劳永逸"的关键

凭证必须在两处各存一份(号池 AES-GCM / 签到 Fernet 是两套密钥体系,统一存储要动 database 包与签到引擎底座,代价远超收益)。双存储的经典死穴是**互相覆盖**:

```
号池 adapter 刷新 → 写号池(ver 5)
签到引擎自刷新   → 写签到侧 token(ver 6,回写失败)
对账发现号池 ver 5 < 签到 pending ver 6 → 执行回写 → 号池 ver 6 ✓
```

解法 = 每条凭证带单调递增版本号 `cred_version`,**所有写入都带基准版本,CAS 生效**:

- `ai_relay_account_pool.cred_version bigint NOT NULL DEFAULT 1`(新列);
- 签到侧在 `device_map.pool_cred_version` 记录"本地凭证对应的号池版本";
- 推送(号池→签到): 载荷带 `credVersion`,签到侧 `pool_cred_version < credVersion` 才更新; 等于 = 幂等无操作; 大于 = 签到侧更新(丢弃本次推送);
- 回写(签到→号池): 载荷带 `baseVersion`(= 签到侧记录的 pool_cred_version),api 侧 `UPDATE ... WHERE id=$1 AND cred_version=$2`,命中才写并 `cred_version+1`; 0 行 = 号池侧已发生更新,丢弃本次回写(以号池为准,不冲突);
- 对账收敛器按版本差决定流向(见 §8)。

任何一侧断链、重启、重复推送、乱序到达,收敛结果都确定。这是本方案"最彻底"的根。

### D2 身份对齐: pool_uid 权威化

签到侧身份键 `identity_key` 来自 `derive_account_identity`(各平台 JWT/device_map 解析),号池侧 uid 来自导入映射。**两边解析规则不可能永远一致**(trae 的 JWT data.id vs auth_id vs sub; qoder opaque token 退 device_map.uid),对不上就是"同号两行、各签各的"。

定案: 同步时把号池 uid 显式写入 `device_map.pool_uid`,`derive_account_identity` 增加**第一优先**读 `device_map.pool_uid`(仅同步来的账号带此键,存量用户账号行为零变化)。号池 uid 成为平台身份唯一权威,不依赖两边解析一致性。

### D3 系统 owner 隔离

签到账号落在固定系统 owner `system:relay-pool`(常量只在 ai-service 侧定义,Node 侧不需要知道):

- 调度器 `list_enabled_accounts()` **全表遍历 enabled、不按 owner 过滤**(现成机制)→ 系统账号自动进入每日 06:00 探针 / 08:05 主窗口 / 10:05 Qoder / 08:10 积分快照;
- 用户态 API 全部按 `require_request_user_id` 过滤(真实用户 id 不可能等于 `system:relay-pool`)→ 用户 UI 零感知;
- admin 读取走 api 侧 internal 代理查询(§5 端点 4),不经用户态。

### D4 内网 HTTP + 断链自愈

api 与 ai-service 同容器网络,`AI_SERVICE_URL=http://ai-service:8803` 是 api 侧既有 env; 两侧均有成熟的 `X-Internal-Secret` + `AI_CALLBACK_SECRET` 内网鉴权(ai-service `input_sanitizer` 放行、api `ai-callback.ts:254` 参考实现)。同步走内网 HTTP,**不直连对方库表**(schema 各自演进,HTTP 是稳定契约)。

断链自愈两级:
1. **号池侧 pending**: 推送失败 → `extraMetadata.checkinSync = {status:'pending', reason, at}`,导入照常成功;
2. **签到侧 pending**: 回写失败 → `device_map.pending_cred = {token, refreshToken, baseVersion, at}`,下次签到/探针结束顺带重试;
3. sweep worker(每 5 分钟)挂对账腿补推 pending(§8)。

### D5 平台映射单一真相源在 api 侧

映射表只存在 api 侧(`relay-account-format.ts` 同族),推送时转成 platform 字符串; ai-service 只认 platform 白名单(`_ACCOUNT_PLATFORMS` 现状)。Python 侧零映射逻辑,不会漂移。号池未来新增 provider(如 minimax)只改 api 侧一处即全链路打通。

## 4. 数据模型变更

### 4.1 `ai_relay_account_pool` 加列(迁移 `packages/database/drizzle/<ts>_relay_account_pool_cred_version.sql`)

```sql
ALTER TABLE ai_relay_account_pool
    ADD COLUMN IF NOT EXISTS cred_version bigint NOT NULL DEFAULT 1;
```

存量账号 cred_version=1; 首次对账时以号池为准全量校准(见 §8)。schema 同步改 `packages/database/src/schema/ai-relay.ts`。

### 4.2 `checkin_accounts.device_map` 契约(jsonb,无 schema 迁移)

| 键 | 写入方 | 语义 |
|---|---|---|
| `pool_account_id` | 号池推送 | 号池账号 uuid(回写/对账定位键) |
| `pool_provider` | 号池推送 | 来源 providerCode(审计) |
| `pool_uid` | 号池推送 | **平台身份权威**(D2,identity_key 第一优先源) |
| `pool_cred_version` | 号池推送/回写后 | 本地凭证对应的号池版本(CAS 基准) |
| `pool_synced_at` | 号池推送 | 最近同步时刻(admin 展示) |
| `pool_enabled` | 号池状态联动 | 号池侧启用态镜像 |
| `pending_cred` | 签到引擎 | 回写失败待重传凭证(D4) |
| `uid` | 号池推送 | 平台 uid(qoder/workbuddy/minimax 引擎既有消费键) |
| `refresh_token` / `expires_at` | 号池推送 | qoder 引擎既有消费键 |
| `cosy`(machine_token 等蛇形族) | 号池推送 | qoder Cosy 头族(号池 extraMetadata 已有) |
| `proxy` | 号池推送 | = 号池 proxyUrl,签到侧 client_for 既有消费键(同账号同出口 IP) |
| `pool_name` | 号池推送 | 号池展示名备份(create_account 会以 extract_display_name 覆盖 name) |

存量桌面捕获/网页录入的账号**不带** `pool_*` 键 → `derive_account_identity` 走原逻辑,行为零变化。

## 5. 同步协议(内网 HTTP,两侧均校验 X-Internal-Secret)

### 端点 1 · `POST /internal/checkin/pool-sync`(api → ai-service,账号 upsert)

```jsonc
// 请求(平台映射单一真相源在 api 侧[D5],ai-service 只认 platform 白名单)
{
  "platform": "qoder",
  "accounts": [{
    "poolAccountId": "uuid",
    "uid": "12345",
    "name": "Qoder 主账号 #1",
    "token": "...",                      // 明文,仅内网传输
    "refreshToken": "... | null",
    "credVersion": 3,
    "enabled": true,
    "proxyUrl": "http://... | null",
    "deviceId": "... | null", "machineId": "... | null",
    "cosy": { "machine_token": "...", "machine_code": "...", "machine_type": "...", "version": "..." } | null,
    "expiresAt": "ISO8601 | null"
  }]
}
// 响应
{ "results": [{ "poolAccountId": "uuid", "status": "synced|skipped|failed", "checkinAccountId": 42, "reason": null }] }
```

处理: providerCode→platform 映射(§6); `codearts` → `skipped` + reason(无签到引擎,如实); 复用 `checkin_store.create_account` 身份合并通路,合并条件扩展为 `pool_cred_version < credVersion` 才更新凭证(D1); `pool_enabled=false` → 同时落 enabled=false。响应逐条状态,api 侧落 extraMetadata。

### 端点 2 · `POST /internal/checkin/pool-state`(api → ai-service,状态联动)

```jsonc
{ "providerCode": "qoder", "items": [{ "uid": "12345", "state": "enabled|disabled|pool_deleted" }] }
```

- `enabled/disabled`: 置 checkin_accounts.enabled(调度器即跳过/恢复);
- `pool_deleted`: enabled=false + device_map.pool_deleted_at(**保留签到历史**,不物理删)。

### 端点 3 · `POST /internal/relay/account-pool/credential`(ai-service → api,凭证回写 CAS)

```jsonc
// 请求
{
  "poolAccountId": "uuid",
  "token": "新 access token",
  "refreshToken": "... | null",
  "baseVersion": 3,                      // 签到侧 pool_cred_version
  "source": "checkin_engine_refresh",
  "expiresAt": "ISO8601 | null"
}
// 响应
{ "ok": true, "credVersion": 4 }         // CAS 命中,版本+1
// { "ok": false, "reason": "version_conflict|not_found" }  // 0 行,丢弃(号池侧更新,以号池为准)
```

api 侧: `UPDATE ai_relay_account_pool SET token_enc=encryptField($token), refresh_token_enc=..., token_expires_at=..., cred_version=cred_version+1, updated_at=now() WHERE id=$1 AND cred_version=$2 RETURNING cred_version`; 同时清/降该账号的 refresh_failure 计数(凭证已新的证据)。

### 端点 4 · `GET /internal/checkin/pool-status?provider=&uid=`(api → ai-service,admin 读)

返回系统 owner 下账号的: enabled、今日记录(action/credits/credits_delta)、活跃冷却、最近同步时刻、pending 回写标记。admin 号池页逐账号展示(G7),不做整表大查询(按 uid 点查)。

## 6. 平台映射(api 侧单一真相源)

| 号池 providerCode | 签到 platform | 说明 |
|---|---|---|
| trae | trae | 双向凭证 + 状态全通 |
| qoder | qoder | 双向凭证(引擎自刷新最活跃,回写价值最大)+ 状态 |
| workbuddy | workbuddy | 双向凭证 + 状态 |
| codearts | — | **skipped**: 无每日签到活动实证,不同步不假装 |
| (未来)minimax | minimax | 号池加 provider 时只改映射表一处,签到引擎现成 |

## 7. 触发时机(五处挂钩)

| 挂钩点 | 动作 | 失败行为 |
|---|---|---|
| `importAccounts()` 每条 imported/updated 后 | 端点 1 upsert | extraMetadata.checkinSync=pending,导入照常成功 |
| toggle 路由(启用/禁用) | 端点 2 enabled/disabled | pending + warn 日志 |
| delete 路由 | 端点 2 pool_deleted | pending + warn 日志 |
| sweep worker 每轮(现成 BullMQ 5min) | 对账收敛器(§8)+ 补推 pending | 下轮重试 |
| `checkin_one()` 末尾(现成 save_device_map 之后) | device_map 序列化签到前后不同 ∧ 带 pool_account_id → 端点 3 回写 | device_map.pending_cred,下次签到/探针重试 |

## 8. 断链自愈与对账收敛器

sweep worker 每轮顺带执行(现成 sweepAccountPool 之后,复用同分布式锁):

1. 拉号池全量(providerCode ∈ 映射域,含 cred_version/enabled);
2. 拉签到侧系统 owner 全量(pool_account_id/pool_cred_version/enabled)—— **新增一个 store 函数** `list_pool_accounts()`,按 owner 精确查,不碰用户账号;
3. 差集与版本判定:
   - 号池有、签到无 → 端点 1 补推;
   - 签到有、号池无 → 端点 2 pool_deleted(号池删了,签到停用);
   - 双边在、`号池.cred_version > 签到.pool_cred_version` → 端点 1 补推;
   - 双边在、`签到.pending_cred.baseVersion == 号池.cred_version` → 端点 3 补回写;
   - enabled 不一致 → 端点 2 校准;
4. 单轮上限(如 200 条)防打爆,余量下轮继续;
5. 全部收敛 ⇒ `extraMetadata.checkinSync={status:'synced', at}`。

对账是**幂等收敛器**: 重复跑、中断重跑、乱序到达,终态一致(D1 保证)。

## 9. 安全边界

- 两个方向全部 `X-Internal-Secret` 校验,复用既有 secret 管理(AI_CALLBACK_SECRET),不新增密钥体系;
- 明文 token 只在容器内网传输,不落任何日志(日志只记 poolAccountId/uid/version);
- `system:relay-pool` 不可登录、不可被用户态 API 寻址(require_request_user_id 语义保证); admin 读取只经 internal 端点 4;
- 端点 3 只接受 CAS 命中更新,天然防重放(旧 baseVersion 打回);
- 号池侧 `decryptAccountCredentials` 明文不出 api 进程边界(除推给 ai-service 的内网请求)。

## 10. 风控(系统账号全额继承签到侧既有机制)

- `device_map.proxy = proxyUrl`: 同账号同出口 IP,与 relay 转发出口一致(若号池配了代理);
- 错峰(jitter 8~45s)、出站全局闸门(checkin_outbound_gate)、冷却累积(Server/Client 三连击、SessionDead 10 年)、06:00 探针只读预检 —— 全部现成,系统账号无差别适用;
- 号池转发(高频业务)+ 签到(每日 1~2 次)叠加风险已知可控; 监控位 = admin 面签到成功率与冷却态可见(G7),异常可一键停用联动;
- 免费代理池(CHECKIN_FREE_PROXY_POOL)对系统账号同样生效。

## 11. Admin UI(web 号池页 `admin/relay/account-pool`)

- 列表行新增: 签到同步徽章(synced/pending/failed + 原因 tooltip)、今日已签✓/未签、最近积分、冷却态;
- 行操作: 「重推同步」(端点 1 单条)、「立即签到」(内部转 manual_checkin 语义,尊重冷却);
- 数据源: 页面加载时按页内 uid 批量点查端点 4(单页 ≤20 个 uid,不做全表拉取)。

## 12. 落地提交序列(6 个提交,均可独立过门禁)

1. **schema**: cred_version 加列 + drizzle 迁移 + schema 同步(仅 DDL,零行为变化);
2. **ai-service 接收侧**: internal 路由文件(端点 1/2/4)+ `list_pool_accounts()` + `derive_account_identity` 的 pool_uid 优先 + 单测;
3. **api 推送侧**: `relay-account-pool-checkin-sync.ts` 服务(映射/pending/重推)+ import/toggle/delete 三处挂钩 + 单测;
4. **回写侧**: 端点 3(api)+ `checkin_one` 末尾回写触发与 pending_cred 重试(ai-service)+ 单测;
5. **对账收敛器**: sweep worker 挂腿 + 差集/版本判定纯函数 + 单测;
6. **admin UI + e2e**: 号池页签到状态展示与操作 + 端到端用例(导入→签到侧可见→停用→删除→回写 CAS)。

落地流程按本仓并行纪律: 独立 git worktree 隔离,类 pre-commit 门禁全绿后按 object-space-land/收敛流程推 origin; 每提交一个逻辑点,门禁逐提交跑(tsc/eslint/vitest/ruff/mypy + 既有守门)。

## 13. 测试计划

- **映射与协议**: providerCode→platform 映射表驱动用例; codearts skipped; 载荷缺字段 400;
- **CAS**: 同版本重复推送幂等; 旧版本推送被拒(不降级); 回写 baseVersion 过期 → version_conflict 且号池凭证不变;
- **身份对齐**: pool_uid 优先(同 JWT 不同解析规则下 identity 仍唯一); 存量无 pool_* 键账号回归;
- **断链**: ai-service 5xx → pending 落库且导入成功; 恢复后 sweep 补推 synced; 回写失败 → pending_cred → 重试成功;
- **对账**: 差集四象限各一条; 单轮上限截断后下轮续跑; 空池/全同步零操作;
- **隔离**: 用户态 API 查不到系统 owner(列表情形); admin 点查只返回系统 owner;
- **e2e**: 号池导入 trae/qoder/workbuddy 各 1 → 签到侧出现且今日调度覆盖 → toggle/delete 联动 → qoder 刷新回写版本+1。

## 14. 验收清单(怎么证明打通)

1. 号池导入 1 个 trae 号 → `system:relay-pool` 下出现该账号,identity_key=号池 uid;
2. 次日 06:00 探针/08:05 主窗口日志出现该账号(或已在平台签过 → skip_already 落记录);
3. admin 号池页该行显示「今日已签」与积分;
4. 号池停用 → 签到侧 enabled=false,调度日志跳过; 恢复 → 重新纳入;
5. 号池删除 → 签到侧停用且历史记录仍在;
6. 停 ai-service → 导入成功且 pending; 恢复 → 5 分钟内 sweep 补推 synced;
7. qoder 号签到触发引擎刷新 → 号池 token_enc 更新且 cred_version+1(旧版本并发回写被 CAS 拒);
8. 用户态 `GET /api/checkin/accounts` 看不到任何系统账号;
9. 全量门禁绿(tsc/eslint/vitest/ruff/mypy + 185+ 守门)。

## 15. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 并行会话在飞,落地冲突 | worktree 隔离 + object-space-land,每提交一个逻辑点 |
| cred_version 迁移与在飞 DDL 撞车 | 迁移用 ADD COLUMN IF NOT EXISTS 幂等; 落地前现读远端迁移目录 |
| 内网 HTTP 成为新故障点 | 两侧全 fail-open + pending + 对账自愈; 同步失败绝不阻塞号池主业 |
| 系统账号签到量放大风控面 | 全额继承错峰/闸门/冷却; admin 面可见可一键停用 |
| pool_uid 与存量 identity 冲突 | pool_uid 仅同步账号带; backfill 只对系统 owner 账号执行,一次性对账脚本 |

## 16. 用户态个人号池 · 三端管理(2026-10-23 立,移动端对齐 Web)

每个登录用户的 `owner_user_id` 独立成池(运营池 `owner_user_id IS NULL` 与本节互不串门)。用户池里的账号即签到助手同一批账号,经 §7 双向同步 + scheduler 对账收敛自动进签到调度 → 每日自动签到获取免费积分,并在转发时优先使用。

**用户态端点**(`apps/api/src/routes/account-pool.ts`,全部 `authenticate` 门):

- `GET /api/account-pool` 我的个人号池列表(投影不含 *Enc/proxyUrl/cosy)
- `POST /api/account-pool` 添加(手动凭证;等价签到助手录入,自动推送签到侧 + 回连 pool_account_id)
- `PATCH /api/account-pool/:id` 改名/启停(启用态联动签到侧 `push(state)`)
- `DELETE /api/account-pool/:id` 删除(联动 `push(pool_deleted)`)
- `POST /api/account-pool/:id/checkin` 立即签到(转签到引擎 manual 语义,尊重冷却)
- `GET /api/account-pool/:id/status` 签到状态点查
- `GET /api/account-pool/summary` 个人池概览(角标/首页)

**三端入口**(数据同一后端,天然互通):

| 端 | 入口/文件 | 说明 |
|---|---|---|
| Web | `/account-pool`(`apps/web/app/(main)/account-pool/page.tsx`)+ 侧栏 | 用户态个人号池 |
| RN | `Screen AccountPool`(SettingsScreen 菜单+抽屉)调 `/api/account-pool` | 对齐 Web |
| 小程序 | `pkg-user/account-pool`(`app.config.ts` 注册+入口)调端内 `api.*('/account-pool')` | 对齐 Web |

**文案**: 新增 `accountPool` 命名空间(RN/miniapp 各 5 语言同批;两端共用 zh-CN/en/ja/ko/zh-TW)。小程序运行时读 `gen-i18n-compressed.mjs` 派生产物,改完 `packages/i18n/.../miniapp-taro/*.json` 须 `pnpm --filter @ihui/miniapp-taro gen:i18n` 重算 `zh-cn-pack.gen.ts`/`remote-locale-manifest.gen.ts` 才进端内首屏回落包。
