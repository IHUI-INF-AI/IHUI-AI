# 金标检索召回基线 2026-10-31

- 生成时刻:2026-10-31T19:50:53.005034+00:00 · HEAD:`9c3c4ce549e6bf0d22dca9a2f44dec6ce60c41bf`
- 金标:bench\fixtures_golden\golden_retrieval_kb.jsonl —— 264 条(本轮用 264 条),`expected_chunk_ids` 去重后 28 个;仓内 chunk manifest:不存在
- 语料(仓内实文件;父块 52 / 叶子块 250 / 叶子均 264.56 词):
  - `faq` → `docs/FAQ.md`(102 叶)
  - `architecture` → `docs/architecture.md`(70 叶)
  - `enterprise-deploy` → `docs/enterprise-service/deployment-guide.md`(52 叶)
  - `blog-rag-pgvector` → `docs/blog/04-rag-knowledge-base-pgvector.md`(26 叶)
- 参数:k=[1, 3, 5, 10] · top_k=10 · BM25 k1=1.5 b=0.75

## 复跑(一条命令;默认档零连库、零模型、零网络)

```bash
cd apps/ai-service && python bench/run_retrieval_golden.py --mode text_only --json
# 全档(需带项目依赖的解释器,如 apps/ai-service/.venv):… --mode all
# 自检:… --mode text_only --self-test
```

## 档 `text_only` — ok

### 逐段打点

- `corpus_load` → **ok**
- `chunk_build` → **ok**
- `index_build` → **ok**
- `retrieve` → **ok** —— 264 题,零结果题 0 条,耗时 881.0 ms
- `id_namespace_reconcile` → **unjudged** —— 金标 28 个 id vs runner 52 个 id,交集 0;形态样本 金标 `['055c98f653a0c45c', '05e8956ebcee3e0b']` / runner `['architecture#p00', 'architecture#p01']`
- `judge` → **ok**

### 轨 `id_native`:判定 0 条 / 未判定 264 条

- 未判定原因逐类计数:`{"id_namespace_mismatch": 264}`
  - `id_namespace_mismatch` 样本(最多 5 题,顺 id 可追):`q-212fa6c7f358`, `q-3099570fba3b`, `q-765bee49c03f`, `q-e62dc8301868`, `q-f67dfb4b4448`
- 无可读聚合:该轨本轮**全部未判定**(不得读成 0)。

### 轨 `evidence_span`:判定 169 条 / 未判定 95 条

- 未判定原因逐类计数:`{"evidence_span_not_located": 84, "answer_empty": 11}`
  - `answer_empty` 样本(最多 5 题,顺 id 可追):`q-57b0aabe7661`, `q-7955de1362b0`, `q-bedc473febf0`, `q-da7221d37ee7`, `q-dc17b723ccc2`
  - `evidence_span_not_located` 样本(最多 5 题,顺 id 可追):`q-056c7563abe7`, `q-212fa6c7f358`, `q-7c57956bd88b`, `q-e62dc8301868`, `q-f425f06e650f`
- 内容锚点匹配形态:`{"full_answer": 168, "first_sentence": 1}`

| k   | recall_at_k | precision_at_k | mrr    | ndcg_at_k | hit_rate_at_k | context_precision |
| --- | ----------- | -------------- | ------ | --------- | ------------- | ----------------- |
| @1  | 0.7491      | 0.8994         | 0.9355 | 0.8994    | 0.8994        | 0.8991            |
| @3  | 0.8258      | 0.3728         | 0.9355 | 0.8778    | 0.9645        | 0.8991            |
| @5  | 0.8699      | 0.2651         | 0.9355 | 0.8893    | 0.9822        | 0.8991            |
| @10 | 0.8987      | 0.1550         | 0.9355 | 0.8825    | 0.9941        | 0.8991            |

- 参照系(`oracle_whole_doc` = 把该题源文档的全部父块按原文顺序当检索结果):Recall@5 = 0.4339,MRR = 0.2308 ⇒ 本腿优于「整篇文档」,读数可解释。

## 两轨口径差异(必读)

- `id_native`:相关集 = 金标自带 `expected_chunk_ids`。本轮与 runner 产出的 id 命名空间**实测交集为空** ⇒ 逐条 `unjudged`。金标 id 是外部 kb-rag 骨架产的不透明 16 位十六进制,仓内无 manifest,也不是这 4 篇文档文本的可复算哈希(5 种切块 × 4 种摘要 × 11608 候选命中 0)。**本基线不凑映射** —— 凑一个 id 对应关系把分数刷起来是这次交付最坏的失败模式。
- `evidence_span`:相关块 = 金标 `ground_truth_answer` 在语料里真实落的那一块(内容锚点,先整答案再首句)。它量的是「检索器能否把含金标答案的块捞进 top-k」,断言弱于 `id_native`,不得替它报数。
- 未判定原因口径:`id_namespace_mismatch` = 两侧 id 体系不同名(需要 chunk manifest 或同 id 索引才能解);`evidence_span_not_located` = 金标答案是改写/摘要而非原文子串,锚不到块;`answer_empty` = **金标自带缺陷**(答案字段归一化后为空,实测多为只剩裸 ``` 围栏的条目)。

## 与对照侧(Qoder 五档阶梯)的对齐与差距

- 已对齐:分档(`text_only` / `vector_only` / `hybrid`)+ 每档逐段打点 + 缺输入点名到具体。
- 刻意未做:`hybrid_rerank` / `hybrid_llm_rerank` 要真 rerank 模型与在线凭据,默认档的零网络零模型纪律下不跑;`vector_only` 用本仓确定性哈希向量,精度显著低于神经向量,读数不得当在线质量看。
- 本仓超越对侧的一格:同一套金标可**零网络、零 DB** 复跑(对侧阶梯依赖在线服务与索引),且未判定原因逐类计数进基线件,可被后续票 diff。
