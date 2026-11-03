#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本器是提升器,读数与末行就是它的交付物 */
/**
 * lesson-apply — 候选稿 → 正式经验库的「提升器」(2026-11-01 立)。
 *
 * 补的是提炼链路最后一格:抽取(`lib/lesson-extract.mjs`)→ 取材(`lesson-draft.mjs`)→ 尺子
 * (`check-lesson-draft.mjs`)三段都在,但候选稿只落 `.ihui-agent/tmp/lesson-draft/` 这个**临时目录**,
 * 全仓没有任何 applier —— 稿子既不去重也不归档,机器侧永不沉淀(§0.9:造好没装车 = 没有)。
 *
 * 分工(§0.6 单一真相源,本文件不复制任何判据):
 *  - 合法性只认 `check-lesson-draft.mjs` 的 `validateDraft`,本文件 import 复用,绝不写第二份校验;
 *  - 去重指纹只认 `evolution-retro.mjs` 的 `fingerprintOf` + 策略文件
 *    `scripts/data/lesson-writeback-policy.json` 的 `fingerprint` 口径(sha256 / 截断长度 / 归一化
 *    列表都在那边),本文件不另立常量 —— 两处各算一套指纹,同一条教训就会两边都"新"。
 *
 * **绝不写 AGENTS.md、绝不写 memory 目录**:AGENTS.md 在 `scripts/data/immutable-guard.json` 的
 * 受保护面里(rule-doc),还压着 96,000 B 体积门 —— 自动改写它等于同时绕过护栏与体积预算。本器
 * 只把稿子搬进 `.ihui-agent/lessons/`,提升后的稿**仍然带着** `writeBack: immutable-exempt-required`
 * 原样不动;写回 AGENTS.md / memory 是**唯一通道 = 人工带 `immutable-exempt: <原因>` 提交**,
 * 机器一步也不替人走。
 *
 * 台账 `.ihui-agent/state/lessons.jsonl` **本器不写**:那是 `evolution-retro.mjs` 的写入面
 * (部署失败桶 → 教训,`--apply` 才落盘,指纹去重合并计数),语义是"部署环复发教训",与这里的
 * "提交教训候选稿"不是同一件事。抢那个文件的追加权会把两种口径混进一份台账。
 *
 * 用法:
 *   node scripts/lesson-apply.mjs                 # 只预览:列出会提升哪些、跳过哪些、为什么
 *   node scripts/lesson-apply.mjs --apply         # 真移动(写目标 → 回读校验 → 记索引 → 删原件)
 *   node scripts/lesson-apply.mjs --json          # 机器可读(可与 --apply 同用)
 *   node scripts/lesson-apply.mjs --self-test     # 内置断言,夹具走 mkScratch,不碰真实积压
 * 退出码:0 = 判定完成且有稿提升(或目录本就空)/ 1 = 有候选但一枚都没提升(全被跳过)/
 *         2 = 未判定(目录不存在、策略读不到、索引坏了、参数错 —— 判不了不记绿)
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { WRITE_BACK, parseFrontmatter, validateDraft } from './check-lesson-draft.mjs'
import { fingerprintOf, loadLessonPolicy } from './evolution-retro.mjs'
import { mkScratch } from './lib/scratch-dir.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'lesson-draft')
export const LESSONS_DIR = join(ROOT, '.ihui-agent', 'lessons')
export const INDEX_FILE = join(LESSONS_DIR, 'index.jsonl')
export const POLICY_PATH = join(ROOT, 'scripts', 'data', 'lesson-writeback-policy.json')

export const RESULT_TAG = 'LESSON-APPLY-RESULT'
export const SELFTEST_TAG = 'LESSON-APPLY-SELFTEST'

/** 跳过原因 → 人读字面(机器读 status,人读 reason,同一份闭集,不散落字符串)。 */
export const STATUS_TEXT = {
  promote: '可提升',
  promoted: '已提升',
  duplicate: '重复(指纹已在索引)',
  'duplicate-file': '重复(目标同名稿已在库,不覆盖)',
  invalid: '校验不过',
  'read-failed': '原件读不到',
  'write-failed': '写库失败(原件保留)',
}

const USAGE = [
  '用法:node scripts/lesson-apply.mjs [--apply] [--json]',
  '     node scripts/lesson-apply.mjs --self-test',
  '     node scripts/lesson-apply.mjs [--tmp-dir <dir>] [--lessons-dir <dir>]   # 演练/夹具',
].join('\n')

/** 参数解析(不抛错、不退出;坏参数以 {error} 返回,由 main 定档)。 */
export function parseArgs(argv) {
  const opts = {
    apply: false,
    json: false,
    selfTest: false,
    help: false,
    tmpDir: '',
    lessonsDir: '',
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
    if (arg === '--apply') opts.apply = true
    else if (arg === '--json') opts.json = true
    else if (arg === '--self-test') opts.selfTest = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--tmp-dir') opts.tmpDir = take()
    else if (arg === '--lessons-dir') opts.lessonsDir = take()
    else if (arg.startsWith('--')) opts.error = `未知参数: ${arg}`
    else opts.error = `多余的位置参数: ${arg}`
    if (opts.error) break
  }
  return opts
}

/** 读策略(形状锁在 loadLessonPolicy 里)。读不到/形状坏 ⇒ null,由调用方落未判定。 */
export function readPolicy(path = POLICY_PATH, readFile = readFileSync) {
  try {
    return loadLessonPolicy(String(readFile(path, 'utf8')))
  } catch {
    return null
  }
}

/**
 * 单枚稿的指纹:**frontmatter 自带的 `fingerprint` 优先,没有才按文件内容 hash**。
 *
 * 为什么允许 frontmatter 自带:上游若哪天开始产指纹,以它为准才是"同一条教训"的正解;这里
 * 只做读取,不产指纹(产指纹的口径在策略文件里,本文件不另写)。
 *
 * 已知弱点(实测记在这里,不假装没有):按内容 hash 时 `generatedAt` 也参与 —— 同一枚提交重新
 * 提炼一次,时间戳变了就是新指纹。第二道防线是"目标同名稿已存在即不覆盖"(见 applyLessons),
 * 文件名 = `sha7-slug`,同提交同标题必然同名,所以不会真出现两份。真正的解法是让提炼器产
 * 语义指纹,那要改 `lesson-draft.mjs`(本票禁改),登记在此。
 */
export function draftFingerprint(markdown, policy) {
  const parsed = parseFrontmatter(markdown)
  const declared = parsed.ok ? parsed.fields?.fingerprint : undefined
  if (declared !== undefined && declared !== null && String(declared).trim()) {
    return { fingerprint: String(declared).trim(), source: 'frontmatter' }
  }
  return { fingerprint: fingerprintOf(markdown, policy), source: 'content-hash' }
}

/** 索引行:字段顺序即契约顺序,便于人读 diff。 */
export function buildIndexEntry({ fingerprint, fileName, fields, firstSeenAt }) {
  const str = (k) => (typeof fields?.[k] === 'string' ? fields[k] : '')
  return {
    fingerprint,
    file: fileName,
    title: str('title'),
    kind: str('kind'),
    at: str('generatedAt') || firstSeenAt,
    sourceCommit: str('sourceCommit'),
    firstSeenAt,
  }
}

export function formatIndexLine(entry) {
  return `${JSON.stringify(entry)}\n`
}

/**
 * 读索引。坏行 ⇒ ok=false 并逐条点名(行号 + 为什么)。
 *
 * 为什么坏行就整轮未判定:索引是"fingerprint 唯一"的唯一凭据,读坏一行就等于那一行覆盖的
 * 教训是否已入库**判不了**;此时继续提升会写出第二条同指纹行,把唯一性破掉。索引本身是派生面
 * (稿子在 `.ihui-agent/lessons/` 里),修好或删掉重扫都比"带着坏行往前冲"安全。
 */
export function readIndex(indexPath, readFile = readFileSync) {
  const entries = []
  const findings = []
  if (!existsSync(indexPath)) return { ok: true, entries, findings }
  let raw = ''
  try {
    raw = String(readFile(indexPath, 'utf8'))
  } catch (error) {
    return { ok: false, entries, findings: [`E_INDEX_UNREADABLE:${error?.message ?? error}`] }
  }
  const lines = raw.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!line.trim()) return
    let doc = null
    try {
      doc = JSON.parse(line)
    } catch {
      doc = null
    }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      findings.push(`E_INDEX_BAD_LINE:第 ${i + 1} 行不是 JSON 对象`)
      return
    }
    if (typeof doc.fingerprint !== 'string' || !doc.fingerprint.trim()) {
      findings.push(`E_INDEX_NO_FINGERPRINT:第 ${i + 1} 行缺 fingerprint(唯一性凭据)`)
      return
    }
    entries.push(doc)
  })
  return { ok: findings.length === 0, entries, findings }
}

/** 目录里的候选稿名(排序后返回,保证预览顺序可复现;非 .md 一律不看)。 */
function listDrafts(tmpDir, readdir = readdirSync) {
  try {
    return readdir(tmpDir)
      .filter((n) => n.endsWith('.md'))
      .sort()
  } catch {
    return null
  }
}

/**
 * 提升主流程(本文件唯一有写盘的一段)。
 *
 * `apply=false` 时**零写盘**:只算规划,连 `.ihui-agent/lessons/` 都不创建 —— 预览必须是
 * 可反复跑的无副作用动作,否则"先看看"就已经把目录造出来了。
 *
 * 真提升的单枚顺序(契约:移动不是复制,写失败保留原件):
 *   ① 写目标 → ② 回读逐字比对 + 回读稿再过一次尺子 → ③ 追加索引一行 → ④ 删临时原件。
 * ①②失败 ⇒ 撤掉刚写的目标(此时目标必定是本轮新写,删它不伤别人的稿),原件不动;
 * ③失败 ⇒ 同样撤目标(否则会留下"库里有稿、索引没有"的孤儿),原件不动;
 * ④失败 ⇒ 仍记 promoted 并带 note:稿已入库、索引已记,下次扫描会判 duplicate,不会重复提升。
 */
export function applyLessons({
  tmpDir = TMP_DIR,
  lessonsDir = LESSONS_DIR,
  indexPath = join(lessonsDir, 'index.jsonl'),
  policy = readPolicy(),
  apply = false,
  now = Date.now(),
  io = {},
} = {}) {
  const fs = {
    exists: existsSync,
    readdir: readdirSync,
    readFile: readFileSync,
    writeFile: writeFileSync,
    appendFile: appendFileSync,
    unlink: unlinkSync,
    mkdir: mkdirSync,
    ...io,
  }
  const firstSeenAt = new Date(now).toISOString()

  if (!fs.exists(tmpDir)) {
    return {
      ok: false,
      undetermined: true,
      reason: 'tmp-missing',
      detail: `候选稿目录不存在:${tmpDir}(不猜"零积压")`,
      items: [],
    }
  }
  if (!policy) {
    return {
      ok: false,
      undetermined: true,
      reason: 'policy-unreadable',
      detail: `写回策略读不到或形状坏了:${POLICY_PATH}(指纹口径判不了)`,
      items: [],
    }
  }
  const names = listDrafts(tmpDir, fs.readdir)
  if (!names) {
    return {
      ok: false,
      undetermined: true,
      reason: 'tmp-unreadable',
      detail: `候选稿目录读不到:${tmpDir}`,
      items: [],
    }
  }
  const index = readIndex(indexPath, fs.readFile)
  if (!index.ok) {
    return {
      ok: false,
      undetermined: true,
      reason: 'index-corrupt',
      detail: `索引读不出唯一性凭据:${indexPath}`,
      findings: index.findings,
      items: [],
    }
  }

  // 已入库指纹集合:先灌索引,再在循环里累积 —— 同一批里两枚同指纹,第二枚当场判重复。
  const seen = new Set(index.entries.map((e) => e.fingerprint))
  const items = []

  for (const name of names) {
    const src = join(tmpDir, name)
    let text = ''
    try {
      text = String(fs.readFile(src, 'utf8'))
    } catch (error) {
      items.push({ file: name, status: 'read-failed', reason: error?.message ?? String(error) })
      continue
    }
    const verdict = validateDraft(text)
    if (!verdict.ok) {
      items.push({ file: name, status: 'invalid', findings: verdict.findings })
      continue
    }
    const parsed = parseFrontmatter(text)
    const { fingerprint, source } = draftFingerprint(text, policy)
    if (seen.has(fingerprint)) {
      items.push({ file: name, status: 'duplicate', fingerprint, source })
      continue
    }
    const target = join(lessonsDir, name)
    if (fs.exists(target)) {
      // 同名稿已在库:绝不覆盖已归档经验(覆盖 = 无声改写历史结论)。
      items.push({ file: name, status: 'duplicate-file', fingerprint, source, target })
      continue
    }
    const entry = buildIndexEntry({
      fingerprint,
      fileName: basename(name),
      fields: parsed.fields,
      firstSeenAt,
    })

    if (!apply) {
      seen.add(fingerprint)
      items.push({ file: name, status: 'promote', fingerprint, source, target, entry })
      continue
    }

    try {
      fs.mkdir(lessonsDir, { recursive: true })
      fs.writeFile(target, text, 'utf8')
      const back = String(fs.readFile(target, 'utf8'))
      if (back !== text) throw new Error('回读内容与原文不一致(写入被截断或换行被改写)')
      const recheck = validateDraft(back)
      if (!recheck.ok) throw new Error(`回读稿校验不过:${recheck.findings.join(';')}`)
    } catch (error) {
      rollback(fs, target)
      items.push({ file: name, status: 'write-failed', reason: error?.message ?? String(error) })
      continue
    }
    try {
      fs.appendFile(indexPath, formatIndexLine(entry), 'utf8')
    } catch (error) {
      rollback(fs, target)
      items.push({
        file: name,
        status: 'write-failed',
        reason: `索引追加失败:${error?.message ?? error}`,
      })
      continue
    }
    seen.add(fingerprint)
    let note = ''
    try {
      fs.unlink(src)
    } catch (error) {
      note = `临时原件删不掉(稿已入库、索引已记,下次扫描判重复):${error?.message ?? error}`
    }
    items.push({ file: name, status: 'promoted', fingerprint, source, target, note })
  }

  const tally = {}
  for (const item of items) tally[item.status] = (tally[item.status] ?? 0) + 1
  const moved = tally.promoted ?? 0
  const planned = tally.promote ?? 0
  return {
    ok: true,
    undetermined: false,
    apply,
    scanned: names.length,
    promoted: moved,
    planned,
    tally,
    items,
  }
}

/** 撤掉本轮刚写的目标(尽力而为:删不掉就留残件,但不吞掉失败判定)。 */
function rollback(fs, target) {
  try {
    if (fs.exists(target)) fs.unlink(target)
  } catch {
    /* 撤不掉不是本轮的判定项,失败原因已由调用方带出 */
  }
}

/** 末行(机读):与 `lesson-draft.mjs` 的 `LESSON-DRAFT-RESULT` 同形。 */
export function buildResultLine(fields) {
  const pairs = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${String(v).replace(/\s+/g, '_')}`)
  return `${RESULT_TAG} ${pairs.join(' ')}`
}

/** 人读预览:一枚一行,跳过项必须带原因(不静默丢弃)。 */
export function formatHuman(result, { tmpDir, lessonsDir }) {
  const lines = []
  lines.push(`候选稿目录:${tmpDir}`)
  lines.push(`经验库目录:${lessonsDir}${result.apply ? '' : '(预览,不写盘)'}`)
  if (result.undetermined) {
    lines.push(`⊘ 未判定(${result.reason}):${result.detail ?? ''}`)
    for (const f of result.findings ?? []) lines.push(`  ⊘ ${f}`)
    return lines
  }
  if (!result.scanned) {
    lines.push('目录里没有 .md 候选稿(判定完成:零积压,不是取不到)')
    return lines
  }
  for (const item of result.items) {
    const head = `${STATUS_TEXT[item.status] ?? item.status} ${item.file}`
    lines.push(`${item.status === 'promote' || item.status === 'promoted' ? '✅' : '⏭'} ${head}`)
    if (item.fingerprint) lines.push(`   fingerprint=${item.fingerprint}(${item.source})`)
    for (const f of item.findings ?? []) lines.push(`   - ${f}`)
    if (item.reason) lines.push(`   - ${item.reason}`)
    if (item.note) lines.push(`   - ${item.note}`)
  }
  return lines
}

/* ------------------------------------------------------------------ 自检 */

/** 夹具:一份过尺子的稿(字段与 `renderDraft` 同形,不 import 提炼器以免把它的夹具拖进来)。 */
function legalDraft(overrides = {}) {
  const f = {
    title: '提升前先校验候选稿',
    kind: 'feedback',
    rule: '候选稿进经验库前必须先过 validateDraft,不许跳过尺子直接 mv',
    why: '跳过尺子会把读起来像结论的假教训沉淀成可检索经验,后续照它改判据就是错上加错',
    howToApply: '落提升前先跑 node scripts/lesson-apply.mjs --json,看 skipped 的 findings',
    anchor: 'scripts/lesson-apply.mjs:1',
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    derived: '夹具',
    writeBack: WRITE_BACK,
    generatedBy: 'scripts/lesson-draft.mjs',
    generatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
  const fm = Object.entries(f)
    .map(([k, v]) => `${k}: ${JSON.stringify(String(v))}`)
    .join('\n')
  return [
    '---',
    fm,
    '---',
    '',
    '## 规则(rule)',
    '',
    f.rule,
    '',
    '## 为什么(why)',
    '',
    f.why,
    '',
    '## 怎么用(howToApply)',
    '',
    f.howToApply,
    '',
  ].join('\n')
}

function runSelfTest() {
  const cases = []
  const check = (name, fn) => {
    try {
      fn()
      cases.push({ name, ok: true })
    } catch (error) {
      cases.push({ name, ok: false, err: error?.message ?? String(error) })
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg || '断言失败')
  }
  const root = mkScratch('lesson-apply-')
  let seq = 0
  /** 每例一套独立夹具目录(tmp/ + lib/),互不污染。 */
  const fixture = () => {
    seq += 1
    const dir = join(root, `case${String(seq).padStart(2, '0')}`)
    const tmp = join(dir, 'tmp')
    const lib = join(dir, 'lib')
    mkdirSync(tmp, { recursive: true })
    return { dir, tmp, lib, index: join(lib, 'index.jsonl') }
  }
  const writeDraft = (tmp, name, text) => {
    mkdirSync(tmp, { recursive: true })
    writeFileSync(join(tmp, name), text, 'utf8')
    return join(tmp, name)
  }
  const indexLines = (indexPath) =>
    existsSync(indexPath)
      ? readFileSync(indexPath, 'utf8')
          .split(/\r?\n/)
          .filter((l) => l.trim())
      : []

  check('① 预览零写盘:合法稿判 promote,经验库目录不创建、原件不动', () => {
    const f = fixture()
    const src = writeDraft(f.tmp, 'aaaaaaa-合法.md', legalDraft())
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index })
    assert(r.ok && !r.undetermined, JSON.stringify(r.reason))
    assert(r.planned === 1 && r.items[0].status === 'promote', JSON.stringify(r.items))
    assert(!existsSync(f.lib), '预览不得创建经验库目录')
    assert(existsSync(src), '预览不得动原件')
    assert(indexLines(f.index).length === 0, '预览不得写索引')
  })

  check('② --apply 真移动:原件消失、库内逐字一致、索引恰一行', () => {
    const f = fixture()
    const md = legalDraft()
    const src = writeDraft(f.tmp, 'aaaaaaa-合法.md', md)
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    assert(r.promoted === 1, JSON.stringify(r.items))
    assert(!existsSync(src), '原件应被移走')
    const target = join(f.lib, 'aaaaaaa-合法.md')
    assert(readFileSync(target, 'utf8') === md, '库内内容与原文不一致')
    const lines = indexLines(f.index)
    assert(lines.length === 1, `索引行数=${lines.length}`)
    const row = JSON.parse(lines[0])
    assert(row.fingerprint === r.items[0].fingerprint, '索引指纹与结果不一致')
    assert(row.file === 'aaaaaaa-合法.md', `file=${row.file}`)
    assert(row.kind === 'feedback' && row.title === '提升前先校验候选稿', JSON.stringify(row))
    assert(row.sourceCommit === '0123456789abcdef0123456789abcdef01234567', 'sourceCommit 未带出')
    assert(typeof row.firstSeenAt === 'string' && row.firstSeenAt.endsWith('Z'), 'firstSeenAt 形态')
    // 提升后的稿仍必须带着 immutable-exempt-required:写回只有人工通道。
    assert(
      readFileSync(target, 'utf8').includes(`writeBack: "${WRITE_BACK}"`),
      'writeBack 被改写了',
    )
  })

  check('③ 提升后目录清空 ⇒ 再跑零枚,不产生第二行索引', () => {
    const f = fixture()
    writeDraft(f.tmp, 'aaaaaaa-合法.md', legalDraft())
    applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    const again = applyLessons({
      tmpDir: f.tmp,
      lessonsDir: f.lib,
      indexPath: f.index,
      apply: true,
    })
    assert(again.scanned === 0 && again.promoted === 0, JSON.stringify(again))
    assert(indexLines(f.index).length === 1, `索引行数=${indexLines(f.index).length}`)
  })

  check('④ 同内容再放回临时目录 ⇒ duplicate,索引仍一行', () => {
    const f = fixture()
    const md = legalDraft()
    writeDraft(f.tmp, 'aaaaaaa-合法.md', md)
    applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    writeDraft(f.tmp, 'bbbbbbb-换个名同内容.md', md)
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    assert(r.items[0].status === 'duplicate', JSON.stringify(r.items))
    assert(r.promoted === 0, '重复项不得再提升')
    assert(indexLines(f.index).length === 1, `索引行数=${indexLines(f.index).length}`)
    assert(existsSync(join(f.tmp, 'bbbbbbb-换个名同内容.md')), '重复项原件应保留(交人判)')
  })

  check('⑤ frontmatter 自带 fingerprint ⇒ 以它为准(不再按内容 hash)', () => {
    const f = fixture()
    writeDraft(f.tmp, 'aaaaaaa-自带指纹.md', legalDraft({ fingerprint: 'fp-from-upstream' }))
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index })
    assert(r.items[0].fingerprint === 'fp-from-upstream', JSON.stringify(r.items[0]))
    assert(r.items[0].source === 'frontmatter', `source=${r.items[0].source}`)
  })

  check('⑥ 校验不过 ⇒ invalid 且逐条点名原因,原件保留、零写入', () => {
    const f = fixture()
    const bad = legalDraft().replace(/\n## 为什么\(why\)\n\n[^\n]+/, '\n## 为什么(why)\n\n')
    const src = writeDraft(f.tmp, 'ccccccc-缺正文.md', bad)
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    assert(r.items[0].status === 'invalid', JSON.stringify(r.items))
    assert(
      (r.items[0].findings ?? []).some((x) => x.startsWith('E_SECTION_EMPTY')),
      JSON.stringify(r.items[0].findings),
    )
    assert(existsSync(src), '不合法的原件不得删(交人改)')
    assert(!existsSync(f.lib), '不合法时不得创建经验库目录')
  })

  check('⑦ 目标同名稿已在库 ⇒ duplicate-file,不覆盖、索引不加行', () => {
    const f = fixture()
    mkdirSync(f.lib, { recursive: true })
    writeFileSync(join(f.lib, 'ddddddd-同名.md'), '库里旧稿,不得被覆盖\n', 'utf8')
    writeDraft(f.tmp, 'ddddddd-同名.md', legalDraft({ title: '新稿' }))
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    assert(r.items[0].status === 'duplicate-file', JSON.stringify(r.items))
    assert(
      readFileSync(join(f.lib, 'ddddddd-同名.md'), 'utf8').startsWith('库里旧稿'),
      '已归档经验被覆盖了',
    )
    assert(indexLines(f.index).length === 0, 'duplicate-file 不得写索引')
  })

  check('⑧ 写库抛错 ⇒ write-failed,原件保留、索引零行(移动前先成功写目标)', () => {
    const f = fixture()
    const src = writeDraft(f.tmp, 'eeeeeee-写失败.md', legalDraft())
    const r = applyLessons({
      tmpDir: f.tmp,
      lessonsDir: f.lib,
      indexPath: f.index,
      apply: true,
      io: {
        writeFile: () => {
          throw new Error('夹具:磁盘满')
        },
      },
    })
    assert(r.items[0].status === 'write-failed', JSON.stringify(r.items))
    assert(String(r.items[0].reason).includes('磁盘满'), `reason=${r.items[0].reason}`)
    assert(existsSync(src), '写失败必须保留原件')
    assert(indexLines(f.index).length === 0, '写失败不得写索引')
  })

  check('⑨ 目录不存在 ⇒ 未判定(exit 2 语义),不回落成"零积压"', () => {
    const f = fixture()
    const r = applyLessons({ tmpDir: join(f.dir, '不存在'), lessonsDir: f.lib, indexPath: f.index })
    assert(r.undetermined && r.reason === 'tmp-missing', JSON.stringify(r))
    assert(!existsSync(f.lib), '未判定时不得写盘')
  })

  check('⑩ 索引坏行 ⇒ 未判定(唯一性判不了就不提升)', () => {
    const f = fixture()
    mkdirSync(f.lib, { recursive: true })
    writeFileSync(f.index, '{"fingerprint":"abc","file":"x.md"}\n坏行\n', 'utf8')
    writeDraft(f.tmp, 'fffffff-合法.md', legalDraft())
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    assert(r.undetermined && r.reason === 'index-corrupt', JSON.stringify(r))
    assert(
      r.findings.some((x) => x.startsWith('E_INDEX_BAD_LINE')),
      JSON.stringify(r.findings),
    )
    assert(existsSync(join(f.tmp, 'fffffff-合法.md')), '未判定时原件必须原样保留')
  })

  check('⑪ 落点结构锁:所有写盘目标都在经验库目录内(绝不碰 AGENTS.md / memory)', () => {
    const f = fixture()
    writeDraft(f.tmp, 'aaaaaaa-合法.md', legalDraft())
    writeDraft(f.tmp, 'bbbbbbb-另一枚.md', legalDraft({ title: '另一枚', rule: '另一条规则句' }))
    const r = applyLessons({ tmpDir: f.tmp, lessonsDir: f.lib, indexPath: f.index, apply: true })
    assert(r.promoted === 2, JSON.stringify(r.items))
    for (const item of r.items) {
      assert(item.target.startsWith(f.lib), `越界写盘:${item.target}`)
      assert(!/AGENTS\.md$|memory[\\/]/i.test(item.target), `越界写盘:${item.target}`)
    }
    assert(indexLines(f.index).length === 2, '两枚不同稿应各一行')
  })

  const failed = cases.filter((c) => !c.ok)
  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : `: ${c.err}`}`)
  console.log(`${SELFTEST_TAG} ok=${cases.length - failed.length} fail=${failed.length}`)
  return failed.length ? 1 : 0
}

/* ------------------------------------------------------------------ CLI */

function main(argv) {
  const opts = parseArgs(argv)
  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  if (opts.error) {
    console.error(`参数错误:${opts.error}`)
    console.log(USAGE)
    console.log(buildResultLine({ state: 'undetermined', reason: 'bad-args' }))
    return 2
  }
  if (opts.selfTest) return runSelfTest()

  const tmpDir = opts.tmpDir || TMP_DIR
  const lessonsDir = opts.lessonsDir || LESSONS_DIR
  const result = applyLessons({
    tmpDir,
    lessonsDir,
    indexPath: join(lessonsDir, 'index.jsonl'),
    apply: opts.apply,
  })

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          mode: opts.apply ? 'apply' : 'preview',
          tmpDir,
          lessonsDir,
          undetermined: result.undetermined,
          reason: result.reason ?? null,
          detail: result.detail ?? null,
          findings: result.findings ?? null,
          scanned: result.scanned ?? 0,
          promoted: result.promoted ?? 0,
          planned: result.planned ?? 0,
          tally: result.tally ?? {},
          items: result.items,
        },
        null,
        2,
      ),
    )
  } else {
    for (const line of formatHuman(result, { tmpDir, lessonsDir })) console.log(line)
  }

  if (result.undetermined) {
    console.log(
      buildResultLine({
        state: 'undetermined',
        mode: opts.apply ? 'apply' : 'preview',
        reason: result.reason,
      }),
    )
    return 2
  }
  const moved = result.promoted
  const planned = result.planned
  const state = result.scanned === 0 ? 'empty' : moved + planned > 0 ? 'ok' : 'none'
  console.log(
    buildResultLine({
      state,
      mode: opts.apply ? 'apply' : 'preview',
      scanned: result.scanned,
      promoted: moved || undefined,
      planned: planned || undefined,
      duplicate: result.tally.duplicate || undefined,
      duplicateFile: result.tally['duplicate-file'] || undefined,
      invalid: result.tally.invalid || undefined,
      failed: (result.tally['write-failed'] ?? 0) + (result.tally['read-failed'] ?? 0) || undefined,
      reason: state === 'none' ? 'all-skipped' : undefined,
    }),
  )
  if (state === 'none') return 1
  return 0
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (error) {
    console.error(`❌ ${error?.message ?? error}\n${error?.stack ?? ''}`)
    console.log(buildResultLine({ state: 'undetermined', reason: 'internal-error' }))
    process.exitCode = 2
  }
}

export const __test__ = {
  parseArgs,
  readPolicy,
  draftFingerprint,
  buildIndexEntry,
  formatIndexLine,
  readIndex,
  applyLessons,
  buildResultLine,
  formatHuman,
  legalDraft,
  main,
  runSelfTest,
  TMP_DIR,
  LESSONS_DIR,
  INDEX_FILE,
  POLICY_PATH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
