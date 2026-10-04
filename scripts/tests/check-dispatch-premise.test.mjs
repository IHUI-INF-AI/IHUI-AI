// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-dispatch-premise.mjs(G-830 派单模板"前提自检"门,2026-10-04 立)。
//
// 票面要求逐条钉死(判据纯函数直接 import,§22c 同口径):
//  1. **正例**:票面点名的标识在当前 HEAD 面 0 命中而声明 exists ⇒ 必须判"前提已腐烂"(红字 + 读数 +
//     结构化产物),退出码 1。少这一条,这道门可以是永绿机。
//  2. **反例(反向锁)**:同一作用域下点名的标识确有命中而声明 exists ⇒ 必须判绿、退出码 0。
//     少这一条,这道门就是一台恒红门(与 §12e「恒红门只逼人 --no-verify」同型)。
//  3. **反向腐烂**:声明 absent 但现读有命中 ⇒ 同样必须红(别人已补上,照旧前提造第二份就是重复)。
//  4. **自指陷阱**:票面把标识写进 PROJECT_PLAN.md 后全仓读数 ≥1 ⇒ 作用域必须强制排除台账,
//     否则"台账引用了它"会把已腐烂的前提洗成仍成立。
//  5. **不许无差别判红**:未判定(取不到读数 / claim 非法)判 exit 2 那一支,**不是**判通过。
//  6. 票面 schema:缺 premises / premises 为空 / probe 不是 git grep 形状 ⇒ exit 2(不当通过)。
//
// git 操作**只有只读**(git grep / rev-parse),不建临时仓、不写任何东西 ⇒ 绝不碰真仓。

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../check-dispatch-premise.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const SELF = fileURLToPath(import.meta.url)
const REPO_ROOT = resolve(dirname(SELF), '..', '..')
const SCRIPT = resolve(REPO_ROOT, 'scripts', 'check-dispatch-premise.mjs')

const {
  judgePremises,
  parseProbe,
  effectiveScope,
  loadTicket,
  readFace,
  sumHits,
  DEFAULT_SCOPE,
  MANDATORY_EXCLUDES,
} = __test__

/** 只读跑一次 CLI,返回 {rc, out}。 */
function runCli(args) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

function ticketFile(dir, name, obj) {
  const p = join(dir, name)
  writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8')
  return p
}

// ─────────────────────────────────────────────────────────────────────────────
test('P1 正例:票面点名的标识 HEAD 面 0 命中 + 声明 exists ⇒ 判前提已腐烂(退出码 1,带读数)', () => {
  // 用票面 G-830 实证为假的那三个标识 —— 与活体面同源,不是编出来的 token。
  const premises = [
    {
      claim: 'exists',
      token: 'check-virtualization-coverage',
      probe: 'git grep -c -F check-virtualization-coverage HEAD -- apps packages',
    },
    {
      claim: 'exists',
      token: 'apps/web/src/hooks/virtualization/',
      probe: 'git grep -c -F apps/web/src/hooks/virtualization/ HEAD -- apps packages',
    },
    {
      claim: 'exists',
      token: 'apps/cli/src/db.ts',
      probe: 'git grep -c -F apps/cli/src/db.ts HEAD -- apps packages',
    },
  ]
  const face = readFace({ root: REPO_ROOT, premises })
  assert.deepEqual(face.problems, [], `真面读数取不到:${face.problems.join(';')}`)
  // 前置:三个标识在默认作用域(已排除台账)必须真的 0 命中 —— 这一条同时钉住"自指排除生效"。
  for (const r of face.readings) {
    assert.equal(
      r.hits,
      0,
      `${r.token} 在 apps/packages/scripts 面应 0 命中,实读 ${r.hits}(若 ≥1 说明台账排除失效)`,
    )
  }
  const judged = judgePremises(premises, face.readings)
  assert.equal(judged.verdict, 'rotten')
  assert.equal(judged.rot, 3)
  assert.equal(judged.undetermined, 0)
  assert.equal(judged.rows[0].verdict, 'rotten')
  assert.match(judged.rows[0].why, /前提已腐烂/)
  assert.equal(judged.rows[0].hits, 0, '必须带读数(0),不是只说一句"已腐烂"')
})

test('P2 反例(反向锁):标识确有命中 + 声明 exists ⇒ 判绿(不许无差别报红)', () => {
  const premises = [
    {
      claim: 'exists',
      token: 'session-store',
      probe: 'git grep -c -F session-store HEAD -- apps packages',
    },
    {
      claim: 'exists',
      token: 'ai-vendors',
      probe: 'git grep -c -F ai-vendors HEAD -- apps packages',
    },
  ]
  const face = readFace({ root: REPO_ROOT, premises })
  assert.deepEqual(face.problems, [])
  for (const r of face.readings)
    assert.ok(r.hits >= 1, `${r.token} 在 scripts 面应 ≥1 命中,实读 ${r.hits}`)
  const judged = judgePremises(premises, face.readings)
  assert.equal(judged.verdict, 'holds', '前提仍成立却报红 ⇒ 这道门是恒红门')
  assert.equal(judged.rot, 0)
  assert.ok(judged.rows.every((r) => r.verdict === 'holds'))
})

test('P3 反向腐烂:声明 absent 但现读有命中 ⇒ 同样判红(方向对称)', () => {
  const premises = [
    {
      claim: 'absent',
      token: 'session-store',
      probe: 'git grep -c -F session-store HEAD -- apps packages',
    },
  ]
  const face = readFace({ root: REPO_ROOT, premises })
  const judged = judgePremises(premises, face.readings)
  assert.equal(judged.verdict, 'rotten')
  assert.match(judged.rows[0].why, /别人已补上|前提已腐烂/)
})

test('P4 自指陷阱:作用域强制排除台账,否则"台账引用了它"会把已腐烂洗成仍成立', () => {
  const sc = effectiveScope(DEFAULT_SCOPE)
  assert.ok(sc.includes(':(exclude)PROJECT_PLAN.md'), `默认作用域未排除台账:${sc.join(' ')}`)
  assert.ok(sc.includes(':(exclude).ihui-agent'))
  // 调用方显式传排除项也不许把它摘掉(强制并集,不是覆盖)。
  const sc2 = effectiveScope(['apps', ':(exclude)PROJECT_PLAN.md'])
  assert.ok(sc2.includes(':(exclude)PROJECT_PLAN.md'))

  // 活体证据(这一段是本条的关键,不能只钉纯函数):**全仓** scope 下票面点名的标识确有命中,
  // 而那一处命中就是台账自己 ⇒ 强制排除生效后必须回落到 0。
  // 没有这一段,把 effectiveScope 改成"直接返回 base"也能让 P4 的前半截通过 —— 而真正
  // 被打开的缺口是"派单者把 scope 写成全仓时,这道门会被台账引用洗成永绿机"。
  // ⚠️ 排除前的读数必须**绕过 readFace** 直测:readFace 内部已强制调 effectiveScope,
  // 所以经它读到的永远是排除后的 0(拿它当"排除前"会把这条断言写成永真)。
  const TOKEN = 'check-virtualization-coverage'
  const rawHits = (scope) => {
    const r = spawnSync(
      resolveGitBin() || 'git',
      [
        '-c',
        'safe.directory=*',
        '-C',
        REPO_ROOT,
        'grep',
        '-c',
        '-F',
        TOKEN,
        'HEAD',
        '--',
        ...scope,
      ],
      {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120_000,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    return sumHits(r.stdout)
  }
  assert.ok(
    rawHits(['.']) >= 1,
    `活体前提失效:全仓 scope 下 ${TOKEN} 应 ≥1 命中(台账引用了它),实读 ${rawHits(['.'])}`,
  )
  // 用 effectiveScope 取排除项,不手写清单 —— 清单会随判据增补而陈旧,而陈旧的断言会假红。
  assert.equal(rawHits(effectiveScope(['.'])), 0, '强制排除台账后应 0 命中 ⇒ 恒绿门')
  // 经 readFace(强制排除在内部生效)读全仓 scope,同样必须 0。
  const guarded = readFace({
    root: REPO_ROOT,
    premises: [{ claim: 'exists', token: TOKEN, scope: ['.'] }],
  })
  assert.deepEqual(guarded.problems, [])
  assert.equal(
    guarded.readings[0].hits,
    0,
    `readFace 内强制排除未生效,实读 ${guarded.readings[0].hits}`,
  )
})

test('P4b 门不读自己:本门与它的镜像测试里写满反例 token,作用域必须扫不到它们', () => {
  // 这条是本门自己的实测教训(落地当轮现形):反例素材就写在本门源码与本测试里,若默认作用域
  // 含 `scripts`,门会读到自己的素材 ⇒ 票面点名的标识读数从 0 抬到 12,正例当场翻绿。
  assert.ok(
    !DEFAULT_SCOPE.includes('scripts'),
    `默认作用域含 scripts ⇒ 门会读到自己的反例素材:${DEFAULT_SCOPE.join(' ')}`,
  )
  assert.ok(!DEFAULT_SCOPE.includes('docs'), '默认作用域含 docs ⇒ 文档引用会让标识自证存在')
  // 强制排除项必须显式含门自身与镜像测试(即便 scope 被传成 `scripts`)。
  for (const p of [
    'scripts/check-dispatch-premise.mjs',
    'scripts/tests/check-dispatch-premise.test.mjs',
  ]) {
    assert.ok(effectiveScope(['scripts']).includes(`:(exclude)${p}`), `强制排除项缺 ${p}`)
  }
  // 活体验证:门源码里确实写满了这些 token(前提未失效),而经 readFace 读 `scripts` 面仍是 0。
  const TOKEN = 'check-virtualization-coverage'
  assert.ok(
    readFileSync(resolve(REPO_ROOT, 'scripts', 'check-dispatch-premise.mjs'), 'utf8').includes(
      TOKEN,
    ),
    '前提失效:本门源码里已不含该 token ⇒ 这条断言失去意义',
  )
  const face = readFace({
    root: REPO_ROOT,
    premises: [{ claim: 'exists', token: TOKEN, scope: ['scripts'] }],
  })
  assert.deepEqual(face.problems, [])
  assert.equal(
    face.readings[0].hits,
    0,
    `门读到了自己的素材(实读 ${face.readings[0].hits})⇒ 正例会翻绿`,
  )
})

test('P5 未判定不当通过:取不到读数 / claim 非法 ⇒ undetermined(不是 holds)', () => {
  const noReading = judgePremises([{ claim: 'exists', token: 'nope', probe: 'p' }], [])
  assert.equal(noReading.verdict, 'undetermined')
  const badClaim = judgePremises(
    [{ claim: 'maybe', token: 't', probe: 'p' }],
    [{ token: 't', hits: 5 }],
  )
  assert.equal(badClaim.verdict, 'undetermined')
  // 混合场:一条 holds + 一条 undetermined ⇒ 整体 undetermined(不得被 holds 拉成绿)。
  const mixed = judgePremises(
    [
      { claim: 'exists', token: 'a', probe: 'p' },
      { claim: 'maybe', token: 'b', probe: 'p' },
    ],
    [{ token: 'a', hits: 3 }],
  )
  assert.equal(mixed.verdict, 'undetermined')
})

test('P6 probe 必须可重跑:非 git grep 形状 ⇒ 判不出,不当通过', () => {
  assert.equal(parseProbe('ls -la').ok, false)
  assert.equal(parseProbe('').ok, false)
  assert.equal(parseProbe('git grep -F tok').ok, false, '缺 -c / HEAD 不算合法 probe')
  const good = parseProbe('git grep -c -F tok HEAD -- apps scripts')
  assert.equal(good.ok, true)
  assert.equal(good.token, 'tok')
  assert.deepEqual(good.scope, ['apps', 'scripts'])
  // 省略 -- <scope…> ⇒ 落回默认作用域(代码面,不含台账)。
  assert.deepEqual(parseProbe('git grep -c -F tok HEAD').scope, DEFAULT_SCOPE)
  // 带引号的 token 也认。
  assert.equal(parseProbe('git grep -c -F "apps/cli/src/db.ts" HEAD').token, 'apps/cli/src/db.ts')
})

test('P7 票面 schema:缺 ticket / premises 为空 / token 与 probe 不一致 ⇒ exit 2 那一支', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-premise-'))
  const noTicket = loadTicket(
    ticketFile(dir, 'a.json', {
      premises: [{ claim: 'exists', token: 't', probe: 'git grep -c -F t HEAD' }],
    }),
  )
  assert.match(noTicket.error, /缺字段 ticket/)
  const empty = loadTicket(ticketFile(dir, 'b.json', { ticket: 'T', premises: [] }))
  assert.match(empty.error, /尺子空转|为空/)
  const mismatch = loadTicket(
    ticketFile(dir, 'c.json', {
      ticket: 'T',
      premises: [{ claim: 'exists', token: 'X', probe: 'git grep -c -F Y HEAD' }],
    }),
  )
  assert.match(mismatch.error, /不一致/)
  assert.match(loadTicket(join(dir, 'missing.json')).error, /读不到票面/)
  assert.match(loadTicket(null).error, /缺 --ticket/)
})

test('P8 退出码分档:正例 1 / 反例 0 / 用法错 2,产物落盘且带读数与 head', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-premise-'))
  const rot = ticketFile(dir, 'rot.json', {
    ticket: 'FIXTURE-ROT',
    premises: [
      {
        claim: 'exists',
        token: 'check-virtualization-coverage',
        probe: 'git grep -c -F check-virtualization-coverage HEAD -- apps packages',
      },
    ],
  })
  const ok = ticketFile(dir, 'ok.json', {
    ticket: 'FIXTURE-OK',
    premises: [
      {
        claim: 'exists',
        token: 'session-store',
        probe: 'git grep -c -F session-store HEAD -- apps packages',
      },
    ],
  })
  const outRot = join(dir, 'rot-report.json')
  const outOk = join(dir, 'ok-report.json')

  const r1 = runCli(['--ticket', rot, '--out', outRot])
  assert.equal(r1.rc, 1, `正例应 exit 1,实得 ${r1.rc}:${r1.out.slice(0, 200)}`)
  assert.match(r1.out, /前提已腐烂/)

  const r2 = runCli(['--ticket', ok, '--out', outOk])
  assert.equal(r2.rc, 0, `反例应 exit 0,实得 ${r2.rc}:${r2.out.slice(0, 200)}`)

  const usage = runCli([])
  assert.equal(usage.rc, 2, `缺 --ticket 应 exit 2,实得 ${usage.rc}`)

  // 产物必须是结构化 JSON 且带读数(head / scope / probes / verdict),不是 stdout 一闪而过。
  const j = JSON.parse(readFileSync(outRot, 'utf8'))
  assert.equal(j.kind, 'dispatch-premise-check')
  assert.equal(j.ticket, 'FIXTURE-ROT')
  assert.equal(j.verdict, 'rotten')
  assert.equal(j.rot, 1)
  assert.match(j.head, /^[0-9a-f]{40}$/)
  assert.deepEqual(j.scope.slice(-MANDATORY_EXCLUDES.length), MANDATORY_EXCLUDES)
  assert.equal(j.probes[0].token, 'check-virtualization-coverage')
  assert.equal(j.probes[0].hits, 0)
  assert.equal(j.probes[0].verdict, 'rotten')
  assert.equal(JSON.parse(readFileSync(outOk, 'utf8')).verdict, 'holds')
})

test('P9 sumHits:git grep -c 逐文件命中求和;空输出 = 0', () => {
  assert.equal(sumHits('HEAD:scripts/a.mjs:2\nHEAD:scripts/b.mjs:3\n'), 5)
  assert.equal(sumHits(''), 0)
  assert.equal(sumHits('\n\n'), 0)
  assert.equal(sumHits('HEAD:scripts/a.mjs:1'), 1)
})

test('P10 --self-test 出口:退出码 0 且逐条断言过(变异取证用这条命令)', () => {
  const r = runCli(['--self-test'])
  assert.equal(r.rc, 0, `--self-test 应 exit 0,实得 ${r.rc}:${r.out.slice(0, 300)}`)
  assert.match(r.out, /0 fail/)
})

// 镜像测试自身也要能被 node --test 直接发现(路径断言:防止文件被挪走而无人发现)。
test('P11 本测试文件与被测脚本同仓相邻(镜像关系不得悄悄断掉)', () => {
  assert.equal(SCRIPT, resolve(process.cwd(), 'scripts', 'check-dispatch-premise.mjs'))
  assert.match(pathToFileURL(SCRIPT).href, /scripts\/check-dispatch-premise\.mjs$/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
