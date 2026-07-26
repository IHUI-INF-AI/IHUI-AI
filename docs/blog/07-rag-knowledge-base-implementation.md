---
title: "RAG 知识库从零到一实现:5 步把文档变成可对话的 AI 大脑"
date: "2026-07-27"
tags: ["RAG", "检索增强生成", "向量数据库", "知识库", "embedding", "RAG 架构"]
category: "AI 工程"
description: "从文档解析、chunking、向量嵌入、检索策略到引用追溯,完整拆解一个生产级 RAG 知识库的 5 步实现,内含 IHUI-AI 的工程实践代码片段。"
---

# RAG 知识库从零到一实现:5 步把文档变成可对话的 AI 大脑

> 直接把整份文档塞进 LLM 上下文,既贵又容易幻觉。RAG(Retrieval-Augmented Generation,检索增强生成)通过「先检索后回答」的方式,让 AI 只看相关片段就能给出可追溯的答案。本文按 5 个工程步骤,讲清楚一个生产级 RAG 知识库从 0 到 1 的落地路径。

---

## 一、为什么需要 RAG:LLM 的三个先天缺陷

1. **知识截止**:模型训练到某个时间点就停了,之后的事不知道。
2. **私有知识盲区**:你公司的内部文档、客户合同、产品手册,模型从没见过。
3. **幻觉**:不知道也硬编,越像真的越危险。

RAG 的核心思路:**不改模型参数,只改输入**。把「用户问题」+「从知识库里检索到的相关片段」一起喂给 LLM,让它基于片段回答,并把片段来源标注出来。

---

## 二、5 步实现路径

### Step 1:文档解析与清洗

支持格式越多越好(IHUI-AI 支持 PDF / Word / Markdown / HTML / TXT / PPT),核心是用统一接口抽出纯文本:

```python
def parse_document(file_path: Path) -> list[DocumentChunk]:
    parser = PARSER_REGISTRY[file_path.suffix]   # .pdf → PyMuPDF, .docx → python-docx
    raw_text = parser.extract(file_path)
    cleaned = normalize_whitespace(remove_boilerplate(raw_text))
    return split_to_chunks(cleaned)
```

坑点:扫描版 PDF 必须先 OCR;Word 里的表格用 `python-docx` 读会丢结构,需要专门处理 `table` 节点。

### Step 2:Chunking(分块)

分块直接决定检索质量。常见三种策略:

| 策略 | 实现 | 适用 |
| --- | --- | --- |
| 固定长度 | 每 500 字切一刀 | 简单文本 |
| 递归字符 | 优先按段落 → 句子切,带 50 字重叠 | 通用场景(IHUI 默认) |
| 语义分块 | 用 embedding 聚类切分 | 长技术文档 |

```python
splitter = RecursiveCharacterTextSplitter(
    chunk_size=512, chunk_overlap=50,
    separators=["\n\n\n", "\n\n", "\n", "。", ".", " "]
)
chunks = splitter.split_text(document_text)
```

经验:`chunk_size` 设在 300-600 token 之间最稳,太小丢失上下文,太大召回率下降。

### Step 3:向量嵌入(Embedding)

把每个 chunk 转成向量。关键选型:

- **模型**:中文用 `bge-m3` 或 `text-embedding-3-large`;英文用 `voyage-3`。
- **维度**:`bge-m3` 是 1024 维,`text-embedding-3-large` 默认 3072 维,可截断到 256 维省存储。
- **批处理**:一次性 batch 32-64 条,API 调用次数降 10 倍。

```python
embeddings = embedding_client.embed_documents(
    [chunk.text for chunk in chunks], batch_size=64
)
# 入库
await pg_pool.executemany(
    "INSERT INTO kb_chunks (id, doc_id, text, embedding) VALUES ($1,$2,$3,$4)",
    [(chunk.id, doc_id, chunk.text, emb) for chunk, emb in zip(chunks, embeddings)]
)
```

### Step 4:检索策略(混合检索 > 纯向量)

单纯向量检索的痛点:专有名词、产品型号、人名匹配不准。解决方案是**向量 + BM25 混合检索**:

```sql
-- pgvector + pg_trgm 双路检索,RRF 融合
WITH vec AS (
  SELECT id, row_number() OVER (ORDER BY embedding <=> $1) AS rank
  FROM kb_chunks LIMIT 50
), bm25 AS (
  SELECT id, row_number() OVER (
    ORDER BY ts_rank_cd(tsv, plainto_tsquery('chinese', $2)) DESC
  ) AS rank
  FROM kb_chunks LIMIT 50
)
SELECT id, 1.0/(60+vec.rank) + 1.0/(60+bm25.rank) AS score
FROM vec JOIN bm25 USING(id)
ORDER BY score DESC LIMIT 10;
```

`RRF(Reciprocal Rank Fusion)` 不需要两路分数归一化,工程上最简单。

### Step 5:引用追溯(可验证 RAG)

最后一步是让 LLM 答案里带「来自哪个文档第几段」:

```python
prompt = f"""基于以下检索片段回答问题,每个事实陈述后用 [^id] 标注来源。

片段:
[1] {chunks[0].text} (来源:{chunks[0].doc_title} 第{chunks[0].page}页)
[2] {chunks[1].text} (来源:{chunks[1].doc_title} 第{chunks[1].page}页)

问题:{user_question}

答案格式:每个论断后接 [^1] / [^2] 等脚注。
"""
```

效果:用户能看到「这句话来自哪份文档第几页」,信任度提升一个量级。

---

## 三、IHUI-AI 的 RAG 工程实践

IHUI-AI 在 `apps/ai-service` 里完整实现了上述 5 步:

- **存储**:`packages/database` 用 PostgreSQL + `pgvector` 扩展,一份 schema 同时支持向量与全文检索。
- **嵌入**:通过 LiteLLM 统一调用,可在 OpenAI / 智谱 / 本地模型间切换。
- **检索**:默认开启混合检索,知识库量小于 1 万条时切到纯向量模式省算力。
- **多端**:`apps/web` / `apps/miniapp-taro` / `apps/cli` 共用同一套 RAG API,在 Web 上传文档,在小程序里问问题。

如果你也想搭一个 RAG 知识库,可以从这个仓库 fork 一份直接跑:<https://github.com/IHUI-INF-AI/IHUI-AI>

---

## 四、常见踩坑清单

1. **重排器(Re-ranker)缺失**:向量召回 Top 10 不一定是最相关的,加一个 `bge-reranker-v2` 重排,准确率 +15%。
2. **没有文档级元数据过滤**:用户问「2024 年的销售数据」,检索却召回 2022 年的。一定要把 `doc_year` 之类存成 metadata,在 SQL 里 pre-filter。
3. **chunk_overlap 设太低**:50 字以下会有跨段语义断裂。
4. **不用 hybrid**:纯向量在专业领域永远比混合检索差 5-10 个点。

---

## 五、下一步:Agentic RAG

传统 RAG 是「一次检索一次回答」,Agentic RAG 让 Agent 自主决定:是否要再查一次?要不要换关键词?要不要查另一个知识库?

IHUI-AI 用 LangGraph 把 RAG 包成一个工具节点,Agent 可以根据初次回答的置信度决定是否触发二次检索。这块会在后续文章里展开。

---

**相关链接**

- 项目仓库:<https://github.com/IHUI-INF-AI/IHUI-AI>
- 官网体验:<https://ihui.ai>
- pgvector 官方文档:<https://github.com/pgvector/pgvector>

如果这篇文章帮到你,欢迎到 GitHub 给 IHUI-AI 点 Star ⭐,也欢迎来官网直接体验我们已经搭好的 RAG 知识库。

---

**SEO 关键词**:`RAG`、`检索增强生成`、`向量数据库`、`知识库`、`embedding`、`RAG 架构`、`pgvector`、`混合检索`
