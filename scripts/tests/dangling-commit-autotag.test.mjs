// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 悬空 commit 自动保活腿的镜像测试(§22c:import 生产判据 `__test__`,零复制)。
 *
 * 钉死七件事(机主 2026-10-30 自证清单):
 *   A1 窗内未备份 ⇒ 打上 tag,且**幂等**(第二次零动作);
 *   A2 超窗 ⇒ 只报数、一条不 tag(§29 人工 GC 存量);
 *   A3 时刻读不到 ⇒ 保守算窗内照拦(这一维不住在本器,住在门 30a 的 `splitUnbackedByWindow` ——
 *      本器只保证"门列出来的就照打",所以这里同时钉"本器 import 的是门那一把尺、没有第二把");
 *   A4 tag 名已存在 ⇒ 不覆盖并点名;
 *   A5 fsck/门 30a 取不到 ⇒ 未判定(不记绿、零 tag);
 *   A6 空转零写零推(clean ⇒ 不建留痕、不派推送、派发层不打日志);
 *   A7 红线形状锁:本器源码不得出现删 tag / GC 的任何形态;接线三处齐备(定义/巡检轮调用/导出)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { __test__ as AT } from '../lib/dangling-commit-autotag.mjs'
import { __test__ as lossGuard } from '../check-commit-loss-guard.mjs'
import { sweepDanglingCommitAutotag } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const GUARDIAN_DISK_PATH = resolve(ROOT, 'scripts', 'git-guardian.mjs')
/**
 * 接线锁的判据面 = **磁盘上守护真正执行的那份** `scripts/git-guardian.mjs`
 * (计划任务跑的是盘上文件,不是 HEAD blob ⇒ 派发层被一笔收编提交整层删掉,磁盘面第一时间红);
 * 而一旦 HEAD 面已经认下这条腿(本批改动落地之后),**两面同时判** ⇒ 工作树滞后副本也不能
 * 把"面上其实没接线"读成绿(§0.4 同面同轮)。落地前磁盘面单独放行,是给本批的,不是给腐烂的。
 */
const headShow = (rel) => {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
    })
  } catch {
    return ''
  }
}
const GUARDIAN_HEAD = headShow('scripts/git-guardian.mjs')
const GUARDIAN_FACES = [readFileSync(GUARDIAN_DISK_PATH, 'utf8')]
if (/sweepDanglingCommitAutotag/.test(GUARDIAN_HEAD)) GUARDIAN_FACES.push(GUARDIAN_HEAD)

const H1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const H2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const H3 = 'cccccccccccccccccccccccccccccccccccccccc'

/** 构造门 30a 的 stdout(横幅旗标名与终态文案全取生产常量,不写字面量 ⇒ 改了本器会红而不是静默失配)。 */
function guardStdout({
  unbacked = [],
  outOfWeek = [],
  green = false,
  noRisk = false,
  fullyBacked = false,
} = {}) {
  const L = ['🛡️  Commit 丢失防护守门']
  if (green) L.push(`✅ ${lossGuard.GREEN_MARKERS.noUnreachable}`)
  if (noRisk) L.push(`  ✅ ${lossGuard.GREEN_MARKERS.noRisk}`)
  if (fullyBacked) L.push('⚠  12 个悬空 commit 已全部 tag 备份(防止 git gc 清理)')
  if (unbacked.length) {
    L.push(`${lossGuard.FLAGS.listUnbacked}:${unbacked.length} 枚(完整 oid,可直接喂 git tag)`)
    L.push(...unbacked)
  }
  if (outOfWeek.length) {
    L.push(`${lossGuard.FLAGS.listOutOfWindow}:${outOfWeek.length} 枚(完整 oid,§29 人工 GC 候选)`)
    L.push(...outOfWeek)
  }
  return L.join('\n')
}

const depsOf = ({
  unbacked = [],
  outOfWeek = [],
  names = new Map(),
  rc = 0,
  stdout = null,
  fails = [],
}) => {
  const calls = { tagged: [], pushed: [], ledger: [] }
  const deps = {
    runGuard: () => ({
      rc,
      stdout: stdout ?? guardStdout({ unbacked, outOfWeek }),
      stderr: 'fatal: fsck 判定面取不到',
    }),
    tagFace: () => ({
      names: new Set(names.keys()),
      targetOf: (n) => names.get(n) || '',
    }),
    createTag:
      () =>
      ({ tag, sha }) =>
        fails.includes(sha)
          ? { ok: false, why: '注入失败' }
          : (calls.tagged.push([tag, sha]), { ok: true }),
    push: () => (tags) => (calls.pushed.push([...tags]), { status: 'ok', detail: '' }),
    ledgerAppend: () => (o) => {
      calls.ledger.push(o)
      return join(mkScratch('dangling-autotag-'), 'l.jsonl')
    },
    logger: () => {},
    nowIso: () => '2026-10-30T00:00:00.000Z',
  }
  return { deps, calls }
}

test('A1 窗内未备份 ⇒ 打上 tag;第二次(已在册)零动作 = 幂等', () => {
  const { deps, calls } = depsOf({ unbacked: [H1, H2] })
  const r1 = AT.autotagOnce({ ...deps, apply: true })
  assert.equal(r1.state, 'tagged')
  assert.equal(r1.tagged, 2)
  assert.deepEqual(
    calls.tagged.map((t) => t[0]),
    [AT.tagNameFor(H1), AT.tagNameFor(H2)],
  )
  assert.equal(calls.ledger.length, 1, '真加了 tag 才写留痕')
  assert.equal(calls.pushed.length, 1, '真加了 tag 才派一次 --auto-push')
  // 第二轮:30a 已不再列这两枚(它们被自己刚打的 tag 覆盖),tag 名也在册 ⇒ already,零新建零推送
  const second = depsOf({ unbacked: [], stdout: guardStdout({ fullyBacked: true }) })
  const r2 = AT.autotagOnce({ ...second.deps, apply: true })
  assert.equal(r2.state, 'clean')
  assert.equal(r2.tagged, 0)
  assert.equal(second.calls.tagged.length, 0)
  assert.equal(second.calls.pushed.length, 0)
  // 同一枚被再列一次(门没消账)⇒ 名在场且指向同枚 = already,绝不重复打
  const again = depsOf({
    unbacked: [H1],
    names: new Map([[AT.tagNameFor(H1), H1]]),
  })
  const r3 = AT.autotagOnce({ ...again.deps, apply: true })
  assert.equal(r3.already, 1)
  assert.equal(r3.tagged, 0)
  assert.equal(again.calls.tagged.length, 0, '幂等:已在册的一枚也不得再派 git tag')
})

test('A2 超窗 ⇒ 只报数、一条不 tag(§29 人工 GC 存量)', () => {
  const { deps, calls } = depsOf({ unbacked: [], outOfWeek: [H1, H2, H3] })
  const r = AT.autotagOnce({ ...deps, apply: true })
  assert.equal(r.state, 'clean')
  assert.equal(r.outOfWeek, 3, '超窗枚数必须作为读数带出,不得在账面上蒸发')
  assert.equal(calls.tagged.length, 0)
  assert.equal(calls.pushed.length, 0)
})

test('A3 窗维不住在本器:import 的是门 30a 那一把尺(含"时刻读不到⇒保守算窗内")', () => {
  // ① 本器用的清单旗标/窗宽常量与门 30a 是同一对象引用,不是抄的第二份字面量
  assert.equal(lossGuard.FLAGS.listUnbacked, '--list-unbacked')
  assert.equal(lossGuard.WINDOW_DAYS_DEFAULT, 30)
  const src = readFileSync(resolve(ROOT, 'scripts', 'lib', 'dangling-commit-autotag.mjs'), 'utf8')
  assert.doesNotMatch(
    src,
    /window-days|"--list-unbacked"|'--list-unbacked'/,
    '本器不得自造旗标/窗宽字面量',
  )
  assert.match(
    src,
    /from '\.\.\/check-commit-loss-guard\.mjs'/,
    '判据必须 import 门 30a 的 __test__',
  )
  // ② "时刻读不到 ⇒ 保守算窗内"由门那一侧给出,本器只照单打(正控 + 反向对照)
  const undated = lossGuard.splitUnbackedByWindow({
    unbacked: [H1],
    committerUnixByHash: new Map(),
    failedBatches: 1,
    nowUnix: 1_700_000_000,
    windowDays: 30,
  })
  assert.deepEqual(undated.blocking, [H1], '整批判不到时刻 ⇒ 门必须照拦(保守方向)')
  const outOfWindow = lossGuard.splitUnbackedByWindow({
    unbacked: [H2],
    committerUnixByHash: new Map([[H2, 1_000_000]]),
    nowUnix: 1_700_000_000,
    windowDays: 30,
  })
  assert.deepEqual(outOfWindow.blocking, [], '超窗 ⇒ 门不列进 blocking ⇒ 本器也就拿不到它')
  // ③ 门列进清单的,本器照打(不二次判窗)
  const { deps, calls } = depsOf({ unbacked: [H1] })
  AT.autotagOnce({ ...deps, apply: true })
  assert.equal(calls.tagged.length, 1)
})

test('A4 tag 名已存在而指向别的对象 ⇒ 不覆盖并点名', () => {
  const taken = AT.tagNameFor(H1)
  const { deps, calls } = depsOf({ unbacked: [H1], names: new Map([[taken, H2]]) })
  const r = AT.autotagOnce({ ...deps, apply: true })
  assert.equal(r.conflicts, 1)
  assert.equal(r.tagged, 0, '绝不覆盖别人的 tag(覆盖 = 把已保活的对象洗掉)')
  assert.equal(calls.tagged.length, 0)
  assert.equal(r.colliding[0].tag, taken)
  assert.equal(r.colliding[0].holds, H2, '点名必须带"这名字现在指着谁"')
  assert.equal(r.state, 'conflict')
})

test('A5 fsck 取不到(门 30a 自报未判定 rc=2)/ 清单与自报枚数对不上 ⇒ 未判定、零 tag', () => {
  const g2 = depsOf({ rc: 2, stdout: '' })
  const r2 = AT.autotagOnce({ ...g2.deps, apply: true })
  assert.equal(r2.state, 'undetermined')
  assert.equal(g2.calls.tagged.length, 0)
  assert.equal(r2.why.includes('未判定'), true, '未判定必须点名原因')

  // 横幅说 2 枚、实收 1 枚 ⇒ 清单腐烂,同样不得记绿(§0.3)
  const rot = depsOf({ stdout: `${lossGuard.FLAGS.listUnbacked}:2 枚\n${H1}` })
  const rr = AT.autotagOnce({ ...rot.deps, apply: true })
  assert.equal(rr.state, 'undetermined')
  assert.equal(rot.calls.tagged.length, 0)

  // 派生层没给退出码(崩溃/超时)⇒ 未判定
  const crash = depsOf({ rc: null, stdout: '' })
  assert.equal(AT.autotagOnce({ ...crash.deps, apply: true }).state, 'undetermined')

  // 既无横幅也无绿标 ⇒ 读不出这一档 ⇒ 未判定(不得折成"没有悬空")
  const blank = depsOf({ stdout: '随便一行文字,没有结论' })
  assert.equal(AT.autotagOnce({ ...blank.deps, apply: true }).state, 'undetermined')
})

test('A6 空转零写零推;打上才有留痕与推送;失败必进留痕', () => {
  const clean = depsOf({ unbacked: [], stdout: guardStdout({ green: true }) })
  const rc = AT.autotagOnce({ ...clean.deps, apply: true })
  assert.equal(rc.state, 'clean')
  assert.equal(clean.calls.ledger.length, 0, '空转一行留痕都不写')
  assert.equal(clean.calls.pushed.length, 0, '空转一次推送都不派')

  const dry = depsOf({ unbacked: [H1] })
  const rd = AT.autotagOnce({ ...dry.deps, apply: false })
  assert.equal(rd.state, 'pending')
  assert.equal(dry.calls.tagged.length, 0, '预演档一个 tag 也不打')

  const part = depsOf({ unbacked: [H1, H2], fails: [H2] })
  const rp = AT.autotagOnce({ ...part.deps, apply: true })
  assert.equal(rp.tagged, 1)
  assert.equal(rp.failed, 1)
  assert.equal(part.calls.ledger.length, 1, '打上过才写留痕')
  assert.equal(
    part.calls.ledger[0].failed.length,
    1,
    '打不上的那枚必须进留痕(失败必响,不能只报成功)',
  )
  assert.deepEqual(
    part.calls.ledger[0].tags,
    [AT.tagNameFor(H1)],
    '留痕逐枚点名打了哪些 tag(可追责)',
  )
  assert.equal(part.calls.ledger[0].kind, 'dangling-autotag')
  assert.equal(part.calls.ledger[0].seat, AT.SEAT)
})

test('A7 红线形状锁:只加不减 —— 源码零删 tag / 零 GC 形态', () => {
  const src = readFileSync(resolve(ROOT, 'scripts', 'lib', 'dangling-commit-autotag.mjs'), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(code, /tag\s+(-d|--delete)/, '不得删 tag(§29 GC 归人工)')
  assert.doesNotMatch(code, /'gc'|"gc"|git gc/, '不得跑 git gc')
  assert.doesNotMatch(code, /update-ref[^\n]*-d/, '不得借 update-ref 删引用')
  assert.match(code, /gitRaw\(\['tag', tag, sha\]/, '保活动作必须是加法 git tag')
})

test('A8 接线锁:派发层定义 + 巡检轮调用 + __test__ 出口 + 15 分钟节流(每个判据面都过一遍)', () => {
  for (const face of GUARDIAN_FACES) {
    const code = face.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert.match(code, /export function sweepDanglingCommitAutotag\(/, '派发函数体不得缺席')
    assert.match(code, /if \(!CHECK_ONLY\) sweepDanglingCommitAutotag\(\)/, '巡检轮调用点不得缺席')
    assert.match(code, /^\s*sweepDanglingCommitAutotag,$/m, '__test__ 出口条目不得缺席')
    assert.match(code, /IHUI_DANGLING_AUTOTAG_INTERVAL_MS/, '节流必须可由 env 覆盖')
    assert.match(
      code,
      /DANGLING_AUTOTAG_INTERVAL_MS \|\| 15 \* 60 \* 1000/,
      '默认节拍 ≥15 分钟(fsck 全量要几分钟)',
    )
    // 与同族清扫器邻接:必须挂在同一个函数体内("文件里两处都出现过"不等于接上了)
    const mine = code.match(/if \(!CHECK_ONLY\) sweepDanglingCommitAutotag\(\)/)
    const sibling = code.match(/if \(!CHECK_ONLY\) sweepBannedBuckets\(\)/)
    assert.ok(mine && sibling, '两条派发都要在(同族节拍)')
    const fnStarts = [...code.matchAll(/^(?:export )?(?:async )?function\s+(\w+)/gm)].map(
      (m) => m.index,
    )
    const enclosing = (idx) => {
      let name = null
      for (const s of fnStarts) {
        if (s <= idx)
          name = code
            .slice(s, code.indexOf('(', s))
            .replace(/^(?:export\s+)?(?:async\s+)?function\s+/, '')
        else break
      }
      return name
    }
    assert.equal(enclosing(mine.index), enclosing(sibling.index), '必须同挂巡检轮函数体')
  }
})

test('A9 派发层读数分档:clean 零日志;tagged 绿行带计数;未判定不记绿且到人', () => {
  const dir = mkScratch('dangling-autotag-')
  const logs = []
  const mails = []
  const notify = (name, detail, opts = {}) => {
    mails.push({ name, detail, opts })
    return { sent: false, why: '测试替身' }
  }
  const runnerOf = (obj) => () => JSON.stringify(obj)
  // clean ⇒ 不打日志行(空转零写,§5e-1)
  const r1 = sweepDanglingCommitAutotag({
    tickFile: join(dir, 't1.json'),
    logger: (m) => logs.push(m),
    runner: runnerOf({ state: 'clean', tagged: 0, unbacked: 0, outOfWeek: 0, push: 'skip' }),
    notify,
  })
  assert.equal(r1.ok, true)
  assert.equal(logs.filter((l) => /悬空 commit 保活/.test(l)).length, 0, 'clean 不得占日志行')
  assert.equal(mails.length, 0, 'clean 不得到人')
  // tagged ⇒ 读数逐键点名
  const r2 = sweepDanglingCommitAutotag({
    tickFile: join(dir, 't2.json'),
    logger: (m) => logs.push(m),
    runner: runnerOf({
      state: 'tagged',
      tagged: 3,
      unbacked: 3,
      outOfWeek: 9,
      already: 0,
      conflicts: 0,
      deferred: 0,
      failed: 0,
      push: 'ok',
    }),
    notify,
  })
  assert.equal(r2.tagged, 3)
  const line = logs.find((l) => /悬空 commit 保活/.test(l))
  assert.match(line, /✅/)
  assert.match(line, /超窗只报数=9/, '超窗存量必须看得见(不得因"没拦"而在账面蒸发)')
  assert.equal(mails.length, 0, '正常打上 tag 属器物自己能干完的活,不到人')
  // undetermined ⇒ 到人(收信人能做什么:让 fsck 跑得通)
  const r3 = sweepDanglingCommitAutotag({
    tickFile: join(dir, 't3.json'),
    logger: (m) => logs.push(m),
    runner: runnerOf({ state: 'undetermined', tagged: 0, why: '门 30a 未判定:fsck 判定面取不到' }),
    notify,
  })
  assert.equal(r3.ok, false, '未判定绝不记绿')
  assert.equal(mails.length, 1)
  assert.match(mails[0].detail, /fsck/)
  assert.match(
    mails[0].opts.dedupKey,
    /state=undetermined/,
    '到人按稳定身份去重(§5e-3),不得每轮重寄',
  )
  // 结论行取不到 ⇒ 未判定 + 不记绿
  const r4 = sweepDanglingCommitAutotag({
    tickFile: join(dir, 't4.json'),
    logger: () => {},
    runner: () => '半截输出',
    notify,
  })
  assert.equal(r4.ok, false)
  assert.equal(r4.state, 'undetermined')
})

test('A10 节流窗口内不派生第二次 + 器物不在位只跳过不记绿', () => {
  const dir = mkScratch('dangling-autotag-')
  let calls = 0
  const counting = () => {
    calls += 1
    return JSON.stringify({ state: 'clean', tagged: 0 })
  }
  const now = 1_700_000_000_000
  const a = sweepDanglingCommitAutotag({
    tickFile: join(dir, 't.json'),
    logger: () => {},
    runner: counting,
    now,
    notify: () => ({}),
  })
  assert.equal(a.ran, true)
  const b = sweepDanglingCommitAutotag({
    tickFile: join(dir, 't.json'),
    logger: () => {},
    runner: counting,
    now: now + 60_000,
    notify: () => ({}),
  })
  assert.equal(b.ran, false)
  assert.equal(calls, 1, '15 分钟窗内一次都不派生(每轮全仓 fsck 是要烧分钟的)')
  const c = sweepDanglingCommitAutotag({
    tickFile: join(dir, 't2.json'),
    logger: () => {},
    scriptFile: join(dir, 'nope.mjs'),
    runner: counting,
  })
  assert.equal(c.ran, false)
  assert.equal(c.why, '器物不在位', '器物缺席要明说"跳过,不记为已探测"(§0.3)')
})

test('A11 展示文案依赖的腐烂锁:门 30a 的两句判读锚点仍在源文件里', () => {
  // 本器把"未备份集为空但确有悬空"这一档认成 clean,靠的是门 30a 打印的那句"已全部 tag 备份";
  // 这句没进 GREEN_MARKERS ⇒ 属展示文案依赖。文案一改,本器会静默读成"没判成" ⇒ 由这条锁盯住:
  // 门体文案漂了先在这里红,而不是在守护日志里以"未判定"的名义长年空转。
  const guardSrc = readFileSync(resolve(ROOT, 'scripts', 'check-commit-loss-guard.mjs'), 'utf8')
  assert.match(
    guardSrc,
    /已全部\s*tag\s*备份/,
    '门 30a 的"已全部 tag 备份"读数行漂了 ⇒ 本器认档的那句要同步改',
  )
  assert.equal(lossGuard.FLAGS.listUnbacked, '--list-unbacked')
  assert.equal(lossGuard.FLAGS.listOutOfWindow, '--list-out-of-window')
})

test('A14 真跑实测那一型:确有悬空但后备援集为空 ⇒ 门只打终态句、零横幅 ⇒ 本器判 clean(不得读成未判定)', () => {
  // 2026-10-30 本票实跑第二次撞上的形状:`⚠️ 检测到 1 个悬空 commit` + `✅ 无 commit 丢失风险`
  // (那枚被树的等价/同内容白名单放行 ⇒ unbacked 集为空 ⇒ 门根本不打 --list-* 横幅)。
  // 只认 noUnreachable 的实现会把"门判完了、没债"读成"门没判成"⇒ 每 15 分钟一条未判定 + 一封邮件。
  const { deps, calls } = depsOf({ stdout: guardStdout({ noRisk: true }) })
  const r = AT.autotagOnce({ ...deps, apply: true })
  assert.equal(r.state, 'clean')
  assert.equal(r.why, '')
  assert.equal(calls.tagged.length, 0)
  assert.equal(calls.ledger.length, 0, 'clean 一行留痕都不写')
  // 反向对照:终态句也不在、横幅也不在 ⇒ 才是真未判定(A5 的 blank 档)
  const blank = depsOf({ stdout: '⚠️  检测到 1 个悬空 commit:' })
  assert.equal(AT.autotagOnce({ ...blank.deps, apply: true }).state, 'undetermined')
})

test('A15 结论锚点全部门口:本器消费的两句终态文案必须是门自己导出的常量(不抄文案)', () => {
  const src = readFileSync(resolve(ROOT, 'scripts', 'lib', 'dangling-commit-autotag.mjs'), 'utf8')
  // 剥注释后再查(注释里允许出现原文案作为说明,代码里出现才算抄了第二份)
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.match(code, /lossGuard\.GREEN_MARKERS\.noUnreachable/)
  assert.match(code, /lossGuard\.GREEN_MARKERS\.noRisk/)
  assert.doesNotMatch(
    code,
    /无 commit 丢失风险|未检测到悬空 commit/,
    '终态文案不得在本器里另抄一份字面量',
  )
})

test('A13 真 git 端到端(装车证明):夹具仓里造一枚真悬空 commit ⇒ 真打上 tag,第二轮幂等零动作', () => {
  const dir = mkScratch('dangling-autotag-e2e-')
  const git = (...args) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 60_000,
    }).trim()
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'fixture@ihui.local')
  git('config', 'user.name', 'fixture')
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  git('add', 'a.txt')
  git('commit', '-q', '-m', 'feat: 基线提交')
  writeFileSync(join(dir, 'b.txt'), 'b\n')
  git('add', 'b.txt')
  git('commit', '-q', '-m', 'fix: 这枚将被 reset 丢掉')
  const lost = git('rev-parse', 'HEAD')
  git('reset', '--hard', 'HEAD~1')
  const before = git('tag', '-l').split('\n').filter(Boolean)

  const pushed = []
  const r1 = AT.autotagOnce({
    root: dir,
    apply: true,
    push: () => (tags) => (pushed.push([...tags]), { status: 'ok', detail: '' }),
    logger: () => {},
  })
  assert.equal(r1.state, 'tagged', `真悬空必须被保活(读数:${JSON.stringify(r1)})`)
  assert.equal(r1.tagged, 1)
  const tagName = AT.tagNameFor(lost)
  assert.equal(
    git('rev-parse', '--verify', '--quiet', `${tagName}^{commit}`),
    lost,
    'tag 必须指向那枚丢的 commit',
  )
  assert.deepEqual(
    pushed[0],
    [tagName],
    '只把本轮新打的 tag 交给 --auto-push(IHUI_TAG_ONLY 精确投递)',
  )
  // 留痕真落盘(可问责),且落在夹具仓不在主仓
  const ledgerAbs = join(dir, AT.LEDGER_REL)
  assert.match(readFileSync(ledgerAbs, 'utf8'), new RegExp(tagName))

  // 第二轮:门 30a 不再列这枚(它已被自己刚打的 tag 覆盖)⇒ clean、零新建、零推送、零留痕
  const ledgerLines1 = readFileSync(ledgerAbs, 'utf8').trim().split('\n').length
  const pushed2 = []
  const r2 = AT.autotagOnce({
    root: dir,
    apply: true,
    push: () => (tags) => (pushed2.push(tags), { status: 'ok', detail: '' }),
    logger: () => {},
  })
  assert.equal(r2.state, 'clean', `第二轮必须零动作(读数:${JSON.stringify(r2)})`)
  assert.equal(pushed2.length, 0, '空转一次推送都不派')
  assert.equal(
    readFileSync(ledgerAbs, 'utf8').trim().split('\n').length,
    ledgerLines1,
    '空转一行留痕都不写(§5e-1)',
  )
  // 只加不减:第一轮之前存在的 tag 一枚不少
  const after = git('tag', '-l').split('\n').filter(Boolean)
  for (const t of before) assert.ok(after.includes(t), `既有 tag ${t} 不得被删`)
})

test('A12 单轮上限:超出记 deferred 交下一轮,绝不静默截断', () => {
  const many = Array.from({ length: 7 }, (_, i) => String(i).padStart(40, '0'))
  const plan = AT.planAutotags({ unbacked: many, existingTagNames: new Set(), cap: 3 })
  assert.equal(plan.create.length, 3)
  assert.equal(plan.deferred.length, 4, '让位的枚数必须报得出来')
  assert.deepEqual(
    plan.deferred.map((d) => d.sha),
    many.slice(3),
  )
  const { deps, calls } = depsOf({ unbacked: many })
  const r = AT.autotagOnce({ ...deps, apply: true, cap: 3 })
  assert.equal(r.deferred, 4)
  assert.equal(calls.tagged.length, 3)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
