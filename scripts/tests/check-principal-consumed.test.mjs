// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 守门「ai-service 身份消费对账」(check-principal-consumed.mjs)的 §22c 镜像测试。
 *
 * 为什么每例都必须存在:本门守的是**没有任何编译期症状**的一型 —— 端点取到已验证身份
 * 却一次没用它,typecheck / lint / 其余门全绿,只有越权读别人数据的人才会撞上。
 * 而门自身最容易的三种"看起来正常其实失明":注册块缺失(门存在但无人调度)、
 * 判据被复制成第二份(两处算同一件事必漂移)、取材回磁盘(共享工作树滞后 HEAD 时换结论)。
 * 这三种都只会表现为一路报绿,所以必须用源码锁 + 夹具仓端到端钉住。
 *
 * 判据本体的对错**不在这里测**(那是 apps/ai-service/tests/test_audit_principal_consumed.py
 * 的 19 例,每条正例配反例);这里只测"门有没有把尺子真的装上、装上后有没有牙"。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GATE_REL = 'check-principal-consumed.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(SCRIPTS_DIR, '..')
const RUNNER = join(SCRIPTS_DIR, 'guardian-runner.mjs')
const SRC = join(SCRIPTS_DIR, GATE_REL)
const RULER_SRC = join(REPO, 'apps', 'ai-service', 'scripts', 'audit_principal_consumed.py')
const GIT = resolveGitBin() || 'git'

// 夹具跑尺子要真解释器:本仓机器上 PATH 没有 python(Windows Store stub 非零退出),
// 所以显式注入 venv —— 这正是门头注写的 IHUI_PRINCIPAL_AUDIT_PYTHON 通道的用途。
const PY = join(REPO, 'apps', 'ai-service', '.venv', 'Scripts', 'python.exe')

/** 真事故形状:签名带身份依赖,体内只拿 thread_id 读数据、user_id 一次没用。 */
const ROUTER_BAD = [
  'from fastapi import APIRouter, Depends',
  'from app.core.jwt_auth import get_current_user_id',
  '',
  'router = APIRouter()',
  '',
  '@router.get("/leak")',
  'async def read_thread(thread_id: str, user_id: str = Depends(get_current_user_id)):',
  '    return store.read(thread_id)',
  '',
].join('\n')

/** 修好之后的形状:同一个端点,属主比对真的消费了身份。 */
const ROUTER_OK = [
  'from fastapi import APIRouter, Depends',
  'from app.core.jwt_auth import get_current_user_id',
  '',
  'router = APIRouter()',
  '',
  '@router.get("/safe")',
  'async def read_thread(thread_id: str, user_id: str = Depends(get_current_user_id)):',
  '    return store.read(thread_id, owner_user_id=user_id)',
  '',
].join('\n')

function gitIn(dir, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

/**
 * 把门**连同相对 import 闭包**装进夹具仓(门按自身位置推 ROOT —— 不装它就在审真仓,
 * 那等于测试跑完什么都没测)。尺子脚本拷的是真仓那一份:判据与被判内容同面演进。
 */
function makeRepo(dir, { router = ROUTER_OK, withRuler = true, commits = 1 } = {}) {
  gitIn(dir, ['init', '-q'])
  gitIn(dir, ['config', 'user.email', 'gate@fixture.local'])
  gitIn(dir, ['config', 'user.name', 'gate-fixture'])
  gitIn(dir, ['config', 'commit.gpgsign', 'false'])
  put(dir, 'apps/ai-service/app/routers/x.py', router)
  if (withRuler) {
    mkdirSync(join(dir, 'apps', 'ai-service', 'scripts'), { recursive: true })
    copyFileSync(RULER_SRC, join(dir, 'apps', 'ai-service', 'scripts', 'audit_principal_consumed.py'))
  }
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    'lib/scratch-dir.mjs',
  ])
  gitIn(dir, ['add', '-A'])
  gitIn(dir, ['commit', '-q', '-m', 'fixture'])
  for (let i = 1; i < commits; i++) {
    put(dir, `docs/seed-${i}.md`, `seed ${i}\n`)
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', `seed ${i}`])
  }
  return dir
}

function runGate(dir, args, env = {}) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, IHUI_PRINCIPAL_AUDIT_PYTHON: PY, ...env },
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e?.status ?? -1, out: `${e?.stdout ?? ''}${e?.stderr ?? ''}` }
  }
}

const parse = (s) => JSON.parse(s.out.slice(s.out.indexOf('{')))

/* ---------------------------- 接线层 ---------------------------- */

test('T1 装车证明:runner 里必须有本门注册块,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const at = src.indexOf("script: 'check-principal-consumed.mjs'")
  assert.ok(at >= 0, '本门不在 runner 里 —— 门存在但没人调度 = 没有(§22c 反复记过)')
  const block = src.slice(Math.max(0, at - 600), at + 2600)
  assert.match(block, /id:\s*'152'/, '注册块缺 id 152(编号若被并发挪号,改这里与 T3 一起改)')
  assert.match(block, /mode:\s*'blocking'/, '本门必须 blocking(读数面已零存量,不会造恒红门)')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_PRINCIPAL_CONSUMED'/, '缺 skipEnv 就没有应急出口')
  assert.match(block, /stagedTriggers:[^\n]*'apps\/ai-service\/'/, '缺 stagedTriggers 会让本门在提交链上根本不唤起')
})

test('T2 反向对照:把 script 行摘掉后,T1 那种"已装车"结论不得成立', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const stripped = src.replace(/script: 'check-principal-consumed\.mjs',/g, "script: '___',")
  assert.ok(!stripped.includes("script: 'check-principal-consumed.mjs'"), 'T2 的替换没生效,反向锁无从谈起')
  assert.ok(
    !/id:\s*'152'[\s\S]{0,600}script: 'check-principal-consumed\.mjs'/.test(stripped),
    '摘掉 script 行后仍被判成"已装车" —— 说明 T1 的锚点根本不指向本门',
  )
})

test('T3 撞号反向锁:全 runner 任何 id 不得出现两次(含本门编号恰好一次)', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const ids = [...src.matchAll(/^\s+id:\s*'([^']+)'/gm)].map((m) => m[1])
  assert.ok(ids.length > 100, `只解析到 ${ids.length} 个 id —— 解析式与注册表写法漂了`)
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i)
  assert.deepEqual(dup, [], `runner 里有重复 id:${[...new Set(dup)].join(', ')} —— 撞号会串 skipEnv 与失败归属`)
  assert.equal(ids.filter((x) => x === '152').length, 1, '本门编号必须在 runner 中恰好出现一次')
})

test('T4 源码锁:取材必须走 face-reader;判据不得复制第二份;豁免清单不得另立', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '本门必须走 face-reader(全量判 HEAD blob)')
  assert.match(src, /catBatch\(/, "没调用层的读取入口 = 半接线(守门 118 那一型)")
  assert.match(src, /from '\.\/lib\/scratch-dir\.mjs'/, '物化面必须落在 scratch 落点,不得手写临时目录')
  // 判据单一真相:本门里不得出现第二份身份依赖名字表 / 第二份豁免清单
  assert.ok(!/AUTH_DEPS\s*=/.test(src), '本门里出现了第二份身份依赖名字表 —— 两处算同一件事必漂移')
  assert.ok(!/IDENTITY_STATE_ATTRS\s*=/.test(src), '判据二的名字清单只许住在尺子里')
  assert.ok(!/PRINCIPAL_EXEMPTIONS\s*=/.test(src), '豁免清单只许住在尺子里,本门只读 stale_exemptions 读数')
  assert.ok(
    !/readFileSync\(\s*join\(\s*ROOT/.test(src),
    '不得用 ROOT 拼磁盘路径读被审内容(共享工作树滞后 HEAD 时会换结论)',
  )
})

/* ---------------------------- 真仓现读 ---------------------------- */

test('T5 真仓阳性对照:HEAD 全量档必须零判红(存量已清),且尺子必须真跑到了东西', () => {
  const r = runGate(REPO, ['--json'])
  assert.equal(r.code, 0, `真仓 HEAD 全量档不得非零(恒红门只会逼人 --no-verify):\n${r.out}`)
  const j = parse(r)
  assert.ok(j.scanned > 100, `扫描文件数异常小(${j.scanned})—— 枚举或解释器坏了,不是"已清完"`)
  assert.ok(j.anchorScanned > 100, `锚点面扫描数异常(${j.anchorScanned})—— 锚点坏了增量就无从起算`)
  assert.deepEqual(j.red, [], '全量档的棘轮锚点=HEAD^ 自身存量,存量一律不得进 red')
  assert.equal(j.undetermined, 0, '委托未判定必须为 0 —— 有未判定就还没到升 blocking 的资格')
  assert.deepEqual(j.machineUndetermined, [], '本机 venv 在位,机器态不得落"未判定"(落了说明解释器探测坏了)')
})

test('T6 面旗与纯函数形状:两旗同给判死;perFileFindings 计数;env 覆盖解释器', async () => {
  const both = runGate(REPO, ['--staged', '--worktree'])
  assert.equal(both.code, 2, `--staged 与 --worktree 同给必须 exit 2:\n${both.out}`)
  const { __test__ } = await import(pathToFileURL(SRC).href)
  const { perFileFindings, pythonCandidates } = __test__
  const m = perFileFindings({
    findings: [
      { file: 'app/routers/a.py', line: 1, func: 'f' },
      { file: 'app/routers/a.py', line: 9, func: 'g' },
      { file: 'app/routers/b.py', line: 2, func: 'h' },
    ],
  })
  assert.equal(m.get('app/routers/a.py'), 2)
  assert.equal(m.get('app/routers/b.py'), 1)
  assert.equal(m.get('app/routers/c.py'), undefined, '锚点没有的文件名额天然为 0(新账必拦)')
  const saved = process.env.IHUI_PRINCIPAL_AUDIT_PYTHON
  process.env.IHUI_PRINCIPAL_AUDIT_PYTHON = '/custom/py'
  try {
    assert.deepEqual(pythonCandidates(REPO), [{ exe: '/custom/py' }], 'env 覆盖必须短路探测(取证/CI 通道)')
  } finally {
    if (saved === undefined) delete process.env.IHUI_PRINCIPAL_AUDIT_PYTHON
    else process.env.IHUI_PRINCIPAL_AUDIT_PYTHON = saved
  }
})

/* ---------------------------- 夹具仓端到端(有牙证明) ---------------------------- */

test('T7 有牙证明:HEAD 干净的路由被改成"取身份不用"并 git add 后,--staged 必须判红并点名;修回即绿', () => {
  const dir = mkScratch('pc-staged-')
  try {
    makeRepo(dir, { router: ROUTER_OK })
    const clean = runGate(dir, ['--staged', '--json'])
    assert.equal(clean.code, 0, `无暂存变更时不应判红:\n${clean.out}`)
    assert.deepEqual(parse(clean).red, [], 'HEAD 干净 ⇒ 暂存档不得凭空造红')

    put(dir, 'apps/ai-service/app/routers/x.py', ROUTER_BAD)
    gitIn(dir, ['add', '-A'])
    const bad = runGate(dir, ['--staged', '--json'])
    assert.equal(bad.code, 1, `把身份消费摘掉必须拦得住:\n${bad.out}`)
    const j = parse(bad)
    assert.equal(j.red.length, 1, `应恰好点名一个端点(实得 ${j.red.length})`)
    assert.equal(j.red[0].file, 'app/routers/x.py', '点名必须是 ai-service 相对路径(与尺子键同形)')
    assert.equal(j.red[0].func, 'read_thread')
    const rep = runGate(dir, ['--staged'])
    assert.match(rep.out, /\[红\] app\/routers\/x\.py/, '报告必须逐条点名,不得只给退出码')
    assert.match(rep.out, /修复出口/, '判红必须同时给出两条修复出口(不得把人逼向削判据)')

    put(dir, 'apps/ai-service/app/routers/x.py', ROUTER_OK)
    gitIn(dir, ['add', '-A'])
    const fixed = runGate(dir, ['--staged', '--json'])
    assert.equal(fixed.code, 0, `修回之后必须立刻放行(否则门在惩罚正确的一方):\n${fixed.out}`)
  } finally {
    rmScratch(dir)
  }
})

test('T8 全量档棘轮:新账进 HEAD 即红;再一笔无关提交后它成存量 ⇒ 只吸收不追红', () => {
  const dir = mkScratch('pc-ratchet-')
  try {
    makeRepo(dir, { router: ROUTER_OK })
    // 把坏形状直接提交进 HEAD(模拟"经 --no-verify 漏进来的存量")
    put(dir, 'apps/ai-service/app/routers/x.py', ROUTER_BAD)
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'leak landed'])
    const justLanded = runGate(dir, ['--json'])
    assert.equal(justLanded.code, 1, `HEAD^ 干净而 HEAD 带新账 ⇒ 全量档必须判红(否则棘轮是摆设):\n${justLanded.out}`)
    assert.equal(parse(justLanded).red.length, 1)

    // 再一笔无关提交:坏形状此刻已是"该文件锚点面自身存量" ⇒ 名额吸收,不再追红
    put(dir, 'docs/unrelated.md', 'next commit\n')
    gitIn(dir, ['add', '-A'])
    gitIn(dir, ['commit', '-q', '-m', 'unrelated'])
    const asLegacy = runGate(dir, ['--json'])
    assert.equal(asLegacy.code, 0, `存量被无关提交追红 = 与任何提交都无关的恒红门(§12e 同型):\n${asLegacy.out}`)
    assert.deepEqual(parse(asLegacy).red, [])
  } finally {
    rmScratch(dir)
  }
})

test('T9 机器态与判死边界:解释器坏/尺子不在面上 ⇒ 未判定 exit 0 不出合格证;枚举 0 ⇒ exit 2', () => {
  // ① 解释器探测落空 ⇒ 未判定,不冒红也不记绿
  const dir1 = mkScratch('pc-nopy-')
  try {
    makeRepo(dir1, { router: ROUTER_BAD })
    const r = runGate(dir1, ['--staged', '--json'], { IHUI_PRINCIPAL_AUDIT_PYTHON: join(dir1, 'no', 'such', 'python.exe') })
    assert.equal(r.code, 0, `机器态不得判红:\n${r.out}`)
    const j = parse(r)
    assert.ok(j.machineUndetermined.length >= 1, '拿不到解释器必须点名,不得静默')
    assert.ok(/未判定/.test(r.out), '末行必须如实标"未判定",不出具"全部已判"合格证')
  } finally {
    rmScratch(dir1)
  }
  // ② 被审面上没有尺子 ⇒ 判据不在这份内容里,未判定而非"仓里没有违规"
  const dir2 = mkScratch('pc-noruler-')
  try {
    makeRepo(dir2, { router: ROUTER_OK, withRuler: false })
    const r = runGate(dir2, ['--staged', '--json'])
    assert.equal(r.code, 0, `尺子缺席属机器态,不得判红:\n${r.out}`)
    assert.ok(parse(r).machineUndetermined.some((s) => /没有尺子/.test(s)), '必须点名"被审面上没有尺子"')
  } finally {
    rmScratch(dir2)
  }
  // ③ 枚举到 0 个 .py ⇒ 判死不记绿
  const dir3 = mkScratch('pc-empty-')
  try {
    gitIn(dir3, ['init', '-q'])
    gitIn(dir3, ['config', 'user.email', 'gate@fixture.local'])
    gitIn(dir3, ['config', 'user.name', 'gate-fixture'])
    put(dir3, 'docs/only.md', 'nothing to audit\n')
    copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir3, 'scripts'))
    gitIn(dir3, ['add', '-A'])
    gitIn(dir3, ['commit', '-q', '-m', 'fixture'])
    const r = runGate(dir3, ['--json'])
    assert.equal(r.code, 2, `枚举 0 个候选必须 exit 2(判据失明不是通过):\n${r.out}`)
    assert.match(r.out, /判据失明|无法判定/, '判死必须喊出来')
  } finally {
    rmScratch(dir3)
  }
})

test('T10 反向锁:本门不得被"顺手"接进第二个调度器(注册只此一处)', () => {
  // 判据与豁免只有一份;调度点也只该有一份(pre-commit 经 runner)。
  // 若有人再往 .husky/CI 里塞第二处直调,两面取材口径迟早分叉(守门 89 R1/R2 的候选面盲区)。
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /scripts\/guardian-runner\.mjs/, '头注必须如实指向唯一调度点')
  assert.ok(!/pre-push|\.github\/workflows/.test(src), '本门头注若声称接了第二个调度点,那里必须真有线 —— 现状是只有 runner')
})
