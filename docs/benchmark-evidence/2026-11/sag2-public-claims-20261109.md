<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# SAG2 让知识库问答能"顺着线索多翻一份"：可对外发布版

> 生成：2026-11-09 · 任务 L · 本文件全部数字来自本轮现场真跑（脚本 `.ihui-agent/tmp/sag2-final-v2/demo_bridge.py`），
> 原始输出留痕 `.ihui-agent/tmp/sag2-final-v2/demo_stdout.txt`。
> 头部 provenance 注释块逐字字节复制自同目录 `sag2-before-after-20261108.md`（含零宽字符，见文末「复现方式」校验）。
> 本文首段「桥接案例」为本席真跑数字；融合增益（I 席）、pgvector/tsvector 同库 A/B（J 席）、
> 判定质量（K 席）三项**本轮已实测完成**，真实数字与命令见下文「已实测可宣布」与「代价与边界」段，
> 不在任何旧报告的「未判定」项下。

## 一句话结论（≤40 字）

以前只按问题里的词找一次，现在会顺着第一份里的线索再翻一份，答案不再断在半句。

## 以前做不到、现在做得到

### 场景

知识库里两份业务文档，答案要合起来才完整：

- 文档 A（`corpus/board-resolution-2025.txt`）：`2025 年董事会决议：年度研发额度 800 万，责任人王工。`
- 文档 B（`corpus/q3-spend-report.txt`，**答案文档**）：`王工牵头的向量检索项目第三季花掉 940 万，超上限 140 万。`
- 有人问：`董事会定的那个额度，后来是谁用超了？`

正确答案是「王工用超了，超 140 万」。难处在于：**第二份里一个问题的字都没有**——
本轮分词实测 `overlap_query_vs_docB = []`，它不含「董事会 / 额度 / 用超」等任何查询词元
（`text.py:163` 的 `match_query` 把中文单字过滤掉，只留相邻双字与数字/英文词）。
只按原问题词搜一次，第二份连候选池都进不去（`index.py:292` `candidate_query`）。

### 以前返回什么

向量路 + 关键词路都拿**原查询词**一次性召回，再 RRF 融合（引入前的 `rag.py`）。本轮等价复现：

- `top10_paths` = `["corpus/board-resolution-2025.txt"]`
- 放宽到 100 个候选 `wide100_paths` 仍只有同一份
- 答案文档 `corpus/q3-spend-report.txt` 一次都没出现，`recall_of_answer_doc = 0`

结果：只能读到「额度 800 万、责任人王工」，答不出「谁用超了 / 超了多少」，容易答半句或答错。

精简真实输出（本轮 `BASELINE_JSON`）：

```json
{
  "mode": "single-hop BM25（引入前 rag.py 关键词路的等价一次性召回）",
  "query_terms": ["董事", "事会", "会定", "定的", "的那", "那个", "个额", "额度", "后来", "来是", "是谁", "谁用", "用超", "超了"],
  "top10_paths": ["corpus/board-resolution-2025.txt"],
  "wide100_paths": ["corpus/board-resolution-2025.txt"],
  "answer_doc_in_wide100": false,
  "recall_of_answer_doc": 0
}
```

### 现在返回什么

SAG2 先命中 A，从 A 里抽出**桥接词**「王工」，第二跳用这些词把 B 翻出来，两份一起进引用，
B 还排在第一位（`score=0.673094`）：

- `hops_executed = 2`
- `expansion_terms_used` = `["人王", "万", "工", "王", "王工"]`（真跑的扩展词，核心是人名「王工」）
- `citation_paths` = `["corpus/q3-spend-report.txt", "corpus/board-resolution-2025.txt"]`
- `recall_of_answer_doc = 1`

引用里的两段原文（真跑 `citations.passage`）：

```
王工牵头的向量检索项目第三季花掉 940 万，超上限 140 万
2025 年董事会决议：年度研发额度 800 万，责任人王工
```

精简真实输出（本轮 `SAG2_JSON`）：

```json
{
  "mode": "SAG2 多跳 retrieve（引入后）",
  "status": "ok",
  "hops_executed": 2,
  "expansion_terms_used": ["人王", "万", "工", "王", "王工"],
  "citation_paths": ["corpus/q3-spend-report.txt", "corpus/board-resolution-2025.txt"],
  "answer_doc_in_citations": true,
  "recall_of_answer_doc": 1,
  "judge_mode": "lexical-only",
  "judge_executed": false
}
```

### 以前 / 现在 左右对照

| | 以前（单跳一次性召回） | 现在（SAG2 多跳） |
| --- | --- | --- |
| 召回到的文档 | 只有 A | B（答案，排第 1）+ A |
| 答案文档召回数 | 0 | 1 |
| 跳数 | 1 | 2 |
| 桥接词 | 无 | 王工 / 人王 / 万 / 工 / 王 |
| 判定器 | — | `lexical-only`、`executed=false`（诚实降级） |

召回过程留痕（真跑 `trace` / `paths`）：`hop0` 命中 1 个候选（A）；`hop1` 用 5 个扩展词召回 B，
候选池 2 个；`hop2` 被显式 `skipped`，原因「扩展词排除已见候选后无新命中，预算未浪费」；
终排 `diversity` 走 `dpp-greedy-orthogonalization`、`reordered=0`；`hydration` 2 进 2 出。

## 可原样对外发布的 5 句话

> 以下 5 句共用同一条复现命令（见文末「复现方式」），每句后面的数字或代码位置均可由该命令重跑核对；
> 数字全部来自本轮桥接案例真跑，未引用旧报告中标注「未判定」的项。

1. **「答案分散在两份文件时，原来只按问题里的词找一次会漏掉第二份；现在会顺着第一份里的线索再找一次，把第二份也带回来。」**
   证据：本轮真跑单跳 `recall_of_answer_doc=0` → 多跳 `recall_of_answer_doc=1`、`hops_executed=2`；复现命令见文末。

2. **「本轮实测里，答案所在那份文档一个问题的词都不含（分词 `overlap_query_vs_docB=[]`），一次性召回 top10 与放宽到 100 个候选都只找到第一份。」**
   证据：`BASELINE_JSON`；代码 `apps/ai-service/app/services/sag2_lexical/text.py:163`（`match_query`）、
   `index.py:292`（`candidate_query`）；复现命令见文末。

3. **「系统第二跳从第一份里抽出桥接词『王工』（本轮真跑扩展词 `["人王","万","工","王","王工"]`），把第二份召回并排在引用第一位（`score=0.673094`）。」**
   证据：`SAG2_JSON` 与 `trace.hop1`；代码 `retrieval.py:162`（`expansion_terms`）、
   `retrieval.py:230`（`resolve_terms`）；复现命令见文末。

4. **「这条新通道建库不调模型、不需要 GPU、没有 key 也能用：本轮 2 份文档建出的索引是纯内存倒排（`backend=in-memory-inverted-index`、`terms=79`），离线/私有部署同样能建能查。」**
   证据：本轮 `idx.status()` 输出 `{"version":2,"documents":2,"chunks":2,"terms":79,"backend":"in-memory-inverted-index"}`；
   代码 `index.py:15-16`（建库不调模型）、`index.py:111`（`add_document`）；复现命令见文末。

5. **「整套对照由脚本自动断言，9 条检查全部 PASS（单跳漏答案、宽 100 仍漏、多跳找回、2 跳、桥接词存在、判定器诚实降级、B 不含查询词元等），脚本退出码 0。」**
   证据：`demo_stdout.txt` 断言段 `ALL_ASSERTIONS_PASSED = True`、`PY_EXIT=0`；复现命令见文末。

## 不能对外说的 4 句话

1. **「SAG2 全面超过向量检索 / 可以替代 embedding」** —— 不能说。它是**补一路词法召回**并与既有
   `rag.py` 做 RRF 三通道融合，不是替换语义向量；本轮只测了 2 文档词法桥接，没有与线上向量库同库 A/B。
2. **「答案召回率 100% / 所有多跳问题都能答对」** —— 不能说。本轮是 1 个案例、2 个文档，
   `recall=1` 指这一个案例的答案文档被召回，不是通用准确率；判定器 `executed=false`，没有语义证据判定。
3. **「三通道融合带来召回增益 / 融合全面超过单通道」** —— 不能说。本轮实测融合相对上一轮等权融合
   MRR +0.1250、nDCG@10 +0.1001（两种子一致），且**与 SAG2 单通道 recall 持平（1.0）**，已证明的是
   「融合未稀释多跳、且在单跳型靠 RAG 腿拿到更好排名」，不是召回提升。
   （融合增益、判定质量现已实测可宣布；唯「真实商业 LLM 打分质量」「与线上 embedding 语义等价」仍禁说，见下。）
4. **「已在 51 万文档 / 真实商业 LLM 打分 / 线上 A/B 验证过」** —— 不能说。本轮是同一套 2 文档索引上的
   **算法消融对照**（单跳基线 vs 完整 SAG2 链路），不是两个代码版本的线上 A/B，未接真实 LLM、未跑大规模语料。

## 复现方式（本席先跑通的命令）

```bash
# 1) 跑桥接案例（原始命令；本轮 exit code 0）
cd /g/IHUI-AI/apps/ai-service
./.venv/Scripts/python.exe ../../.ihui-agent/tmp/sag2-final-v2/demo_bridge.py
# 本轮实测：PY_EXIT=0，ALL_ASSERTIONS_PASSED=True

# 2) 校验本文件头部 provenance 注释块与源文件逐字字节一致（含零宽字符）
#    命令与输出见 .ihui-agent/tmp/sag2-final-v2/L-demo-report.md「水印字节级复制校验」
```

所有原始输出留痕：`.ihui-agent/tmp/sag2-final-v2/demo_stdout.txt`。

## 代价与边界（不能只夸）

- **多一次查询开销**：多跳最多两轮扩展（本轮 `hops_executed=2`），比单跳多查；单次
  `duration_ms≈1.25`（本轮示意值，未做多次采样基准，不作为性能结论）。`hop2` 已被显式
  `skipped` 并留痕「预算未浪费」，不是无脑多查。
- **词法通道不替代语义向量**：本轮桥接词「王工」在词法层被拆成 `王 / 工 / 人王 / 王工` 等字面碎片，
  靠字面重合把两份关联起来，并不"理解"人名含义；语义相关但用词完全不同的段落仍可能漏。
- **判定器默认诚实降级**：本轮用 `LexicalOnlyJudge`，`judge_mode=lexical-only`、`judge_executed=false`，
  `judge_reason` 明写「不得声称已完成语义证据判定」（`judge.py:72-77`）；接了模型才有模型分。
- **规模与口径**：本轮语料 2 文档 / 2 段落（`version=2`、`chunks=2`），是**机制演示**，不是规模或质量评测；
  结论只对「答案分散、第二段不含问题词」这一类场景成立。
- **已实测可宣布（本轮真跑，非推断）**：
  - 三通道自适应门控融合：相对上一轮等权 RRF，MRR +0.1250、nDCG@10 +0.1001，严格 ≥ 任一单通道，两种子一致
    （证据 `I-fusion-gain.md`、`tests/test_sag2_fusion_gain.py` 9 passed）。
  - 真实 Postgres 同库 A/B：本机 PostgreSQL 18.6 + `vector` 0.8.6 + 真实 HNSW 索引，同库同语料真建表真查；
    **多跳**场景（答案文档不含任何查询词元）非语义 ANN 召回 **0.0**、SAG2 词法多跳 **1.0**（补上 ANN 召不回的洞）；
    融合总体 0.9375、ANN 基线 0.5（两腿高度分歧时固定 top-10 无法同时容纳两腿全部独有项，属可证伪真实边界，
    **不宣称「融合全面 ≥ 各通道」**）。（证据 `J-pgvector-ab-scale.md` / `tests/test_sag2_pgvector_ab.py` 2 passed）
  - 判定质量：接入**真实本地 ONNX 句向量模型**（49 次真实推理）后 MRR 0.2083 → 0.715~0.799、nDCG 0.5117 → 0.82~0.86，
    诱饵文档进 top5 从 3.875 降到 ~2.0，两种子一致（证据 `K-judge-quality.md`、`tests/test_sag2_judge_quality.py` 7 passed）。
  - 规模延迟（实测 1k/5k/20k）：内存倒排**建库 2.4s→52s→850s（超线性，20k 达 14 分钟）**、多跳检索 p50 10.6→22.9→95.8ms；
    Postgres `tsvector`+GIN 查询 p50 0.115→1.41→0.92ms（近线性、亚毫秒级，大库首选）。**大库须预建库 + SHA-256 增量更新，不能实时全量建库**
    （证据 `J-pgvector-ab-scale.md`）。
- **仍禁说（边界，非缺陷）**：真实商业 LLM 打分质量、与线上 embedding 模型语义等价、51 万文档规模外推（仅基于实测点外推）、线上 A/B 指标。
  本文只用自己真跑的桥接案例数字 + 上述本轮实测数字，不替任何旧报告写「未判定」项。
