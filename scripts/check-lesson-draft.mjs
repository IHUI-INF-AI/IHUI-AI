#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本文件是 CLI 尺子,读数必须打到 stdout 交人现读 */
/**
 * check-lesson-draft — 教训候选稿「合法性」尺子(唯一实现,2026-10-26 立)。
 *
 * 为什么要有它:`scripts/lesson-draft.mjs` 产出的 markdown 候选稿是「准备写回 AGENTS.md / memory
 * 的规则」,写错了就是往规则面塞一条读起来像结论的假教训。抽取(lesson-extract)→ 取材(lesson-draft)
 * → 合法性(本文件)三者分工,任何一份判据只有一处实现(§0.6);本文件是第三格,**不得在别处再写
 * 一份 frontmatter 解析或字段白名单**。
 *
 * 立因是实测:2026-10-26 的 `chore(auto)` 收编把 `scripts/lesson-draft.mjs` 提前入库,而它 import 的
 * 本文件当时不存在 ⇒ HEAD 上一处悬空具名导入,门 98 全量档零容忍判红,全仓提交被阻断。补这一份
 * 不是「补一个空壳让 import 解析成功」:契约按调用点逐条钉死(见下),`lesson-draft --self-test` 的
 * ④⑤ 两例就是用本尺子反向证明提炼器吐的稿合法、frontmatter 可回读。
 *
 * 契约(只认调用点实际用到的形状,多一个字段都不加 —— 加字段等于给写手开新面):
 *   parseFrontmatter(markdown) → { ok, fields, body, findings }
 *     · ok=false 时 fields 为空对象、findings 逐条点名为什么读不出(缺开头 `---` / 缺结尾 `---` /
 *       键重复 / 值不是 `"…"` 也不是裸标量);
 *     · 值解析与 `lesson-draft.mjs` 的 `yamlQuote` 成对:双引号 JSON 串按 JSON.parse 回读,
 *       其余按裸标量 trim(布尔只认 true/false,数字只认十进制)。
 *   validateDraft(markdown) → { ok, findings }
 *     · findings 每条是 `码:细节` 形态(人读与机读同一套字面),空数组 = 通过;
 *     · 判据面 = frontmatter 必填键 / writeBack 恒 `immutable-exempt-required` / kind 在策略白名单 /
 *       三段式标题各恰一次且正文非空 / rule 不超策略条数上限 / 不许出现「写回已完成」的既成声明。
 *
 * 判据源单一:kind 白名单与 rule 字数上限一律读 `scripts/data/lesson-writeback-policy.json`
 * (该文件头注已写明「改本文件即改判据,禁止在脚本里再写一份」),本文件不抄第二份常量。
 *
 * 退出码:0 = 合法 / 1 = 有违规(逐条点名) / 2 = 未判定(策略文件读不到或形状坏了 —— 判不了不记绿)。
 * 用法:node scripts/check-lesson-draft.mjs <稿路径> | --self-test
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 类别枚举单源:提炼器认得的 kind 由它的标签表决定,写回白名单由策略文件决定,两边都不在此重抄。
import { LESSON_LABELS } from './lib/lesson-extract.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const POLICY_PATH = join(ROOT, 'scripts', 'data', 'lesson-writeback-policy.json')

/** 与 `lesson-draft.mjs` 的 WRITE_BACK 同值:写回必须由人工带 immutable-exempt 提交执行。 */
export const WRITE_BACK = 'immutable-exempt-required'

/** frontmatter 必填键 = `renderDraft` 实际会渲染的那 11 个,顺序无关。 */
export const REQUIRED_FIELDS = [
  'title',
  'kind',
  'rule',
  'why',
  'howToApply',
  'anchor',
  'sourceCommit',
  'derived',
  'writeBack',
  'generatedBy',
  'generatedAt',
]

/** 三段式:标题原文 → frontmatter 对应键(用于「标题在但正文空」这一型的定向点名)。 */
export const SECTIONS = [
  ['## 规则(rule)', 'rule'],
  ['## 为什么(why)', 'why'],
  ['## 怎么用(howToApply)', 'howToApply'],
]

const QUOTED = /^"(?:[^"\\]|\\.)*"$/
const BARE_TRUE_FALSE = /^(?:true|false)$/
const NUMBER = /^-?\d+(?:\.\d+)?$/

/** 双引号 JSON 串按 JSON 回读,裸标量 trim;坏值返回 { ok:false } 交调用方点名。 */
function decodeValue(raw) {
  const v = raw.trim()
  if (QUOTED.test(v)) {
    try {
      return { ok: true, value: JSON.parse(v) }
    } catch {
      return { ok: false, why: '双引号串不是合法 JSON 转义' }
    }
  }
  if (v === '') return { ok: false, why: '值为空' }
  if (BARE_TRUE_FALSE.test(v)) return { ok: true, value: v === 'true' }
  if (NUMBER.test(v)) return { ok: true, value: Number(v) }
  if (/^[[{]/.test(v)) return { ok: false, why: '复合值必须写成双引号 JSON 串' }
  return { ok: true, value: v }
}

/**
 * frontmatter 解析唯一实现。
 * 只认「文件首行 `---` + 下一个 `---` 收尾」这一种形态(渲染器产出的正是这一种);
 * 不是 YAML 全量解析器 —— 多一层解析就多一处与渲染器漂开的地方。
 */
export function parseFrontmatter(markdown) {
  const findings = []
  const text = String(markdown ?? '')
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') {
    return { ok: false, fields: {}, body: text, findings: ['E_NO_OPEN:首行不是 `---`,读不出 frontmatter'] }
  }
  let close = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      close = i
      break
    }
  }
  if (close < 0) {
    return { ok: false, fields: {}, body: text, findings: ['E_NO_CLOSE:frontmatter 没有收尾 `---`(被截断的稿不得当成合法)'] }
  }
  const fields = {}
  for (let i = 1; i < close; i += 1) {
    const line = lines[i]
    if (!line.trim() || line.trim().startsWith('#')) continue
    const at = line.indexOf(':')
    if (at <= 0) {
      findings.push(`E_BAD_LINE:第 ${i + 1} 行不是 \`键: 值\` 形态`)
      continue
    }
    const key = line.slice(0, at).trim()
    if (Object.hasOwn(fields, key)) {
      findings.push(`E_DUP_KEY:键 \`${key}\` 出现两次(后写覆盖前写,与门 89 R13 同型)`)
      continue
    }
    const decoded = decodeValue(line.slice(at + 1))
    if (!decoded.ok) {
      findings.push(`E_BAD_VALUE:键 \`${key}\` ${decoded.why}`)
      continue
    }
    fields[key] = decoded.value
  }
  return { ok: findings.length === 0, fields, body: lines.slice(close + 1).join('\n'), findings }
}

function loadPolicy() {
  try {
    const raw = readFileSync(POLICY_PATH, 'utf8')
    const policy = JSON.parse(raw)
    const kinds = policy?.kinds
    const maxChars = policy?.limits?.maxLessonChars
    if (!Array.isArray(kinds) || kinds.length === 0 || !Number.isFinite(maxChars) || maxChars <= 0) {
      return { ok: false, why: '策略文件形状坏了(kinds 空或 limits.maxLessonChars 非正数)' }
    }
    return { ok: true, kinds, maxChars }
  } catch (error) {
    return { ok: false, why: `策略文件读不到:${error?.message ?? error}` }
  }
}

/**
 * 合法 kind 集合 = 提炼器类别(`LESSON_LABELS` 的值)∪ 写回白名单(策略 `kinds`)。
 *
 * 为什么不是只用策略白名单:提炼器产出的是「条目类别」(`feedback` / `project`),策略里的 `kinds`
 * 是「允许自动写回的类型」(`deploy-retro`)—— 两者是不同的问题。拿写回白名单卡类别,会让提炼器
 * 自产的稿被判 E_KIND(`lesson-draft --self-test` ④ 就是这样量的),等于逼人把两条判据抄成一份。
 * 类别枚举只在 `lib/lesson-extract.mjs` 一处,白名单只在策略文件一处,本函数只做并集。
 */
function allowedKinds(policy) {
  return new Set([...LESSON_LABELS.values(), ...(policy?.kinds ?? [])])
}

/** 判断正文里是否出现「写回已完成」的既成声明(候选稿只许说"要由人写回",不许说自己已写)。 */
const CLAIMED_WRITE_RE = /(?:已写回|已写入\s*AGENTS\.md|已落\s*AGENTS\.md|writeBack\s*[:=]\s*(?:done|true))/i

/**
 * 合法性判据唯一实现。findings 为空才算通过;
 * 策略读不到 ⇒ ok=false 且首条是 `E_UNDETERMINED`,调用方按 exit 2 处理(判不了不记绿)。
 */
export function validateDraft(markdown, { policy = loadPolicy() } = {}) {
  if (!policy.ok) return { ok: false, findings: [`E_UNDETERMINED:${policy.why}`] }
  const parsed = parseFrontmatter(markdown)
  const findings = [...parsed.findings]
  if (!parsed.ok && !Object.keys(parsed.fields).length) return { ok: false, findings }

  const { fields } = parsed
  for (const key of REQUIRED_FIELDS) {
    if (!Object.hasOwn(fields, key)) findings.push(`E_MISSING_FIELD:缺必填键 \`${key}\``)
  }
  const str = (k) => (typeof fields[k] === 'string' ? fields[k].trim() : '')
  for (const key of ['title', 'rule', 'why', 'howToApply', 'derived', 'generatedBy', 'generatedAt']) {
    if (Object.hasOwn(fields, key) && !str(key)) findings.push(`E_EMPTY_FIELD:\`${key}\` 为空串`)
  }
  if (Object.hasOwn(fields, 'writeBack') && fields.writeBack !== WRITE_BACK) {
    findings.push(`E_WRITE_BACK:\`writeBack\` 必须是 \`${WRITE_BACK}\`,实为 \`${String(fields.writeBack)}\``)
  }
  if (Object.hasOwn(fields, 'kind')) {
    const legal = allowedKinds(policy)
    if (!legal.has(fields.kind)) {
      findings.push(
        `E_KIND:\`kind\` 不在合法集合 [${[...legal].join(', ')}](提炼器类别 ∪ 写回白名单),实为 \`${String(fields.kind)}\``,
      )
    }
  }
  if (str('rule').length > policy.maxChars) {
    findings.push(`E_RULE_TOO_LONG:rule 长度 ${str('rule').length} 超过上限 ${policy.maxChars}`)
  }

  const body = parsed.body
  for (const [heading, key] of SECTIONS) {
    const hits = body.split(/\r?\n/).filter((l) => l.trim() === heading).length
    if (hits === 0) findings.push(`E_SECTION_MISSING:缺段 \`${heading}\``)
    else if (hits > 1) findings.push(`E_SECTION_DUP:段 \`${heading}\` 出现 ${hits} 次(重复段会让读者拿到两份结论)`)
    else {
      const after = body.slice(body.indexOf(heading) + heading.length)
      const next = after.search(/\n##\s/)
      const content = (next < 0 ? after : after.slice(0, next)).replace(/^>.*$/gm, '').trim()
      if (!content) findings.push(`E_SECTION_EMPTY:段 \`${heading}\` 正文为空(frontmatter 有 \`${key}\` 不代表正文写了)`)
    }
  }
  if (CLAIMED_WRITE_RE.test(parsed.body)) {
    findings.push('E_CLAIMED_WRITE:正文出现「已写回」类既成声明 —— 候选稿只能请求人写回,不得自称已完成')
  }
  return { ok: findings.length === 0, findings }
}

/* ------------------------------------------------------------------ 自检 */

export const __test__ = { decodeValue, loadPolicy, CLAIMED_WRITE_RE, POLICY_PATH }

function validDraft(overrides = {}) {
  const f = {
    title: '提交前先验证导入目标存在',
    kind: 'deploy-retro',
    rule: '新增 import 前先确认目标文件已在同一枚提交里',
    why: '悬空具名导入会让全仓门 98 零容忍判红,阻断所有人提交',
    howToApply: '落提交前跑 node scripts/check-dangling-local-imports.mjs --files <你的文件>',
    anchor: 'scripts/lesson-draft.mjs:33',
    sourceCommit: '"0123456789abcdef0123456789abcdef01234567"',
    derived: '门 98 取证行',
    writeBack: WRITE_BACK,
    generatedBy: '"scripts/lesson-draft.mjs"',
    generatedAt: '"2026-10-26T00:00:00.000Z"',
    ...overrides,
  }
  const fm = Object.entries(f).map(([k, v]) => `${k}: ${v}`).join('\n')
  return `---\n${fm}\n---\n\n## 规则(rule)\n\n${f.rule}\n\n## 为什么(why)\n\n${f.why}\n\n## 怎么用(howToApply)\n\n${f.howToApply}\n`
}

function selfTest() {
  let pass = 0
  let fail = 0
  const check = (name, fn) => {
    try {
      fn()
      pass += 1
    } catch (error) {
      fail += 1
      console.error(`❌ ${name}: ${error?.message ?? error}`)
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg || '断言失败')
  }

  check('① 合法稿 ⇒ ok 且 findings 空', () => {
    const v = validateDraft(validDraft())
    assert(v.ok, JSON.stringify(v.findings))
  })
  check('② frontmatter 可回读(双引号串解回原文)', () => {
    const p = parseFrontmatter(validDraft())
    assert(p.ok, JSON.stringify(p.findings))
    assert(p.fields.title === '提交前先验证导入目标存在', `title=${p.fields.title}`)
    assert(p.fields.sourceCommit === '0123456789abcdef0123456789abcdef01234567', 'sourceCommit 未解回原文')
  })
  check('③ 缺收尾 `---` ⇒ 不合法且点名 E_NO_CLOSE', () => {
    const md = validDraft().replace(/\n---\n\n## 规则/, '\n\n## 规则')
    const v = validateDraft(md)
    assert(!v.ok && v.findings.some((x) => x.startsWith('E_NO_CLOSE')), JSON.stringify(v.findings))
  })
  check('④ writeBack 被改 ⇒ 点名 E_WRITE_BACK(候选稿不得自带写回豁免)', () => {
    const v = validateDraft(validDraft({ writeBack: 'done' }))
    assert(!v.ok && v.findings.some((x) => x.startsWith('E_WRITE_BACK')), JSON.stringify(v.findings))
  })
  check('⑤ 缺段 ⇒ 点名 E_SECTION_MISSING;段在但空 ⇒ E_SECTION_EMPTY', () => {
    const noSec = validateDraft(validDraft().replace(/\n## 为什么\(why\)\n\n[\s\S]*?(?=\n## 怎么用)/, '\n'))
    assert(noSec.findings.some((x) => x.startsWith('E_SECTION_MISSING')), JSON.stringify(noSec.findings))
    const emptySec = validateDraft(validDraft().replace(/(## 为什么\(why\)\n\n)[^\n]+/, '$1'))
    assert(emptySec.findings.some((x) => x.startsWith('E_SECTION_EMPTY')), JSON.stringify(emptySec.findings))
  })
  check('⑥ rule 超上限 ⇒ E_RULE_TOO_LONG(上限读策略,不抄常量)', () => {
    const policy = loadPolicy()
    assert(policy.ok, policy.why)
    const v = validateDraft(validDraft({ rule: `"${'长'.repeat(policy.maxChars + 1)}"` }))
    assert(v.findings.some((x) => x.startsWith('E_RULE_TOO_LONG')), JSON.stringify(v.findings))
  })
  check('⑦ kind 不在白名单 ⇒ E_KIND', () => {
    const v = validateDraft(validDraft({ kind: 'not-a-kind' }))
    assert(v.findings.some((x) => x.startsWith('E_KIND')), JSON.stringify(v.findings))
  })
  check('⑧ 既成写回声明 ⇒ E_CLAIMED_WRITE', () => {
    const v = validateDraft(validDraft().replace('## 规则(rule)\n\n', '## 规则(rule)\n\n已写回 AGENTS.md。'))
    assert(v.findings.some((x) => x.startsWith('E_CLAIMED_WRITE')), JSON.stringify(v.findings))
  })
  check('⑨ 策略读不到 ⇒ E_UNDETERMINED(判不了不记绿,不回落成"合法")', () => {
    const v = validateDraft(validDraft(), { policy: { ok: false, why: '夹具:读不到' } })
    assert(!v.ok && v.findings[0] === 'E_UNDETERMINED:夹具:读不到', JSON.stringify(v.findings))
  })
  check('⑩ 重复键 ⇒ E_DUP_KEY', () => {
    const md = validDraft().replace('kind: deploy-retro', 'kind: deploy-retro\nkind: deploy-retro')
    const v = validateDraft(md)
    assert(v.findings.some((x) => x.startsWith('E_DUP_KEY')), JSON.stringify(v.findings))
  })
  check('⑪ 提炼器自产类别(feedback/project)⇒ 合法(合法集 = 类别 ∪ 写回白名单)', () => {
    for (const kind of [...LESSON_LABELS.values()]) {
      const v = validateDraft(validDraft({ kind }))
      assert(v.ok, `kind=${kind}: ${JSON.stringify(v.findings)}`)
    }
    assert(!validateDraft(validDraft({ kind: 'made-up-kind' })).ok, '生造类别不得放行')
  })

  const total = pass + fail
  console.log(`${fail === 0 ? '✅' : '❌'} check-lesson-draft self-test: pass ${pass} / fail ${fail} / total ${total}`)
  return fail === 0 ? 0 : 1
}

/* CLI 只在「本文件就是入口」时执行 —— 被 `lesson-draft.mjs` import 时零副作用(否则本文件会把
   调用方的 argv 当成自己的,直接 exit 掉调用方的自检;这类"import 即执行"与门 89 R13 同族)。 */
const invokedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const target = argv.find((a) => !a.startsWith('-'))
  if (!target) {
    console.log('用法:node scripts/check-lesson-draft.mjs <稿路径> | --self-test')
    process.exit(2)
  }
  let text = ''
  try {
    text = readFileSync(target, 'utf8')
  } catch (error) {
    console.error(`❌ 读不到稿:${error?.message ?? error}`)
    process.exit(2)
  }
  const verdict = validateDraft(text)
  if (verdict.findings.some((f) => f.startsWith('E_UNDETERMINED'))) {
    for (const f of verdict.findings) console.error(`⊘ ${f}`)
    process.exit(2)
  }
  if (verdict.ok) {
    console.log(`✅ ${target} 合法(判据:必填键 ${REQUIRED_FIELDS.length} / 三段式 / writeBack=${WRITE_BACK} / kind 白名单)`)
    process.exit(0)
  }
  for (const f of verdict.findings) console.error(`❌ ${f}`)
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
