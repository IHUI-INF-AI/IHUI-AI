<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# K —「代码检索召回质量」只读尺子 · 现场心跳

## 已开工@2026-11-01/K席

- **开工现读 HEAD**：`19b19eb03014a209f1075ec43db80847fdd797be`（main）
- 任务：新建只读尺 `scripts/check-retrieval-quality.mjs` + 镜像测试；**不进提交链**，不碰 runner/.husky/package.json/CI。

## 主席两条事实的复核结果（逐字节现读，非引用）

1. **`apps/ai-service/app/services/rag.py:504` 已真调融合 ⇒ 复核：成立（行号一致）**
   - 现读原文：`        fused = reranker.rrf_fuse(rankings, k=rrf_k, labels=labels)`
   - 上游同函数 `_retrieve`（`:444`）双路**并行**起：`vec_task = asyncio.create_task(self._vector_retrieve(...))` + `kw_task = asyncio.create_task(self._keyword_fallback(...))` ⇒ 形态 = **双腿并跑 + 融合**，不是串行。
   - **但主席未点的一格（现读补）**：`rrf_fuse` 的入参只有 `rankings/k/labels/key_fn`（`reranker.py:113` 签名），**没有任何腿权重参数**；`contrib = 1.0 / (k + rank)`（`reranker.py:143`）⇒ 本仓融合是**无权 RRF**，与对方 `textWeight:2 / vectorWeight:1` 不是同一档。全仓 `grep textWeight|vectorWeight|text_weight|vector_weight`（apps/ai-service、packages、scripts）**命中 0**（现读）。
   - 降级这侧 rag 是**出声的**：`stats["mode"] = "single-source:keyword"`（`rag.py:493`）+ 函数 docstring 明写"这条降级**必须**在 stats 里留原因"。

2. **`apps/ai-service/app/services/mcp_server.py:1341 _tool_search_codebase` 串行回落 + 静默降级 ⇒ 复核：成立（行号一致），注释实际位置有出入**
   - `async def _tool_search_codebase(...)` 确在 `:1341`。
   - 逐字注释「`# 失败或无结果时静默 fallback 到下方 regex 路径`」**在该函数体内 `:1406`**（主席把函数入口行号一并当注释行号引用了——**差异已点名，不影响结论**）。
   - 回落出口现读：语义腿有结果即 `return`；`except Exception as e:` 分支**只写 debug 日志**（`"semantic search failed, fallback to regex: %s"`）后直落 regex 腿；regex 腿返回体顶层键（现读）= `tool/query/path/pattern/symbol_type/matches/total/truncated/semantic_index/message/ok` ⇒ **无 `degraded`/`fallback_reason`/`requested_strategy`/`executed_strategy` 任一枚显式降级键**。
   - **弱 carrier 一格（尺子要单独判）**：`semantic_index_field` 初始化 `None`（`:1362` 附近），只有走到 `_lazy_index_and_research` 才被赋值；**`except` 分支不写它** ⇒ 异常型降级下该键恒为 `null` ⇒ 有键无声。判据落点：尺子把这一档单独记 `carrier-only`，不并入 `signaled`。

## 尺子设计取向（写死在头注）

- 判据单源走 **①派生一次 `python -c` 调真函数 `rrf_fuse`**（`apps/ai-service/.venv/Scripts/python.exe`，离线可跑，已实测：`[('b',0.032522,['text','vector']),('a',0.016393,['text']),('c',0.016129,['vector'])]`）；**不在 .mjs 里抄公式**（§0.6 / 门 191）。Python 取不到 ⇒ 只报不需公式的集合维，公式维记 `unjudged` 点名缺什么（§0.3）。
- 真库（PG 8810 / Redis 8811）**一律不碰**；默认离线夹具档（§5 测试隔离铁律）。
- 只读：取材面默认 `git show HEAD:<file>`（§0.4），`--worktree` 仅人工逃生舱；不写盘、不自愈、不改参数。

---

## 交付读数（2026-11-01 收口，全部现读）

- **尺子**：`scripts/check-retrieval-quality.mjs`（只读，默认 `--print`，取材面 HEAD）
  + 镜像测试 `scripts/tests/check-retrieval-quality.test.mjs`（判据全 import，§22c）
- **判据单源取①**：每轮派生 `apps/ai-service/.venv/Scripts/python.exe -c` 调真 `rrf_fuse`
  （连同它自己的 `_default_key`）；加权 2:1 档由「同一条腿按权重次数重复计入」表达，
  **.mjs 里零公式**（`selfCheckNoFormula()` 走 `scripts/lib/code-mask.mjs` 遮罩后自扫，
  镜像测试钉住；这是门 191 反模式的自证）。取不到 python ⇒ 名次维 `unjudged` 点名缺什么。

### 四问的现场读数（HEAD 面）

| 问 | 读数 |
| --- | --- |
| J1 形态 | `rag._retrieve` = **dual-leg-fused**（两腿 + `rrf_fuse` + 并发 create_task=2，体 443..521）；`mcp.search_codebase` = **serial-fallback**（两腿都在、体内 0 枚融合调用、腿次序 vector→text，体 1339..1625） |
| J2 降级信号 | `rag._retrieve` = **signaled**（`stats["mode"] = "single-source:keyword"` 遥测出声）；`mcp.search_codebase` = **silent-degrade**（`carrier-only:semantic_index(异常分支不赋值 ⇒ 恒 null)` + `log-only:debug`）；`[WARNING] silent_degrade exits=1 names=mcp.search_codebase` |
| J3 融合差异 | 内置夹具（两腿各 5，并集 8，双腿都命中 2）：无权 RRF(k=60) 名次 `rag > reranker > codebase_indexer > mcp_server > context_recall > similarity > routers/rag > context_engine`；对方 2:1 加权投影名次 `rag > reranker > context_recall > routers/rag > context_engine > codebase_indexer > mcp_server > similarity`；首个分歧位第 3（`codebase_indexer` 3→6、`context_recall` 5→3）⇒ 加权把「只在向量腿头名」的片挤后 3 位 |
| J4 对照口径 | rrfK 本仓 60（rag.DEFAULT_RRF_K 与 reranker 默认两处同值，env `RAG_RRF_K` 未设置）vs 对方 60 ⇒ **same**；textWeight 本仓**无腿权重参数**（`rrf_fuse(rankings,k,labels,key_fn)`，全仓权重符号 0 命中 ⇒ 等价 1）vs 对方 2 ⇒ **different**；vectorWeight 1 vs 1 ⇒ same。默认口径自陈 `evidence-doc(二手读数)`；`--counterpart-live auto` 回源实测活 bundle（4,794,632 B）读数 60/2/1 一致 |

### 变异证明（真把判据改坏）

`.ihui-agent/tmp/rea-goal-b45/mutation/mutant-run.log`：把 `judgeDegradeSignal` 末行
`verdict:'silent-degrade'` 反转成 `'signaled'` ⇒

- `--self-test` 26/28 红（`✗ J2 mcp ⇒ silent-degrade…`、`✗ 现场 J2 mcp ⇒ silent-degrade 或未判定 — signaled`），exit 1
- `node --test` **fail 3 / pass 32**：`正例:回落体无键 + carrier 恒 null + 只写 debug ⇒ silent-degrade`、
  `变异 M4(反转生产判据必被抓住)`、`现场 mcp 的 verdict 与证据自洽`
- 事后按字节还原（sha256 与还原前一致，`grep -c MUTANT` = 0）

### 验证末行现读

```
self-test 28/28 通过(现读;夹具全在 scratch 根,未碰真库)                      # exit 0
ℹ tests 35  ℹ pass 35  ℹ fail 0  ℹ skipped 0  ℹ duration_ms 8409.7874        # 镜像测试
node scripts/check-retrieval-quality.mjs --print                              # exit 1(判出缺陷档)
[check:watermark-syntax] 取材=版本树 HEAD 清单=18510 … 全部通过                # 门 95
[watermark:verify] 覆盖 2/2 … 残迹 0 / 载荷损坏 0 / 仅隐写 0
pnpm exec prettier --check(两枚新文件) All matched files use Prettier code style!
```

### 没做的格子与原因

- **未新增 `apps/ai-service/tests/test_retrieval_quality_surface.py`**：①方案已由 node 侧派生真函数闭环，
  再加一枚 Python 测试文件等于给同一判据开第二个出口（§0.6 单一真相源），无新增信息。
- **未接任何调度/提交链**（按派单书：不碰 `guardian-runner.mjs`/`.husky/**`/根 `package.json`/`.github/workflows`；
  镜像测试里有一枚"本尺文件名不得出现在那四处"的反向锁）。
- **未做真库档**（PG 8810/Redis 8811 一概不碰；J3 只走夹具档，`--fixture` 可换）。
- **未量 rerank / `sources[]` / 行区间合并**：那是 J3/J1 之后的格子，派单书只要求四问；对方 `maxRerankTokens`
  等默认常量数值仍属 T9 §9 未判定项。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
