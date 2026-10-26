// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 经验自动提炼(纯判据层) —— 票:经验自动提炼(每次改动/事故后把教训写回 AGENTS.md / memory)
 *
 * 只做一件事:从**提交信息正文**里已写下的「根因/立因/教训/Why/原因/病根/决策/约定」段落,
 * 抽出一条可复核的规则句,并给出它为什么成立(原文引用)与怎么用(改动面 + 红门)。
 *
 * 为什么只认这些段(§0.3「没判绝不写成判过」):
 *  - 本仓的提交信息里,事故的**根因**是作者当场量出来并写进正文的;而"这行代码看起来很危险"是提炼器的推断。
 *    从有出处的段落抽取 = 有锚点可追;从 diff 反推教训 = 编造因果。故抽取面只认正文段落与 changedFiles 清单。
 *  - 抽不出就返回 `{undetermined:true, reason}`:宁可不产出,也不产出一条读起来像结论的假规则。
 *
 * 纯函数,零 IO:git 读取由 `scripts/lesson-draft.mjs` 负责,合法性由 `scripts/check-lesson-draft.mjs` 负责。
 * 三者分工 = 抽取(本文件)/ 取材(CLI)/ 尺子(检):任何一份判据都只有一处实现(§0.6)。
 */

/** 段落标签 → 条目类别。feedback = 事故/纠正型;project = 决策/约定型。
 *  出口给 `scripts/check-lesson-draft.mjs` 当"合法 kind"的来源 —— 类别枚举只此一处(§0.6)。 */
export const LESSON_LABELS = new Map([
  ['教训', 'feedback'],
  ['why', 'feedback'],
  ['根因分析', 'feedback'],
  ['根因', 'feedback'],
  ['立因', 'feedback'],
  ['原因', 'feedback'],
  ['病根', 'feedback'],
  ['决策', 'project'],
  ['约定', 'project'],
])

/** 取主段时的优先级:已经是"规则句"的标签排在"事实句"前面。 */
const LABEL_PRIORITY = ['教训', 'why', '根因分析', '根因', '立因', '原因', '病根', '决策', '约定']

/** 段终结标签:同一段文字里这些标签之后的内容不属于本段(防止把"修法"当成根因读)。 */
const SECTION_BREAK_LABELS = [
  '修法',
  '改法',
  '改动',
  '修复',
  '方案',
  '处置',
  '取证',
  '验证',
  '实测',
  '自证',
  '证据',
  '影响',
  '结论',
  '批注',
  '顺带',
  '注意',
  '备注',
  '背景',
  '用法',
  '退出码',
  '接线',
  '未触碰',
]

/** 规范句标志:出现这些词才算"规则句",否则只是事实陈述。 */
const DIRECTIVE_RE = /(禁止|不得|不许|严禁|必须|一律|只许|切勿|杜绝|避免|应当|只能)/

export const RULE_MAX_CHARS = 120
export const WHY_MAX_CHARS = 240
export const TITLE_MAX_CHARS = 60
export const MIN_RULE_CHARS = 8
export const MIN_WHY_CHARS = 12

/** 码点长度(CJK 一字算一,不按 UTF-16 代理对算二)。 */
export function charLen(value) {
  return Array.from(String(value ?? '')).length
}

/** 按码点截断,不切碎代理对。 */
function sliceChars(value, max) {
  return Array.from(String(value ?? '')).slice(0, max).join('')
}

/** 折叠空白(markdown 软换行在规则句里没有语义)。 */
function collapse(value) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
}

/** 去掉 markdown 强调/列表符/编号符/引号,便于逐字引用与长度判定。 */
export function cleanInline(value) {
  return collapse(value)
    .replace(/^\s*(?:[-*+]\s+)+/, '')
    .replace(/^\s*(?:[①-⑳]|\d+[.)、])\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^[「『“"']+/, '')
    .replace(/[」』”"']+$/, '')
    .trim()
}

const LABEL_LINE_RE =
  /^\s*(?:[-*+]\s+)?(?:\*\*)?([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9 ]{0,8}?)(?:\*\*)?(?:\s*[(（][^)）]{0,24}[)）])?\s*[:：]\s*(.*)$/

function normalizeLabel(label) {
  return String(label ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * 把正文切成「标签段」。识别形态(本仓实际写法,见 0a3defae / 86085c63 / 4c155346):
 *   `根因:…` / `- 根因:…` / `**根因**:…` / `立因(本票):…`
 * 行内出现下一个标签(如 `根因:A。修法:B`)时,在该标签处截断本段。
 */
export function parseSections(body) {
  const lines = String(body ?? '')
    .replace(/\r/g, '')
    .split('\n')
  const sections = []
  let current = null
  let pendingText = []

  const flush = () => {
    if (current) {
      current.text = collapse(pendingText.join('\n'))
      sections.push(current)
    }
    current = null
    pendingText = []
  }

  for (const line of lines) {
    const m = line.match(LABEL_LINE_RE)
    if (m) {
      const label = normalizeLabel(m[1])
      const kind = LESSON_LABELS.get(label)
      const isBreak = SECTION_BREAK_LABELS.some((b) => normalizeLabel(b) === label)
      if (kind || isBreak) {
        flush()
        if (kind) {
          current = { label, kindHint: kind, inline: truncateAtNextLabel(cleanInline(m[2])) }
          if (current.inline) pendingText.push(current.inline)
        }
        continue
      }
    }
    if (current) pendingText.push(line)
  }
  flush()
  return sections.filter((s) => charLen(s.text) > 0)
}

/** 行内标签截断:在 `修法:`/`验证:` 等终结标签处停下。 */
export function truncateAtNextLabel(text) {
  const value = String(text ?? '')
  for (const label of SECTION_BREAK_LABELS) {
    const re = new RegExp(`[\\s;；。]${label}[:：]`)
    const idx = value.search(re)
    if (idx >= 0) return value.slice(0, idx).trim()
  }
  return value
}

/** 段落 → 句级候选(按中英文句读切,过滤过短碎片)。 */
export function splitSentences(text) {
  return collapse(text)
    .split(/(?<=[。;；!?！？])\s*/)
    .map((s) => cleanInline(s))
    .filter((s) => charLen(s) >= MIN_RULE_CHARS)
}

function pickPrimarySection(sections) {
  for (const label of LABEL_PRIORITY) {
    const hit = sections.find((s) => s.label === label)
    if (hit) return hit
  }
  return sections[0] ?? null
}

const BOUNDARY_RE = /[。;；,，、)）:：]/

/**
 * 规则句定型:
 *  1) 段落里已有规范句且 ≤120 ⇒ 逐字采用(derived='verbatim');
 *  2) 只有事实句 ⇒ `避免再犯:<首句>`(derived='wrapped-root-cause',人工一眼看出是包装句);
 *  3) 首句超长且无句读可切 ⇒ 未判定 rule-too-long(不切碎、不凑一句像规则的话)。
 */
export function buildRule(section) {
  const sentences = splitSentences(section?.text ?? '')
  const directive = sentences.find((s) => DIRECTIVE_RE.test(s) && charLen(s) <= RULE_MAX_CHARS)
  if (directive) return { rule: directive, derived: 'verbatim' }

  const tooLong = sentences.find((s) => DIRECTIVE_RE.test(s))
  if (tooLong && !boundarySlice(tooLong, RULE_MAX_CHARS)) {
    return { undetermined: true, reason: 'rule-too-long', detail: charLen(tooLong) }
  }
  if (tooLong) {
    return { rule: boundarySlice(tooLong, RULE_MAX_CHARS), derived: 'verbatim-truncated' }
  }

  const clause = sentences[0] ?? cleanInline(section?.text ?? '')
  if (!clause) return { undetermined: true, reason: 'rule-empty' }
  const prefix = '避免再犯:'
  const budget = RULE_MAX_CHARS - charLen(prefix)
  const sliced = charLen(clause) <= budget ? clause : boundarySlice(clause, budget)
  if (!sliced) return { undetermined: true, reason: 'rule-too-long', detail: charLen(clause) }
  return { rule: `${prefix}${sliced}`, derived: 'wrapped-root-cause' }
}

/** 在 ≤max 的窗口内按句读收口;找不到句读 ⇒ 返回空串(调用方据此判未判定)。 */
export function boundarySlice(text, max) {
  if (charLen(text) <= max) return text
  const chars = Array.from(text).slice(0, max)
  for (let i = chars.length - 1; i >= Math.floor(max / 2); i -= 1) {
    if (BOUNDARY_RE.test(chars[i])) return chars.slice(0, i).join('').trim()
  }
  return ''
}

/** 锚点:有 40 位 sha 用 sha(可回溯到对象空间);否则用标题原文(内容锚点,禁行号/短 sha,§1)。 */
export function buildAnchor({ commitSha, title }) {
  const sha = String(commitSha ?? '')
  if (/^[0-9a-f]{40}$/i.test(sha)) return `commit:${sha.toLowerCase()}`
  const t = cleanInline(title)
  return t ? `subject:${t}` : ''
}

/** 改动面描述:同目录 / 公共前缀 / 只报枚数(绝不编不存在的路径)。 */
export function scopeOfFiles(changedFiles) {
  const files = (changedFiles ?? []).filter((f) => typeof f === 'string' && f.trim())
  if (!files.length) return '同类改动面'
  const dirs = files.map((f) => {
    const idx = f.lastIndexOf('/')
    return idx > 0 ? f.slice(0, idx) : '.'
  })
  const segments = dirs.map((d) => (d === '.' ? [] : d.split('/')))
  let common = segments[0] ?? []
  for (const seg of segments.slice(1)) {
    let i = 0
    while (i < common.length && i < seg.length && common[i] === seg[i]) i += 1
    common = common.slice(0, i)
  }
  const head = common.length ? `${common.join('/')}/**` : '仓根'
  return `${head}(${files.length} 个文件)`
}

export function buildHowToApply({ changedFiles, redGates }) {
  const scope = scopeOfFiles(changedFiles)
  const gates = (redGates ?? []).map((g) => cleanInline(g)).filter(Boolean)
  const tail = gates.length
    ? `先复跑 ${gates.join('、')}`
    : '先按改动面复跑对应守门与镜像测试'
  return `下次动 ${scope} 前,${tail};红了按本条改判据或改实现,不得反向放宽判据。本条只作自查前置,不替代守门末行读数。`
}

/** 标题:去 conventional 前缀,取首个小句,≤60 字。 */
export function buildTitle(commitSubject) {
  const raw = collapse(commitSubject)
  if (!raw) return ''
  const noPrefix = raw.replace(/^[a-z]+(?:\([^)]{0,40}\))?!?:\s*/i, '')
  const firstClause = noPrefix.split(/\s+——\s+|—{2,}/)[0]
  const trimmed = firstClause.replace(/[。.;；,，:：]+$/, '').trim()
  return sliceChars(trimmed, TITLE_MAX_CHARS).trim()
}

/**
 * 主入口(纯函数)。
 * @param {{commitSubject?:string, commitBody?:string, changedFiles?:string[], redGates?:string[], commitSha?:string}} input
 * @returns {{undetermined:true, reason:string, detail?:number}|{title:string, kind:'feedback'|'project',
 *   rule:string, why:string, howToApply:string, anchor:string, derived:string, label:string}}
 */
export function extractLesson(input = {}) {
  const subject = collapse(input.commitSubject)
  const body = String(input.commitBody ?? '')
  if (!subject && !body.trim()) return { undetermined: true, reason: 'empty-input' }

  const sections = parseSections(body)
  if (!sections.length) return { undetermined: true, reason: 'no-lesson-section' }

  const primary = pickPrimarySection(sections)
  const built = buildRule(primary)
  if (built.undetermined) return built

  const title = buildTitle(subject) || sliceChars(cleanInline(primary.text), TITLE_MAX_CHARS)
  if (!title) return { undetermined: true, reason: 'title-empty' }

  const anchor = buildAnchor({ commitSha: input.commitSha, title })
  const cause = collapse(primary.text)
  const causeText =
    charLen(cause) <= WHY_MAX_CHARS ? cause : `${sliceChars(cause, WHY_MAX_CHARS - 1)}…`
  const why = `${causeText}(锚点:${anchor || 'subject:' + title})`
  if (charLen(why) < MIN_WHY_CHARS) return { undetermined: true, reason: 'why-too-short' }

  const rule = built.rule.replace(/[。;；]+$/, '').trim()
  if (charLen(rule) < MIN_RULE_CHARS) return { undetermined: true, reason: 'rule-empty' }

  return {
    title,
    kind: primary.kindHint,
    rule,
    why,
    howToApply: buildHowToApply({ changedFiles: input.changedFiles, redGates: input.redGates }),
    anchor,
    derived: built.derived,
    label: primary.label,
  }
}

export const __test__ = {
  LESSON_LABELS,
  LABEL_PRIORITY,
  SECTION_BREAK_LABELS,
  DIRECTIVE_RE,
  parseSections,
  truncateAtNextLabel,
  splitSentences,
  pickPrimarySection,
  buildRule,
  boundarySlice,
  buildAnchor,
  buildTitle,
  buildHowToApply,
  scopeOfFiles,
  cleanInline,
  charLen,
  extractLesson,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
