/**
 * AI 教育课程 seed 脚本(P1-3 MVP)。
 *
 * 用法：
 *   pnpm --filter @ihui/api tsx scripts/seed-courses.ts
 *
 * 行为：
 * 1. upsert 3 个课程分类(programming / ai-agent / education)
 * 2. upsert 5 门示范课程(AI 编程入门 / LangGraph 实战 / MCP 协议开发 /
 *    AI 教育方法论 / Agent 工作流设计)
 * 3. 每门课插入 5-8 个章节占位(lessonChapters)
 * 4. 按 title 去重，已存在跳过（不覆盖 instructor 修改）
 *
 * 注意：
 * - durationHours / difficulty 字段当前 lessons 表无对应列，仅在 SeedCourse 接口留存用于文档化
 * - coverImage 用占位路径，实际生产应替换为真实图片 URL
 */
import 'dotenv/config'
import { db } from '../src/db/index.js'
import { lessons, lessonChapters, learnCategories } from '@ihui/database'
import { eq } from 'drizzle-orm'

interface SeedLesson {
  title: string
  durationMinutes: number
}

interface SeedCourse {
  title: string
  description: string
  instructor: string
  durationHours: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: string
  lessons: SeedLesson[]
  coverImage: string
  studentsCount: number
  status: number
}

const SEED_COURSES: SeedCourse[] = [
  {
    title: 'AI 编程入门',
    description:
      '面向 0 基础学员，系统介绍 AI 辅助编程的核心概念、工具与实战流程，涵盖 Cursor、Trae、Claude Code 等主流 AI 编程工具。',
    instructor: '李明轩',
    durationHours: 8,
    difficulty: 'beginner',
    category: 'programming',
    coverImage: '/images/courses/ai-programming.svg',
    studentsCount: 1280,
    status: 1,
    lessons: [
      { title: 'AI 编程工具概览', durationMinutes: 40 },
      { title: 'Cursor 入门实战', durationMinutes: 45 },
      { title: 'Trae IDE 工作流', durationMinutes: 50 },
      { title: 'Claude Code 命令行', durationMinutes: 40 },
      { title: '提示工程基础', durationMinutes: 45 },
      { title: '代码生成与重构', durationMinutes: 50 },
      { title: '调试与测试自动化', durationMinutes: 40 },
    ],
  },
  {
    title: 'LangGraph 实战',
    description:
      '基于 Python LangGraph 框架，从状态图基础到多 Agent 协作，系统构建可生产部署的 LLM 应用。',
    instructor: '王思远',
    durationHours: 15,
    difficulty: 'intermediate',
    category: 'ai-agent',
    coverImage: '/images/courses/langgraph.svg',
    studentsCount: 680,
    status: 1,
    lessons: [
      { title: 'LangGraph 框架概览', durationMinutes: 50 },
      { title: 'State 状态管理', durationMinutes: 60 },
      { title: 'Node 与 Edge 设计', durationMinutes: 55 },
      { title: '条件分支与循环', durationMinutes: 50 },
      { title: '工具调用集成', durationMinutes: 60 },
      { title: '多 Agent 协作', durationMinutes: 65 },
      { title: '记忆与持久化', durationMinutes: 55 },
      { title: '生产部署与监控', durationMinutes: 60 },
    ],
  },
  {
    title: 'MCP 协议开发',
    description:
      '深入 Model Context Protocol 协议规范，从 Server 开发到 Client 集成，打通 LLM 与外部工具的标准化通道。',
    instructor: '陈雨晴',
    durationHours: 12,
    difficulty: 'intermediate',
    category: 'ai-agent',
    coverImage: '/images/courses/mcp-dev.svg',
    studentsCount: 420,
    status: 1,
    lessons: [
      { title: 'MCP 协议规范解读', durationMinutes: 50 },
      { title: 'Server 端开发', durationMinutes: 60 },
      { title: 'Tool 工具定义', durationMinutes: 55 },
      { title: 'Resource 资源管理', durationMinutes: 50 },
      { title: 'Prompt 模板', durationMinutes: 45 },
      { title: 'Client 集成与调试', durationMinutes: 60 },
      { title: '安全与权限控制', durationMinutes: 50 },
    ],
  },
  {
    title: 'AI 教育方法论',
    description:
      '面向一线教师，系统介绍 AI 在教学设计、个性化学习、学情分析等教育场景的应用方法与实践案例。',
    instructor: '张晓梅',
    durationHours: 6,
    difficulty: 'beginner',
    category: 'education',
    coverImage: '/images/courses/ai-education.svg',
    studentsCount: 890,
    status: 1,
    lessons: [
      { title: 'AI 教育概览', durationMinutes: 40 },
      { title: '教学设计中的 AI', durationMinutes: 50 },
      { title: '个性化学习路径', durationMinutes: 45 },
      { title: '学情分析与反馈', durationMinutes: 50 },
      { title: 'AI 辅助评估', durationMinutes: 45 },
      { title: '教育伦理与边界', durationMinutes: 40 },
    ],
  },
  {
    title: 'Agent 工作流设计',
    description:
      '面向架构师与高级工程师，系统讲解 Agent 工作流的拓扑设计、状态编排、容错恢复与可观测性建设。',
    instructor: '刘建国',
    durationHours: 20,
    difficulty: 'advanced',
    category: 'ai-agent',
    coverImage: '/images/courses/agent-workflow.svg',
    studentsCount: 320,
    status: 1,
    lessons: [
      { title: 'Agent 工作流概览', durationMinutes: 60 },
      { title: '拓扑设计模式', durationMinutes: 75 },
      { title: '状态编排与持久化', durationMinutes: 70 },
      { title: '并行与串行调度', durationMinutes: 65 },
      { title: '容错与重试策略', durationMinutes: 70 },
      { title: '人工介入节点', durationMinutes: 60 },
      { title: '可观测性与追踪', durationMinutes: 65 },
      { title: '生产案例分析', durationMinutes: 75 },
    ],
  },
]

const categoryCache = new Map<string, string>()

async function getOrCreateCategory(name: string): Promise<string> {
  const cached = categoryCache.get(name)
  if (cached) return cached

  const [existing] = await db
    .select({ id: learnCategories.id })
    .from(learnCategories)
    .where(eq(learnCategories.name, name))
    .limit(1)

  if (existing) {
    categoryCache.set(name, existing.id)
    return existing.id
  }

  const [created] = await db
    .insert(learnCategories)
    .values({ name, sort: 0, status: 1 })
    .returning({ id: learnCategories.id })

  if (!created) throw new Error(`Failed to create category: ${name}`)
  categoryCache.set(name, created.id)
  return created.id
}

async function upsertCourse(c: SeedCourse): Promise<'inserted' | 'skipped'> {
  // 按 title 去重，已存在跳过（不覆盖 instructor 修改）
  const [existing] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.title, c.title))
    .limit(1)

  if (existing) return 'skipped'

  const categoryId = await getOrCreateCategory(c.category)

  const [created] = await db
    .insert(lessons)
    .values({
      title: c.title,
      intro: c.description,
      lecturerName: c.instructor,
      coverImage: c.coverImage,
      signupCount: c.studentsCount,
      lessonCount: c.lessons.length,
      status: c.status,
      categoryId,
      isFree: true,
      isPublished: true,
    })
    .returning({ id: lessons.id })

  if (!created) throw new Error(`Failed to insert course: ${c.title}`)

  // 插入章节占位
  for (const [i, lesson] of c.lessons.entries()) {
    await db.insert(lessonChapters).values({
      lessonId: created.id,
      title: lesson.title,
      sortOrder: i,
    })
  }

  return 'inserted'
}

async function main() {
  console.info('[seed-courses] 开始 seed AI 教育课程...')
  let inserted = 0
  let skipped = 0

  for (const c of SEED_COURSES) {
    try {
      const result = await upsertCourse(c)
      if (result === 'inserted') {
        inserted++
        console.info(`  ✓ inserted "${c.title}" (${c.lessons.length} lessons)`)
      } else {
        skipped++
        console.info(`  → skipped  "${c.title}" (already exists)`)
      }
    } catch (err) {
      console.error(`  ✗ failed "${c.title}":`, err)
      throw err
    }
  }

  console.info(`[seed-courses] 完成: ${inserted} inserted, ${skipped} skipped`)
  process.exit(0)
}

main().catch((err) => {
  console.error('[seed-courses] 失败:', err)
  process.exit(1)
})
