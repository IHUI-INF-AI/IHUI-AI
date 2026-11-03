<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui/context-compaction — 契约与边界

一句话职责:会话上下文压缩的**唯一规则源** —— 触发阈值、token 估算、配对组切分、分层摘要、
零模型请求回收、压缩后复核与回填熔断。跨端共享:CLI agent runtime、API `/chat/stream` 入口、
ai-service(TS 边界)共用同一套判定;Python 侧等价实现住在 `apps/ai-service/app/core/context_compaction.py`。

## 1. 对外给谁用(现查 HEAD,`git grep -l "from '@ihui/context-compaction'" HEAD -- apps packages scripts`)

15 个文件引用,全部走主入口 `'@ihui/context-compaction'`,无一处子路径:

- `apps/api`:`src/routes/ai-chat-stream.ts`、`src/routes/chat.ts`、`src/utils/conversation-archive.ts`、
  `src/utils/semantic-summary.ts`(+ `tests/ai-chat-stream-tools.test.ts`)
- `apps/cli`:`src/context.ts`、`src/context-guards.ts`、`src/compaction-v2.ts`、`src/compaction-cache.ts`、
  `src/commands/agent.ts`、`src/tools/result-envelope/envelope.ts`、`scripts/compaction-eval.ts`
  (+ `tests/compaction-eval.test.ts`、`tests/compaction-reclaim-first.test.ts`、`tests/parity-fixture.test.ts`)

## 2. 公开面(package.json `exports` 只有 `"."`;`src/index.ts` 是唯一 re-export 面)

`main`/`types` = `./dist/index.js` / `.d.ts`,构建 = `tsc`(纯 TS,无需资源复制)。入口按内部模块分组递出:

- 内核叶子:`src/types.ts`(`ChatMessage`、`ChatMessageToolCall`)、`src/token-estimate.ts`
  (`estimateTokens`、`estimateMessagesTokens`、`MESSAGE_OVERHEAD_TOKENS`、`TOOL_CALL_OVERHEAD_TOKENS`、`IMAGE_TOKEN_PLACEHOLDER`)
- 标记(`src/markers.ts`):`SUMMARY_MARKER`、`isSummaryMessage`、`ENVELOPE_OPEN_MARKER`、`ENVELOPE_CLOSE_MARKER`、
  `ENVELOPE_PREVIEW_FOOTER`、`isEnvelopeContent` —— 信封与摘要的**字符串形状**只有这一处定义,端内不得再写字面量
- 压缩主流程(`src/index.ts` 本文件定义):`compressContext`、`compressContextIfNeeded`、`buildStructuredSummary`、
  `summarizeMessage`、`effectiveContextWindow`(**压缩分母唯一出口**,必须用它而不是直接除以 `contextWindow`)
- 回收(`src/reclaim.ts`):`reclaimStaleToolResults`、`splitAssistantRounds`、`hasMultimodalBlock`、
  `isReclaimedPlaceholder` + `RECLAIM_*` 常量族
- 有效性守卫(`src/validity-guards.ts`):`reverifyContextAfterCompaction`、`pickAuthoritativeTokens`、
  `RefillBreaker`、`buildRefillDiagnostic`、`retryAfterOverflowDrop`、`findOrphanToolMessages`
- 闭集原因:`COMPACTION_DECISION_REASONS` / `CompactionDecisionReason` / `isCompactionDecisionReason`
- 阈值常量:`DEFAULT_TRIGGER_RATIO` 0.88、`DEFAULT_TARGET_RATIO` 0.6、`DEFAULT_KEEP_RECENT` 6、
  `DEFAULT_MAX_TOKENS` 24000、`CONTEXT_BUDGET_THRESHOLD` 0.7、`MAX_OUTPUT_RESERVE_TOKENS` 8192

结果类型 `CompressionResult` 的 `removedCount` / `truncatedCount` / `trigger` / `reason` 是**四个不同维度**,
不得互相代替(缺席读作"未知",不读作 0)。

## 3. 依赖方向与边界(`config/architecture-policy.yaml` 条目 `- id: 'packages/context-compaction'`)

`layer: platform` · `exported: true` · `managed: true` · `requires: []` · `public_entrypoints: ['.']`

- 唯一运行时依赖是 `gpt-tokenizer`(仅 `src/token-estimate.ts:8` 用其 `encode`),不依赖任何仓内包 ⇒ `requires: []` 诚实。
- 端内**不得**按 `@ihui/context-compaction/src/...` 或 `.../dist/reclaim.js` 穿透内部 —— 表里 `public_entrypoints`
  只有 `.` 一条,深导入由本门 D3 判红。
- 阈值/比例/字符量这类数字**不得**在任何端复制第二份:改了这里就改了所有端;反过来,端内出现 `0.88` 这类
  字面量即属"绕开单一源"。
- 与 Python 侧是**逐语义**镜像而非共享代码:`test/consistency-fixtures.json` 与
  `tests/fixtures/parity.json` 两侧的 fixture 由 `apps/ai-service/tests/test_consistency_fixtures.py`、
  `test_context_compaction.py` 消费 ⇒ 改判据必须同批改 Python 侧与夹具。

## 4. 已知缺口 / 未收口的点

- `src/reclaim.ts:147` 导出 `isEnvelopeResult`,但 `src/index.ts` 的 reclaim re-export 清单里**没有它**
  ⇒ 经唯一公开面拿不到。仓内其余 5 处 `isEnvelopeResult` 全在 `apps/cli` 的**注释正文**里(不是调用),
  所以这个符号目前是"包内自用 + 对外隐形"。要么补进 index,要么改成非导出。
- 测试目录**两份并存**:`test/`(4 个文件,真正的 vitest 用例)与 `tests/`(只有 `fixtures/parity.json`,无 spec)。
  AGENTS §23 要求项目内测试目录用 `tests/`;当前 `vitest run --passWithNoTests` 靠默认 glob 同时吃到
  `test/`,一旦有人按 §23 把 `test/` 并进 `tests/` 而漏改夹具路径,`--passWithNoTests` 会让"一个用例都没跑"
  以绿色通过。合并这一格时**必须**去掉 `--passWithNoTests` 复跑一次再判定。
- `CompressionResult.truncatedCount` 是 2026-09-26 补的可选字段(A10B-8),旧调用方仍按 `trigger === 'truncated'`
  单判据披露"省略了几条";`apps/api` 那两处路由是否已改读该字段本次未逐行核。
- 本包无 `contract_files` 声明,也不命中 `contract_file_patterns` ⇒ 齐备性(E2)此前只靠本文档补足。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
