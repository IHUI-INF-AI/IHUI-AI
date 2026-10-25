// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 经验自动提炼 —— 取材层 CLI(只读 git log,只写候选稿,绝不写 AGENTS.md / memory)
 *
 * 票:经验自动提炼(每次改动/事故后把教训写回 AGENTS.md / memory,受 P0 不可变护栏约束)。
 *
 * 三段分工(§0.6 单一真相源,本文件不复制任何判据):
 *  抽取 —— scripts/lib/lesson-extract.mjs 的 extractLesson(纯函数)
 *  尺子 —— scripts/check-lesson-draft.mjs 的 validateDraft(候选稿合法性唯一实现)
 *  取材 —— 本文件(唯一有 IO 的一段)
 *
 * 为什么产物只能落"候选稿"(票面边界):
 *  AGENTS.md 在 scripts/data/immutable-guard.json 的受保护面里(rule-doc),还有 96,000 B 体积门;
 *  自动改写它等于同时绕过护栏与体积预算。所以本器只产 markdown 候选(frontmatter + 三段式),
 *  frontmatter 恒带 `writeBack: immutable-exempt-required` —— 写回必须由带 `immutable-exempt: <原因>`
 *  的提交人工执行,机器一步也不替你走。memory 目录在仓外(~/.qoder-cn/...),同理只给建议文件名。
 *
 * 用法:
 *   node scripts/lesson-draft.mjs --since 2026-10-20T00:00:00Z [--out <file|dir>] [--json] [--limit 20]
 *   node scripts/lesson-draft.mjs --commit <sha40> [--out <file>]
 *   node scripts/lesson-draft.mjs --self-test
 * 退出码:0 = 产出至少一条候选 / 2 = 未判定(取不到 git、未取到提交、区间为空、一条都抽不出)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, gitRaw } from './lib/face-reader.mjs'
import { charLen, cleanInline, extractLesson } from './lib/lesson-extract.mjs'
import { parseFrontmatter, validateDraft } from './check-lesson-draft.mjs'

/* eslint-disable no-console -- CLI 的诊断与末行就是它的交付物 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_LIMIT = 20
const FIELD_SEP = '\x1f'
const RECORD_SEP = '\x1e'

export const RESULT_TAG = 'LESSON-DRAFT-RESULT'
export const SELFTEST_TAG = 'LESSON-DRAFT-SELFTEST'
export const WRITE_BACK = 'immutable-exempt-required'

/** git 记录格式:四段字段,末段是 --name-only 的路径块(见 parseLogOutput 的注释)。 */
export const LOG_FORMAT = `--format=%H%x1f%s%x1f%b%x1f%x1e`

const USAGE = [
  '用法:node scripts/lesson-draft.mjs --since <ISO> [--out <file|dir>] [--json] [--limit N]',
  '     node scripts/lesson-draft.mjs --commit <sha> [--out <file>] [--gate <守门脚本名>]',
  '     node scripts/lesson-draft.mjs --self-test',
].join('\n')

/**
 * 解析 `git log --name-only --format=%H\x1f%s\x1f%b\x1f\x1e` 的输出。
 * 记录布局:每个 chunk 被 \x1e 切成 `<sha>\x1f<subject>\x1f<body>\x1f\n\n<names>\n`
 * —— 路径块落在**本记录的 \x1e 之后**,所以字段分隔符必须在 \x1e 之前再写一枚,否则
 * 路径会被读进下一条记录(这正是 --name-only 与自定义 --format 混用的老坑)。
 */
export function parseLogOutput(raw) {
  const records = []
  for (const chunk of String(raw ?? '').split(RECORD_SEP)) {
    const text = chunk.replace(/^\n+/, '')
    if (!text.trim()) continue
    const parts = text.split(FIELD_SEP)
    if (parts.length < 4) continue
    const sha = parts[0].trim()
    if (!/^[0-9a-f]{40}$/i.test(sha)) continue
    records.push({
      sha: sha.toLowerCase(),
      subject: parts[1].trim(),
      body: parts[2],
      changedFiles: parts
        .slice(3)
        .join(FIELD_SEP)
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    })
  }
  return records
}

/** 参数解析(不抛错、不退出;坏参数以 {error} 返回,由 main 定档)。 */
export function parseArgs(argv) {
  const opts = {
    since: '',
    commit: '',
    out: '',
    json: false,
    selfTest: false,
    help: false,
    limit: DEFAULT_LIMIT,
    gates: [],
    error: '',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const take = () => {
      const v = argv[i + 1]
      if (v === undefined) {
        opts.error = `${arg} 缺少取值`
        return ''
      }
      i += 1
      return v
    }
    if (arg === '--self-test') opts.selfTest = true
    else if (arg === '--json') opts.json = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--since') opts.since = take()
    else if (arg === '--commit') opts.commit = take()
    else if (arg === '--out') opts.out = take()
    else if (arg === '--gate') {
      const v = take()
      if (v) opts.gates.push(v)
    } else if (arg === '--limit') {
      const v = take()
      const n = Number.parseInt(v, 10)
      if (!Number.isFinite(n) || n <= 0) opts.error = `--limit 取值不是正整数: ${v}`
      else opts.limit = n
    } else if (arg.startsWith('--')) opts.error = `未知参数: ${arg}`
    else opts.error = `多余的位置参数: ${arg}`
    if (opts.error) break
  }
  return opts
}

/** ISO 单点时刻校验:只接受能解析成确定时刻的写法,相对时间("3 days ago")不接受(不可复现)。 */
export function isIsoInstant(value) {
  const text = cleanInline(value)
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(text)) {
    return false
  }
  return Number.isFinite(Date.parse(text))
}

export function isShaLike(value) {
  return /^[0-9a-f]{4,40}$/i.test(cleanInline(value))
}

/** 读 git log(只读)。返回 {records} 或抛 Undetermined(取不到面就明确未判定,不回落空集)。 */
export function readCommits({ since, commit, limit }) {
  if (commit) {
    const full = String(
      gitRaw(['rev-parse', '--verify', `${commit}^{commit}`], ROOT).stdout ?? '',
    ).trim()
    if (!/^[0-9a-f]{40}$/i.test(full)) {
      throw new Undetermined(`--commit 解析不到提交对象: ${commit}`)
    }
    const raw = String(
      gitRaw(['log', '-1', LOG_FORMAT, '--name-only', full], ROOT).stdout ?? '',
    )
    return parseLogOutput(raw)
  }
  const args = ['log', LOG_FORMAT, '--name-only', `--since=${since}`, '-n', String(limit)]
  const raw = String(gitRaw(args, ROOT).stdout ?? '')
  return parseLogOutput(raw)
}

function yamlQuote(value) {
  return JSON.stringify(String(value ?? ''))
}

/** 单条候选稿渲染(frontmatter + 三段式)。 */
export function renderDraft({ draft, sha, generatedAt }) {
  const fm = [
    '---',
    `title: ${yamlQuote(draft.title)}`,
    `kind: ${draft.kind}`,
    `rule: ${yamlQuote(draft.rule)}`,
    `why: ${yamlQuote(draft.why)}`,
    `howToApply: ${yamlQuote(draft.howToApply)}`,
    `anchor: ${yamlQuote(draft.anchor)}`,
    `sourceCommit: ${sha ? yamlQuote(sha) : '""'}`,
    `derived: ${yamlQuote(draft.derived)}`,
    `writeBack: ${WRITE_BACK}`,
    `generatedBy: "scripts/lesson-draft.mjs"`,
    `generatedAt: ${yamlQuote(generatedAt)}`,
    '---',
  ].join('\n')
  const body = [
    '',
    '## 规则(rule)',
    '',
    draft.rule,
    '',
    '## 为什么(why)',
    '',
    draft.why,
    '',
    '## 怎么用(howToApply)',
    '',
    draft.howToApply,
    '',
    '> 候选稿:写回 AGENTS.md 必须由带 `immutable-exempt: <原因>` 的提交人工执行;写回 memory 由人确认文件名后另存。',
    '',
  ].join('\n')
  return `${fm}\n${body}`
}

export function slugify(title) {
  const ascii = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return Array.from(ascii || 'lesson').slice(0, 40).join('') || 'lesson'
}

/** 文件名:有 sha 用 sha7 前缀(可回溯),无 sha(自检夹具)退到序号。 */
export function draftFileName({ sha, title, index }) {
  const prefix = sha ? sha.slice(0, 7) : `draft${String(index + 1).padStart(2, '0')}`
  return `${prefix}-${slugify(title)}.md`
}

export function buildResultLine(fields) {
  const pairs = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, '_')}`)
  return `${RESULT_TAG} ${pairs.join(' ')}`
}

/** 把候选稿落盘:单条 ⇒ 该路径当文件;多条 ⇒ 该路径当目录。 */
export function writeDrafts(drafts, out) {
  if (!drafts.length || !out) return { written: [] }
  const asFile = drafts.length === 1 && extname(out) === '.md'
  if (asFile) {
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, drafts[0].markdown, 'utf8')
    return { written: [out] }
  }
  mkdirSync(out, { recursive: true })
  const written = []
  drafts.forEach((d, i) => {
    const file = join(out, draftFileName({ sha: d.sha, title: d.draft.title, index: i }))
    writeFileSync(file, d.markdown, 'utf8')
    written.push(file)
  })
  return { written }
}

function summarize(entries) {
  const reasons = new Map()
  let drafts = 0
  let skipped = 0
  for (const e of entries) {
    if (e.draft) {
      drafts += 1
      continue
    }
    skipped += 1
    const key = e.reason || 'unknown'
    reasons.set(key, (reasons.get(key) ?? 0) + 1)
  }
  const reasonText = [...reasons.entries()].map(([k, v]) => `${k}:${v}`).join(',')
  return { drafts, skipped, reasonText }
}

async function main(argv) {
  const opts = parseArgs(argv)
  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  if (opts.error) {
    console.error(`参数错误: ${opts.error}`)
    console.log(USAGE)
    console.log(buildResultLine({ state: 'undetermined', reason: 'bad-args' }))
    return 2
  }

  if (opts.selfTest) return runSelfTest()

  if (!opts.since && !opts.commit) {
    console.error('必须给 --since <ISO> 或 --commit <sha>(本器不猜区间)')
    console.log(buildResultLine({ state: 'undetermined', reason: 'no-range' }))
    return 2
  }
  if (opts.since && opts.commit) {
    console.error('--since 与 --commit 互斥')
    console.log(buildResultLine({ state: 'undetermined', reason: 'conflicting-range' }))
    return 2
  }
  if (opts.since && !isIsoInstant(opts.since)) {
    console.error(`--since 不是可复现的 ISO 时刻: ${opts.since}`)
    console.log(buildResultLine({ state: 'undetermined', reason: 'bad-since' }))
    return 2
  }
  if (opts.commit && !isShaLike(opts.commit)) {
    console.error(`--commit 不是 sha: ${opts.commit}`)
    console.log(buildResultLine({ state: 'undetermined', reason: 'bad-sha' }))
    return 2
  }

  let records
  try {
    records = readCommits({ since: opts.since, commit: opts.commit, limit: opts.limit })
  } catch (e) {
    const reason = e instanceof Undetermined ? 'git-unavailable' : 'git-failed'
    console.error(`取材失败(${reason}): ${e?.message ?? e}`)
    console.log(buildResultLine({ state: 'undetermined', reason }))
    return 2
  }

  if (!records.length) {
    console.error('区间内一枚提交都没有 —— 未判定(不记绿也不报"零教训")')
    console.log(
      buildResultLine({ state: 'empty', reason: 'empty-interval', mode: opts.commit ? 'commit' : 'since' }),
    )
    return 2
  }

  const generatedAt = new Date().toISOString()
  const entries = records.map((r) => {
    const draft = extractLesson({
      commitSubject: r.subject,
      commitBody: r.body,
      changedFiles: r.changedFiles,
      redGates: opts.gates,
      commitSha: r.sha,
    })
    if (draft.undetermined) {
      return { sha: r.sha, subject: r.subject, reason: draft.reason, detail: draft.detail }
    }
    const markdown = renderDraft({ draft, sha: r.sha, generatedAt })
    const verdict = validateDraft(markdown)
    return {
      sha: r.sha,
      subject: r.subject,
      draft,
      markdown,
      // 自产自检:提炼器吐的稿必须当场过尺子,不过就是提炼器有 bug(不是稿"大概还行")。
      violates: verdict.ok ? [] : verdict.findings,
    }
  })

  const usable = entries.filter((e) => e.draft && !(e.violates ?? []).length)
  const { drafts, skipped, reasonText } = summarize(entries)
  const { written } = writeDrafts(usable, opts.out)

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          mode: opts.commit ? 'commit' : 'since',
          since: opts.since || null,
          commit: opts.commit || null,
          commits: entries.length,
          written,
          entries: entries.map((e) => ({
            sha: e.sha,
            subject: e.subject,
            reason: e.reason ?? null,
            violates: e.violates ?? null,
            draft: e.draft ?? null,
          })),
        },
        null,
        2,
      ),
    )
  } else {
    for (const item of usable) {
      console.log(`<!-- lesson-draft: ${item.sha} label=${item.draft.label} derived=${item.draft.derived} -->`)
      console.log(item.markdown)
    }
  }

  const selfViolations = entries.filter((e) => (e.violates ?? []).length).length
  const state = usable.length ? 'ok' : 'undetermined'
  console.log(
    buildResultLine({
      state,
      mode: opts.commit ? 'commit' : 'since',
      commits: entries.length,
      drafts,
      usable: usable.length,
      skipped,
      selfViolations: selfViolations || undefined,
      reasons: reasonText || undefined,
      written: written.length || undefined,
      out: opts.out || undefined,
      reason: usable.length ? undefined : 'no-extractable-lesson',
    }),
  )
  return usable.length ? 0 : 2
}

/* ------------------------------------------------------------------ 自检 */

function runSelfTest() {
  const cases = []
  const check = (name, fn) => {
    try {
      fn()
      cases.push({ name, ok: true })
    } catch (e) {
      cases.push({ name, ok: false, err: e?.message ?? String(e) })
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }

  const SHA = 'a'.repeat(40)
  const withLesson = {
    commitSubject: 'fix(scripts): 门 234 A2 误判收口',
    commitBody: '立因(HEAD 面实测):位置约束写死『标头紧跟复选框』,票号挡在中间时剥不出。\n\n修法:改走 locateSidecarHeader。',
    changedFiles: ['scripts/lib/plan-task-index.mjs', 'scripts/check-plan-fields.mjs'],
    commitSha: SHA,
  }

  check('① 正常抽取:根因段 ⇒ 规则句 + 三类 kind + 锚点', () => {
    const r = extractLesson(withLesson)
    assert(!r.undetermined, '应当抽出')
    assert(r.kind === 'feedback', `kind=${r.kind}`)
    assert(charLen(r.rule) <= 120, `rule 超长 ${charLen(r.rule)}`)
    assert(r.anchor === `commit:${SHA}`, `anchor=${r.anchor}`)
  })

  check('② 无根因段 ⇒ undetermined(不编)', () => {
    const r = extractLesson({ commitSubject: 'chore: 改了点东西', commitBody: '顺手改了一下排版' })
    assert(r.undetermined && r.reason === 'no-lesson-section', JSON.stringify(r))
  })

  check('③ 空输入 ⇒ undetermined', () => {
    const r = extractLesson({})
    assert(r.undetermined && r.reason === 'empty-input', JSON.stringify(r))
  })

  check('④ 渲染出的稿必须过尺子(自产自检)', () => {
    const draft = extractLesson(withLesson)
    const md = renderDraft({ draft, sha: SHA, generatedAt: '2026-10-25T00:00:00.000Z' })
    const verdict = validateDraft(md)
    assert(verdict.ok, JSON.stringify(verdict.findings))
  })

  check('⑤ frontmatter 可回读且 writeBack 恒为 immutable-exempt-required', () => {
    const draft = extractLesson(withLesson)
    const md = renderDraft({ draft, sha: SHA, generatedAt: '2026-10-25T00:00:00.000Z' })
    const fm = parseFrontmatter(md)
    assert(fm.ok, 'frontmatter 解析失败')
    assert(fm.fields.writeBack === WRITE_BACK, `writeBack=${fm.fields.writeBack}`)
  })

  check('⑥ git 记录解析:路径块不串到下一条', () => {
    const raw = `${SHA}${FIELD_SEP}subj A${FIELD_SEP}body A${FIELD_SEP}\n\nscripts/a.mjs\n${RECORD_SEP}${'b'.repeat(40)}${FIELD_SEP}subj B${FIELD_SEP}body B${FIELD_SEP}\n\nscripts/b.mjs\n${RECORD_SEP}`
    const recs = parseLogOutput(raw)
    assert(recs.length === 2, `records=${recs.length}`)
    assert(recs[0].changedFiles.join(',') === 'scripts/a.mjs', JSON.stringify(recs[0].changedFiles))
    assert(recs[1].changedFiles.join(',') === 'scripts/b.mjs', JSON.stringify(recs[1].changedFiles))
  })

  check('⑦ 参数解析:互斥 / 坏 limit / 未知参数', () => {
    assert(parseArgs(['--since', '2026-10-20T00:00:00Z']).since, 'since 未取到')
    assert(parseArgs(['--limit', '0']).error, '--limit 0 应当报错')
    assert(parseArgs(['--nope']).error, '未知参数应当报错')
    assert(parseArgs(['--gate', 'check-x.mjs']).gates.length === 1, 'gate 未收集')
  })

  check('⑧ ISO 时刻与 sha 形态', () => {
    assert(isIsoInstant('2026-10-20T00:00:00Z'), 'ISO 时刻应通过')
    assert(!isIsoInstant('3 days ago'), '相对时间不应通过')
    assert(isShaLike('a'.repeat(40)), '40 位 sha 应通过')
    assert(!isShaLike('xyz'), '非 hex 不应通过')
  })

  check('⑨ 文件名与 slug', () => {
    assert(draftFileName({ sha: SHA, title: '门 234 A2 误判收口', index: 0 }).startsWith('aaaaaaa-'), 'sha7 前缀')
    assert(slugify('!!').length > 0, 'slug 不应为空')
  })

  check('⑩ 末行形态:state=empty 时带 reason', () => {
    const line = buildResultLine({ state: 'empty', reason: 'empty-interval', mode: 'since' })
    assert(line.startsWith(RESULT_TAG), line)
    assert(line.includes('reason=empty-interval'), line)
  })

  check('⑪ 超长且无句读的根因 ⇒ 未判定 rule-too-long', () => {
    const r = extractLesson({
      commitSubject: 'fix: x',
      commitBody: `根因:${'很长的描述'.repeat(30)}`,
      changedFiles: [],
    })
    assert(r.undetermined && r.reason === 'rule-too-long', JSON.stringify(r))
  })

  check('⑫ 决策段 ⇒ kind=project', () => {
    const r = extractLesson({
      commitSubject: 'docs: 定档',
      commitBody: '决策:新增状态词必须同批补齐五语言,禁止端内硬编码中文。',
      changedFiles: ['packages/i18n'],
    })
    assert(!r.undetermined, JSON.stringify(r))
    assert(r.kind === 'project', `kind=${r.kind}`)
  })

  const failed = cases.filter((c) => !c.ok)
  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : `: ${c.err}`}`)
  console.log(`${SELFTEST_TAG} ok=${cases.length - failed.length} fail=${failed.length}`)
  return failed.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      console.log(buildResultLine({ state: 'undetermined', reason: 'internal-error' }))
      process.exitCode = 2
    })
}

export const __test__ = {
  parseLogOutput,
  parseArgs,
  isIsoInstant,
  isShaLike,
  readCommits,
  renderDraft,
  slugify,
  draftFileName,
  buildResultLine,
  writeDrafts,
  summarize,
  main,
  runSelfTest,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
