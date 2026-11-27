// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力意图路由 v1（2026-11-28）。
 *
 * 背景：/start 首屏原来只有八张卡，用户仍要“挑功能”。超级入口的最低要求是
 * 用户说一句人话，系统自己选能力并落到结果页。本模块是这件事的纯函数内核：
 * 输入一句自然语言，输出能力目录里的 id + 分数 + 命中词；不联网、不调模型。
 *
 * 为什么先做确定性路由，而不是直接上 LLM：
 * - 可单测、可解释、零延迟、零成本；模型只在“没命中”时兜底（走对话面板）；
 * - 规则表与能力目录 id 一一对齐，写错 id 由测试直接红；
 * - 以后接 LLM 时，这份规则表仍是最好的 few-shot 示例与回归基线。
 *
 * 刻意不做什么：
 * - 不做同义词向量召回（那是 embedding 的活，本模块只做字面命中）；
 * - 不做权限与配额判定（能力是否可用仍由 capability gate / 服务端裁决）；
 * - 不返回“页面标题”，只返回能力对象，避免 UI 与能力目录两套命名。
 */

import { getCapability, type Capability } from './catalog'

export interface CapabilityIntentRule {
  readonly capabilityId: string
  readonly keywords: readonly string[]
  /** 命中即扣分：防止“写代码”被当成“写出稿”这类字面误伤 */
  readonly avoid?: readonly string[]
  /** 同分时的优先级；只在同分生效，不改变主分排序 */
  readonly weight?: number
}

/**
 * 规则表：每条 capabilityId 必须真实存在于能力目录（测试会逐条核对）。
 * 中文按“连续片段”命中，不做分词；因此宁可写长词，不写单字。
 */
export const CAPABILITY_INTENT_RULES: readonly CapabilityIntentRule[] = [
  {
    capabilityId: 'content.generate',
    keywords: [
      '写文章',
      '写稿',
      '写文案',
      '文案',
      '出稿',
      '公众号文章',
      '小红书笔记',
      '写笔记',
      '创作',
      '写作',
      '写一篇',
      '写个',
      'write a post',
      'write',
      'copywriting',
    ],
    avoid: ['代码', '程序', '接口', 'bug', '编译', '函数'],
  },
  {
    capabilityId: 'content.pipeline',
    keywords: ['一句话', '一条龙', '全流程', '从头到尾', '生成草稿', '直接出稿', '一键出稿'],
    weight: 2,
  },
  {
    capabilityId: 'content.compliance',
    keywords: [
      '合规',
      '违规',
      '敏感词',
      '内容审核',
      '审核一下',
      '风险检查',
      '能不能发',
      '合规自检',
    ],
  },
  {
    capabilityId: 'content.rewrite',
    keywords: ['改写', '重写', '换个说法', '改一版', '润色', '适配平台'],
  },
  {
    capabilityId: 'content.title',
    keywords: ['标题', '取标题', '话题词', '标签', 'hashtag', 'tag'],
    weight: 2,
  },
  {
    capabilityId: 'content.script',
    keywords: ['口播', '口播稿', '短视频脚本', '脚本', '分镜', '直播话术'],
    avoid: ['代码', '程序', '接口'],
  },
  {
    capabilityId: 'content.translate',
    keywords: ['翻译', '译成', '英文', '日文', '韩文', '多语言', 'translate'],
  },
  {
    capabilityId: 'publish.preflight',
    keywords: ['预检', '发布前检查', '能不能发布', '发布检查', '发布预检'],
    weight: 2,
  },
  {
    capabilityId: 'publish.dispatch',
    keywords: [
      '发布',
      '发到',
      '分发',
      '同步到',
      '同步',
      '上传',
      '一键发布',
      '多平台发布',
      '发一条',
      '发出去',
      'publish',
      'distribute',
    ],
  },
  {
    capabilityId: 'publish.schedule',
    keywords: ['定时', '预约', '排期', '定时发布', '几点发', '明天发'],
  },
  {
    capabilityId: 'publish.draft',
    keywords: ['草稿', '存草稿', '保存草稿'],
    weight: 1,
  },
  {
    capabilityId: 'publish.edit',
    keywords: ['编辑草稿', '改稿', '修改草稿', '改一下稿'],
  },
  {
    capabilityId: 'publish.queue',
    keywords: ['队列', '任务队列', '排队', '待发布'],
  },
  {
    capabilityId: 'publish.platforms',
    keywords: ['支持哪些平台', '平台清单', '渠道清单', '能发哪些平台', '平台能力'],
  },
  {
    capabilityId: 'publish.analytics',
    keywords: [
      '数据',
      '播放量',
      '阅读量',
      '涨粉',
      '粉丝增长',
      '复盘',
      '统计',
      '效果',
      '文章数据',
      '发布数据',
      '数据分析',
      '数据看板',
      'analytics',
      'stats',
    ],
  },
  {
    capabilityId: 'publish.review',
    keywords: ['复盘报告', '发布复盘', '效果复盘', '周报分析'],
  },
  {
    capabilityId: 'publish.task',
    keywords: ['任务详情', '发布失败', '发布结果', '重试', '失败重试'],
  },
  {
    capabilityId: 'account.connect',
    keywords: ['绑定账号', '接入账号', '添加账号', '扫码登录', '授权账号'],
  },
  {
    capabilityId: 'account.list',
    keywords: ['我的账号', '账号清单', '账号池', '账号矩阵', '有哪些账号', '账号'],
  },
  {
    capabilityId: 'account.health',
    keywords: [
      '掉线',
      '账号掉线',
      '账号失效',
      '账号异常',
      '登录态',
      '登录失效',
      '登录态失效',
      '体检',
      '失效',
      '检测账号',
      '账号健康',
    ],
  },
  {
    capabilityId: 'account.renew',
    keywords: ['保活', '续期', '自动登录', '保持登录', '续登'],
  },
  {
    capabilityId: 'media.image',
    keywords: [
      '配图',
      '封面图',
      '封面',
      '生成图',
      '画一张',
      '海报',
      '图片',
      '插图',
      'cover',
      'image',
    ],
  },
  {
    capabilityId: 'media.edit',
    keywords: ['修图', '改图', '去背景', '换背景', '抠图', '图片编辑', '调整图片'],
  },
  {
    capabilityId: 'media.video',
    keywords: ['视频', '短视频', '剪辑', '合成视频', '数字人', '视频生成'],
  },
  {
    capabilityId: 'knowledge.ingest',
    keywords: ['资料入库', '入库', '上传资料', '导入文档', '喂资料', '知识入库'],
  },
  {
    capabilityId: 'knowledge.ask',
    keywords: ['知识库', '问资料', '查资料', '根据文档回答', '知识问答', 'rag'],
  },
  {
    capabilityId: 'knowledge.card',
    keywords: ['知识卡', '提炼', '摘要卡', '卡片提炼'],
  },
  {
    capabilityId: 'knowledge.export',
    keywords: ['导出知识', '导出资料', '知识导出'],
  },
  {
    capabilityId: 'edu.lesson',
    keywords: ['课程', '教案', '备课', '讲课', '课件'],
  },
  {
    capabilityId: 'edu.practice',
    keywords: ['练习', '出题', '批改', '作业', '刷题'],
  },
  {
    capabilityId: 'edu.report',
    keywords: ['学情', '学习报告', '成绩分析', '学习情况'],
  },
  {
    capabilityId: 'edu.parent',
    keywords: ['家长', '家长端', '家长看进度'],
  },
  {
    capabilityId: 'tool.doc.parse',
    keywords: ['解析文档', '读pdf', 'pdf', '提取正文', 'ocr', '文档解析'],
  },
  {
    capabilityId: 'tool.chart.generate',
    keywords: ['图表', '柱状图', '折线图', '饼图', '可视化', 'chart'],
  },
  {
    capabilityId: 'tool.report.generate',
    keywords: ['报表', '周报', '月报', '报告生成', '生成报告'],
  },
  {
    capabilityId: 'tool.artifact.create',
    keywords: ['交付物', '生成文件', 'ppt', 'excel', 'word', '生成ppt'],
  },
  {
    capabilityId: 'tool.automation.create',
    keywords: ['自动化', '定时任务', '工作流', '机器人', 'automation'],
  },
  {
    capabilityId: 'tool.web.fetch',
    keywords: ['网页', '抓取', '读取网页', '爬', '网页内容', '链接内容', 'fetch'],
  },
]

/** /start 首屏的默认四张“能力票”：优先选真实能跑通的（agent-ready 或有页面）。 */
export const START_SUGGESTION_CAPABILITY_IDS: readonly string[] = [
  'content.pipeline',
  'publish.dispatch',
  'publish.analytics',
  'media.image',
]

const RULE_BY_ID = new Map(CAPABILITY_INTENT_RULES.map((rule) => [rule.capabilityId, rule]))
const RESOLVE_MIN_SCORE = 6
const CANDIDATE_MIN_SCORE = 4
const DEFAULT_MARGIN = 3
const CJK_PATTERN = /[\u3400-\u9fff]/

/** 归一化：NFKC + 小写 + 标点空白压成单空格，避免“，发布！”漏命中。 */
export function normalizeCapabilityIntentText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
    .trim()
}

export interface CapabilityIntentMatch {
  readonly capability: Capability
  readonly score: number
  /** 命中的原始关键词（含“标题:xxx”这种派生命中），用于解释与排障 */
  readonly matched: readonly string[]
}

export type CapabilityIntentKind = 'empty' | 'resolved' | 'ambiguous' | 'agent'

export interface CapabilityIntentResolution {
  readonly kind: CapabilityIntentKind
  readonly query: string
  readonly best: CapabilityIntentMatch | null
  /** 按分数从高到低；ambiguous 时最多 3 条，resolved 时最多 4 条 */
  readonly matches: readonly CapabilityIntentMatch[]
}

export interface CapabilityIntentOptions {
  readonly margin?: number
  readonly limit?: number
}

function keywordScore(keyword: string): number {
  const isCjk = CJK_PATTERN.test(keyword)
  if (isCjk) {
    // 单字（“写/图/发”）只给 2 分，宁可漏判也不抢判；两字起按长度线性加分。
    return keyword.length >= 2 ? keyword.length * 3 : 2
  }
  // 英文按字母长度，封顶 8 个字母，避免长句整段命中时权重失真。
  return Math.min(keyword.length, 8) * 2
}

function scoreRule(
  rule: CapabilityIntentRule,
  capability: Capability,
  normalized: string,
): { score: number; matched: string[] } {
  let score = 0
  const matched: string[] = []

  for (const rawKeyword of rule.keywords) {
    const keyword = normalizeCapabilityIntentText(rawKeyword)
    if (!keyword || !normalized.includes(keyword)) continue
    score += keywordScore(keyword) + (keyword.length >= 4 ? 2 : 0)
    matched.push(rawKeyword)
  }

  const title = normalizeCapabilityIntentText(capability.title)
  if (title && normalized.includes(title)) {
    score += 8
    matched.push(`标题:${capability.title}`)
  }

  for (const rawAvoid of rule.avoid ?? []) {
    const avoid = normalizeCapabilityIntentText(rawAvoid)
    if (avoid && normalized.includes(avoid)) score -= 8
  }

  // 权重只在“已经命中”时生效：否则每条带权重的规则都会给所有查询送 1-2 分，
  // 阈值就形同虚设（2026-11-28 首跑单测抓到：无关句子也能拿到 2 分）。
  if (score > 0) score += rule.weight ?? 0
  return { score, matched }
}

function resolveOrder(a: CapabilityIntentMatch, b: CapabilityIntentMatch): number {
  if (b.score !== a.score) return b.score - a.score
  const weightA = RULE_BY_ID.get(a.capability.id)?.weight ?? 0
  const weightB = RULE_BY_ID.get(b.capability.id)?.weight ?? 0
  if (weightB !== weightA) return weightB - weightA
  const readyA = a.capability.status === 'agent-ready' ? 1 : 0
  const readyB = b.capability.status === 'agent-ready' ? 1 : 0
  if (readyB !== readyA) return readyB - readyA
  return a.capability.id.localeCompare(b.capability.id)
}

/** 只做打分与排序，不判 kind；给测试与调试面板复用。 */
export function rankCapabilityIntents(query: string): CapabilityIntentMatch[] {
  const normalized = normalizeCapabilityIntentText(query)
  if (!normalized) return []

  const matches: CapabilityIntentMatch[] = []
  for (const rule of CAPABILITY_INTENT_RULES) {
    const capability = getCapability(rule.capabilityId)
    if (!capability) continue
    const { score, matched } = scoreRule(rule, capability, normalized)
    if (score <= 0) continue
    matches.push({ capability, score, matched })
  }
  return matches.sort(resolveOrder)
}

/**
 * 一句话 → 能力。
 * - resolved：分数够且领先第二名 >= margin，UI 可直接跳；
 * - ambiguous：有候选但拉不开差距，UI 给 3 个按钮让用户点；
 * - agent：完全不认识，交给对话面板（把原话原样发出去，不吞输入）。
 */
export function resolveCapabilityIntent(
  query: string,
  options: CapabilityIntentOptions = {},
): CapabilityIntentResolution {
  const trimmed = query.trim()
  if (!trimmed) return { kind: 'empty', query: '', best: null, matches: [] }

  const margin = options.margin ?? DEFAULT_MARGIN
  const limit = options.limit ?? 4
  const ranked = rankCapabilityIntents(trimmed)
  const best = ranked[0] ?? null

  if (!best || best.score < CANDIDATE_MIN_SCORE) {
    return { kind: 'agent', query: trimmed, best: null, matches: [] }
  }

  const second = ranked[1]
  const lead = best.score - (second?.score ?? 0)
  const matches = ranked.slice(0, limit)

  if (best.score >= RESOLVE_MIN_SCORE && lead >= margin) {
    return { kind: 'resolved', query: trimmed, best, matches }
  }
  return {
    kind: 'ambiguous',
    query: trimmed,
    best,
    matches: ranked.slice(0, Math.min(3, limit)),
  }
}

/**
 * 落点 URL：统一带 `q=` 把原话种子传给目标页；不读 q 的页面会忽略，不报错。
 * 返回 null 表示该能力没有页面落点（例如 planned 的导出能力），UI 应回落到对话。
 */
export function buildCapabilityLaunchHref(
  match: CapabilityIntentMatch,
  query: string,
): string | null {
  const href = match.capability.uiHref
  if (!href) return null
  const seed = query.trim()
  if (!seed) return href
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}q=${encodeURIComponent(seed)}`
}

/** 首屏默认票对应的能力对象；缺 id 时跳过，不返回 undefined 占位。 */
export function listStartSuggestionCapabilities(): Capability[] {
  const out: Capability[] = []
  for (const id of START_SUGGESTION_CAPABILITY_IDS) {
    const capability = getCapability(id)
    if (capability) out.push(capability)
  }
  return out
}
