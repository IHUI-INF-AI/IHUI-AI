// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * §22c 镜像测试:scripts/check-db-row-narrow-cas.mjs(DB 行面窄 CAS 修复模板采纳闸)+ 判据库
 * `scripts/lib/db-row-narrow-cas.mjs`。G-93,2026-10-15。
 *
 * 几条不可动摇的锁(违反任一条,这个测试就退化成"复读机"):
 *  M1 判据不重写 —— 测试 **import 判据库与门体**,不得在测试里抄第二份四态/三要素实现;
 *     门体与测试用的是**同一个函数对象**(引用相等),不是同形两份。
 *  M2 四态用例各一条 —— `clean / repair / unrelated / unsafe` 每态一条,问**结构**
 *     (verdict 属封闭集、writes 是数组、每条 write 带 from/to/expected),不问文本。
 *  M3 分界线 —— `unrelated` / `unsafe` 两支**什么都不写**:narrowCasRepair 层面断言
 *     updateRow 调用次数 === 0(不是"写了空对象"),`unsafe` 还要**抛错**(拒猜不是返回码)。
 *  M4 拒猜四格 —— 缺 expected / identity 前缀不匹配 / 污染形态不可证明 / 要改的列没有旧值。
 *  M5 未命中就重读再裁决 —— 成对两臂:第二枪的 WHERE 必须钉**新读到的值**,且不得等于
 *     第一次读到的旧值(等于即"返回旧快照"那一型);返回值结构上**没有** row/snapshot 字段。
 *  M6 静态判据成对 —— 合模板形态零缺项 / 顺手修形态缺项非空,断言 `missing` 数组而非源码文本。
 *  M7 门体必须真跑 —— `--self-test` rc=0;真仓 head 面候选 ≥ 1(枚举到 0 那格判死的反向证明)。
 *  M8 装车如实 —— 未进 guardian-runner 注册表时,门体头注**不得**自称已接线(守门 89 那一型);
 *     这条两侧状态都成立,不会因后续接线而腐烂。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as lib from '../lib/db-row-narrow-cas.mjs'
import { __test__ as gate } from '../check-db-row-narrow-cas.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE_REL = 'scripts/check-db-row-narrow-cas.mjs'
const GATE = join(REPO, GATE_REL)
const RUNNER_REL = 'scripts/guardian-runner.mjs'
const GIT = existsSync('C:/Program Files/Git/cmd/git.exe') ? 'C:/Program Files/Git/cmd/git.exe' : 'git'

/** 面:优先 HEAD blob(落地后),取不到回落磁盘(落地前窗口)。与门体不同面就会出现错位尺子。 */
function repoText(rel) {
  try {
    return execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  } catch {
    const abs = join(REPO, rel)
    if (!existsSync(abs)) throw new Error(`两侧都取不到:${rel}`)
    return readFileSync(abs, 'utf8')
  }
}

function run(args, opts = {}) {
  const out = spawnSync(process.execPath, [GATE, ...args], {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: REPO,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 1 << 26,
    windowsHide: true,
    ...opts,
  })
  return { rc: out.status, out: `${out.stdout ?? ''}${out.stderr ?? ''}` }
}

/* ───────────────────── 夹具:与上游同形的一行 session(污染落在宿主机绝对路径) ───────────────────── */

const POLLUTED_A = { id: 's1', workspaceID: 'ws-1', directory: '/host/proj', path: '/host/proj/a.ts' }
const POLLUTED_B = { id: 's1', workspaceID: 'ws-1', directory: '/host/other', path: '/host/other/b.ts' }
const CLEAN_ROW = { id: 's1', workspaceID: 'ws-1', directory: '/remote/proj', path: '/remote/proj/a.ts' }

/** 一份 spec(模板的调用方入参),与镜像测试各例共用。 */
const SPEC = {
  idKey: 'id',
  id: 's1',
  fields: ['directory', 'path'],
  owner: { key: 'workspaceID', value: 'ws-1' },
  prefixes: ['/host/'],
  repair: (field, cur) => cur.replace('/host/', '/remote/'),
  isClean: (field, cur) => typeof cur === 'string' && cur.startsWith('/remote/'),
}
const expectedOf = (row) => ({ directory: row.directory, path: row.path })

/** 记录每一枪的写,并把"命中几行"交给调用方编排。 */
function recorder(hits = []) {
  const calls = []
  const updateRow = async (write) => {
    calls.push(write)
    const n = hits[calls.length - 1]
    return typeof n === 'number' ? n : 0
  }
  return { calls, updateRow }
}

/* ───────────────────────────── M1 判据单源 ───────────────────────────── */

test('M1 判据只有一份:门体与镜像测试引用同一个函数对象', () => {
  assert.equal(gate.judgeTemplate, lib.judgeTemplate, '门体必须 re-export 判据库那一份,不得自带第二份')
  assert.equal(lib.VERDICTS.length, 4)
  assert.deepEqual([...lib.VERDICTS].sort(), ['clean', 'repair', 'unrelated', 'unsafe'])
  assert.deepEqual([...lib.TEMPLATE_PARTS], ['expected', 'fourState', 'reread'])
})

/* ────────────────────────── M2 四态用例各一条 ────────────────────────── */

test('M2 四态:clean / repair / unrelated / unsafe 各一条(问结构不问文本)', () => {
  const clean = lib.adjudicateRow({ ...SPEC, row: CLEAN_ROW, expected: expectedOf(POLLUTED_A) })
  assert.equal(clean.verdict, 'clean')
  assert.ok(lib.VERDICTS.includes(clean.verdict))
  assert.equal(clean.writes.length, 0, 'clean 不写')

  const repair = lib.adjudicateRow({ ...SPEC, row: POLLUTED_A, expected: expectedOf(POLLUTED_A) })
  assert.equal(repair.verdict, 'repair')
  assert.equal(repair.writes.length, 2)
  for (const w of repair.writes) {
    assert.deepEqual(Object.keys(w).sort(), ['expected', 'field', 'from', 'to'])
    assert.ok(w.to.startsWith('/remote/'))
    assert.equal(w.expected, POLLUTED_A[w.field], '每条 write 必须带它自己那一列的旧值')
  }

  const unrelated = lib.adjudicateRow({
    ...SPEC,
    row: { ...POLLUTED_A, workspaceID: 'ws-2' },
    expected: expectedOf(POLLUTED_A),
  })
  assert.equal(unrelated.verdict, 'unrelated')
  assert.equal(unrelated.reason, 'not-owned')
  assert.equal(unrelated.writes.length, 0)

  const unsafe = lib.adjudicateRow({
    ...SPEC,
    row: POLLUTED_A,
    expected: expectedOf(POLLUTED_A),
    identity: { present: true, matches: false },
  })
  assert.equal(unsafe.verdict, 'unsafe')
  assert.equal(unsafe.reason, 'identity-prefix-mismatch')
  assert.equal(unsafe.writes.length, 0)
})

/* ──────────────────── M3 分界线:unrelated / unsafe 零写入 ──────────────────── */

test('M3 unrelated 与 unsafe 两支什么都不写(写调用计数 === 0)', async () => {
  // unrelated:别人的行
  const r1 = recorder()
  const out1 = await lib.narrowCasRepair({
    ...SPEC,
    expected: expectedOf(POLLUTED_A),
    readRow: async () => ({ ...POLLUTED_A, workspaceID: 'ws-2' }),
    updateRow: r1.updateRow,
  })
  assert.equal(out1.verdict, 'unrelated')
  assert.equal(out1.wrote, false)
  assert.equal(r1.calls.length, 0, 'unrelated 一支发出任何 UPDATE 都算顺手修')

  // unsafe:含 identity 而前缀不匹配 ⇒ 拒猜抛错,且没写过
  const r2 = recorder()
  await assert.rejects(
    () =>
      lib.narrowCasRepair({
        ...SPEC,
        expected: expectedOf(POLLUTED_A),
        identity: { present: true, matches: false },
        readRow: async () => POLLUTED_A,
        updateRow: r2.updateRow,
      }),
    (e) => e instanceof lib.NarrowCasUnsafe && e.reason === 'identity-prefix-mismatch',
  )
  assert.equal(r2.calls.length, 0, 'unsafe 一支必须什么都不写')
})

/* ───────────────────────────── M4 拒猜四格 ───────────────────────────── */

test('M4 拒猜四格:证明不了的形态一律 unsafe,不猜', () => {
  const cases = [
    { name: '缺 expected(没有旧值的 UPDATE 不是 CAS)', input: { row: POLLUTED_A, expected: {} }, reason: 'no-expected' },
    {
      name: 'identity 前缀不匹配',
      input: { row: POLLUTED_A, expected: expectedOf(POLLUTED_A), identity: { present: true, matches: false } },
      reason: 'identity-prefix-mismatch',
    },
    {
      name: '污染形态不可证明(不在已知前缀清单里)',
      input: { row: { ...POLLUTED_A, directory: '/weird/x' }, expected: expectedOf(POLLUTED_A) },
      reason: 'unprovable-pollution',
    },
    {
      name: '要改的那一列没有旧值',
      input: { row: POLLUTED_A, expected: { directory: '/host/proj' } },
      reason: 'no-expected-for-field',
    },
  ]
  for (const c of cases) {
    const got = lib.adjudicateRow({ ...SPEC, ...c.input })
    assert.equal(got.verdict, 'unsafe', `${c.name} 必须落 unsafe`)
    assert.equal(got.reason, c.reason, `${c.name} 的 reason`)
    assert.equal(got.writes.length, 0, `${c.name} 不得产出任何 write`)
  }
})

/* ──────────── M5 未命中就重读再裁决:第二枪钉新事实,不返回旧快照 ──────────── */

test('M5 CAS 未命中 ⇒ 重读后按**新**事实再来一枪(成对两臂)', async () => {
  let reads = 0
  const rows = [POLLUTED_A, POLLUTED_B]
  const { calls, updateRow } = recorder([0, 0]) // 两枪都不命中 ⇒ 走"重读再裁决"直到用尽
  const out = await lib.narrowCasRepair({
    ...SPEC,
    expected: expectedOf(POLLUTED_A),
    maxRereads: 1,
    readRow: async () => rows[Math.min(reads++, rows.length - 1)],
    updateRow,
  })

  assert.equal(out.wrote, false)
  assert.equal(out.reason, 'cas-miss-exhausted')
  assert.equal(out.rereads, 1, '未命中后必须重读过')
  assert.equal(out.attempts, 2, '重读之后必须真的再裁决一枪')
  assert.equal(reads, 2, '读事实的次数 = 1 次初读 + 1 次重读')

  // 正控:第二枪的 WHERE 钉的是**新读到的**值
  assert.equal(calls.length, 2)
  assert.equal(calls[1].where.directory, POLLUTED_B.directory)
  // 反控:若实现沿用第一次读到的旧快照,第二枪的 WHERE 会仍是旧值 —— 那一型必须红
  assert.notEqual(calls[1].where.directory, POLLUTED_A.directory)
  assert.deepEqual(calls[1].set, { directory: '/remote/other', path: '/remote/other/b.ts' })

  // 结构上根本没有旧快照可返回(想返回也返回不了)
  for (const k of ['row', 'snapshot', 'rowBefore', 'stale']) {
    assert.equal(k in out, false, `返回值不得带 ${k} 字段(票面:不能返回旧快照)`)
  }
})

test('M5b 重读之后命中 ⇒ 写成并返回 repair', async () => {
  let reads = 0
  const rows = [POLLUTED_A, POLLUTED_B]
  const { calls, updateRow } = recorder([0, 1]) // 第一枪未命中、重读后第二枪命中
  const out = await lib.narrowCasRepair({
    ...SPEC,
    expected: expectedOf(POLLUTED_A),
    maxRereads: 1,
    readRow: async () => rows[Math.min(reads++, rows.length - 1)],
    updateRow,
  })
  assert.equal(out.wrote, true)
  assert.equal(out.verdict, 'repair')
  assert.equal(out.rereads, 1)
  assert.equal(calls[1].where.path, POLLUTED_B.path)
})

/* ─────────────────────────── M6 静态判据成对 ─────────────────────────── */

test('M6 静态判据成对:合模板零缺项 / 顺手修缺项非空(问 missing 数组)', () => {
  const ok = lib.judgeTemplate(`import { adjudicateRow } from '../lib/db-row-narrow-cas.mjs'
export async function repairRemoteSessionPaths(input) {
  const adj = adjudicateRow({ row, expected: { directory: input.expectedDirectory }, fields: ['directory'] })
  const r = await db.execute(sql\`update session set directory = \${adj.writes[0].to}
    where id = \${input.id} and directory = \${input.expectedDirectory}\`)
  return Number(r.changes) === 1
}`)
  assert.equal(ok.candidate, true)
  assert.deepEqual(ok.missing, [], '走模板 + 带旧值 ⇒ 零缺项')

  const bad = lib.judgeTemplate(`export async function repairThing(id, next) {
  await db.update(t).set({ directory: next }).where(eq(t.id, id))
  return true
}`)
  assert.equal(bad.candidate, true)
  assert.ok(bad.missing.includes('expected'))
  assert.ok(bad.missing.includes('fourState'))
  assert.ok(bad.missing.length > ok.missing.length, '顺手修的缺项必须多于合模板')

  // 缺项集合必须是三要素的子集(不许出现第四种缺项 ⇒ 判据面封闭)
  for (const m of [...ok.missing, ...bad.missing]) assert.ok(lib.TEMPLATE_PARTS.includes(m))
})

/* ───────────────────────────── M7 门体真跑 ───────────────────────────── */

test('M7 门体 --self-test 真跑且全绿', () => {
  const r = run(['--self-test'])
  assert.equal(r.rc, 0, `self-test 非绿:\n${r.out}`)
  assert.ok(!/❌/.test(r.out), `self-test 里有 ❌:\n${r.out}`)
})

test('M7b 真仓 head 面候选 ≥ 1(枚举到 0 判死那一格的反向证明)', () => {
  const { candidates, scanned } = gate.collectFace('head')
  assert.ok(scanned > 0, '扫到的源文件数必须 > 0')
  assert.ok(candidates.size >= 1, `head 面候选为 0 ⇒ 门体已瞎(扫到 ${scanned} 个源文件)`)
  const r = run([])
  assert.equal(r.rc, 0, `全量档存量只报数,不得红:\n${r.out}`)
})

/* ───────────────────────────── M8 装车如实 ───────────────────────────── */

test('M8 未进 runner 注册表时,门体头注不得自称已接线', () => {
  const runner = repoText(RUNNER_REL)
  const wired = runner.includes('check-db-row-narrow-cas.mjs')
  const header = repoText(GATE_REL).slice(0, 4000)
  if (!wired) {
    for (const claim of ['已接入 pre-commit', '已接线', '已接入守门链', 'CI 必跑']) {
      assert.equal(header.includes(claim), false, `未接线却自称「${claim}」(守门 89 那一型)`)
    }
  }
  assert.ok(true)
})

// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
