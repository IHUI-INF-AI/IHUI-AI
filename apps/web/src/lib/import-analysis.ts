// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导入会话 → 拿来分析(D28 补齐层,2026-10-03)
 *
 * 本模块是"消费侧判据",与 `import-analysis-catalog.generated.ts`(库的投影)分工:
 *   - 投影文件 = 库有什么(20 分类 / 210 条,机器生成,勿手改)
 *   - 本文件     = 对**哪个导入来源**默认推荐**哪些场景**、怎么把模板填成可发指令
 *
 * 四件事:
 *   1. `readImportProvenance` — 把 chat_conversations.metadata 里那份
 *      `{importedFrom, importedVia, fileName}`(D28 落库时写入,此前全仓只写不读)读出来,
 *      并在 wechat 来源上追加**发言人清单 + 时间跨度**(从消息正文与时间戳现算,
 *      不依赖解析器额外落库 —— 解析器已定稿,不改)。
 *   2. `WECHAT_RECOMMENDED_SCENARIO_IDS` / `CODE_RECOMMENDED_SCENARIO_IDS` — 来源 → 场景推荐
 *      (纯 id 数组,本模块内不查库,故不需要投影)。
 *      wechat 是**群聊记录**,对"会议纪要 / 待办提取 / 客户复盘 / 承诺追踪"这类
 *      聊天记录类分析真正有用;codex / claude_code / cursor / aider 是**编程会话**,
 *      默认推荐代码审查 / 重构 / 调试类 —— 这正是两个来源族的关键差异。
 *   3. `buildAnalysisPrompt` — 用用户填的 variables 替换模板 `{var}` 占位符,
 *      拼成一条**普通用户消息**,由既有聊天通道发出(不新造 LLM 调用链)。
 *
 * **本模块刻意不 import 投影文件**(只 import 其 `type`):投影含 210 条模板正文
 * ≈493KB,静态 import 会把它拖进每一个引用本模块的 chunk。会话消息区为了显示
 * "来自微信导入"要读 provenance,那条路径**不该**为场景目录付 493KB 的解析与下载代价。
 * 取场景/列分类的出口在 `import-analysis-scenarios.ts`,由"用场景分析"弹窗
 * 动态 import 拉入 —— 只有用户真要点分析时才付这个成本。
 */
import type { ImportAnalysisScenario } from './import-analysis-catalog.generated'

// =============================================================================
// 类型
// =============================================================================

/** 导入来源(与 @ihui/api-client 的 ConversationImportSource 同集) */
export type ImportSource = 'claude_code' | 'codex' | 'cursor' | 'aider' | 'wechat'

/**
 * 会话来源信息(从 metadata 读出,读不出时为 null)
 *
 * `importedVia` 单独保留是因为它区分的是**通道**(`conversation-import` = 网页导入面板,
 * CLI 走 cli-import 通道),而 `importedFrom` 区分的是**被导入的工具**。两者都是
 * D28 落库时写进 metadata 的字段,此前没有任何读取点 —— 本模块是第一个消费方。
 */
export interface ImportProvenance {
  /** 被导入的外部工具 */
  readonly source: ImportSource
  /** 导入通道标识(如 'conversation-import') */
  readonly via: string
  /** 原始导出文件名(commit 时选填,可能为 null) */
  readonly fileName: string | null
  /** wechat 专属:从正文 `昵称：正文` 前缀识别出的发言人(按出现频次降序) */
  readonly speakers: readonly string[]
  /** wechat 专属:首条消息时间(ISO);无有效时间戳为 null */
  readonly startedAt: string | null
  /** wechat 专属:末条消息时间(ISO);无有效时间戳为 null */
  readonly endedAt: string | null
}

/** 会话详情/消息区读到的来源判定结果 */
export type ImportProvenanceResult =
  { readonly kind: 'none' } | { readonly kind: 'imported'; readonly provenance: ImportProvenance }

// =============================================================================
// 常量
// =============================================================================

/** 来源枚举守卫(与 api 侧 z.enum 同集;运行时校验,不信任 DB 里的任意字符串) */
function isImportSource(v: unknown): v is ImportSource {
  return v === 'claude_code' || v === 'codex' || v === 'cursor' || v === 'aider' || v === 'wechat'
}

/**
 * 微信正文里的发言人前缀:`昵称：正文`(全角冒号,解析器 wechat.py 写死全角)。
 *
 * 判据收紧为「首个全角冒号前 1..24 字、无换行、无冒号」—— 昵称不该很长,
 * 也不该含冒号;不收紧会把"注意:明天上线"这类正文误判成"发言人叫 注意"。
 */
const SPEAKER_PREFIX_RE = /^([^：\n]{1,24})：/

/** wechat 默认推荐场景(库内 id)。
 *
 *  逐条理由(全部取自库自身 title/use_case,不是自造场景):
 *   - `062` 知识笔记整理 —— 把一段原始信息整理成结构化笔记(会议纪要/摘要的正形)
 *   - `058` 任务优先级决策 —— 从一堆任务里排优先级(待办提取的正形)
 *   - `163` 项目复盘方案 —— 回顾/评估/分析/总结/行动(复盘的正形)
 *   - `088` 投诉处理话术 —— 倾听/共情/道歉/解决(客户投诉与情绪复盘的正形)
 *   - `166` 项目沟通方案 —— 干系人/信息/方式/计划(承诺与沟通追踪的正形)
 *
 *  ⚠️ 这 5 条**不覆盖**"从群聊里逐条抽取承诺"这种纯转录类需求 —— 库里没有那条
 *  prompt(全库 grep 关键词无命中)。用户可用下面任一入口自行组合:场景下拉可切到
 *  全部 210 条,或直接手打补充要求。
 */
export const WECHAT_RECOMMENDED_SCENARIO_IDS: readonly string[] = [
  '062',
  '058',
  '163',
  '088',
  '166',
]

/**
 * 编程会话来源默认推荐场景(库内 id)
 *
 *  - `001` 深度代码审查 / `002` 代码重构方案 / `003` 智能调试助手 —— 编程会话的
 *    三个高频诉求,且这三条模板都含 `{code}` 变量,填入导入会话的代码正文即可
 */
export const CODE_RECOMMENDED_SCENARIO_IDS: readonly string[] = ['001', '002', '003']

/** 未识别来源时的兜底推荐(不猜来源的具体族,给通用知识整理) */
export const FALLBACK_RECOMMENDED_SCENARIO_IDS: readonly string[] = ['062']

// =============================================================================
// 来源读取
// =============================================================================

/**
 * 极简时间戳归一(ISO 串与毫秒数都收,其他一律 null)。
 *
 * 刻意**不用** `new Date(x)` 宽松解析:那会让 "昨天"/"2026" 之类也被当成有效时间,
 * 而导入消息的 createdAt 来自客户端自由文本(api 侧 parseTimestamp 兜底回退导入时刻),
 * 宽松解析出的"时间跨度"是假的,展示假时间比不展示更糟(诚实性红线)。
 *
 * 收 number 是因为 web store 的 ChatMessage.createdAt 是毫秒数(见 stores/chat.ts),
 * 而 api-client 的 ConversationMessage.createdAt 是 ISO 串 —— 两个来源都得读。
 */
function parseTimestampOrNull(raw: unknown): string | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? new Date(raw).toISOString() : null
  }
  if (typeof raw !== 'string' || raw.trim() === '') return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return null
  const t = Date.parse(raw)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

/** 读来源时只需要消息的正文与时间;web store / api-client 两种消息形态都能喂进来 */
export interface ImportProvenanceMessage {
  readonly content: string
  /** ISO 串或毫秒数;缺失/非法时该条不参与时间跨度 */
  readonly createdAt?: string | number
}

/**
 * 从消息正文识别发言人(仅 wechat 来源调用)。
 *
 * 逐条独立解析而不是"第一条命中就认全文同源":一个 TXT 可能混入系统消息
 * (`你撤回了一条消息` 会被并进上一条正文,见 wechat.py 已知行为),
 * 逐条解析天然把那种行排除在外(它没有 `：` 前缀或前缀形态不符)。
 *
 * @returns 发言人(按出现次数降序、同次数按首次出现次序)
 */
function collectSpeakers(messages: readonly ImportProvenanceMessage[]): {
  speakers: string[]
  startedAt: string | null
  endedAt: string | null
} {
  const counts = new Map<string, number>()
  const firstSeenAt = new Map<string, number>()
  let minTime: number | null = null
  let maxTime: number | null = null

  messages.forEach((m, i) => {
    const match = SPEAKER_PREFIX_RE.exec(m.content)
    if (match?.[1]) {
      const name = match[1].trim()
      if (name !== '') {
        counts.set(name, (counts.get(name) ?? 0) + 1)
        if (!firstSeenAt.has(name)) firstSeenAt.set(name, i)
      }
    }
    const ts = parseTimestampOrNull(m.createdAt)
    if (ts !== null) {
      const t = Date.parse(ts)
      if (minTime === null || t < minTime) minTime = t
      if (maxTime === null || t > maxTime) maxTime = t
    }
  })

  const speakers = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (firstSeenAt.get(a[0]) ?? 0) - (firstSeenAt.get(b[0]) ?? 0))
    .map(([name]) => name)

  return {
    speakers,
    startedAt: minTime === null ? null : new Date(minTime).toISOString(),
    endedAt: maxTime === null ? null : new Date(maxTime).toISOString(),
  }
}

/**
 * 读出会话的导入来源信息。
 *
 * @param metadata chat_conversations.metadata(api-client 的 ConversationDetail.metadata 是 unknown)
 * @param messages 当前会话已加载的消息(仅 wechat 来源用于算发言人/时间跨度;其余来源忽略)
 *
 * 读不出时返回 `{kind:'none'}` —— 调用方据此**不渲染**任何来源标识,
 * 绝不用"未知来源"之类的猜测文案冒充(导入会话与自建会话必须一眼可分)。
 */
export function readImportProvenance(
  metadata: unknown,
  messages: readonly ImportProvenanceMessage[] = [],
): ImportProvenanceResult {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { kind: 'none' }
  }
  const meta = metadata as Record<string, unknown>
  const rawFrom = meta.importedFrom
  const rawVia = meta.importedVia
  // importedFrom 是判据;via 只是补充说明。via 缺失但 from 在(极老数据/手工改库)不算导入,
  // 因为无法区分是哪条通道 —— 那时宁可不显示来源,也不要显示一个来路不明的通道名。
  if (!isImportSource(rawFrom) || typeof rawVia !== 'string' || rawVia === '') {
    return { kind: 'none' }
  }
  const fileName = typeof meta.fileName === 'string' && meta.fileName !== '' ? meta.fileName : null
  const { speakers, startedAt, endedAt } =
    rawFrom === 'wechat'
      ? collectSpeakers(messages)
      : { speakers: [], startedAt: null, endedAt: null }
  return {
    kind: 'imported',
    provenance: { source: rawFrom, via: rawVia, fileName, speakers, startedAt, endedAt },
  }
}

// =============================================================================
// Prompt 拼装
// =============================================================================

/**
 * 用用户填的 variables 替换模板里的 `{var}` 占位符。
 *
 * 规则:
 *  - 填了值 → 替换为该值(trim 后非空才算"填了")
 *  - 未填/填空白 → 替换为占位提示 `（待补充：<var>）`,**不删占位符**。
 *    删掉的话模型会以为那条要求不存在,静默漏掉一条用户本想分析的内容;
 *    留着可见的待补充标记,模型会主动追问或明确标注该条为空 —— 宁可啰嗦也不静默丢弃。
 *  - 模板里出现但 variables 清单没列的占位符:同样按"未填"处理(不猜)。
 */
export function fillTemplate(
  template: string,
  variables: Readonly<Record<string, string>>,
  pendingPlaceholder: (varName: string) => string,
): string {
  return template.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_match, name: string) => {
    const v = variables[name]
    return v !== undefined && v.trim() !== '' ? v.trim() : pendingPlaceholder(name)
  })
}

/** 分析指令的固定前缀/后缀(不含正文;正文由 buildAnalysisPrompt 拼) */
const ANALYSIS_HEADER = '【导入会话 · 场景分析】'
const ANALYSIS_TRANSCRIPT_HINT =
  '以上是本次导入的会话记录全文。请基于该记录的真实内容进行分析，' +
  '在记录中确实不存在的信息（人名、数字、日期、承诺）一律标注为「记录中未提及」，不要推测或编造。'

/**
 * 拼出要作为**用户消息**发出的分析指令。
 *
 * 走既有聊天通道(与 AI 面板的输入框同一出口),因此历史里的导入消息就是本轮上下文 ——
 * 不另建 LLM 调用链,也不把正文重贴一遍(重贴会让长会话双倍计费/超上下文)。
 *
 * @param scenario 选中的库场景
 * @param variables 用户填的变量值(键为库的 variables 条目)
 * @param pendingPlaceholder 未填变量的占位提示(由调用方给 i18n 文案)
 */
export function buildAnalysisPrompt(
  scenario: ImportAnalysisScenario,
  variables: Readonly<Record<string, string>>,
  pendingPlaceholder: (varName: string) => string,
): string {
  const body = fillTemplate(scenario.template, variables, pendingPlaceholder)
  const missing = scenario.variables.filter((v) => !variables[v] || variables[v]!.trim() === '')
  const tail =
    missing.length > 0
      ? `\n\n（本次未填写的变量：${missing.map(pendingPlaceholder).join('、')} —— 请在输出中明确说明这部分缺少依据。）`
      : ''
  return [
    ANALYSIS_HEADER,
    `场景：${scenario.title}（${scenario.useCase || scenario.description}）`,
    ANALYSIS_TRANSCRIPT_HINT,
    '',
    '按以下要求输出：',
    '',
    body,
    tail,
  ].join('\n')
}

// =============================================================================
// 展示格式化
// =============================================================================

/** 来源 → 短标签的兜底映射表(catalog key,由 i18n 层消费;此处只给不可枚举的兜底) */
export const IMPORT_SOURCE_FALLBACK_LABEL: Record<ImportSource, string> = {
  claude_code: 'Claude Code',
  codex: 'Codex CLI',
  cursor: 'Cursor',
  aider: 'Aider',
  wechat: '微信',
}

/**
 * 发言人清单的展示串(超过 limit 个只显示前 limit 个 + 余量)。
 * 微信群常有几十上百人,全列出来会把来源条撑爆并挤掉真正的文件名/时间。
 */
export function formatSpeakerList(speakers: readonly string[], limit = 5): string {
  if (speakers.length === 0) return ''
  if (speakers.length <= limit) return speakers.join('、')
  return `${speakers.slice(0, limit).join('、')} +${speakers.length - limit}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
