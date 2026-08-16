import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  BookOpen,
  Users,
  BarChart3,
  Wrench,
} from 'lucide-react'
import { generateCourseSchema, type CourseSchema } from '@/lib/seo/schema-course'
import { BackButton } from '@/components/common'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('useCasesAiEdu')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/use-cases/ai-edu' },
    openGraph: {
      title: t('metaTitle'),
      description: t('metaDescription'),
      url: 'https://aizhs.top/use-cases/ai-edu',
      type: 'website',
    },
  }
}

const capabilities = [
  {
    title: '课程结构化编排',
    desc: '从大纲到课件到作业,AI Agent 协助教师拆分知识点,自动生成配套练习与项目任务,大幅减少备课时间。',
  },
  {
    title: '个性化学习路径',
    desc: '基于学员答题数据与学习节奏,AI 自动调整后续内容难度与推荐方向,因材施教规模化。',
  },
  {
    title: '智能答疑与作业批改',
    desc: '7×24 在线答疑,代码/数学/作文多模态批改,教师只需复核高价值样本,日常辅导工作量降低 60%。',
  },
  {
    title: '学习数据看板',
    desc: '实时汇总学员完成率/正确率/学习时长,自动识别掉队学员并提醒助教介入,留存率提升 25%。',
  },
]

const toolchain = [
  { name: 'Next.js 15 + React 19', purpose: 'Web 端课程工作台与学员门户' },
  { name: 'Fastify 5 + Drizzle ORM', purpose: 'API 端课程/作业/成绩数据' },
  { name: 'FastAPI + LangGraph + LiteLLM', purpose: '智能答疑/作业批改/学习推荐引擎' },
  { name: 'MCP 工具协议', purpose: '对接 LMS/Notion/Zoom 直播/题库系统' },
  { name: 'Tauri 2 桌面端', purpose: '离线课程缓存 + 本地题库练习' },
  { name: 'WXT 浏览器插件', purpose: '网页端视频课一键收藏与笔记' },
  { name: 'Taro 4 小程序', purpose: '移动端刷题 + 碎片化学习' },
  { name: 'CLI 命令行', purpose: '批量导入题库与课程脚本化处理' },
]

const metrics = [
  { value: '60%', label: '教师辅导工作量降低' },
  { value: '25%', label: '学员留存率提升' },
  { value: '8 端', label: '同步分发' },
  { value: '30min', label: '上线时间' },
]

export default async function AiEduPage() {
  // 2026-07-26 GEO 强化:Course schema(适配 AI 引擎对"AI 教育"页面的结构化抓取)
  let courseJsonLd: CourseSchema | null = null
  try {
    const t = await getTranslations('useCasesAiEdu.courseSchema')
    const about = (t.raw('about') as string[] | undefined) ?? []
    courseJsonLd = generateCourseSchema({
      name: t('name'),
      description: t('description'),
      url: 'https://aizhs.top/use-cases/ai-edu',
      providerName: t('provider'),
      providerUrl: 'https://aizhs.top',
      hasCourseInstance: {
        startDate: t('startDate'),
        endDate: t('endDate'),
        courseMode: 'online',
        courseWorkload: t('courseWorkload'),
        inLanguage: 'zh-CN',
      },
      priceCurrency: 'CNY',
      price: 0,
      about,
      teaches: (t.raw('teaches') as string[] | undefined) ?? [],
      educationalLevel: 'beginner',
      inLanguage: 'zh-CN',
    })
  } catch {
    courseJsonLd = null
  }

  return (
    <>
      {courseJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
        />
      ) : null}
      <main className="mx-auto w-full max-w-6xl px-4 py-8 min-[768px]:px-8 min-[768px]:py-8">
        <BackButton />
        {/* Hero */}
        <section className="space-y-5 text-center">
          <div className="inline-flex items-center gap-2 rounded border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            AI 教育
          </div>
          <h1 className="text-4xl font-bold tracking-tight min-[768px]:text-5xl">
            AI 教育 Agent:课程编排/智能答疑/学习推荐
          </h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground min-[768px]:text-lg">
            基于 IHUI AI 全栈 AI 操作系统搭建,8 端同源分发,Apache 2.0 开源,支持私有化部署。
            课程结构化编排 + 智能答疑 + 作业批改 + 学习数据看板,30 分钟上线。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-2xl font-bold text-primary min-[768px]:text-3xl">
                  {m.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground min-[768px]:text-sm">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 痛点 */}
        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">教培行业面临的真实挑战</h2>
          <ul className="space-y-2 text-sm text-muted-foreground min-[768px]:text-base">
            <li className="flex gap-2">
              <span className="text-rose-500">•</span>
              教师 70% 时间用于备课/批改/答疑,真正教学时间被挤压
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500">•</span>
              大班教学难以因材施教,优秀学员吃不饱/后进学员跟不上
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500">•</span>
              题库更新慢,与新教材/新考纲脱节,学员刷题效果有限
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500">•</span>
              学员学习数据散落在多个系统,完课率/续费数据不透明
            </li>
            <li className="flex gap-2">
              <span className="text-rose-500">•</span>
              多校区协作时,课程标准/题库/教学进度难以统一
            </li>
          </ul>
        </section>

        {/* 解决方案 */}
        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">IHUI AI 教育 Agent 解决方案</h2>
          <div className="grid grid-cols-1 gap-3 min-[768px]:grid-cols-2">
            {capabilities.map((c) => (
              <div key={c.title} className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {c.title}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 技术栈 */}
        <section className="mt-12 space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">8 端同源技术栈</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">技术</th>
                  <th className="px-4 py-2 font-medium">用途</th>
                </tr>
              </thead>
              <tbody>
                {toolchain.map((t) => (
                  <tr key={t.name} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{t.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 核心收益 */}
        <section className="mt-12 grid grid-cols-1 gap-3 min-[768px]:grid-cols-3">
          <div className="rounded-lg border bg-card p-5">
            <BookOpen className="h-5 w-5 text-primary" />
            <div className="mt-3 text-2xl font-bold">60%</div>
            <div className="mt-1 text-xs text-muted-foreground">教师辅导工作量降低</div>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <Users className="h-5 w-5 text-primary" />
            <div className="mt-3 text-2xl font-bold">25%</div>
            <div className="mt-1 text-xs text-muted-foreground">学员留存率提升</div>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <BarChart3 className="h-5 w-5 text-primary" />
            <div className="mt-3 text-2xl font-bold">95%+</div>
            <div className="mt-1 text-xs text-muted-foreground">智能批改准确率</div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-lg border bg-card p-8 text-center">
          <Wrench className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 text-2xl font-bold tracking-tight">30 分钟搭建 AI 教育 Agent</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            注册即用,Apache 2.0 开源,可私有化部署;Web/API/AI
            Service/Desktop/Extension/Mobile/Miniapp/CLI 8 端同源。
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/use-cases"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              查看更多用例
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/docs/agent"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-xs font-medium transition-colors hover:bg-accent"
            >
              阅读 Agent 文档
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
