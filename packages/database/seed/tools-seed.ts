// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createDb } from '../src/client.js'
import { tools } from '../src/schema/tool.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

/**
 * 工具目录种子(2026-10-30)。
 *
 * 背景:`GET /api/tools`(apps/api/src/routes/tools.ts:58)与 `tools` 表一直齐备,web 端
 * `/tools` 页也照它渲染,但**全仓没有任何 seed、也没有运营建工具的页面**(唯一写入方是
 * admin POST,而 apps/web 没有对应的 admin coupons/tools 页)⇒ 新库里这张表恒空,
 * `/tools` 页三个分类各自显示「暂无工具」——能力在、入口在、数据不在。
 *
 * 纪律:下面每一条都对应一个**本仓真实存在、点得动**的 web 路由(逐条 `ls apps/web/app/(main)/<路径>`
 * 核过)。宁少勿滥 —— 编一条不存在的 url,就是给用户一个 404。
 *
 * 幂等:tools 表 name 无唯一约束,按 name 先查后插(与 announcements-seed 同法),重跑不重复插。
 * 运营后续新增/改名一律走管理后台,本 seed 只管首启基线。
 */
interface SeedTool {
  name: string
  description: string
  /** 与 web /tools 页 CATEGORIES 的三档逐字一致(ai / dev / efficiency),写第四档页面筛不出来 */
  category: 'ai' | 'dev' | 'efficiency'
  icon: string
  url: string
  sortOrder: number
}

const SEED_TOOLS: SeedTool[] = [
  {
    name: 'PDF 合并',
    description: '多个 PDF 按顺序合成一份,支持拖拽调序与删除单项。',
    category: 'efficiency',
    icon: 'layers',
    url: '/tools/pdf/merge',
    sortOrder: 10,
  },
  {
    name: 'PDF 拆分',
    description: '按页码区间拆出子文件,单个 PDF 可派生多份。',
    category: 'efficiency',
    icon: 'scissors',
    url: '/tools/pdf/split',
    sortOrder: 20,
  },
  {
    name: 'PDF 加水印',
    description: '给 PDF 叠加文字水印,可调字号、透明度与旋转角度。',
    category: 'efficiency',
    icon: 'stamp',
    url: '/tools/pdf/watermark',
    sortOrder: 30,
  },
  {
    name: 'Markdown 转 PDF',
    description: '把 Markdown 文稿渲染导出为排好版的 PDF。',
    category: 'efficiency',
    icon: 'file-text',
    url: '/tools/pdf/convert',
    sortOrder: 40,
  },
  {
    name: 'AI 语音转写',
    description: '上传音频,由大模型转写为文字稿(会议/访谈/口播稿整理)。',
    category: 'ai',
    icon: 'mic',
    url: '/tools/voice-stt',
    sortOrder: 10,
  },
  {
    name: '模型广场',
    description: '浏览与对比平台接入的大模型,选定后可直接发起对话。',
    category: 'ai',
    icon: 'sparkles',
    url: '/models',
    sortOrder: 20,
  },
  {
    name: '知识库',
    description: '把文档建成可检索的知识库,问答直接命中库内上下文。',
    category: 'ai',
    icon: 'book-open',
    url: '/knowledge-base',
    sortOrder: 30,
  },
  {
    name: 'MCP 插件商店',
    description: '浏览并安装 MCP Server,给智能体接入外部工具能力。',
    category: 'dev',
    icon: 'plug',
    url: '/mcp-store',
    sortOrder: 10,
  },
  {
    name: '网页工具集',
    description: '面向开发者的在线小工具集合(格式转换/编解码/文本处理)。',
    category: 'dev',
    icon: 'wrench',
    url: '/web-tools',
    sortOrder: 20,
  },
]

export async function seedTools() {
  // 幂等:先取已存在的 name 集合,只插缺的那些
  const existing = await db.select({ name: tools.name }).from(tools)
  const existingNames = new Set(existing.map((r) => r.name))
  const toInsert = SEED_TOOLS.filter((t) => !existingNames.has(t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    icon: t.icon,
    url: t.url,
    status: 'published' as const,
    sortOrder: t.sortOrder,
  }))
  if (toInsert.length === 0) {
    console.info('[seed] tools: 全部已存在,跳过(幂等)')
    return
  }
  await db.insert(tools).values(toInsert)
  console.info(
    `[seed] tools: 新增 ${toInsert.length} 条,跳过 ${existingNames.size} 条已存在(共 ${SEED_TOOLS.length} 条基线)`,
  )
}

// 独立执行入口:tsx seed/tools-seed.ts
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools-seed.ts')) {
  seedTools()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[tools] seed 失败:', err)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
