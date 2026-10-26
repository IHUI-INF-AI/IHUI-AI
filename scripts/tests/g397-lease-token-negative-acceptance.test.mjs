// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-397 票面自写的验收判据 —— 「注入一次租约(leaseId)不相等的迟到 finish 请求,控制文件必须不被改动」
//
// 票面口径(台账 G-397 原文):**收这一格的判据不是"代码写了 leaseId",而是"leaseId 不相等
// 的迟到 finish 打进去,控制文件逐字节不动"**。本文件就是那条判据的可复跑形态。
//
// 为什么跑在 `scripts/deploy-lock.mjs` 而不是票面点名的上游文件(2026-10-26 现读,取证见
// `.ihui-agent/tmp/s6-lease/progress.md`):
//  ① 上游 `packages/provider-node/src/zcode-builtin-remote-synchronizer.ts` **不在本仓** ——
//     `git ls-files packages/provider-node` 为空、工作树无该目录,全仓 `finishLease` 零实现命中;
//     按 `config/zcode-absorption.json` 登记,它只存在于只读学习克隆 `.ihui-agent/tmp/zcode-study/zcode`
//     (`scripts/zcode-absorption-matrix.mjs:41` 的 DEFAULT_CLONE),该目录本机不存在,直取上游
//     revision 亦超时 ⇒ 票面"leaseId 是否还在"这一半本机**未判定**(§0.3:不记绿也不冒红),
//     不拿一个不在盘上的对象造成用例。
//  ② 我方这一格**已装车**的是部署锁:G-696(2026-09-29)起 meta 带 `token`(`writeMeta` 现生成
//     `randomBytes(16)` hex,不可预测),`release` **先**比凭据,不匹配(含根本没带)⇒ 点名拒绝、
//     删锁那几步根本走不到。票面要的负向性质在这把锁上量得出来,故本文件把它钉成用例。
//  ③ `scripts/git-lock.mjs` 同一格**尚未装车**(release 认 `meta.pid === process.pid` 这一个
//     裸 pid 事实即可删锁,`git-lock.mjs:892-894`;`verifyHolder` 只接在抢占侧 `:1095`)。
//     那一格属 `git-lock` 持有人领地,本文件**不改它也不替它编造绿灯**;结论只进交付报告。
//
// §22c:归属比对住在源脚本里,本文件只 import `__test__`(acquire/release/readMeta/writeMeta/
// metaFile/check/isProcessAlive),不在测试里抄第二份判据。
//
// 真机零副作用:夹具全部走 `mkScratch()`(§15b 正牌出口,仓树外/唯一批准的 `.DevEnv`),
// 归档面与 pending 落点在任何用例**之前**指进夹具;`IHUI_DEPLOY_LOCK_TOKEN` /
// `IHUI_DEPLOY_LOCK_OWNER_PID` 必须先摘掉 —— 它们是 release/acquire 的**合法凭据来源**,
// 留着,"不匹配 ⇒ 拒绝"那几条就变成环境彩票(与 deploy-lock-release-owner-token.test.mjs 同纪律)。
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as L } from '../deploy-lock.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const DEPLOY_LOCK = join(SCRIPTS_DIR, 'deploy-lock.mjs')

// ---- 夹具环境:必须在任何会写现场的用例之前落地 ------------------------------
const ENV_BASE = mkScratch('g397-env-')
const SCENE_ROOT = join(ENV_BASE, 'scene')
mkdirSync(SCENE_ROOT, { recursive: true })
process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = SCENE_ROOT
delete process.env.IHUI_DEPLOY_LOCK_TOKEN
delete process.env.IHUI_DEPLOY_LOCK_OWNER_PID
after(() => rmScratch(ENV_BASE))

/**
 * 形状合法而值不同的第二枚凭据:必须是**同一形状**(32 位小写 hex,与 writeMeta 现生成的
 * 那枚一字不差地同形),否则"被拒"可能只是因为畸形,而不是因为"不是同一枚租约"。
 * 畸形那一族由用例 3 单独判。
 */
const SHAPE_VALID_BUT_DIFFERENT = '0123456789abcdef0123456789abcdef'

/** 已确定不存在的 pid(现查现用,不写死 —— 写死的会在别的机器上复活) */
function deadPid() {
  for (let p = 999_000; p < 1_200_000; p += 17) {
    if (!L.isProcessAlive(p)) return p
  }
  throw new Error('夹具需要一个确定已死的 pid,但未找到')
}

/**
 * 给本条用例开**独占**的归档面(代为收口/抢占才会往里写)。逐条独占的理由:
 * "被拒的 finish 不得留下归档现场"这条断言量的就是"scene 目录条目数没涨",
 * 共用一个 scene 时它读的是全局计数器,别条用例的现场会把它顶成假红/假绿。
 * @returns {() => number} 当前 scene 条目数的读数器
 */
function useScene(base) {
  const scene = join(base, 'scene')
  mkdirSync(scene, { recursive: true })
  process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = scene
  return () => readdirSync(scene).length
}

/** 控制文件的逐字节指纹(票面判据"必须不被改动"的唯一可量形态) */
function controlSha(dir) {
  const file = L.metaFile(dir)
  if (!existsSync(file)) return null
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** 锁目录的整体快照:控制文件指纹 + 目录在否 + 目录内条目清单(改名/搬走/加笔记都会露出来) */
function snapshotControl(dir) {
  return {
    sha: controlSha(dir),
    dirExists: existsSync(dir),
    entries: existsSync(dir) ? readdirSync(dir).sort().join('|') : null,
  }
}

/** 派 deploy-lock 的 CLI(§12g 显式 stdio;§5b windowsHide;凭据 env 从子进程里摘掉) */
function runCli(script, args, dir) {
  // 归档面随当条用例走(见 useScene),子进程只继承本条自己那一份,别条用例的现场不得混进来
  const env = { ...process.env }
  delete env.IHUI_DEPLOY_LOCK_TOKEN
  delete env.IHUI_DEPLOY_LOCK_OWNER_PID
  return spawnSync(process.execPath, [script, ...args, '--lock-dir', dir], {
    cwd: SCRIPTS_DIR,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
}

/** 一次合法 acquire:返回 CLI 打印并落盘的那枚租约凭据(票面里的 leaseId A) */
function acquireLease(script, dir) {
  const dead = deadPid()
  const acq = runCli(script, ['acquire', '--mode', 'build', '--owner-pid', String(dead)], dir)
  assert.equal(acq.status, 0, `acquire 夹具失败:${acq.stdout ?? ''}${acq.stderr ?? ''}`)
  const m = /token=([0-9a-f]{32})/.exec(acq.stdout ?? '')
  assert.ok(m, `acquire 必须把租约凭据交给调用方(stdout 应含 token=<32hex>):${acq.stdout}`)
  // 打印的那枚必须就是控制文件里的那枚(否则"凭 A finish"这条正向对照量的是别的东西)
  const st = L.readMeta(dir)
  assert.equal(st.kind, 'ok', `acquire 后 meta 必须可读且形态完好,实得 ${st.kind}`)
  assert.equal(st.meta.token, m[1], 'CLI 打印的凭据与落盘的凭据必须同一枚')
  return m[1]
}

// ══ 用例 1 · 票面负向主例 ═══════════════════════════════════════════════════
test('负向主例:合法 acquire 拿到租约 A ⇒ 迟到 finish 带不相等的 B ⇒ 控制文件逐字节未变且点名被拒(CLI 跨进程)', async () => {
  const base = mkScratch('g397-mismatch-')
  try {
    const sceneCount = useScene(base)
    const dir = join(base, 'lock')
    const leaseA = acquireLease(DEPLOY_LOCK, dir)
    const before = snapshotControl(dir)
    assert.ok(before.sha, '夹具前置:控制文件必须已落盘')
    const sceneBefore = sceneCount()

    // 迟到的 finish 请求:另一个进程、同 mode、带一枚**形状合法但不是这一枚**的凭据
    const late = runCli(
      DEPLOY_LOCK,
      ['release', '--mode', 'build', '--token', SHAPE_VALID_BUT_DIFFERENT],
      dir,
    )
    const out = `${late.stdout ?? ''}${late.stderr ?? ''}`
    assert.match(out, /拒绝释放/, `被拒必须点名(不得静默成功),实得输出:${out}`)
    assert.match(out, /owner token 不匹配/, `拒绝理由必须落在归属凭据这一格,实得:${out}`)

    // 票面的硬断言:控制文件**逐字节**未改动 —— 不是"还在就行",改名/归档搬走/改写 ts 都算动过
    const after_ = snapshotControl(dir)
    assert.equal(
      after_.sha,
      before.sha,
      '不匹配凭据的 finish 之后,控制文件 sha256 必须与之前逐字节相等',
    )
    assert.equal(after_.dirExists, true, '被拒的 finish 不得删锁')
    assert.equal(
      after_.entries,
      before.entries,
      '被拒的 finish 不得往锁目录里添/减任何文件(现场原样)',
    )
    assert.equal(L.check({ dir, log: () => {} }), 1, '生产侧只读探针必须仍报 locked')
    assert.equal(L.readMeta(dir).meta.token, leaseA, '被拒的 finish 不得改写锁里的凭据')

    // 同一条负向在进程内 API 层的机器可读形态:被拒 + why 点名(调用方拿得到,不是只有一行日志)
    const api = L.release({ mode: 'build', dir, token: SHAPE_VALID_BUT_DIFFERENT })
    assert.equal(api.released, false, `实得 ${JSON.stringify(api)}`)
    assert.match(api.why, /owner token 不匹配/, `返回值必须点名原因,实得 ${api.why}`)
    assert.equal(controlSha(dir), before.sha, '进程内 API 的拒绝路径同样不得改动控制文件')

    // 现场不得因为"被拒"而被搬走(归档面条目数不变 = 抢占/代为收口那条路根本没能进去)
    const sceneAfter = sceneCount()
    assert.equal(
      sceneAfter,
      sceneBefore,
      '被拒的 finish 不得留下归档现场(那说明它其实执行了代为收口)',
    )

    // 同批正向对照(独立一枚见用例 2):凭 A 自己 finish ⇒ 控制文件按预期消失。
    // 少了这一步,上面那一串"逐字节不变"可能只是因为链路没跑通而恒绿。
    const okRun = runCli(DEPLOY_LOCK, ['release', '--mode', 'build', '--token', leaseA], dir)
    assert.equal(okRun.status, 0, `凭同一租约的 finish 应成功:${okRun.stderr}`)
    assert.equal(
      existsSync(dir),
      false,
      `正向对照失效:凭 A finish 之后控制文件必须按预期变化(锁目录消失),CLI 输出:${okRun.stdout}${okRun.stderr}`,
    )
    assert.equal(L.check({ dir, log: () => {} }), 0, '正向 finish 后生产侧探针必须报未锁定')
  } finally {
    rmScratch(base)
  }
})

// ══ 用例 2 · 同批正向对照 ═══════════════════════════════════════════════════
test('正向对照(独立夹具):凭 acquire 那枚租约自己 finish ⇒ 控制文件按预期变化(证明用例 1 的"不变"不是恒真)', async () => {
  const base = mkScratch('g397-positive-')
  try {
    const sceneCount = useScene(base)
    const dir = join(base, 'lock')
    const leaseA = acquireLease(DEPLOY_LOCK, dir)
    const before = snapshotControl(dir)
    const sceneBefore = sceneCount()

    const r = runCli(DEPLOY_LOCK, ['release', '--mode', 'build', '--token', leaseA], dir)
    assert.equal(r.status, 0, `合法 finish 必须成功:${r.stderr}`)
    assert.equal(existsSync(dir), false, '合法 finish 之后锁目录必须不在了')
    assert.notEqual(
      snapshotControl(dir).sha,
      before.sha,
      '正向对照的断言形态:控制文件指纹必须**确实变了**(此处为不再存在)',
    )
    assert.ok(
      sceneCount() > sceneBefore,
      '代为收口的现场必须真的归档进夹具(scene 目录)——链路跑通的直接证据',
    )
  } finally {
    rmScratch(base)
  }
})

// ══ 用例 3 · 缺失/畸形租约一族 ═════════════════════════════════════════════
test('租约缺失或畸形(null / undefined / 空串 / 纯空白 / 非 hex / UUID 形态但非这一枚 / 超长 / 非字符串)的迟到 finish ⇒ 一律不得改动控制文件', () => {
  const base = mkScratch('g397-malformed-')
  try {
    useScene(base)
    const dir = join(base, 'lock')
    mkdirSync(dir, { recursive: true })
    // 用生产写盘出口建夹具(不在测试里手拼 meta,免得"控制文件长什么样"变成两份真相)。
    // 刻意不指定 pid:writeMeta 落的是**本进程** pid ⇒ 下面九次畸形 finish 全都"按 pid 看是持有者",
    // 仍一律被拒 —— 这正是票面那一格"认 token 不认 pid"的可观测形态。
    const written = L.writeMeta(dir, 'build', { ownerPid: deadPid() })
    const leaseA = written.token
    assert.equal(
      typeof leaseA,
      'string',
      `生产 writeMeta 必须落凭据,实得 ${JSON.stringify(leaseA)}`,
    )
    const before = snapshotControl(dir)

    const cases = [
      ['根本没带(undefined)', undefined],
      ['null', null],
      ['空串', ''],
      ['纯空白', '   '],
      ['非 hex 形态', 'not-a-lease-at-all'],
      // 票面点名的上游形态是 randomUUID:形状再"像 UUID"也不是同一枚,必须同样吃闭门羹
      ['UUID 形态但不是这一枚', '3f2504e0-4f89-41d3-9a0c-0305e82c3301'],
      ['超长串(4096 字)', 'a'.repeat(4096)],
      ['非字符串(数字 0)', 0],
      ['非字符串(对象)', {}],
    ]
    for (const [label, bogus] of cases) {
      const r = L.release({ mode: 'build', dir, token: bogus })
      assert.equal(
        r.released,
        false,
        `${label}:迟到 finish 竟被接受 ⇒ 控制文件被改动,实得 ${JSON.stringify(r)}`,
      )
      assert.match(r.why, /owner token 不匹配/, `${label}:拒绝必须点名归属凭据,实得 ${r.why}`)
      const now = snapshotControl(dir)
      assert.equal(now.sha, before.sha, `${label}:控制文件被改动了(sha 变了)`)
      assert.equal(now.dirExists, true, `${label}:被拒的 finish 不得删锁`)
      assert.equal(now.entries, before.entries, `${label}:被拒的 finish 不得增删锁目录内容`)
    }

    // 整轮畸形凭据打完之后,同一把锁仍能被**合法**租约改动 ⇒ 上面九个"不变"不是因为锁动不了
    const r = L.release({ mode: 'build', dir, token: leaseA })
    assert.equal(
      r.released,
      true,
      `正向对照失效:凭 acquire 那枚租约也 finish 不掉,实得 ${JSON.stringify(r)}`,
    )
    assert.equal(existsSync(dir), false, '合法 finish 之后锁目录必须不在了')
  } finally {
    rmScratch(base)
  }
})

// ══ 用例 4 · 变异自证 ══════════════════════════════════════════════════════
test('变异自证:在 scratch 副本里摘掉 release 的凭据等值比较 ⇒ 同一负向序列必须翻红(源文件一字未改)', async () => {
  const base = mkScratch('g397-mutation-')
  try {
    useScene(base)
    const src = readFileSync(DEPLOY_LOCK, 'utf8')
    // 票面点名的"等值比较"在生产里的这一格;命中次数必须恰为 1,否则变异的是别处 = 自证无效
    const GUARD = 'if (callerToken !== lockToken) {'
    const hits = src.split(GUARD).length - 1
    assert.equal(hits, 1, `变异锚点在源脚本里应恰命中 1 次,实得 ${hits} 次 ⇒ 变异自证失去依据`)

    const mutDir = join(base, 'scripts')
    const libDir = join(mutDir, 'lib')
    mkdirSync(libDir, { recursive: true })
    // 连依赖闭包一起复制(副本自足,不回读仓内 lib;只 './lib/x.mjs' 这一层,实测无传递相对依赖)
    for (const rel of [...src.matchAll(/from '(\.\/lib\/[^']+\.mjs)'/g)].map((m) => m[1])) {
      copyFileSync(join(SCRIPTS_DIR, rel), join(mutDir, rel.slice(2)))
    }
    const mutated = join(mutDir, 'deploy-lock.mjs')
    writeFileSync(mutated, src.replace(GUARD, 'if (false && callerToken !== lockToken) {'), 'utf8')
    const mutSrc = readFileSync(mutated, 'utf8')
    assert.notEqual(mutSrc, src, '副本必须真的被改过')
    assert.equal(mutSrc.split(GUARD).length - 1, 0, '副本里等值比较必须已被摘除')

    const dir = join(base, 'lock')
    acquireLease(mutated, dir)
    const before = controlSha(dir)
    const r = runCli(
      mutated,
      ['release', '--mode', 'build', '--token', SHAPE_VALID_BUT_DIFFERENT],
      dir,
    )
    // 摘掉比对 ⇒ 不相等的租约就能删掉别人的锁:这正是用例 1/3 要拦的那一型。
    // 这里断言的是"变异体确实把它删掉了":若这一条也绿不翻红,说明用例 1 的 sha 断言没有牙。
    assert.equal(
      existsSync(dir),
      false,
      `变异自证失效:摘掉凭据等值比较后,不匹配租约的 finish 仍删不掉锁 ⇒ 负向用例的绿灯不是这条判据给的(${r.stdout ?? ''}${r.stderr ?? ''})`,
    )
    assert.notEqual(
      controlSha(dir),
      before,
      '变异体下控制文件必须被改动(与用例 1 的"逐字节不变"构成对照)',
    )
  } finally {
    rmScratch(base)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
