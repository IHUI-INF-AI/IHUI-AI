<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 三轮 goal 交付完整性审计报告（b41 / b42 / b43）

- 审计对象：`G:/IHUI-AI` 仓库
- 审计范围：跨层（源码 / 测试 / 文档）完整性
- 审计方法：Grep / Read / Glob / Bash 实际核查，不依赖记忆
- 审计日期：2026-10-31

---

## 一、每轮「源码落地 / 测试 / 文档登记」三栏勾叉表

### b41 — ContextFS（只读虚拟文件系统）+ 导入 4 维（README 记为 `G2 ContextFS`，commit `6b25542a75`）

| 栏       | 结论    | 命中真实文件 / 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 源码落地 | ✅      | `apps/ai-service/app/services/knowledge_fs.py`（322 行，真实实现，头注声明「把 codebase 语义索引投影成只读虚拟文件系统」）<br>`apps/ai-service/app/api/v1/knowledge_fs.py`（106 行，API 端点）<br>导入：`apps/ai-service/app/services/external_runtime_import.py`（232 行）、`apps/ai-service/app/api/v1/external_import.py`（58 行）、`apps/ai-service/app/services/importers/`（8 个具体导入器：aider / chatgpt / claude_ai / claude_code / codex / cursor / ir / wechat） |
| 测试绿   | ✅      | `apps/ai-service/tests/test_knowledge_fs.py`（**12** 个测试函数）<br>`apps/ai-service/tests/test_importers.py`（**35** 个）<br>`apps/ai-service/tests/test_wechat_importer.py`（**40** 个）                                                                                                                                                                                                                                                                                  |
| 文档登记 | ⚠️ 部分 | ✅ `README.md:5741`（「G2 ContextFS 只读虚拟文件系统 + Qoder 导入 4 维对位物 (goal-b41)」）<br>✅ `README.en.md:195`（对应英文条目）<br>❌ `AGENTS.md`：对 b41/b42/b43 全部零命中<br>❌ `PROJECT_PLAN.md`：无三轮 goal 直接登记条目（仅命中 unrelated 的 mobile-rn「4 维度」内容）                                                                                                                                                                                           |

### b42 — G7 本地 embedding 回落档（commit `d1a0710f5b`）

| 栏       | 结论    | 命中真实文件 / 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 源码落地 | ✅      | `packages/database/drizzle/20261031120000_codebase_embedding_provider.sql`（`codebase_chunks.embedding_provider varchar(32)`：NULL/remote/local-hash）<br>`apps/ai-service/app/core/llm_gateway.py:4124` `def embed_local_fallback`（1536 维 char-trigram 哈希投影）<br>`apps/ai-service/app/services/codebase_indexer.py`（调用 `embed_local_fallback`，`_generate_embeddings_batch` 远端失败回落 + 标注 `'local-hash'`）<br>api 侧：T5 声明 `ChunkInput.embeddingProvider` / `indexChunks` 返回 `localEmbedded` 计数 / search·hybrid 带出 provider（`apps/api`） |
| 测试绿   | ✅      | `apps/ai-service/tests/test_codebase_embedding_fallback.py`（**6** 个测试函数 = 文档所称「6/6 GREEN」）                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 文档登记 | ⚠️ 部分 | ✅ `README.md:5625`（「G7 本地 embedding 回落档」）<br>✅ `README.en.md:154`（对应英文条目）<br>❌ `AGENTS.md`：零命中<br>❌ `PROJECT_PLAN.md`：无三轮 goal 直接登记条目<br>⚠️ 交付回执仅存于 `.archify/architecture-goal-b42-g7-20261031-1235/goal-b42-g7.delivery.json`，**仓库根目录无** `goal-b42-*.delivery.json`（而 b41/b43 在根目录各有副本）                                                                                                                                                                                                              |

### b43 — wiki 写面（knowledge_writer 知识写面，commit `6ef61c1bfa`）

| 栏       | 结论    | 命中真实文件 / 证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 源码落地 | ✅      | `apps/ai-service/app/services/knowledge_writer.py`（258 行，真实实现，6 态返回：ok / skipped_missing_identity / invalid_input / upstream_unavailable / upstream_rejected / card_missing）<br>`apps/ai-service/app/api/v1/knowledge_write.py`（**4 端点**：POST `/cards`、PATCH `/cards/{id}`、DELETE `/cards/{id}`、POST `/cards/{id}/links`）<br>挂载确认：`apps/ai-service/app/api/v1/router.py:27` `include_router(knowledge_write.router, prefix="/ai/knowledge-write", ...)`（即 `/api/v1/ai/knowledge-write` 四端点，与已知落地一致） |
| 测试绿   | ✅      | `apps/ai-service/tests/test_knowledge_writer.py`（**6** 个测试函数：write 通道形状 / 身份三态零请求 / Bearer 通道 / 404 语义 / 读改写+幂等+unlink 双键 / 非法输入零 HTTP = 文档所称「6/6 GREEN」）<br>mypy：T6 文档称「2 文件 0 错」——**本审计未独立跑 mypy，属文档声明，未验证**                                                                                                                                                                                                                                                           |
| 文档登记 | ⚠️ 部分 | ✅ `README.md:5584`（「knowledge_write agent 知识写面」）<br>✅ `README.en.md:114`（对应英文条目）<br>❌ `AGENTS.md`：零命中<br>❌ `PROJECT_PLAN.md`：无三轮 goal 直接登记条目                                                                                                                                                                                                                                                                                                                                                              |

---

## 二、发现的不一致 / 遗漏（逐条）

1. **【文档】AGENTS.md 对三轮 goal 全部零登记。** README.md 与 README.en.md 三栏齐全，但 agent 操作手册（`AGENTS.md`，95KB）对 `b41` / `b42` / `b43` / `ContextFS` / `knowledge-write` / `本地 embedding` / `goal-b4*` 全部无命中。跨文档登记不一致。

2. **【产物】b42 交付回执未对齐到仓库根目录。** b41（`goal-b41-kfs.delivery.json` + `.html`）与 b43（`goal-b43-wikix.delivery.json` + `.html`）均在仓库根有副本；b42 的 `goal-b42-g7.delivery.json` 仅存在于 `.archify/architecture-goal-b42-g7-20261031-1235/` 内，根目录缺失。属产物登记位置不一致（b42 交付本身存在，非缺失）。

3. **【文档】PROJECT_PLAN.md 无三轮 goal 的显式登记条目。** 三 goal 的进展主要靠 `README.md` changelog + `.archify/architecture-goal-b4x-*` 架构目录承载；PROJECT_PLAN.md 中命中的「4 维度」均为 mobile-rn（RN TabBar）上下文，与 b41「Qoder 导入 4 维」无关，容易造成混淆。

4. **【命名歧义】b41「导入 4 维」与源码实际规模不对应。** README 称「Qoder 导入 4 维对位物」，但 `apps/ai-service/app/services/importers/` 实际有 **8** 个具体导入器（aider / chatgpt / claude_ai / claude_code / codex / cursor / ir / wechat），源码注释与文档均未显式定义「4 维」指哪 4 类维度。属语义未落定的命名歧义，建议澄清。

5. **【测试可信度】b43 mypy「0 错」仅文档声明，未独立验证。** T6 称「mypy 2 文件 0 错」，本审计受限于未跑 mypy（需依赖环境），该结论属二手声明。建议 CI 固化 mypy 门禁使其可复现。

6. **【未结清项】toolhost.dll / harness.dll 反编译「进行中未完成」。** `docs/benchmark-evidence/2026-10/trae-rea-20261031/T5-goal-b42.md` 与 `T6-goal-b43.md` 均登记 toolhost(95MB)/harness(248MB) 反编译产物未出，属取证长跑层「分析级完成、反编译级进行中」。非三轮交付阻断项，但属未结清，需在后续轮次收口。

---

## 三、b44 收尾后续建议清单（按优先级）

### P0 — 阻断级 / 必须对齐

- **A. b42 交付回执对齐根目录**：将 `.archify/architecture-goal-b42-g7-20261031-1235/goal-b42-g7.delivery.json` 与 `.html` 复制到仓库根，与 `goal-b41-kfs.*` / `goal-b43-wikix.*` 命名对齐，消除产物登记位置不一致。
- **B. AGENTS.md 补三轮 goal 登记**：在 `AGENTS.md` 增加 b41/b42/b43 的落地摘要与入口路径（knowledge_fs / embed_local_fallback / knowledge_write），或显式声明「AGENTS.md 不承载 goal registry、以 README changelog 为准」以消除跨文档歧义。

### P1 — 重要 / 应做

- **C. PROJECT_PLAN.md 增三轮显式登记**：为 b41/b42/b43 各加一条带 commit SHA + 源码/测试路径的登记项，避免仅依赖 README changelog + .archify 隐式承载。
- **D. 澄清 b41「4 维导入」语义**：在 `knowledge_fs.py` / `importers/` 头注或文档中定义「4 维」具体所指（当前 importers 为 8 个具体源），消除命名与实现规模的不对应。
- **E. 固化 mypy 门禁**：将 b43「2 文件 0 错」转为 CI 可验证项（在 ai-service 的 mypy 检查中加入 `knowledge_writer.py` + `knowledge_write.py`），避免口头声称。

### P2 — 低优先 / 后续

- **F. 收口 toolhost.dll / harness.dll 反编译**：回填 `T4 §3` 同款流程产物（当前 scratch 目录 `goal-b42-ghidra` / `goal-b43-ghidra` 有 6h 老化风险），属取证层非交付阻断。
- **G. b43 补跨服务契约测试**：现有 `test_knowledge_writer.py` 仅 monkeypatch httpx，建议补 `apps/api routes/knowledge-card.ts` 端到端契约测试，锁死「写入判据单一真相源在 api 侧」这一关键不变量。

---

## 四、结论速览

- **源码落地**：b41 ✅ / b42 ✅ / b43 ✅（均真实存在且非空，核心文件已逐一定位）
- **测试绿**：b41 ✅（12+35+40 函数）/ b42 ✅（6 函数，6/6 GREEN 吻合）/ b43 ✅（6 函数，6/6 GREEN 吻合）
- **文档登记**：README 中英双版三栏齐全 ✅；AGENTS.md 三栏零登记 ❌；PROJECT_PLAN.md 无显式登记 ❌
- **关键遗漏/不一致条数**：**6 条**（见第二节 1–6；其中 2 条为 P0 阻断级：b42 根回执缺失、AGENTS.md 零登记）
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
