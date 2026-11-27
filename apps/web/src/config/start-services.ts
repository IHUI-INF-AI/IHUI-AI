// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /start 首屏八卡的单一事实源。
 *
 * 为什么放 config,不写死在页面里:
 * - 文案、排序、落点改一处,页面只负责渲染;
 * - capabilityIds 与能力目录 `packages/shared/src/capabilities/catalog.ts` 的 id 对齐,
 *   避免 UI 叫「多平台发布」、Agent 工具却叫 publish_multi 的两套命名;
 * - agentTool 为 null = 目前只能人工点进去用,Agent 还调不动。
 *   能力目录批次按 capabilityId 逐个登记,登记一个改一个,不提前吹。
 */

export type StartServiceIcon =
  'pen' | 'send' | 'chart' | 'users' | 'book' | 'image' | 'cap' | 'wrench'

export type StartSurface = 'web' | 'agent'

export interface StartService {
  readonly id: string
  readonly capabilityIds: readonly string[]
  readonly title: string
  readonly desc: string
  readonly href: string
  readonly icon: StartServiceIcon
  readonly surfaces: readonly StartSurface[]
  /** 与首条 capability 的 agentTool 一致；null = 主能力还调不动 */
  readonly agentTool: string | null
}

export const START_SERVICES: readonly StartService[] = [
  {
    id: 'content.generate',
    capabilityIds: [
      'content.pipeline',
      'content.generate',
      'content.compliance',
      'content.rewrite',
      'content.title',
      'content.script',
    ],
    title: 'AI 内容生产',
    desc: '一句话出稿、合规自检并落下草稿，人工确认后才发布',
    href: '/ai-generation',
    icon: 'pen',
    surfaces: ['web'],
    agentTool: 'prepare_publish_draft',
  },
  {
    id: 'publish.dispatch',
    capabilityIds: [
      'publish.draft',
      'publish.edit',
      'publish.preflight',
      'publish.task',
      'publish.queue',
      'publish.platforms',
      'publish.dispatch',
      'publish.schedule',
    ],
    title: '多平台发布',
    desc: '先出草稿并预检，人工确认后才分发到已接账号',
    href: '/publish/new',
    icon: 'send',
    surfaces: ['web'],
    agentTool: 'create_publish_draft',
  },
  {
    id: 'publish.analytics',
    capabilityIds: ['publish.analytics'],
    title: '发布数据',
    desc: '回收播放、互动与发布成功率，按平台复盘',
    href: '/publish/analytics',
    icon: 'chart',
    surfaces: ['web'],
    agentTool: 'get_publish_stats',
  },
  {
    id: 'account.pool',
    capabilityIds: ['account.connect', 'account.list', 'account.health', 'account.renew'],
    title: '账号池',
    desc: '统一登录态，掉线自动保活续期',
    href: '/account-pool',
    icon: 'users',
    surfaces: ['web'],
    agentTool: null,
  },
  {
    id: 'knowledge.base',
    capabilityIds: ['knowledge.ingest', 'knowledge.ask', 'knowledge.card'],
    title: '知识库',
    desc: '把资料、课程、历史稿喂给 AI 再回答',
    href: '/knowledge-base',
    icon: 'book',
    surfaces: ['web'],
    agentTool: null,
  },
  {
    id: 'media.generate',
    capabilityIds: ['media.image', 'media.edit', 'media.video'],
    title: '图片与视频',
    desc: '封面、配图、短视频，一处生成',
    href: '/image-gen',
    icon: 'image',
    surfaces: ['web'],
    agentTool: null,
  },
  {
    id: 'edu.tutor',
    capabilityIds: ['edu.lesson', 'edu.practice'],
    title: 'AI 教育',
    desc: '全年龄段课程与练习，家长可看进度',
    href: '/edu-ai',
    icon: 'cap',
    surfaces: ['web'],
    agentTool: null,
  },
  {
    id: 'tools.box',
    capabilityIds: [
      'tool.doc.parse',
      'tool.chart.generate',
      'tool.artifact.create',
      'tool.report.generate',
      'tool.automation.create',
      'tool.web.fetch',
    ],
    title: '工具箱',
    desc: '改写、翻译、提取、格式转换等常用件',
    href: '/tools',
    icon: 'wrench',
    surfaces: ['web'],
    agentTool: 'parse_document',
  },
]

export const START_SERVICE_COUNT = START_SERVICES.length
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
