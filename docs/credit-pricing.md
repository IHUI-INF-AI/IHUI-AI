# 模型积分计价方案

> 目标:为每条 LLM 调用建立可量化、可管控、可兜底的积分消耗规则,既支撑 SaaS 多租户计费,也兼容社区免费额度。
> 配套 DB 字段:`ai_model_config_models.points_multiplier numeric(5,2) default 1.00`。
> 管理端入口:`/admin/ai-models`(每个模型的"积分消耗倍数"下拉)。

---

## 一、计费公式

```
扣分 = (输入 token + 输出 token) / 1000 × points_multiplier × 1 积分基准
```

- **token 总量** = `usage.prompt_tokens + usage.completion_tokens`(由 LLM 响应体返回)。
- **points_multiplier**:模型级倍数,5 档可选(0 / 1 / 3 / 10 / 30),DB 默认 1.00。
- **1 积分基准**:1 积分 = 1000 token × 1 倍数,与 monetization.md 的 SaaS 订阅额度换算一致。
- **结果取整**:向下取整到 2 位小数(`floor(扣分 × 100) / 100`),避免微小扣分放大误差。

**示例**:
- GPT-4o(标准 ×3),输入 800 token + 输出 200 token → `(800+200)/1000 × 3 × 1 = 3 积分`
- DeepSeek-Chat(经济 ×1),输入 5000 token + 输出 1000 token → `(5000+1000)/1000 × 1 × 1 = 6 积分`
- Ollama 本地模型(免费 ×0),任意 token → `0 积分`

---

## 二、5 档倍数梯度表

| 倍数档位 | `points_multiplier` | 单次 1K token 扣分 | 推荐场景 | 模型示例 |
| --- | --- | --- | --- | --- |
| **免费** | 0 | 0 积分 | 本地模型 / 内测免费 / 教学体验 | `ollama/llama3` / `deepseek-free-tier` |
| **经济** | 1 | 1 积分 | 大流量基础场景 / 国产高性价比模型 | `deepseek-chat` / `qwen-turbo` / `gpt-4o-mini` |
| **标准** | 3 | 3 积分 | 主力对话模型 / 性价比均衡 | `gpt-4o` / `claude-3-5-sonnet` / `gemini-1.5-pro` |
| **高级** | 10 | 10 积分 | 复杂推理 / 长上下文 / 高质量场景 | `claude-opus-4` / `gpt-4-turbo` / `gemini-1.5-pro-1M` |
| **旗舰** | 30 | 30 积分 | 顶级推理 / 多模态 / 企业关键链路 | `gpt-4o-flagship` / `claude-opus-flagship` / `gemini-ultra` |

> 倍数由管理员在 `/admin/ai-models` 编辑,选项固定为 5 档(下拉选择,不允许自由输入,避免误填 9999 等极端值)。

---

## 三、积分来源

| 来源 | 表 | 字段 | 说明 |
| --- | --- | --- | --- |
| 用户积分余额 | `user_points`(gamification schema) | `points` | 用户当前可用积分,扣分直接从此字段递减 |
| 签到 / 任务奖励 | `point_records` | `change` | 每日签到、任务完成、活动奖励等正向流水 |
| 兑换商城消耗 | `point_redeem_items` | `points_cost` | 兑换商品时扣分(独立于 LLM 计费链路) |
| SaaS 订阅赠送 | `vip_subscriptions` | `granted_points` | Pro / 企业版每月赠送积分,计入 `user_points` |

> 积分账户体系由 `packages/database/src/schema/gamification.ts` 维护,API 端通过 `POST /api/v1/llm/chat` 链路调用前查询余额,调用后扣减。

---

## 四、扣分时机

```
用户发起 LLM 调用
  ├─ 1. 预检:查询模型 points_multiplier + 用户积分余额
  ├─ 2. 估算最大扣分 = (max_tokens 限制) × multiplier / 1000
  ├─ 3. 余额不足 → 触发兜底策略(见第五节)
  ├─ 4. 余额充足 → 调用 LLM(stream / non-stream)
  ├─ 5. LLM 成功返回 → 读取 usage.prompt_tokens + completion_tokens
  ├─ 6. 计算实际扣分 = (prompt + completion) / 1000 × multiplier
  └─ 7. 事务扣减 user_points.points + 写入 point_records(change = -扣分, reason = 'llm_call')
```

- **扣分时机**:LLM 调用**完成后**按实际 `usage.token` 扣分,**不预扣**(避免失败后回滚复杂度)。
- **流式调用**:在 SSE done 事件中获取 `usage`,在 done 之后再扣分;若 LLM 未返回 usage,降级为按 `max_tokens` 估算扣分。
- **缓存命中**:命中缓存的响应**不扣分**(避免重复计费),命中逻辑见 `apps/ai-service` 的 60% 缓存层。

---

## 五、兜底策略(积分不足)

```
LLM 调用前发现 估算扣分 > 用户积分余额
  ├─ 优先策略 A:降级到 zero_cost 模型(points_multiplier = 0)
  │   ├─ 查询当前 provider_code 下所有 multiplier = 0 且 enabled = true 的模型
  │   ├─ 优先选 sortOrder 最小的,保证用户体验稳定
  │   └─ 降级响应 header 加 `X-Credit-Downgraded: 1` + `X-Original-Model: <原模型>`
  ├─ 次选策略 B:无 zero_cost 模型可用 → 返回 402 Payment Required
  │   ├─ 响应体:{ code: 402, message: "积分不足,请签到 / 兑换 / 升级 VIP", data: { required, balance } }
  │   └─ 前端弹出"积分不足"对话框,引导签到 / 兑换 / 升级
  └─ 兜底策略 C:管理员可配置"全局免费兜底模型"(env: `LLM_FALLBACK_MODEL_ID`)
      └─ 兜底模型固定 zero_cost,所有租户共享,避免完全无法使用
```

- **降级可见**:前端需在消息气泡下方提示"本次调用已降级到 `<模型名>`(积分不足)",不静默降级。
- **降级频率**:同一用户 24 小时内降级 ≥ 10 次 → 触发引导升级 VIP 的强提示。
- **管理员可关闭兜底**:env `LLM_CREDIT_FALLBACK_ENABLED=false` 时,积分不足直接返回 402,不降级。

---

## 六、失败不扣分(事务保护)

| 失败场景 | 处理 | 扣分 |
| --- | --- | --- |
| LLM 调用 HTTP 5xx / 超时 | 不扣分,记录 `llm_call_logs.status = 'failed'` | 0 积分 |
| LLM 调用返回 4xx(鉴权 / 限流) | 不扣分,记录错误 | 0 积分 |
| LLM 调用成功但 `usage` 缺失 | 降级按 `max_tokens` 估算扣分 | 估算值 |
| 扣减积分时 DB 事务失败 | 整个调用回滚,**不写入响应**,返回 500 | 0 积分 |
| `point_records` 写入失败但 `user_points` 已扣 | 后台对账任务每小时修复(以 `user_points` 为准) | 已扣 |

**事务边界**:`扣减 user_points + 写入 point_records` 必须在同一 Drizzle 事务中,任一失败全部回滚,确保积分账户一致性。

**对账任务**:`apps/api/src/jobs/credit-reconcile.job.ts`(每小时执行),扫描最近 1 小时 `llm_call_logs` 与 `point_records`,发现不一致:
- `point_records` 有记录但 `llm_call_logs.status = 'failed'` → 退回积分(`point_records.change = +退回值`)
- `llm_call_logs.status = 'success'` 但无对应 `point_records` → 补扣分(写 `point_records.change = -补扣值`)

---

## 七、管理端能力

### 7.1 编辑倍数

入口:`/admin/ai-models` → 编辑 / 新增模型对话框 → "积分消耗倍数"下拉。

- 5 档固定选项,不允许自由输入。
- 默认值 1(经济档)。
- 修改后立即生效(下次 LLM 调用即按新倍数扣分)。
- 不影响历史 `point_records`(已扣分记录不补扣 / 不退回)。

### 7.2 查看扣分流水

- `/admin/points/records`:查看所有用户积分流水(支持按 `reason = 'llm_call'` 筛选)。
- `/admin/llm/call-logs`:查看 LLM 调用日志,含 `tokens_used` / `points_cost` / `model_id`。

### 7.3 全局配置

| 环境变量 | 默认 | 说明 |
| --- | --- | --- |
| `LLM_CREDIT_FALLBACK_ENABLED` | `true` | 积分不足时是否降级到 zero_cost 模型 |
| `LLM_FALLBACK_MODEL_ID` | (空) | 全局免费兜底模型 ID(空则按 provider 内 zero_cost 模型选) |
| `LLM_CREDIT_DOWNGRADE_LIMIT` | `10` | 24 小时内降级次数上限,超过触发 VIP 升级强提示 |
| `LLM_CREDIT_RECONCILE_INTERVAL` | `3600` | 对账任务执行间隔(秒) |

---

## 八、与其他规则的关系

- **与 monetization.md 的关系**:本方案是 monetization "API 计费"收入流的具体实现,积分 = 1 分钱(¥0.01)的内部记账单位,支持 SaaS 订阅赠送 / 单独购买 / 兑换商城。
- **与 RBAC 的关系**:管理员(`role_id >= 1`)才能编辑倍数;普通用户只能查看自己的扣分流水。
- **与多租户的关系**:`user_points` 按 `tenant_id` 隔离,跨租户不互相影响;`points_multiplier` 是模型级全局配置,不按租户区分(如需按租户定制,后续扩展 `tenant_model_overrides` 表)。
- **与缓存层的关系**:命中缓存的响应不扣分,但 `llm_call_logs` 仍记录(`status = 'cache_hit'`),便于成本分析。

---

## 九、变更日志

| 日期 | 变更 | 备注 |
| --- | --- | --- |
| 2026-07-31 | 初版立稿 | DB schema 已新增 `points_multiplier` 字段,admin AI 模型管理页已支持编辑 |
