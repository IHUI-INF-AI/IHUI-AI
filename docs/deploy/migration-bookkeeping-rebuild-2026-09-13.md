<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 迁移记账重建与守门 — 2026-09-13

> 生产库 = 本机 `127.0.0.1:8810`(`ihui_dev`)·drizzle 目录 `packages/database/drizzle`(254 个 `.sql`)
> 结论:**254 ↔ 254 严格双射达成**,`drizzle-kit migrate` 通道恢复且幂等(零应用)。

## 1. 症状

`drizzle-kit migrate` 每轮都"成功"但**一条迁移也不应用**;另一条基于 sha256 记账的旧通道
(`D:/DevEnv/tools/apply-migrations.py`)与磁盘 253 个 `.sql` **0 命中**。

## 2. 两条通道的根因

| 通道 | 根因 | 证据 |
|---|---|---|
| `drizzle-kit migrate` | 判据为 `Number(DB.created_at) < entry.when`。journal 的 `when` 是**合成时间戳**(自 2023-11-14 起每条 `+86400000`,max = `1721513600000`);而库内 `created_at` 是**真实时间**(max = `1788717703662`)。→ 判据恒假 → 恒空转 | `meta/_journal.json` 全量 `when` 等差;库内 last `created_at` 远大于 journal max |
| `apply-migrations.py`(sha256 记账) | 迁移文件被注入**零宽溯源水印**后内容改变 → 旧 sha256 全部失效(0/253 命中) | 自证:同文件去水印后 hash 可复现 |
| 附带发现 | `llm_call_logs.config_id` 为 `uuid` 而 `ai_model_config.id` 是 `bigint` → 渠道直连 success 写数字 id 触发 `invalid input syntax for type uuid` → `recordCall` 顶层 catch 吞错 → **无流水、无计费**(error 路径 `configId=null` 故正常落库,此差异是定位关键) | `D:/DevEnv/logs/svc-api-nssm.log` level:50 `[billing] recordCall failed` |

> 选型说明:保留 `drizzle-kit migrate`(它只比对 `created_at`,不比对 hash,天然免疫水印导致的内容漂移),
> 废弃 sha256 记账通道。

## 3. 修复动作

1. **DDL 修复**:`ALTER TABLE llm_call_logs ALTER COLUMN config_id TYPE bigint`(存量 40 行全 NULL,零损失);
   `provider_code` 复核后维持 `varchar(32)`(号池实际值仅 `swiftapi`,不存在截断)。
2. **journal 重建**:补录缺失条目,`248 → 254` 条;`when` 严格单调、`tag` 唯一。
3. **库内记账重建**:备份原表为 `drizzle.__mig_audit_bak_20260913`(453 条污染行)后重建为 **254 条**,
   `created_at` 与 journal `when` **逐一对应**。
4. **补齐 4 条 pending 迁移**(均幂等 `IF NOT EXISTS`):`0225_create_device_tokens`、
   `20260910000000_agent_tasks_workspace_team`、`20260908000000_create_agent_event_triggers`、
   `20260910030000_create_knowledge_cards`。
5. **清理误诊产物**:删除 `20260913140000_llm_call_logs_provider_code_widen.sql`(误诊 + 孤儿无 journal 条目);
   schema 回退 `provider_code` 到 `varchar(32)`,并把 e404b3e 漏改的 `configId: bigint` 补上。

## 4. 验证(可复现)

```bash
pnpm migration:check          # 离线: journal↔.sql 双向一一对应 / tag 唯一 / when 严格递增唯一
pnpm migration:check:db       # 追加: 库内 drizzle.__drizzle_migrations 与 journal 严格双射
```

实测输出(2026-09-13):

```
✓ B5 journal 结构完整(version=7, dialect=postgresql, 254 条)
✓ B1 双向一一对应(254 ↔ 254)
✓ B2 tag 唯一      ✓ B3 when 严格递增且唯一
! B4 idx 断号(非阻塞): 210→212  —— drizzle 按 tag 配对 SQL、按 when 排序,idx 仅元数据
✓ B6 行数一致(254)
✓ B7 created_at 集合与 journal when 集合严格双射
✓ B8 max 一致(1721945600000)→ migrate 不会空转,也不会重跑
```

补充证据:`max_created_at == 1721945600000 == journal.last.when`;`config_id` 实库类型 = `bigint`。
`schema drift check`(`scripts/check-db-schema-drift.mjs`)覆盖的是 TS schema ↔ 迁移 SQL 的**表级**漂移,
与本文的 **journal 记账结构**是互补维度,两者都进 CI。

## 5. 守门(防再漂移)

| 守门 | 位置 | 维度 |
|---|---|---|
| `scripts/check-migration-bookkeeping.mjs` | CI(`Migration bookkeeping check`)+ pre-commit(guardian-runner id `49`,blocking) | B1~B5 离线结构 |
| 同上 `--db` | 手工(`pnpm migration:check:db`) | B6~B8 库内双射 |

应急跳过:`HUSKY_SKIP_MIGRATION_BOOKKEEPING=1 git commit ...`
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
