// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * E2E 知识库种子脚本（幂等）。
 *
 * 背景:knowledge-base.spec.ts 依赖 /api/knowledge 返回非空列表,
 * 隔离库(ihui_e2e)重建后 knowledge_base 为空 → 4 例永久红。
 * 本脚本沉淀该种子机制,与 seed-test-users 同级,由 web 的 global-setup 自动调用。
 *
 * 用法:
 *   pnpm --filter @ihui/api run seed:e2e-knowledge
 *   # 连接目标库由 DATABASE_URL 决定(dotenv 不覆盖已存在的环境变量,外部传入即生效)
 *
 * 行为:
 * 1. upsert 8 条公开知识条目(is_published=true, status=1,按 title 幂等)
 * 2. 打印 seed 结果
 */
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { knowledgeBase } from '@ihui/database'
import { eq } from 'drizzle-orm'

interface SeedKnowledge {
  title: string
  summary: string
  content: string
}

const SEED_KNOWLEDGE: SeedKnowledge[] = [
  {
    title: 'E2E 种子 · AI 入门:大语言模型是什么',
    summary: '面向零基础读者的大语言模型入门指南。',
    content:
      '大语言模型(LLM)是一种基于 Transformer 架构的深度学习模型,通过海量文本预训练习得语言规律。\n\n核心概念:token、上下文窗口、温度参数。本文用于 E2E 环境知识库板块回归验证。',
  },
  {
    title: 'E2E 种子 · Prompt 工程基础技巧',
    summary: '编写高质量提示词的六个实用技巧。',
    content:
      '好的提示词包含:角色设定、任务描述、约束条件、输出格式、示例(Few-shot)、思维链引导。\n\n本文用于 E2E 环境知识库板块回归验证。',
  },
  {
    title: 'E2E 种子 · RAG 检索增强生成简介',
    summary: '用外部知识库提升模型回答准确性的标准方案。',
    content:
      'RAG(Retrieval-Augmented Generation)流程:文档切片 → 向量化入库 → 语义检索 → 拼接上下文 → 生成回答。\n\n本文用于 E2E 环境知识库板块回归验证。',
  },
  {
    title: 'E2E 种子 · AI Agent 与工具调用',
    summary: '让模型学会使用工具完成复杂任务。',
    content:
      'AI Agent = 模型 + 记忆 + 规划 + 工具调用。Function Calling 让模型按 JSON Schema 输出结构化参数,由运行时执行真实动作。\n\n本文用于 E2E 环境知识库板块回归验证。',
  },
  {
    title: 'E2E 种子 · 多模态模型应用场景',
    summary: '图文音视频融合的 AI 能力盘点。',
    content:
      '多模态模型可同时理解文本、图像、音频。典型场景:图文理解、OCR、视觉问答、视频摘要。\n\n本文用于 E2E 环境知识库板块回归验证。',
  },
  {
    title: 'E2E 种子 · 模型微调与量化部署',
    summary: '从全量微调到 LoRA,从 FP16 到 INT4。',
    content:
      '微调路线:全量微调成本高,LoRA/QLoRA 用低秩矩阵近似更新,显存需求大幅下降。量化部署可在消费级显卡运行大模型。\n\n本文用于 E2E 环境知识库板块回归验证。',
  },
  {
    title: 'E2E 种子 · AI 安全与内容合规',
    summary: '生成式 AI 服务的安全边界与实践。',
    content:
      '内容安全包括:输入过滤、输出审核、敏感词拦截、人工复核。合规要点:数据隐私、版权、生成内容标识。\n\n本文用于 E2E 环境知识库板块回归验证。',
  },
  {
    title: 'E2E 种子 · 效率工具:AI 辅助编程',
    summary: '代码补全、重构、评审中的 AI 实践。',
    content:
      'AI 辅助编程的三个层次:行内补全、对话生成、Agent 自主改码。配合测试与评审流程可显著提升交付质量。\n\n本文用于 E2E 环境知识库板块回归验证。',
  },
]

async function main() {
  console.info('[seed-e2e-knowledge] 开始 seed 公开知识条目...')
  let inserted = 0
  let skipped = 0

  for (const k of SEED_KNOWLEDGE) {
    const [existing] = await db
      .select({ id: knowledgeBase.id })
      .from(knowledgeBase)
      .where(eq(knowledgeBase.title, k.title))
      .limit(1)

    if (existing) {
      skipped++
      continue
    }

    await db.insert(knowledgeBase).values({
      title: k.title,
      summary: k.summary,
      content: k.content,
      isPublished: true,
      status: 1,
    })
    inserted++
  }

  console.info(`[seed-e2e-knowledge] 完成: ${inserted} inserted, ${skipped} skipped`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-e2e-knowledge] 失败:', err)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
