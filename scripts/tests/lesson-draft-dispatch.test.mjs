// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 经验提炼派发腿(`sweepLessonDraft`)的调度镜像测试(2026-10-31 立)。
 *
 * 立因:器物 `scripts/lesson-draft.mjs` 早已造好(只读 git log、只写候选稿、frontmatter 恒
 * `writeBack: immutable-exempt-required`),但全仓**没有任何调度器**调用它 —— 只能人工敲,
 * 于是"每次改动/事故后提炼教训"结构上永不发生(§0.9:造好没装车 = 没有)。
 *
 * 钉死七件事(判据全部走生产函数本身,§22c 不复制):
 *  L1 器物不在位 ⇒ 跳过且**不写节流戳**(补回器物后下一轮立刻能跑);
 *  L2 有候选(`state=ok`)⇒ 记 drafted 并把 written 读数带出;
 *  L3 5 分钟节流:判过档窗口内不派生第二次,过窗即放行;
 *  L4 无候选(`undetermined + reason=no-extractable-lesson`)⇒ clean、零写,仍算"判过了";
 *  L5 未判定 ⇒ `ok=false` 不记绿,戳带 `judged:false`,1 小时冷却内不重试、过冷却重试;
 *  L6 结论行读不到 ⇒ 同样未判定(形状漂移不许冒绿);
 *  L7 结构锁:guardian 内不得出现写 AGENTS.md / memory 的动作,`sweepLessonDraft` 函数体内
 *     唯一的写盘目标是 tickFile。
 *  L8 装车锁:两处挂点(健康轮次族 / daemon tick 族)各一处,且登记进 `__test__` 出口。
 *
 * 射程说明:L7/L8 判的是**源码结构**,不是入库面 —— 未提交工作树上跑本文件即有牙;
 * 入库一致性由提交/推送本身保证,不由本锁重复判(否则本腿在落盘当轮就是恒红门)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { sweepLessonDraft } from '../git-guardian.mjs'
import { __test__ as lessonDraft } from '../lesson-draft.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')

/** 独立 scratch 落点(§15b:临时夹具只进 mkScratch,不落仓库树内)。 */
function fixture() {
  const dir = mkScratch('lesson-draft-sweep-')
  return { dir, tickFile: join(dir, 'tick.json'), outDir: join(dir, 'drafts') }
}

function logsOf() {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}

const RESULT = (state, kv = '') => `LESSON-DRAFT-RESULT state=${state}${kv ? ` ${kv}` : ''}`
const T0 = Date.parse('2026-10-31T00:00:00Z')
const MIN = 60 * 1000

/** 括号配平取函数体:先跳过参数表(`opts = {}` 的默认值里也有花括号,不能当函数体起点)。 */
function functionBody(src, name) {
  const start = src.indexOf(`export function ${name}(`)
  if (start < 0) return ''
  let i = src.indexOf('(', start)
  if (i < 0) return ''
  let pd = 0
  for (; i < src.length; i += 1) {
    if (src[i] === '(') pd += 1
    else if (src[i] === ')') {
      pd -= 1
      if (pd === 0) break
    }
  }
  const open = src.indexOf('{', i)
  if (open < 0) return ''
  let depth = 0
  for (let j = open; j < src.length; j += 1) {
    if (src[j] === '{') depth += 1
    else if (src[j] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(open, j + 1)
    }
  }
  return ''
}

test('L1 器物不在位 ⇒ 跳过且不写节流戳(不记为已探测)', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const r = sweepLessonDraft({
    ...f,
    logger,
    scriptFile: join(mkScratch('lesson-draft-missing-'), 'nope.mjs'),
  })
  assert.equal(r.ran, false)
  assert.match(String(r.why), /不在位/)
  assert.match(logs.join('\n'), /不记为已探测/)
  assert.equal(existsSync(f.tickFile), false, '器物不在位时写戳等于把"没跑"记成"刚跑过"')
})

test('L2 有候选 ⇒ drafted,written 读数出账,戳记 judged=true', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const r = sweepLessonDraft({
    ...f,
    now: T0,
    logger,
    runner: () =>
      RESULT('ok', 'mode=since commits=4 drafts=2 usable=2 skipped=2 written=2'),
  })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'drafted')
  assert.equal(r.written, 2)
  assert.match(logs.join('\n'), /产出 2 条候选稿/)
  assert.match(logs.join('\n'), /写回仍须人工/)
  const tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.equal(tick.judged, true)
  assert.equal(tick.written, 2)
  assert.equal(tick.state, 'drafted')
})

test('L3 5 分钟节流:判过档窗口内不派生第二次,过窗放行', () => {
  const f = fixture()
  let calls = 0
  const runner = () => {
    calls += 1
    return RESULT('ok', 'commits=1 usable=1 written=1')
  }
  const first = sweepLessonDraft({ ...f, now: T0, logger: () => {}, runner })
  assert.equal(first.ran, true)
  const within = sweepLessonDraft({ ...f, now: T0 + 4 * MIN, logger: () => {}, runner })
  assert.equal(within.ran, false)
  assert.match(String(within.why), /节流/)
  assert.equal(calls, 1, '窗口内第二次派发 = 每 2 分钟一 tick 会被反复点着')
  const after = sweepLessonDraft({ ...f, now: T0 + 5 * MIN, logger: () => {}, runner })
  assert.equal(after.ran, true)
  assert.equal(calls, 2)
})

test('L4 无候选 ⇒ clean 零写,但仍记"判过"(不得与"没跑"并桶)', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const r = sweepLessonDraft({
    ...f,
    now: T0,
    logger,
    runner: () => RESULT('undetermined', 'reason=no-extractable-lesson commits=3 skipped=3'),
  })
  assert.equal(r.ok, true)
  assert.equal(r.state, 'clean')
  assert.equal(r.written, undefined)
  assert.match(logs.join('\n'), /零可提炼/)
  // guardian 侧只写 tick,不往候选目录塞任何东西
  assert.deepEqual(readdirSync(f.dir), ['tick.json'])
  assert.equal(existsSync(f.outDir), false)
  const tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.equal(tick.judged, true)
  assert.equal(tick.written, 0)
})

test('L5 未判定 ⇒ ok=false 不记绿;1 小时冷却内不重试,过冷却重试', () => {
  const f = fixture()
  let calls = 0
  const runner = () => {
    calls += 1
    return RESULT('undetermined', 'reason=git-unavailable')
  }
  const first = sweepLessonDraft({ ...f, now: T0, logger: () => {}, runner })
  assert.equal(first.ran, true)
  assert.equal(first.ok, false, '"取不到输入"与"零候选"长得一样就是本文件要治的失效型')
  assert.equal(first.state, 'undetermined')
  const tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.equal(tick.judged, false)
  assert.equal(tick.reason, 'git-unavailable')
  const cool = sweepLessonDraft({ ...f, now: T0 + 30 * MIN, logger: () => {}, runner })
  assert.equal(cool.ran, false)
  assert.match(String(cool.why), /冷却/)
  assert.equal(calls, 1)
  const retry = sweepLessonDraft({ ...f, now: T0 + 61 * MIN, logger: () => {}, runner })
  assert.equal(retry.ran, true)
  assert.equal(calls, 2)
})

test('L6 结论行读不到 ⇒ 未判定(形状漂移不许冒绿)', () => {
  const f = fixture()
  const { logs, logger } = logsOf()
  const r = sweepLessonDraft({ ...f, now: T0, logger, runner: () => 'not a result line' })
  assert.equal(r.ok, false)
  assert.equal(r.state, 'undetermined')
  assert.match(logs.join('\n'), /未判定/)
  const tick = JSON.parse(readFileSync(f.tickFile, 'utf8'))
  assert.equal(tick.judged, false)
  assert.equal(tick.reason, 'no-result-line')
})

test('L7 结构锁:guardian 不写 AGENTS.md / memory;函数体内唯一写盘 = tickFile', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  const writeRe =
    /\b(writeFileSync|appendFileSync|createWriteStream|writeFile|copyFileSync|renameSync|truncateSync|rmSync|unlinkSync)\b/
  // 全文:含 AGENTS.md 的行不得同时出现写类 API(注释/字符串里的提及合法)
  const offenders = src
    .split('\n')
    .map((line, i) => ({ line: i + 1, text: line }))
    .filter(({ text }) => text.includes('AGENTS.md') && writeRe.test(text))
  assert.deepEqual(
    offenders.map((o) => `${o.line}:${o.text.trim()}`),
    [],
    'guardian 结构上不得出现写 AGENTS.md 的动作(写回是人工带 immutable-exempt 的提交)',
  )
  const body = functionBody(src, 'sweepLessonDraft')
  assert.ok(body.length > 0, '取不到 sweepLessonDraft 函数体')
  assert.equal(/AGENTS\.md/.test(body), false, '函数体内出现 AGENTS.md')
  assert.equal(/\bmemory\b/i.test(body), false, '函数体内出现 memory 写面')
  const writes = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => writeRe.test(l))
  assert.deepEqual(writes, ["writeFileSync(tickFile, JSON.stringify(tickBody), 'utf8')"])
})

test('L8 装车锁:两处挂点各一处,且登记进 __test__ 出口', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  const lines = src.split('\n')
  const CALL = 'if (!CHECK_ONLY) sweepLessonDraft()'
  assert.equal(lines.filter((l) => l.trim() === CALL).length, 2, '挂点必须恰好两处')
  const near = (anchor, within = 8) => {
    const i = lines.findIndex((l) => l.trim() === anchor)
    if (i < 0) return false
    return lines.slice(i, i + within).some((l) => l.trim() === CALL)
  }
  assert.ok(near('if (!CHECK_ONLY) sweepHeadRecallRows()'), '健康轮次族必须接上')
  assert.ok(near('if (!CHECK_ONLY) sweepStaleClaimMarks()'), 'daemon tick 族必须接上')
  const exportBlock = src.slice(src.indexOf('export const __test__ = {'))
  assert.match(exportBlock, /^\s*sweepLessonDraft,$/m, '未登记进 __test__ ⇒ 镜像测试打不到这一格')
})

test('L9 器物取材面:--commit HEAD 必须真取到该枚提交及其文件清单', () => {
  // 这是 G-14 接线时实测抓出的两处潜伏缺陷的回归锁:① `gitRaw` 在 utf8 下直接返回字符串,
  // 器物多取一层 `.stdout` ⇒ 恒空集;② 记录分隔符写在 format 结尾 ⇒ 路径块落进下一 chunk,
  // 本条 changedFiles 恒空、下一条被路径污染而整条丢弃。两者都让"永远 empty-interval"看起来
  // 像"区间内确实没提交"。
  const recs = lessonDraft.readCommits({ commit: 'HEAD', limit: 1 })
  assert.equal(recs.length, 1, 'HEAD 必须取到 1 枚')
  assert.match(recs[0].sha, /^[0-9a-f]{40}$/)
  const expected = execFileSync('git', ['show', '--name-only', '--format=', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
  assert.deepEqual([...recs[0].changedFiles].sort(), expected, '文件清单必须与 git 自身逐名一致')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
