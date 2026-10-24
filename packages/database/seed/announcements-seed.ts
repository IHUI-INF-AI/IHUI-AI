// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { createDb } from '../src/client.js'
import { announcements, type AnnouncementPlatform } from '../src/schema/content.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

/**
 * 公告种子数据(2026-10-24)。
 *
 * 背景:公告表此前零种子 —— 即便首页 Marquee 接了 /api/announcements,库里没公告
 * 首页也是空的。本 seed 按 title 幂等(已存在则跳过),内容全部取自当日实测的
 * 真实能力盘点(4399 REST 路由 / 9 端 / 101 内置模型 / 中继网关 / 监控大屏 /
 * AI 教育 / 灰度放量 / BI 大屏 / 342 守门 / 338 migrations 等)。
 *
 * 运营说明:后续公告一律走管理后台 /admin/announcements 发布,本 seed 只负责
 * 首启基线;要更新文案改这里重跑即可(幂等,不重复插)。
 */

interface SeedAnnouncement {
  title: string
  content: string
  type: 'info' | 'update' | 'maintenance' | 'warning'
  isPinned: boolean
  /** 距今天数(负数=过去发布,用于排序);缺省 0 = 今天 */
  daysAgo?: number
  /** 过期天数(缺省 = 不过期) */
  expiresInDays?: number
  /** 投放端(缺省/空数组 = 全端通用;见 ANNOUNCEMENT_PLATFORMS) */
  platforms?: AnnouncementPlatform[]
}

const DAY = 24 * 60 * 60 * 1000

const SEED_ANNOUNCEMENTS: SeedAnnouncement[] = [
  {
    title: '🚀 中继 API 中转站上线:一个 Key 直达全球大模型',
    content:
      '智汇 AI 中继网关(Relay)全面开放:OpenAI 兼容协议,实时同步 GPT-5.4 / Claude Opus 5 / Gemini 3.8 / GLM-5.3 / DeepSeek-V4 / Kimi-K3 等旗舰模型;个人号池与团队池双轨并存,支持签到自动续期。配合 101 个内置模型目录与 19 个原生 Provider 适配器,一个 API Key 走天下。',
    type: 'update',
    isPinned: true,
    daysAgo: 0,
  },
  {
    title: '📊 生产级运维监控大屏:告警严重度分级 + 容量警戒线',
    content:
      '原生监控面板正式上线:/admin/monitor/panels 提供 Prometheus + Alertmanager 三路聚合,告警按严重度分级、容量警戒线预警、边缘腿详情下钻,全面替代 Grafana iframe 方案。183 族指标 / 279 面板 / 331 条表达式实时可视。',
    type: 'update',
    isPinned: true,
    daysAgo: 1,
  },
  {
    title: '🎓 AI 教育全栈发布:课程 / 直播 / 考试 / 证书一体化',
    content:
      '八大模块齐备:课程目录、章节播放、学习进度、直播、考试、证书、讲师、班级。从 AI 新工具到企业 AI 文化三阶递进,决策者社群成员全年课程免费。管理端支持缴费登记与学员进度透视。',
    type: 'update',
    isPinned: false,
    daysAgo: 2,
  },
  {
    title: '🧩 三栈协议齐备:LangGraph 4 大工作流 + 88 个 MCP 工具',
    content:
      'LangGraph 4 大状态图工作流(plan-execute / memory-load-save / Canvas / 口播)+ ai-service 88 个 MCP 工具 + 5 个 A2A 端点 + 6 个 ACP 扩展, Zed / VSCode / Cursor 内嵌可用,行业罕见的三栈合一。',
    type: 'update',
    isPinned: false,
    daysAgo: 3,
  },
  {
    title: '🌐 9 端同源覆盖:统一账号,无缝切换',
    content:
      'Web / API / AI 服务 / 微信小程序 / Tauri 桌面端 / 浏览器扩展 / React Native / CLI / 原生 Capacitor 九端同源,一套账号体系统一切换,数据实时同步。',
    type: 'info',
    isPinned: false,
    daysAgo: 5,
  },
  {
    title: '💼 决策者社群早鸟价:¥6000/年(标准价 ¥18000,3.3 折)',
    content:
      '限 18 席,决策者专属。含 9 端全功能、100+ 大模型无限调用、私有化部署咨询、全年 AI 课程免费。早鸟价 2026 年内有效,售罄即止。',
    type: 'info',
    isPinned: true,
    daysAgo: 0,
    expiresInDays: 69, // 2027-01-01 前有效
  },
  {
    title: '🛡️ 安全风控升级:SQLi 运行时检测 + IP 信誉封禁',
    content:
      '新增 SQL 注入运行时检测、mTLS 双向认证、IP 信誉自动封禁与威胁态势仪表盘;出站请求逐跳 SSRF 复检。342 个守门脚本 + 7 个 husky 钩子 + 338 个数据库迁移,提交链全自动体检。',
    type: 'update',
    isPinned: false,
    daysAgo: 7,
  },
  {
    title: '📈 BI 数据大屏 + 灰度放量:新功能安全上线',
    content:
      'BI 仪表盘支持自定义看板、千分位格式化、告警严重度着色与空态兜底;管理端 /gray-release 支持按指标灰度观测,新功能先小流量验证再全量,线上事故率显著下降。',
    type: 'update',
    isPinned: false,
    daysAgo: 10,
  },
]

export async function seedAnnouncements() {
  console.info(`[seed] announcements: 开始导入 ${SEED_ANNOUNCEMENTS.length} 条公告基线...`)
  // 幂等:announcements 表无 title 唯一约束,先查已存在标题,只插缺失的
  const existing = await db.select({ title: announcements.title }).from(announcements)
  const existingTitles = new Set(existing.map((r) => r.title))
  const now = Date.now()
  const toInsert = SEED_ANNOUNCEMENTS.filter((a) => !existingTitles.has(a.title)).map((a) => ({
    title: a.title,
    content: a.content,
    type: a.type,
    isPinned: a.isPinned,
    isPublished: true,
    publishedAt: new Date(now - (a.daysAgo ?? 0) * DAY),
    expiresAt: a.expiresInDays !== undefined ? new Date(now + a.expiresInDays * DAY) : null,
    // 空数组 = 全端通用(web/rn/miniapp/extension/cli 全部显示)
    platforms: a.platforms ?? [],
  }))
  if (toInsert.length === 0) {
    console.info('[seed] announcements: 全部已存在,跳过(幂等)')
    return
  }
  await db.insert(announcements).values(toInsert)
  console.info(`[seed] announcements: 新增 ${toInsert.length} 条,跳过 ${existingTitles.size} 条已存在`)
}

// 独立执行入口:tsx seed/announcements-seed.ts
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('announcements-seed.ts')) {
  seedAnnouncements()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[announcements] seed 失败:', err)
      process.exit(1)
    })
}
