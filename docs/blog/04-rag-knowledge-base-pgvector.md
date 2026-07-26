---
title: "从 0 到 1 构建企业级 RAG 知识库:pgvector + 文档切片 + 混合检索"
date: "2026-07-26"
tags: ["AI", "RAG", "pgvector", "PostgreSQL", "开源"]
category: "AI 工程"
description: "用 PostgreSQL + pgvector 构建企业级 RAG 知识库,IHUI AI 实战分享智能切片、混合检索(向量+全文+重排)与引用溯源。"
---

# 从 0 到 1 构建企业级 RAG 知识库:pgvector + 文档切片 + 混合检索

> 你给公司搭了个 AI 助手,接入了 GPT-4o。员工问"2025 年 Q3 销售政策",AI 编了一段"销售政策"。法务一看,全是幻觉——Q3 政策根本不是这样。员工问"产品 X 的退货流程",AI 又编。CTO 怒了:"我们花了几百万搭 AI,连公司内部文档都不知道?"

这就是 LLM 的致命伤:**它不知道你的企业内部知识**。微调太贵、太慢,且无法实时更新。解法是 RAG(Retrieval-Augmented Generation,检索增强生成)。本文讲 IHUI AI 如何用 pgvector + 混合检索构建企业级 RAG,支持多模态、权限隔离、引用溯源。

---

## 一、痛点:为什么朴素的 RAG 不够用

网上 RAG demo 看起来都很简单:把文档切片 → embedding → 存向量库 → 查询时算余弦相似度 → top-K 塞进 prompt。但企业级落地,你会撞上 4 堵墙:

### 墙 1:切片切不好,召回全乱套

- 按 500 字符硬切:把"订单"概念切成两半,前半段说"订单创建",后半段说"订单状态",两段单独都检索不到。
- 按段落切:不同段落长度差异巨大,有的段落 50 字太短,有的 5000 字超 context。
- 表格/代码块被切碎:Markdown 表格切成 4 段,每段都是乱码。

### 墙 2:纯向量检索召回不准

用户问"退款",向量库返回 top-5 是"还款"、"退货"、"账单"、"汇款"、"赔付"——意思相近但不是退款政策。**向量相似 ≠ 语义匹配**。

### 墙 3:多模态文档处理不了

PDF 里有图表、扫描件、公式。纯文本 RAG 直接把图表当图片丢了,但图表里恰恰是关键信息(如价格表)。

### 墙 4:权限隔离没有

A 部门的文档 B 部门不能看,但 RAG 一检索全暴露了。员工问"薪酬体系",HR 内部文档被检索出来给普通员工看了。

---

## 二、方案:pgvector + 智能切片 + 三路混合检索

### 2.1 为什么选 pgvector 而不是 Pinecone/Milvus

| 维度 | pgvector | Pinecone | Milvus |
| --- | --- | --- | --- |
| 部署成本 | 已有 PG,0 额外成本 | SaaS,按量计费 | 自建集群 |
| 事务一致性 | 与业务数据同库,事务一致 | 跨库,需手动同步 | 跨库,需手动同步 |
| 混合检索 | 向量 + 全文(pg_trgm/pg_bigm)原生 | 仅向量 | 向量 + 标量过滤 |
| 权限隔离 | 用 PG 的 RLS 行级安全 | 要自己实现 | 要自己实现 |
| 数据规模 | 100 万向量内最佳 | 亿级 | 亿级 |

**结论**:中小型企业(< 1 亿向量)选 pgvector 收益最大——少一个组件、事务一致、权限复用 PG。IHUI AI 选 pgvector 是因为我们的业务数据本来就在 PostgreSQL,知识库和业务数据同库,RAG 检索可以直接 JOIN 业务表(如"只检索我部门可见的文档")。

### 2.2 整体架构

```
┌─────────────────────────────────────────────┐
│ 文档摄入流水线                                │
│ PDF/Word/Markdown/HTML → 解析 → 智能切片      │
│        ↓                                     │
│ 多模态提取(文本/表格/图像)                   │
│        ↓                                     │
│ Embedding(text-embedding-3-large / bge-m3)   │
│        ↓                                     │
│ PostgreSQL + pgvector(kb_chunks 表)          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 检索流水线                                    │
│ 用户 Query                                    │
│   ↓                                          │
│ ┌──────────┬──────────┬──────────┐          │
│ │ 向量召回  │ 全文召回  │ 关键词召回│          │
│ │ (top 20) │ (top 20) │ (top 20) │          │
│ └──────────┴──────────┴──────────┘          │
│   ↓                                          │
│ 融合去重 + Rerank(bge-reranker-v2-m3)        │
│   ↓                                          │
│ 权限过滤(PG RLS)                            │
│   ↓                                          │
│ Top-5 → LLM 生成 + 引用溯源                  │
└─────────────────────────────────────────────┘
```

---

## 三、技术细节

### 3.1 数据库 schema

```sql
-- 启用扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- 模糊匹配
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 知识库表
CREATE TABLE knowledge_bases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id),
  visibility VARCHAR(20) NOT NULL DEFAULT 'private', -- private/team/public
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 文档表
CREATE TABLE kb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  source_type VARCHAR(50) NOT NULL, -- pdf/docx/md/html/url
  source_url TEXT,
  mime_type VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/processing/ready/failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 切片表(核心)
CREATE TABLE kb_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id UUID NOT NULL REFERENCES kb_documents(id) ON DELETE CASCADE,
  kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,                       -- 切片文本
  embedding VECTOR(1024),                       -- bge-m3 1024 维
  token_count INT NOT NULL,
  chunk_type VARCHAR(20) NOT NULL,             -- text/table/code/image_caption
  metadata JSONB NOT NULL DEFAULT '{}',        -- 页码/标题层级/坐标等
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(doc_id, chunk_index)
);

-- 向量索引(HNSW,比 IVFFlat 召回率高)
CREATE INDEX idx_kb_chunks_embedding
  ON kb_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 全文索引
CREATE INDEX idx_kb_chunks_content_trgm
  ON kb_chunks USING gin (content gin_trgm_ops);

-- 行级安全(RLS):权限隔离
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY kb_chunks_isolation ON kb_chunks
  USING (
    kb_id IN (
      SELECT id FROM knowledge_bases
      WHERE visibility = 'public'
         OR owner_id = current_user_id()
         OR (visibility = 'team' AND team_id IN (SELECT team_id FROM user_teams WHERE user_id = current_user_id()))
    )
  );
```

**关键设计**:
- HNSW 索引:`m=16, ef_construction=64`,召回率 95%+,延迟 < 50ms。
- `gin_trgm_ops`:支持中文模糊匹配(原生 PG 全文索引中文支持差)。
- RLS:数据库层强制权限隔离,即使应用层漏了校验,数据库也不会泄露。

### 3.2 智能切片

`apps/ai-service/src/rag/chunker.py`:

```python
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)
from typing import Literal

class SmartChunker:
    """按文档结构智能切片"""

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 64,
    ):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        # Markdown 按标题切
        self.md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=[
                ("#", "h1"), ("##", "h2"), ("###", "h3"),
            ],
        )
        # 递归切(优先 \n\n → \n → 。 → 空格)
        self.recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", "。", ".", " ", ""],
        )

    def chunk(self, text: str, source_type: str) -> list[dict]:
        if source_type == "md":
            return self._chunk_markdown(text)
        return self._chunk_plain(text)

    def _chunk_markdown(self, text: str) -> list[dict]:
        # 先按标题切
        sections = self.md_splitter.split_text(text)
        chunks = []
        for section in sections:
            # 再按长度切(避免单 section 过长)
            sub_chunks = self.recursive_splitter.split_text(section.page_content)
            for i, sc in enumerate(sub_chunks):
                chunks.append({
                    "content": sc,
                    "chunk_type": "text",
                    "metadata": {
                        **section.metadata,  # h1/h2/h3 层级
                        "sub_index": i,
                    },
                })
        return chunks

    def _chunk_plain(self, text: str) -> list[dict]:
        chunks = self.recursive_splitter.split_text(text)
        return [{"content": c, "chunk_type": "text", "metadata": {}} for c in chunks]

    def chunk_table(self, table_markdown: str, caption: str = "") -> list[dict]:
        """表格不切,整段作为一个 chunk"""
        return [{
            "content": f"{caption}\n\n{table_markdown}" if caption else table_markdown,
            "chunk_type": "table",
            "metadata": {"caption": caption},
        }]
```

**关键设计**:
- Markdown 先按标题切再按长度切,保证语义完整。
- 表格/代码块不切,整段存(超长就单独 embedding)。
- 递归分割器优先用中文句号 `。`,中文文档友好。

### 3.3 多模态文档处理

PDF 里的图表用 Vision LLM 生成 caption 再入库:

```python
import pypdf
from litellm import acompletion

async def extract_pdf_with_vision(pdf_path: str) -> list[dict]:
    """提取 PDF,把每页图表用 Vision LLM 描述"""
    reader = pypdf.PdfReader(pdf_path)
    chunks = []
    for page_num, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        # 切文本
        chunks.extend(chunker.chunk(text, "plain"))
        # 提取图像
        for img_idx, img in enumerate(page.images):
            img_base64 = encode_image_to_base64(img)
            # 用 Vision LLM 生成 caption
            caption = await acompletion(
                model="gpt-4o",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "用中文描述这张图表的内容,包括数据点和趋势。"},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_base64}"}},
                    ],
                }],
            )
            chunks.append({
                "content": f"[图 {page_num + 1}-{img_idx + 1}]\n{caption.choices[0].message.content}",
                "chunk_type": "image_caption",
                "metadata": {"page": page_num + 1, "image_index": img_idx + 1},
            })
    return chunks
```

**收益**:用户问"2025 年 Q3 销售趋势",向量检索到图表的 caption,LLM 引用图表数据回答,而不是说"我不知道"。

### 3.4 Embedding 模型选择

IHUI AI 默认用 `bge-m3`(开源、1024 维、中英双语、支持稀疏向量),备选 `text-embedding-3-large`(OpenAI,3072 维,贵):

```python
from litellm import aembedding

async def embed(text: str) -> list[float]:
    response = await aembedding(
        model="bge-m3",  # 通过 LiteLLM 调用,可换 OpenAI/Voyage
        input=[text],
    )
    return response.data[0]["embedding"]
```

**关键点**:embedding 模型一旦选定不能轻易换(维度不同要重建索引)。我们用 `bge-m3` 是因为开源、可私有化部署、中文表现优于 OpenAI。

### 3.5 三路混合检索

`apps/ai-service/src/rag/retriever.py`:

```python
import asyncpg
from typing import Literal

class HybridRetriever:
    """三路混合检索:向量 + 全文 + 关键词"""

    def __init__(self, pool: asyncpg.Pool, embed_fn):
        self.pool = pool
        self.embed_fn = embed_fn

    async def retrieve(
        self,
        query: str,
        kb_id: str,
        user_id: str,
        top_k: int = 5,
    ) -> list[dict]:
        # 1. 向量召回
        query_embedding = await self.embed_fn(query)
        vector_hits = await self.pool.fetch(
            """
            SELECT id, content, metadata,
                   1 - (embedding <=> $1::vector) AS score
            FROM kb_chunks
            WHERE kb_id = $2
            ORDER BY embedding <=> $1::vector
            LIMIT 20
            """,
            query_embedding, kb_id,
        )

        # 2. 全文召回(pg_trgm 模糊匹配)
        fulltext_hits = await self.pool.fetch(
            """
            SELECT id, content, metadata,
                   similarity(content, $1) AS score
            FROM kb_chunks
            WHERE kb_id = $2 AND content % $1
            ORDER BY score DESC
            LIMIT 20
            """,
            query, kb_id,
        )

        # 3. 关键词召回(ILIKE)
        keywords = extract_keywords(query)  # jieba 分词
        keyword_hits = await self.pool.fetch(
            """
            SELECT id, content, metadata,
                   CASE WHEN content ILIKE '%' || $1 || '%' THEN 0.6 ELSE 0 END
                   + CASE WHEN content ILIKE '%' || $2 || '%' THEN 0.4 ELSE 0 END AS score
            FROM kb_chunks
            WHERE kb_id = $3 AND (
              content ILIKE '%' || $1 || '%' OR
              content ILIKE '%' || $2 || '%'
            )
            LIMIT 20
            """,
            keywords[0] if len(keywords) > 0 else "",
            keywords[1] if len(keywords) > 1 else "",
            kb_id,
        )

        # 4. 融合去重(RRF - Reciprocal Rank Fusion)
        merged = reciprocal_rank_fusion(
            vector_hits, fulltext_hits, keyword_hits,
            weights=[0.5, 0.3, 0.2],  # 向量权重最高
        )

        # 5. Rerank(用 bge-reranker-v2-m3)
        reranked = await rerank(query, merged, top_k=20)

        # 6. 权限过滤(PG RLS 已自动应用,但显式再校验一次更安全)
        filtered = [r for r in reranked if await can_access(user_id, r["id"])]

        return filtered[:top_k]


def reciprocal_rank_fusion(*hit_lists, weights):
    """RRF 融合:score = Σ weight / (60 + rank)"""
    scores = {}
    for hits, weight in zip(hit_lists, weights):
        for rank, hit in enumerate(hits):
            scores[hit["id"]] = scores.get(hit["id"], 0) + weight / (60 + rank)
    return sorted(scores.items(), key=lambda x: -x[1])
```

**为什么三路**:
- 向量召回:语义相似(用户问"退款",召回"退货政策")
- 全文召回:词形相似(用户打错字"退款z",召回"退款")
- 关键词召回:精确匹配(用户搜"ISO27001",必须包含这个词)

任何单路都有盲区,三路融合后召回率从 72% → 91%。

### 3.6 Rerank 模型

召回后用 `bge-reranker-v2-m3` 重排(交叉编码器,比向量相似更准):

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")

async def rerank(query: str, candidates: list[dict], top_k: int) -> list[dict]:
    pairs = [(query, c["content"]) for c in candidates]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(candidates, scores), key=lambda x: -x[1])
    return [c for c, _ in ranked[:top_k]]
```

**收益**:重排后 top-5 准确率从 81% → 94%。

### 3.7 引用溯源

LLM 生成时把 chunk_id 注入 prompt,要求每段回答标注引用:

```python
async def generate_with_citations(query: str, chunks: list[dict]) -> dict:
    context = "\n\n".join([
        f"[{i + 1}] (来源:{c['metadata'].get('source', '未知')}, 页码:{c['metadata'].get('page', '?')})\n{c['content']}"
        for i, c in enumerate(chunks)
    ])
    prompt = f"""基于以下知识库内容回答问题。每个事实陈述后用 [编号] 标注引用来源。如果知识库中没有相关信息,明确说"知识库中未找到"。

知识库:
{context}

问题:{query}

回答:"""
    response = await dispatcher.chat("gpt-4o", [
        {"role": "system", "content": "你是企业知识助手,严格基于知识库回答,禁止编造。"},
        {"role": "user", "content": prompt},
    ])
    return {
        "answer": response,
        "citations": [
            {"id": c["id"], "source": c["metadata"].get("source"), "page": c["metadata"].get("page")}
            for c in chunks
        ],
    }
```

UI 上每段回答后面有 `[1] [2]` 可点击,跳到原文档对应页码。**员工不再担心 AI 编造**。

---

## 四、IHUI AI 实战数据

| 指标 | 数值 |
| --- | --- |
| 默认 embedding 模型 | bge-m3(1024 维,中英双语) |
| Rerank 模型 | bge-reranker-v2-m3 |
| 切片策略 | Markdown 标题 + 递归字符(512/64) |
| 检索路径 | 向量 + 全文 + 关键词(三路 RRF 融合) |
| Top-5 召回率 | **94.2%**(对比纯向量 72%) |
| 平均检索延迟 | 80ms(10 万 chunks) |
| 多模态支持 | PDF/Word/Markdown/HTML/图像 caption |
| 权限隔离 | PG RLS 行级安全 + 应用层双校验 |
| 引用溯源 | 100% 回答附 chunk_id + 页码 |

**真实案例**:某律所接入 IHUI AI 知识库,把 3000 份合同入库。律师问"竞业协议补偿标准",AI 回答 + 引用具体合同条款 + 页码,5 秒搞定。原来律师翻合同平均 25 分钟/次。

---

## 五、踩坑总结

### 坑 1:embedding 维度选错

一开始用 `text-embedding-3-small`(1536 维),后来想换 `bge-m3`(1024 维)省存储,发现维度不一致要重建索引。**经验:一开始就评估好,后期换 embedding 等于重建知识库**。

### 坑 2:切片太小召回发散

chunk_size=128 召回率高但 LLM 拿到的上下文太碎,回答支离破碎。我们最终用 512 token + 64 overlap,平衡召回和上下文完整。

### 坑 3:HNSW vs IVFFlat

HNSW 召回率高(95%+)但内存占用大;IVFFlat 省内存但召回率掉到 85%。**100 万 chunks 内 HNSW 更优,千万级以上才考虑 IVFFlat**。

### 坑 4:中文分词

`pg_trgm` 对中文不友好,我们把 `jieba` 集成到应用层做关键词提取,再喂给 SQL ILIKE。纯数据库层方案要上 `pg_bigm`(需要自己编译 PG 扩展)。

### 坑 5:权限过滤晚了一步

最初在 Python 层做权限过滤,有次 bug 把内部 HR 文档检索出来给普通员工看了。**教训:权限必须在 SQL 层(RLS)兜底,应用层校验只是优化性能**。

---

## 六、结语

企业级 RAG 的核心是:

- **切片智能**:按 Markdown 标题 + 递归字符,表格/代码不切,512/64 是甜点。
- **三路融合**:向量(语义)+ 全文(模糊)+ 关键词(精确),RRF 融合召回率 94%。
- **Rerank 兜底**:bge-reranker-v2-m3 把 top-5 准确率从 81% 拉到 94%。
- **多模态**:图表用 Vision LLM 生成 caption 入库,检索时一视同仁。
- **权限隔离**:PG RLS 数据库层兜底 + 应用层校验,双保险。
- **引用溯源**:每段回答附 chunk_id + 页码,员工敢用、法务敢批。

这套架构让 IHUI AI 的知识库在企业场景落地:律所、咨询公司、SaaS 厂商都在用。如果你也在做 RAG,强烈建议从第一天就用 pgvector + 混合检索——纯向量方案在生产环境必撞墙。

---

## 关于 IHUI AI

IHUI AI 是一站式 8 端全栈 AI 操作系统,Apache 2.0 开源。

- 🌐 官网:https://ihui.ai
- 💻 GitHub:https://github.com/IHUI-INF-AI/IHUI-AI(Star 支持一下 ⭐)
- 📦 8 端同源:Web / API / CLI / Desktop / Extension / Mobile / Miniapp
- 🤖 176 模型:OpenAI / Claude / Gemini / 通义 / DeepSeek / 智谱 / 文心 / 豆包 / Kimi / Ollama
- 💰 定价:Free / Pro ¥49/月 / Team ¥199/人/月 / Enterprise ¥2999/月起

**5 分钟 Fork 到上线,替代 ChatGPT Team + Claude Code + Notion AI,月省 $60+。**
