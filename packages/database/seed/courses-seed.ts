/**
 * P1-3 AI 教育课程内容 seed + 证书模板 seed (step 12)
 *
 * 写入 3 张表(均通过 upsertByUnique 幂等可重入):
 *  1. learn_categories  — 「AI 教育课程」一级分类(若已存在则跳过)
 *  2. lessons           — 8 门示范课程(AI 编程入门 / LangGraph 实战 / MCP 开发 /
 *                                  AI 教育方法论 / 多模态大模型 / RAG 工程化 /
 *                                  智能体评测 / AI 安全对抗)
 *  3. lesson_chapters   — 每门课 3-5 个章节大纲
 *  4. certificate_templates — 2 个证书视觉模板(紧凑 + 古典),由前端
 *                              `apps/web/src/components/certificate/CertificateTemplate.tsx`
 *                              渲染
 *
 * 8 门课程标题/讲师/时长/难度/章节大纲/标签,所有 string 字段为中文 + 数字 / 符号,
 * 对应 i18n 文案统一在 `packages/i18n/messages/web/{zh-CN,en,ja,ko,zh-TW}.json`
 * 的 `courses` namespace(参考已有 `course.*` 结构)。
 *
 * 不修改:任何其他 step / 任何 schema / 任何现有 UI。
 */

import { createDb } from '../src/client.js'
import {
  lessons,
  learnCategories,
  lessonChapters,
} from '../src/schema/learn.js'
import { certificateTemplates } from '../src/schema/certificate.js'
import { eq } from 'drizzle-orm'
import { upsertByUnique } from './_utils/upsert-by-unique.js'

const db = createDb(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui',
)

interface ChapterDef {
  title: string
  durationMin: number
}

interface CourseDef {
  code: string
  title: string
  intro: string
  lecturer: string
  level: 'beginner' | 'intermediate' | 'advanced'
  durationHours: number
  tags: string[]
  chapters: ChapterDef[]
}

/** 8 门示范课程(P1-3 计划要求 5-10 门) */
const courseSeeds: CourseDef[] = [
  {
    code: 'AI-EDU-001',
    title: 'AI 编程入门:从 Prompt 到生产级代码',
    intro:
      '面向零基础开发者的 AI 编程入门课。系统讲解提示工程、代码生成、单元测试、Code Review 全流程,配套 Claude Code / Codex CLI 实战。',
    lecturer: '陈知行',
    level: 'beginner',
    durationHours: 12,
    tags: ['AI 编程', 'Prompt', 'Claude Code', 'Codex CLI'],
    chapters: [
      { title: '提示工程基础:从对话到任务', durationMin: 60 },
      { title: 'Claude Code 与 Codex CLI 入门', durationMin: 90 },
      { title: '代码生成与单元测试', durationMin: 120 },
      { title: 'Code Review 与重构工作流', durationMin: 90 },
      { title: '生产部署:从原型到上线', durationMin: 60 },
    ],
  },
  {
    code: 'AI-EDU-002',
    title: 'LangGraph 实战:状态化多 Agent 系统',
    intro:
      '深入 LangGraph 状态机与多 Agent 协作机制。覆盖 StateGraph / Checkpoint / ToolNode / Human-in-the-Loop,实战 ReAct + Plan-Execute 范式。',
    lecturer: '林子衿',
    level: 'intermediate',
    durationHours: 18,
    tags: ['LangGraph', 'Agent', 'StateGraph', 'Tool Calling'],
    chapters: [
      { title: 'LangGraph 核心抽象:Node / Edge / State', durationMin: 90 },
      { title: 'Checkpoint 与持久化会话', durationMin: 90 },
      { title: 'ToolNode 与 Function Call 集成', durationMin: 120 },
      { title: 'ReAct 与 Plan-Execute 范式', durationMin: 150 },
      { title: '生产化部署与可观测性', durationMin: 90 },
    ],
  },
  {
    code: 'AI-EDU-003',
    title: 'MCP 协议开发:Claude Code 扩展实战',
    intro:
      'Model Context Protocol (MCP) 全栈开发课。覆盖 Server / Client / Transport / Resource / Prompt,实战 Claude Code per-visitor 权限模型。',
    lecturer: '苏景行',
    level: 'intermediate',
    durationHours: 14,
    tags: ['MCP', 'Claude Code', 'Protocol', 'A2A'],
    chapters: [
      { title: 'MCP 协议概览与生态', durationMin: 60 },
      { title: 'Server 开发:Tool / Resource / Prompt', durationMin: 120 },
      { title: 'Transport 实现:stdio / SSE / Streamable', durationMin: 90 },
      { title: 'Client 集成与 Claude Code 调试', durationMin: 90 },
      { title: 'per-visitor 权限模型与安全', durationMin: 60 },
    ],
  },
  {
    code: 'AI-EDU-004',
    title: 'AI 教育方法论:从知识传递到能力培养',
    intro:
      '面向教育从业者的 AI 时代教学设计课。融合 Bloom 分类 / 建构主义 / 项目式学习,实战 AI 辅助备课、个性化学习路径、智能评测。',
    lecturer: '李思涵',
    level: 'beginner',
    durationHours: 10,
    tags: ['AI 教育', '教学设计', '个性化学习', '智能评测'],
    chapters: [
      { title: 'AI 时代教育范式转移', durationMin: 60 },
      { title: 'AI 辅助备课与教案生成', durationMin: 60 },
      { title: '个性化学习路径设计', durationMin: 60 },
      { title: '智能评测与反馈系统', durationMin: 60 },
    ],
  },
  {
    code: 'AI-EDU-005',
    title: '多模态大模型应用开发',
    intro:
      '视觉-语言-语音多模态融合实战课。覆盖 CLIP / LLaVA / Whisper / VALL-E,实战图像理解、视频分析、数字人交互。',
    lecturer: '赵明远',
    level: 'intermediate',
    durationHours: 16,
    tags: ['多模态', 'CLIP', 'Whisper', 'LLaVA'],
    chapters: [
      { title: '多模态基础:视觉-语言对齐', durationMin: 90 },
      { title: 'CLIP 与图像检索', durationMin: 90 },
      { title: 'LLaVA 视觉问答实战', durationMin: 120 },
      { title: 'Whisper 语音识别与翻译', durationMin: 90 },
      { title: '多模态 Agent 集成', durationMin: 90 },
    ],
  },
  {
    code: 'AI-EDU-006',
    title: 'RAG 工程化:从原型到企业级',
    intro:
      '检索增强生成(RAG)工程化全链路课。覆盖文档处理 / Embedding / 向量库 / 召回重排 / 评测,实战 LangChain + Qdrant + RAGAS。',
    lecturer: '王启明',
    level: 'intermediate',
    durationHours: 20,
    tags: ['RAG', '向量数据库', 'Embedding', 'LangChain'],
    chapters: [
      { title: 'RAG 架构总览与典型坑', durationMin: 90 },
      { title: '文档解析与 Chunking 策略', durationMin: 120 },
      { title: 'Embedding 模型选型与微调', durationMin: 90 },
      { title: '向量数据库:Qdrant / Milvus / pgvector', durationMin: 120 },
      { title: '召回-重排两阶段架构', durationMin: 90 },
      { title: 'RAGAS 评测与持续优化', durationMin: 90 },
    ],
  },
  {
    code: 'AI-EDU-007',
    title: '智能体评测:SWE-Bench / GAIA / Terminal-Bench',
    intro:
      'Agent 评测体系深度课。覆盖 SWE-Bench Pro / GAIA / Terminal-Bench 2.0 / BrowseComp / OSWorld,实战 LLM-as-Judge 与自动化评测。',
    lecturer: '徐之恒',
    level: 'advanced',
    durationHours: 12,
    tags: ['Agent 评测', 'SWE-Bench', 'GAIA', 'LLM-as-Judge'],
    chapters: [
      { title: 'Agent 评测范式:从指标到 harness', durationMin: 90 },
      { title: 'SWE-Bench Pro 实战', durationMin: 90 },
      { title: 'GAIA 多模态 Agent 评测', durationMin: 60 },
      { title: 'Terminal-Bench 2.0 命令行评测', durationMin: 60 },
      { title: 'LLM-as-Judge 与人工复核', durationMin: 60 },
    ],
  },
  {
    code: 'AI-EDU-008',
    title: 'AI 安全对抗:Prompt Injection 与红队评估',
    intro:
      'AI 安全攻防实战课。覆盖 Prompt Injection / Jailbreak / GPT-Red self-play RL / 自动化红队,实战企业 Agent 安全加固。',
    lecturer: '韩夜白',
    level: 'advanced',
    durationHours: 14,
    tags: ['AI 安全', 'Prompt Injection', 'GPT-Red', '红队'],
    chapters: [
      { title: 'AI 安全威胁建模', durationMin: 60 },
      { title: 'Prompt Injection 攻防实战', durationMin: 90 },
      { title: 'Jailbreak 与越权检测', durationMin: 90 },
      { title: 'GPT-Red self-play 强化学习', durationMin: 90 },
      { title: '企业 Agent 安全加固清单', durationMin: 60 },
    ],
  },
]

/** 2 个证书视觉模板(compact / classical),由前端 CertificateTemplate 渲染 */
const certificateTemplateSeeds = [
  {
    name: 'IHUI 标准证书 - 紧凑版',
    description: '4:3 紧凑证书,适合在线展示与打印导出。深色边框 + 中心 SVG 印章。',
    awardingOrganization: 'IHUI AI 学院',
    awarderName: '院长 · 学术委员会',
    awardConditions: '完成课程全部章节学习并通过期末考核(≥ 60 分)',
    validityPolicy: '永久有效',
    templateConfig: {
      variant: 'compact',
      primaryColor: '#0F172A',
      accentColor: '#D4A574',
    },
  },
  {
    name: 'IHUI 古典证书 - 典礼版',
    description: '5:4 古典证书,适合典礼颁发与归档。古典纹章 + 双色印章 + 装饰线。',
    awardingOrganization: 'IHUI AI 学院 · 学术委员会',
    awarderName: '学术委员会主任',
    awardConditions: '完成指定课程并通过学术委员会评审',
    validityPolicy: '永久有效',
    templateConfig: {
      variant: 'classical',
      primaryColor: '#1C1917',
      accentColor: '#92400E',
    },
  },
]

export async function seedCourses() {
  console.log(`开始导入 P1-3 AI 教育课程内容...`)

  // 1. 「AI 教育课程」一级分类
  const catName = 'AI 教育课程'
  const [exCat] = await db.select().from(learnCategories).where(eq(learnCategories.name, catName))
  let catId: string
  if (exCat) {
    catId = exCat.id
    console.log(`  分类「${catName}」已存在,复用 id=${catId}`)
  } else {
    const [ins] = await db
      .insert(learnCategories)
      .values({ name: catName, sort: 50, status: 1 })
      .returning({ id: learnCategories.id })
    catId = ins.id
    console.log(`  新建分类「${catName}」 id=${catId}`)
  }

  // 2. 8 门课程(upsertByUnique, 按 code 唯一)
  let addedCourses = 0
  let updatedCourses = 0
  let addedChapters = 0
  for (let i = 0; i < courseSeeds.length; i++) {
    const c = courseSeeds[i]
    const sortWeight = 200 - i

    const { id: lessonId, action } = await upsertByUnique(db, {
      table: lessons,
      uniqueBy: { column: lessons.title, value: c.title },
      insertValues: {
        title: c.title,
        coverImage: null,
        intro: c.intro,
        categoryId: catId,
        lecturerName: c.lecturer,
        price: '0.00',
        originalPrice: null,
        isFree: true,
        isPublished: true,
        sort: sortWeight,
        viewCount: 0,
        signupCount: 0,
        lessonCount: c.chapters.length,
        status: 1,
      },
      updateValues: {
        intro: c.intro,
        lecturerName: c.lecturer,
        categoryId: catId,
        lessonCount: c.chapters.length,
        isPublished: true,
        sort: sortWeight,
      },
    })

    if (action === 'inserted') {
      addedCourses++
      console.log(`  [+] 课程: ${c.title} (${c.code})`)
    } else {
      updatedCourses++
      console.log(`  [~] 课程: ${c.title} (${c.code})`)
    }

    // 3. 章节(按 title 幂等 upsert, 已有则跳过)
    const existingChapters = await db
      .select()
      .from(lessonChapters)
      .where(eq(lessonChapters.lessonId, lessonId as string))

    const existingByTitle = new Set(existingChapters.map((ch) => ch.title))
    let sortOrder = existingChapters.length
    for (const ch of c.chapters) {
      if (existingByTitle.has(ch.title)) continue
      await db
        .insert(lessonChapters)
        .values({
          lessonId: lessonId as string,
          title: ch.title,
          sortOrder: sortOrder++,
        })
      addedChapters++
    }
  }
  console.log(
    `  课程: 新增 ${addedCourses} / 更新 ${updatedCourses}; 章节: 新增 ${addedChapters}`,
  )

  // 4. 2 个证书视觉模板
  let addedTpl = 0
  let updatedTpl = 0
  for (const t of certificateTemplateSeeds) {
    const { action } = await upsertByUnique(db, {
      table: certificateTemplates,
      uniqueBy: { column: certificateTemplates.name, value: t.name },
      insertValues: {
        name: t.name,
        description: t.description,
        backgroundImage: null,
        templateConfig: t.templateConfig as unknown as Record<string, unknown>,
        awardingOrganization: t.awardingOrganization,
        awarderName: t.awarderName,
        awardConditions: t.awardConditions,
        validityPolicy: t.validityPolicy,
        status: 1,
      },
      updateValues: {
        description: t.description,
        templateConfig: t.templateConfig as unknown as Record<string, unknown>,
        awardingOrganization: t.awardingOrganization,
        awarderName: t.awarderName,
        awardConditions: t.awardConditions,
        validityPolicy: t.validityPolicy,
        status: 1,
      },
    })
    if (action === 'inserted') {
      addedTpl++
      console.log(`  [+] 证书模板: ${t.name}`)
    } else {
      updatedTpl++
      console.log(`  [~] 证书模板: ${t.name}`)
    }
  }
  console.log(`  证书模板: 新增 ${addedTpl} / 更新 ${updatedTpl}`)

  console.log('=== P1-3 AI 教育课程内容 seed 完成 ===')
}
