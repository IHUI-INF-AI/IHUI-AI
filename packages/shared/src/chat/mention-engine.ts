// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 多维提及统一引擎 —— 纯逻辑层(不取数、不依赖 React / i18n / 图标)。
//
// V3 第 61 票(2026-09-27 立)。此前 `@` 与 `#` 是**两套半死的引擎**:
//  - `@`:trigger 解析写在 `apps/web/src/components/chat/message-input.tsx` 的 handleChange 里
//        (`next.endsWith('@')` + `/@[\w./-]*$/` 两条裸正则),选中只插反引号路径,
//        多维检索 hook `useSearchMentions` 与 store 的 `addMention` **全仓零调用方**,
//        于是 `MentionChips` 读的 `mentions` 永远是空数组、第 33 行的早退恒成立。
//  - `#`:trigger 解析写在 `apps/web/src/hooks/use-context-selector.ts` 的 extractHashQuery 里,
//        九类目表 CONTEXT_SELECTOR_CATEGORIES 自持一份,选中 chip 存在 message-input 的局部 state。
// 「是哪几个维度」与「trigger 怎么解」因此各写了一遍 —— 这正是本仓反复记录的漂移成因
// (见 AGENTS §"两处算同一件事必须共用一份实现")。
//
// 本文件是这两件事的**唯一**归宿:
//  - `MENTION_DIMENSIONS` 一张表列出全部维度(`@` 五类 + `#` 九类),维度 id 封闭;
//  - `parseMentionTrigger` 一个函数解 trigger,两个 sigil 同走一遍;
//  - `replaceTrailingTrigger` / `removeMentionInsert` 一个插入/移除出口;
//  - `MentionSelection` 是 store 里唯一那份状态的元素类型。
// 渲染端只允许消费这里的出口,禁止在组件里再写一份 trigger 正则或再抄一份维度表
// (常驻对账:`scripts/check-mention-engine-wired.mjs` 的 W2/W3 判据)。
//
// 口径纪律:本文件不放图标、不放色值、不放用户可见文案 —— 只放 i18n **键名**。
// 平台侧(web / 未来的其它端)用自己的 adapter 把 dimensionId 映射到图标与颜色。

import type { ContextMention, MentionType } from '@ihui/types'

/** 两个触发符。`@` = 多维上下文检索;`#` = 静态语义类目。 */
export const MENTION_SIGILS = ['@', '#'] as const
export type MentionSigil = (typeof MENTION_SIGILS)[number]

export function isMentionSigil(v: unknown): v is MentionSigil {
  return typeof v === 'string' && (MENTION_SIGILS as readonly string[]).includes(v)
}

/**
 * 候选从哪来:
 *  - `workspace-files` 用端内已有的工作区文件列表(`useMentionFiles`),不打网络;
 *  - `context-search`  走 `useSearchMentions` → GET /api/context/mentions?type=…;
 *  - `static-category` 表内固定项,选中即插入 token,无候选检索。
 */
export type MentionCandidateSource = 'workspace-files' | 'context-search' | 'static-category'

/** 一个提及维度(`@` 侧 5 条 + `#` 侧 9 条 = 14 条,封闭集) */
export interface MentionDimension {
  /** 稳定 id:`at:<类>` / `hash:<类>`。图标 adapter、埋点、测试都锚它,不得改拼写。 */
  id: string
  sigil: MentionSigil
  /** 该维度的 `#` token(`@` 侧为空串 —— 它插入的是候选自带的 insertText) */
  token: string
  /** i18n 取词位置(键名,不是文案;含点键须按真实嵌套路径写) */
  labelNs: string
  labelKey: string
  /** 副位说明的键(可选:`@` 侧的检索类维度没有静态说明) */
  descKey?: string
  candidateSource: MentionCandidateSource
  /** `@` 侧维度对应的后端检索类型;`#` 侧为 undefined */
  mentionType?: MentionType
}

/**
 * 一张表就是「是哪几个维度」的唯一答案。
 * 顺序即面板分组顺序(用例与截图锚它,不得随意调换)。
 */
export const MENTION_DIMENSIONS: readonly MentionDimension[] = [
  // ── @ 多维上下文检索(五类,与 GET /api/context/mentions 的 type 枚举一一对应) ──
  {
    id: 'at-file',
    sigil: '@',
    token: '',
    labelNs: 'chat',
    labelKey: 'mentionEngine.tabFile',
    candidateSource: 'workspace-files',
    mentionType: 'file',
  },
  {
    id: 'at-folder',
    sigil: '@',
    token: '',
    labelNs: 'chat',
    labelKey: 'mentionEngine.tabFolder',
    candidateSource: 'context-search',
    mentionType: 'folder',
  },
  {
    id: 'at-symbol',
    sigil: '@',
    token: '',
    labelNs: 'chat',
    labelKey: 'mentionEngine.tabSymbol',
    candidateSource: 'context-search',
    mentionType: 'symbol',
  },
  {
    id: 'at-database',
    sigil: '@',
    token: '',
    labelNs: 'chat',
    labelKey: 'mentionEngine.tabDatabase',
    candidateSource: 'context-search',
    mentionType: 'database',
  },
  {
    id: 'at-web',
    sigil: '@',
    token: '',
    labelNs: 'chat',
    labelKey: 'mentionEngine.tabWeb',
    candidateSource: 'context-search',
    mentionType: 'web',
  },
  // ── # 九类语义源(原 CONTEXT_SELECTOR_CATEGORIES 搬进本表,token 逐字不变) ──
  {
    id: 'hash-file',
    sigil: '#',
    token: '#File',
    labelNs: 'contextSelector',
    labelKey: 'kindFile',
    descKey: 'descFile',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-folder',
    sigil: '#',
    token: '#Folder',
    labelNs: 'contextSelector',
    labelKey: 'kindFolder',
    descKey: 'descFolder',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-code',
    sigil: '#',
    token: '#Code',
    labelNs: 'contextSelector',
    labelKey: 'kindCode',
    descKey: 'descCode',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-problems',
    sigil: '#',
    token: '#Problems',
    labelNs: 'contextSelector',
    labelKey: 'kindProblems',
    descKey: 'descProblems',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-terminal',
    sigil: '#',
    token: '#Terminal',
    labelNs: 'contextSelector',
    labelKey: 'kindTerminal',
    descKey: 'descTerminal',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-web',
    sigil: '#',
    token: '#Web',
    labelNs: 'contextSelector',
    labelKey: 'kindWeb',
    descKey: 'descWeb',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-doc',
    sigil: '#',
    token: '#Doc',
    labelNs: 'contextSelector',
    labelKey: 'kindDoc',
    descKey: 'descDoc',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-pastChats',
    sigil: '#',
    token: '#PastChats',
    labelNs: 'contextSelector',
    labelKey: 'kindPastChats',
    descKey: 'descPastChats',
    candidateSource: 'static-category',
  },
  {
    id: 'hash-rule',
    sigil: '#',
    token: '#Rule',
    labelNs: 'contextSelector',
    labelKey: 'kindRule',
    descKey: 'descRule',
    candidateSource: 'static-category',
  },
] as const

/** 表自身的自证:两条同形判据都由这张表推导,所以它不能有空洞 */
export function findDimension(id: string): MentionDimension | undefined {
  return MENTION_DIMENSIONS.find((d) => d.id === id)
}

export function dimensionsForSigil(sigil: MentionSigil): MentionDimension[] {
  return MENTION_DIMENSIONS.filter((d) => d.sigil === sigil)
}

// ============================================================================
// trigger 解析 —— 全仓唯一一份
// ============================================================================

/** 一个正在生效的触发态:sigil + 已输入的过滤词 + 是否「光杆」(sigil 后什么都没有) */
export interface MentionTrigger {
  sigil: MentionSigil
  query: string
  /** 输入以 sigil 本身结尾(`@` 侧的历史语义:只有光杆 @ 才打开浮层) */
  bare: boolean
  /** sigil 在 value 中的下标(替换/删除时按它切,不用二次正则以免吃掉前导空白) */
  start: number
}

/** `#` 触发:行首或空白后的 `#` + 非空白非 # 词,且落在结尾 */
const HASH_TRIGGER_RE = /(?:^|\s)#([^\s#]*)$/
/** `@` 触发:结尾的 `@` + 词字符/./_/ - (不要求前导空白 —— 保持 61 票之前的既有行为) */
const AT_TRIGGER_RE = /@([\w./-]*)$/

/**
 * 从输入值解析当前触发态;非触发态返回 null。
 * 两个 sigil 各一条正则,但**判据只在这里**,调用方不得再抄一份。
 * 先判 `#` 后判 `@`:两条正则都锚定结尾,同一次输入最多命中一条(交叉形态如 `a#b`
 * 两条都不命中),所以顺序不改变结论,只为可读性固定。
 */
export function parseMentionTrigger(value: string): MentionTrigger | null {
  if (!value) return null
  const hash = HASH_TRIGGER_RE.exec(value)
  if (hash) {
    const whole = hash[0] ?? ''
    const inner = hash[1] ?? ''
    return {
      sigil: '#',
      query: inner,
      bare: inner.length === 0,
      start: hash.index + (whole.startsWith('#') ? 0 : 1),
    }
  }
  const at = AT_TRIGGER_RE.exec(value)
  if (at) {
    const inner = at[1] ?? ''
    return {
      sigil: '@',
      query: inner,
      bare: inner.length === 0,
      start: at.index,
    }
  }
  return null
}

/** 该 sigil 当前是否处于触发态(浮层的开/关一律由它判,不在组件里写正则) */
export function isTriggerActive(value: string, sigil: MentionSigil): boolean {
  return parseMentionTrigger(value)?.sigil === sigil
}

// ============================================================================
// 插入 / 移除 —— 全仓唯一一份
// ============================================================================

/**
 * 用 replacement 顶掉结尾的触发段(`@` 含其词字符,`#` 含其词字符)。
 * 非触发态原样返回 —— 调用方拿到的值可预测,不静默改正文。
 */
export function replaceTrailingTrigger(
  value: string,
  sigil: MentionSigil,
  replacement: string,
): string {
  const trigger = parseMentionTrigger(value)
  if (!trigger || trigger.sigil !== sigil) return value
  return value.slice(0, trigger.start) + replacement
}

/**
 * 把一条已选提及的插入文本从正文里摘掉(点 chip 上的 × 时同步删正文)。
 * 先摘「带尾空格」那份,再摘裸的那份 —— 与 61 票之前 `#` 侧的行为逐字一致。
 */
export function removeMentionInsert(value: string, insertText: string): string {
  if (!insertText) return value
  return value.split(`${insertText} `).join('').split(insertText).join('')
}

// ============================================================================
// 唯一那份状态:MentionSelection
// ============================================================================

/**
 * 一条已选提及。`@` 与 `#` 共用这一个形态 —— 这是「两条路归一」的落点:
 * 之前 `#` 的选择存在 message-input 的局部 state,`@` 的选择存在 store 但没人写,
 * 现在两者都进 store 的同一份 selections 数组,由同一个 MentionChips 渲染。
 */
export interface MentionSelection {
  /** store 去重键:`<dimensionId>:<来源 id>` */
  id: string
  sigil: MentionSigil
  /** 必须是 MENTION_DIMENSIONS 里的 id(封闭集) */
  dimensionId: string
  /** 展示名(来自数据本身,不经 i18n) */
  label: string
  /** 副位说明(路径 / 列摘要 / 类目说明键解出的文案) */
  detail?: string
  /** 真正进消息正文的片段 */
  insertText: string
}

/** 由后端统一检索的候选构造(`@` 侧;insertText 优先用后端给的,回落到反引号路径) */
export function selectionFromSearchMention(
  dim: MentionDimension,
  mention: ContextMention,
): MentionSelection {
  const insertText =
    mention.insertText || (mention.meta?.path ? `\`${mention.meta.path}\`` : `\`${mention.label}\``)
  return {
    id: `${dim.id}:${mention.id}`,
    sigil: dim.sigil,
    dimensionId: dim.id,
    label: mention.label,
    ...(mention.detail ? { detail: mention.detail } : {}),
    insertText,
  }
}

/** 由静态类目构造(`#` 侧;插入 token + 一个尾空格,与既有形态逐字一致) */
export function selectionFromDimension(
  dim: MentionDimension,
  opts: { detail?: string } = {},
): MentionSelection {
  return {
    id: `${dim.id}:${dim.token}`,
    sigil: dim.sigil,
    dimensionId: dim.id,
    label: dim.token,
    ...(opts.detail ? { detail: opts.detail } : {}),
    insertText: dim.token,
  }
}

/**
 * 归一 store:同 id 覆盖、异 id 追加。
 * 纯函数(store 与测试共用同一份,禁止第二份实现)。
 */
export function withSelection(
  current: readonly MentionSelection[],
  next: MentionSelection,
): MentionSelection[] {
  if (current.some((m) => m.id === next.id)) return [...current]
  return [...current, next]
}

export function withoutSelection(
  current: readonly MentionSelection[],
  id: string,
): MentionSelection[] {
  return current.filter((m) => m.id !== id)
}
