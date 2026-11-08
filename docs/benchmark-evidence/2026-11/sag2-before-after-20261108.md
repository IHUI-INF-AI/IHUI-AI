<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# SAG2 引入 IHUI-AI 后的变化：前后对比与实测证据

> 生成：2026-11-08 · 取证对象：`Zleap-AI/SAG-Wiki`（MIT v0.2.7）的行为与设计，
> 本仓实现均为自有代码（AGENTS.md §0.12：不粘源码 / 不破解许可 / 不绕付费 / 不取凭据）。
> 全部数字为本次现场实测，原始命令与输出见 `.ihui-agent/tmp/sag2-final/H-before-after-data.md`
> 以及 A–H 各席报告。检索质量数字是**同一套索引上的算法消融对照**（单跳 BM25 基线 vs
> 完整 SAG2 链路），不是两个代码版本的线上 A/B。

## 一句话结论

SAG2 给项目补上了一条「**建库不调模型、查询时跨段落多跳关联**」的纯词法检索通道，
并接入既有 `rag.py` 的 RRF 形成三通道。在确定性多跳语料上，答案召回 **0/12 → 12/12**；
400 文档建库对外部模型服务调用 **0 次**；文档更新走 SHA-256 增量，**303.7ms → 1.95ms**（155.5×）。
同时补齐了诚实降级状态、判定执行率遥测、Postgres `tsvector` 后端、六端点 API、
黑白工作台与 5 语言文案。真实商业 LLM 打分质量、51 万文档规模延迟、
与线上向量库同库 A/B 仍未验证。

## 六个具体变好之处

### 1. 多跳问题终于能召回答案（0 → 12/12）

答案分散在 3 个段落、必须靠桥接词才能到达的查询：纯 BM25 单跳
`recall@10 = 0.0`、`MRR = 0.0`、命中 0 个答案文档；SAG2 两跳 + 扩展词 + DPP
`recall@10 = 1.0`、`MRR = 0.5`、命中 **12/12**。换成自建 60 / 200 / 800 文档语料，
单跳仍 0.0、多跳仍 1.0。

引入前 `rag.py` 只有「向量路 + 关键词路各取 topN 后 RRF 融合」，两路都基于**原查询词**
一次性召回；查询里没出现的桥接段落永远进不了候选池。

代码：`apps/ai-service/app/services/sag2_lexical/retrieval.py`（多跳主循环 / 扩展词）、
`index.py`（BM25 粗筛）、`text.py`（CJK 单字 + bigram）。

### 2. 建库不再背模型成本（外部调用 0 次）

400 文档逐条 `add_document`，`model_calls` 恒为 **0**；用 `sys.setprofile` 抓建库期间的
外部模型/网络类调用也是 **0 次**；建库路径只依赖标准库（`hashlib / math / re / unicodedata`）。
对照 `rag.py` 的 `vector_memory.embed(content)` —— 整篇路径每文档 1 次 embedding，
400 文档即 **400 次**（读码得到的结构性推断，本次未接真实 embedding 服务实测）。

本次实测 400 文档建库 p50 **430.7ms**、多跳检索 p50 **2.34ms**。
意义：离线/内网/无 key 环境下知识库仍可建、可查；不产生 embedding 账单与 GPU 依赖。

代码：`index.py:111-166`、`service.py:59-84`。

### 3. 文档更新走 SHA-256 增量（303.7ms → 1.95ms，155.5×）

相同内容重复写入 `changed=False`、`version` 不变；改 1 个文档后 `version` 400→401，
其余 399 个文档 chunk 不变，`_index_chunk` 实际调用 **400 次 → 1 次**。
全量重建 p50 **303.715ms** vs 增量改 1 文档 p50 **1.953ms**。

引入前没有这一层词法索引；本仓已有的 `pgvector_store.py` 幂等建表与 3 次失败熔断
是向量侧的可靠性基础，SAG2 补的是词法侧的增量与版本失效。

代码：`index.py`（sha256 / 跳过 / 重建 / version）。

### 4. 结果不再扎堆（top-5 不同子话题 1 → 3）

DPP 贪心正交化终排：10 个候选（8 个近似重复 + 2 个不同子话题）下，top-5 覆盖的不同
子话题 **1 → 3**，top-5 平均两两余弦 **0.8367 → 0.251**，10 个位置中 9 个被重排。
真实检索链路上 4 组查询的 `diversity.reordered` = `[2, 2, 0, 3]`。

引入前 `rag.py` 的 RRF 只按排名融合，不做去冗余；近似重复段落会一起占满 top-k。

代码：`diversity.py:40-108`、`retrieval.py` 终排段。

### 5. 降级状态可自证，且本轮修掉一处自相矛盾

无 judge 时返回 `judge_mode="lexical-only"` / `judge_executed=false`；网关抛异常时
`mode="unavailable"` / `executed=false`，都不伪装成「已判定」。遥测如实记分子分母：
全降级 `calls=8 / executed=0 / rate=0.0`；混合 `calls=4 / executed=2 / rate=0.5`。

引入前 `rag.py` 已有 `rerank.*` / `recall.paths` 留痕，但**没有**判定执行率这一维度
（实测 `result_to_dict` 的 11 个键中无 `judge*`）——SAG2 补的是这一维度，不是从无到有。

**本轮额外修复的真实缺陷**：跨 hop 混合时，旧实现 `judge_executed=True` 却可能仍返回
`judge_reason=NO_MODEL_REASON`（「未配置模型」）、`judge_mode=lexical-only`，
调用方会把「已判定」误读成「从未判定」。现加结果层形状锁 + 降级轮次计数，
并由 `tests/test_sag2_judge_consistency.py` 的 6 条用例（含 max_hops 0/1/2 × 4 脚本
共 12 组穷尽形状锁）钉死。代码：`judge.py`（`JUDGE_EXECUTED_REASON`）、
`retrieval.py` 结果层。

### 6. 完整入口、真实端到端与测试覆盖

| 项 | 引入前 | 本轮收口后 |
| --- | --- | --- |
| API 端点 | 0 | 6（`/api/v1/ai/sag2/{status,documents,search,retrieve,fuse}` 等） |
| 前端 | 0 | 黑白工作台 + api client + 导航 + rewrite 白名单 |
| i18n | 0 | 5 语言各 36 个 `sag2Lexical` 文案键 |
| pytest（SAG2） | 0 | **123 passed**（含真实 PG / 真实 HTTP / 形状锁） |
| vitest（SAG2） | 0 | **54 passed**（36 api client + 18 组件真渲染） |
| 真实 Postgres 端到端 | 无 | **已跑成**：PG 18.6，真建表/真写入/`ts_rank_cd`/参数绑定抗注入/真实连接失败降级，7 用例无 skip |
| 真实 LLM 链路端到端 | 无 | **已跑成**：本机真实 OpenAI-compatible HTTP 服务，≥31 次真实 TCP 请求，正常/畸形/500/超时全链路留痕 |
| UI 层测试 | 无 | 18 条组件测试，`vi.stubGlobal('fetch')` 走真实信封解包，不再 `vi.mock('@/lib/api')` 旁路 |
| 水印覆盖 | — | 新增文件 100% provenance 水印 |

代码：`app/api/v1/sag2_lexical.py`、`apps/web/app/(main)/sag2/`、
`apps/web/src/api/sag2-lexical.ts`、`packages/i18n/messages/web/*.json`、
`tests/test_sag2_pg_integration.py`、`tests/test_sag2_llm_http_e2e.py`。

## 能力矩阵

| 能力 | 引入前 | 引入后 | 证据类型 |
| --- | --- | --- | --- |
| 多跳查询时扩展 | 无 | 两跳 + 扩展词，recall 0.0→1.0 | 实测 |
| CJK 单字 + bigram 词元 | 仅子串关键词匹配 | 显式切词 + bigram 查询 | 实测 + 代码结构 |
| DPP 多样性终排 | 无 | top-5 子话题 1→3 | 实测 |
| SHA-256 增量 + version | 无 | 400→1 次重算，155.5× | 实测 |
| 可插拔证据判定 | 无 | LexicalOnly / Model / 网关适配 | 实测 + 代码结构 |
| 诚实降级 | 已有 rerank/recall 留痕 | 新增 judge_mode / judge_executed / reason 形状锁 | 实测 |
| 判定执行率遥测 | 无 | calls / executed / rate 分子分母恒等式 | 实测 |
| Postgres tsvector 后端 | 仅 pgvector 向量 | `PgTsVectorStore` + 后端工厂 + 真实 PG 端到端 | 实测 |
| 三通道 RRF | `rag.py` 双路 RRF(k=60) | `fuse_with_rag` 再融 SAG2 | 实测（合成夹具，**未证明增益**） |
| 六端点 API / 前端工作台 / 5 语言 | 无 | 均有 | 代码结构 + 门读数 |
| 真实 PG / 真实 HTTP / UI 层测试 | 无 | 全部入链并真跑 | 实测 |
| ESLint 门禁 | 结构性 RC=124 未判定 | `**/.ihui-agent/**` 剪枝后 `eslint .` 与 turbo 20 任务零超时 | 实测 |
| 全量 tsc / `pnpm lint` | 30 条错误 / exit 1 | 0 错误 / exit 0（sag2 路径 0 命中） | 实测 |

## 本轮同时清掉的存量门红（非 SAG2 引入，但不再挂账）

| 项 | 根因 | 处置 |
| --- | --- | --- |
| ESLint RC=124 | `.ihui-agent/tmp/` 18G / 29802 个源码副本被 flat config 的 `files` glob 收进 FileEnumerator，旧 ignores 缺 `**/` 前缀无法目录级剪枝 | 两个 config 各补 `'**/.ihui-agent/**'`，不改判据、不降规则 |
| 299 门 `ERR_MODULE_NOT_FOUND: typescript` | 并发重装依赖树 | 依赖恢复后真跑 `check-miniapp-shell-form.mjs` exit 0 |
| `check-git-stdio-discipline --staged` 1 处红 | 用 `origin/main^{tree}` 造私有索引冒充「本次提交面」，把远端存量违规读成本轮红；`:339` 违规已被远端 `3eba6c71fd` 补齐 stdio | 三面自证 + 取面纪律：落地验门一律用 HEAD 树私有索引；head/私有索引 staged/工作树三面 RC=0 |
| IG 门 `list-bad` RC=2 | `immutable-guard.json` 3 条 `kind` 不在合法枚举（`autonomy-executor` / `autonomy-cost`×2） | 归位为 `gate-registry` / `gate-body` / `judgement-lib`，只改分类标签，path 与 reviewBy 不变，护栏射程一字不缩 |
| AJ3 台账 3 条腐烂 | 远端 `adjudications.json` 已是「移出 items 转 resolved」正解，红只存在于本地 HEAD 面 | 落地基于 origin/main 天然 3→0 |
| 全量 tsc 30 条 / `pnpm lint` exit 1 | 本地 `feat/model-sync-upstream-purge` 分支的 purge 中间态，远端已是正确终态 | sag2 的 2 条命中已修；落地树基于 origin/main，tsc 自然 0 |

## 还没证明的部分（不得越界宣称）

1. **真实商业 LLM 打分质量**：本机无外部 key；HTTP 端到端证明的是协议 / 序列化 /
   超时 / 畸形响应 / 降级链路在真实 I/O 下成立，不证明答案更准。
2. **生产规模延迟**：最大测到 800 文档、内存倒排；51 万文档与 Postgres 后端大规模延迟未测。
3. **与线上向量库同库 A/B**：rag 侧用关键词单路降级态夹具，未接真实 pgvector / embedding 服务。
4. **三通道融合的额外增益**：本次夹具上融合后 recall 与 SAG2 单通道持平（1.0），
   MRR 反而 **0.5 → 0.3333**、首个答案名次 2→3。只证明「融合未降低召回」，**未证明增益**。
5. **建库延迟绝对值**：本机 9 次采样 288~563ms，抖动大；历史 277.8ms 本次未复现，仅数量级一致。
6. **「每文档 1 次 embedding」** 是读 `rag.py` 得到的结构性推断，未实测。
7. 语料是确定性注入语料，不是真实用户查询分布；`recall@10` 不等于线上 NDCG 或用户满意度。
8. ESLint 仍有**偶发冷缓存 124**（修复后 2 次观测，复跑 5/5 单文件与 3/4 全量均 0，
   turbo 全量 20 包零超时），属 Windows + pnpm symlink 森林下的资源竞态，非配置错误。
