<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# L 席 · AI 归属 notes 读侧聚合出口 —— 心跳

## 已开工@2026-11-01/L-authorship-read

- HEAD（当次实测）：`0b1340a5be03ce6b00de94e0c327f8509806b3b6`（短 `0b1340a5be`）
- 工作树：多会话共用，`git status --porcelain` 对活文档/App 面常年非净（本席只新增两个文件 + lib 加导出，不碰他席现场）

## 主席给的四条现场事实 —— 逐条复核（以代码为准）

1. **判据体存在** ✅ 复核一致：`scripts/lib/ai-authorship-notes.mjs`（271 行，导出口 `notesRefForNamespace / readNote / writeNote / recordForCommit / verifyRecord / verifyIntegrity / decideAttribution / buildPayload / mergeEntry / buildEntry / dedupeKeyOf / hashPaths / canonicalJson`）。
   - **差异点名（重要）**：本仓实际命名空间**不是** `refs/notes/ai`，而是 `refs/notes/ihui-ai`（lib:20 `NOTES_NS_BASE = 'refs/notes/ihui-ai'`，派生形 `refs/notes/ihui-ai-<ns>`）。`refs/notes/ai` 只作为「对标外部形态」出现在 `safe-commit.mjs:2101` 的注释里。报表按 lib 的 `notesRefForNamespace()` 取 ref，不硬编码。
2. **写侧已接线** ✅ 复核一致：`scripts/safe-commit.mjs:94` import `recordForCommit`，`scripts/safe-commit.mjs:2104-2116` 在提交落地后派生，主体取 `IHUI_AGENT_SESSION_ID ?? AGENT_NAME`，两者皆空 ⇒ 整段跳过（fail-open，不写 notes）。
3. **读侧零命中** ✅ 复核一致：`git grep -nI "refs/notes/ai"` 全仓仅 1 命中 = `safe-commit.mjs:2101` 注释；`git grep -nI "recordForCommit|verifyRecord|ai-authorship-notes"` 命中集 = lib 本体 + `record-ai-authorship.mjs`（手工 CLI）+ `safe-commit.mjs`（写侧）+ `scripts/tests/ai-authorship-notes.test.mjs`（镜像）。**无任何聚合/审计/报表消费者** ⇒ 「只有写侧没有读侧」成立。
4. **真仓当前归属数据**（主席未给，本席现读，直接影响读数口径）：
   - `git for-each-ref 'refs/notes/*'` ⇒ **0 条**；`.git/refs/notes` 目录不存在；`packed-refs` 无 notes 条目。
   - `git notes --ref=refs/notes/ihui-ai list` ⇒ 空输出 rc=0；`git notes show HEAD` ⇒ `error: no note found for object …`。
   - ⇒ **结论：写侧虽已接线，但真仓至今 0 枚归属 note 落地**（最可能因由：历次 safe-commit 会话未设 `IHUI_AGENT_SESSION_ID`/`AGENT_NAME` ⇒ 走 fail-open 跳过分支）。所以「本仓 AI 归属覆盖率」这个数第一次给出时必然是 **0/有分母**，报表整体结论必须落 `unjudged/未判定`（§0.3），**不得**因为「note 一条没有」就判成「全是人类写的」。
5. **内容哈希轴（Q4）现读**：notes v1 载荷（lib:50-71）**不存 blob 内容哈希** —— 只有 `dedupe_key`（=路径清单的 sha256，lib:33-40）与 `integrity.fp`（=载荷自身的 canonical-json sha256，lib:48/79-88）。⇒ 「note 记录的哈希 vs 当前 blob」这一维**结构上无法从 note 内部取值**：本席把它拆成两条如实的轴 —— `payloadIntegrity`（用 lib `verifyIntegrity`，判载荷被改写）+ `blobDrift`（从 git 现算归属 commit 的 blob 与目标 rev 的 blob 比对，判归属是否已失效）。报表会显式印出「notes 不存内容哈希」这一事实与 lib 锚点，不假装 Q4 原样成立。

## 本席射程

新增只读出口 `scripts/ai-authorship-report.mjs` + 镜像 `scripts/tests/ai-authorship-report.test.mjs`；`lib` **只加纯函数导出**（路径归一 / numstat 行解析 / notes list 行解析），不改任何既有函数体。刻意不进提交链（判历史 ⇒ §12e）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
