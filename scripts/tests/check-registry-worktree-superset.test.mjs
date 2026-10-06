// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-registry-worktree-superset.mjs(票面 G-1058643)
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
// §22c:判据从源文件 export 的 `__test__` 直接导入,测试里**不得**再抄一份镜像常量。
import { __test__ } from '../check-registry-worktree-superset.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const GATE_NAME = 'check-registry-worktree-superset.mjs'
const GATE = join(REPO, 'scripts', GATE_NAME)

const GIT = resolveGitBin() || 'git'
const git = (args, cwd) =>
  execFileSync(
    GIT,
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...args],
    {
      cwd: cwd || REPO,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

/** 夹具:真仓 HEAD 的两份注册表原样落盘(positive control 删的是**真存在的条目行**)。 */
function seedRegistryRepo(dir) {
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  cpSync(join(REPO, 'scripts', 'lib'), join(dir, 'scripts', 'lib'), { recursive: true })
  // lib/gitdir.mjs 现职 import scripts 顶层件 ⇒ 按目录拷,不在测试里手写依赖清单(同 166 的前车)
  for (const f of readdirSync(join(REPO, 'scripts'))) {
    if (f.endsWith('.mjs')) copyFileSync(join(REPO, 'scripts', f), join(dir, 'scripts', f))
  }
  const headPkg = gitRaw(['show', 'HEAD:package.json'], REPO)
  const headRunner = gitRaw(['show', `HEAD:${__test__.RUNNER_PATH}`], REPO)
  assert.ok(headPkg && headPkg.length > 100, '夹具必须取到真仓 HEAD 的 package.json')
  assert.ok(headRunner && headRunner.length > 1000, '夹具必须取到真仓 HEAD 的 runner')
  writeFileSync(join(dir, 'package.json'), headPkg, 'utf8')
  writeFileSync(join(dir, __test__.RUNNER_PATH), headRunner, 'utf8')
  git(['init', '-q', '--initial-branch=main'], dir)
  git(['config', 'user.email', 't@t'], dir)
  git(['config', 'user.name', 't'], dir)
  git(['add', '-A'], dir)
  git(['commit', '-qm', 'seed: 注册表夹具'], dir)
  return { headPkg, headRunner }
}

/** 只把"门体 + lib 依赖"搬进夹具(不放任何注册表文件)⇒ 专门用来构造"枚举到 0 个"的那一臂。 */
function seedScriptsOnly(dir) {
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  cpSync(join(REPO, 'scripts', 'lib'), join(dir, 'scripts', 'lib'), { recursive: true })
  for (const f of readdirSync(join(REPO, 'scripts'))) {
    // runner 也在 scripts 顶层 —— 它本身就是注册表文件,带上它就把"枚举到 0"这一臂造不出来
    if (f.endsWith('.mjs') && f !== 'guardian-runner.mjs') {
      copyFileSync(join(REPO, 'scripts', f), join(dir, 'scripts', f))
    }
  }
  git(['init', '-q', '--initial-branch=main'], dir)
  git(['config', 'user.email', 't@t'], dir)
  git(['config', 'user.name', 't'], dir)
}

const runGate = (dir, extra = []) => {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_NAME), ...extra], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 180000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? -1, out: String(e.stdout || '') + String(e.stderr || '') }
  }
}

test('T1 接线方向锁:未注册时源码不得声称已接线;一旦被主会话注册则三件套必须齐备', () => {
  const src = readFileSync(GATE, 'utf8')
  const runnerHead = gitRaw(['show', `HEAD:${__test__.RUNNER_PATH}`], REPO)
  const wired = runnerHead.includes(GATE_NAME)
  if (!wired) {
    assert.ok(
      !/已接\s*pre-commit|guardian-runner\s*第\s*\d+\s*项/.test(src),
      '未接线却声称已接线 = 守门 89 R2 的恒红形态',
    )
    assert.ok(/本门尚未接线/.test(src), '源码必须如实写明未接线(注册由主会话单写者做)')
  } else {
    const m = new RegExp(`script:\\s*'${GATE_NAME}'[\\s\\S]{0,400}?skipEnv:\\s*'([A-Z_]+)'`).exec(runnerHead)
    assert.ok(m, '已接线则必须带 skipEnv')
    assert.ok(/mode:\s*'(blocking|advisory)'/.test(runnerHead), '已接线则必须定级')
  }
})

test('T2 判据形状锁:P2 用逐行等值、清单只走 HEAD 面、取材只走 face-reader', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.ok(/for \(let i = 0; i < a\.length; i\+\+\) if \(a\[i\] !== b\[i\]\) return false/.test(src), 'P2 必须逐行比,不是比行数')
  assert.ok(/ls-tree[^\n]*'HEAD'/.test(src), '清单必须取自 HEAD 面')
  const fsImport = ['from ', "'node:", "fs'"].join('')
  assert.ok(!src.includes(fsImport), '本门不得自己 import node:fs 读盘(必须走 face-reader 的档)')
  assert.ok(src.includes('./lib/face-reader.mjs'), '取材必须共用层')
})

test('T3 构造面阳性对照(真仓 HEAD 的真条目被删)⇒ 缺省档点名 P1,提交链档判红', () => {
  const dir = mkScratch('regsup-t3-')
  try {
    const { headPkg } = seedRegistryRepo(dir)
    const entry = __test__.extractPkgEntries(headPkg).order.includes('check:percent-clamp')
      ? 'check:percent-clamp'
      : __test__.extractPkgEntries(headPkg).order[0]
    const lines = headPkg.split(/\r?\n/)
    const at = lines.findIndex((l) => new RegExp(`^\\s*"${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`).test(l))
    assert.ok(at > 0, `夹具里必须能定位 ${entry} 那一行`)
    lines.splice(at, 1)
    writeFileSync(join(dir, 'package.json'), lines.join('\n'), 'utf8')
    const def = runGate(dir, [])
    assert.equal(def.rc, 0, `缺省档只报数不得判红:${def.out.slice(0, 300)}`)
    assert.ok(def.out.includes(`[P1 缺失] ${entry}`), `缺省档必须点名 ${entry}:${def.out.slice(0, 300)}`)
    assert.match(def.out, /档=只报数\(不判红\)/)
    git(['add', 'package.json'], dir)
    const st = runGate(dir, ['--staged'])
    assert.equal(st.rc, 1, `提交链档必须判红:${st.out.slice(0, 300)}`)
    assert.ok(st.out.includes(`[P1 缺失] ${entry}`) && /档=问责\(判红\)/.test(st.out))
    writeFileSync(join(dir, 'package.json'), headPkg, 'utf8')
    git(['add', 'package.json'], dir)
    const back = runGate(dir, ['--staged'])
    assert.equal(back.rc, 0, `补回那一行就该绿:${back.out.slice(0, 300)}`)
    assert.match(back.out, /P1 缺失 0 条/)
  } finally {
    rmScratch(dir)
  }
})

test('T4 runner 注册块被整块抹掉 ⇒ P1 点名该 id;仅改字段 ⇒ P2(成对)', () => {
  const dir = mkScratch('regsup-t4-')
  try {
    const { headRunner } = seedRegistryRepo(dir)
    const e = __test__.extractRunnerEntries(headRunner)
    // 成对两臂都要落在"夹具真的改得动"的那一块上:挑一块带 mode: 'blocking' 的
    let id = null
    let block = null
    for (const k of e.order) {
      const v = e.entries.get(k).lines.join('\n')
      if (v.includes("mode: 'blocking'")) {
        id = k
        block = v
        break
      }
    }
    assert.ok(id, '夹具里必须有一块带 mode: \'blocking\'')
    writeFileSync(join(dir, __test__.RUNNER_PATH), headRunner.replace(`${block}\n`, ''), 'utf8')
    const gone = runGate(dir, ['--strict'])
    assert.equal(gone.rc, 1, `--strict 必须判红:${gone.out.slice(0, 300)}`)
    assert.ok(gone.out.includes(`[P1 缺失] ${id}`), `必须点名 id ${id}:${gone.out.slice(0, 400)}`)
    writeFileSync(join(dir, __test__.RUNNER_PATH), headRunner, 'utf8')
    const restored = runGate(dir, ['--strict'])
    assert.match(restored.out, /P1 缺失 0 条/, '与上臂成对:块补回去就不得见 P1')
    const edited = headRunner.replace(block, block.replace("mode: 'blocking'", "mode: 'advisory'"))
    assert.notEqual(edited, headRunner, '夹具必须真改到 mode')
    writeFileSync(join(dir, __test__.RUNNER_PATH), edited, 'utf8')
    const drift = runGate(dir, ['--strict'])
    assert.equal(drift.rc, 1, `字段漂开必须判红:${drift.out.slice(0, 300)}`)
    assert.ok(drift.out.includes(`[P2 改写] ${id}`), `必须点名 P2:${drift.out.slice(0, 400)}`)
  } finally {
    rmScratch(dir)
  }
})

test('T5 语义等值而逐行不等 ⇒ 只落"未判定",既不算 P2 也不算通过(读 __test__ 判据)', () => {
  const { judgeFile, PKG_A, PKG_REORDER, PKG_REFLOW } = __test__
  const j = (cand) => judgeFile({ path: 'package.json', headText: PKG_A, candText: cand, candAbsent: false, ledger: { ok: new Map(), bad: [], present: false } })
  const re = j(PKG_REORDER)
  assert.equal(re.p1.length, 0, '纯换序不得算 P1')
  assert.equal(re.p2.length, 0, '纯换序不得算 P2')
  assert.deepEqual(re.und.map((x) => x.entry), ['(条目顺序)'], '换序必须点名成未判定,不许静默')
  const rf = j(PKG_REFLOW)
  assert.equal(rf.p2.length, 0, 'prettier 重排不得算 P2')
  assert.ok(rf.und.some((x) => x.entry === 'check:b'), '重排那一条必须落未判定并被点名')
  const dirty = j(PKG_A.replace('"check:b": "node 2"', '"check:b": "node 9"'))
  assert.deepEqual(dirty.p2.map((x) => x.entry), ['check:b'], '与上两条成对:值真改了就是 P2')
})

test('T6 豁免账成对:带非空原因 ⇒ 转入豁免维仍点名;裸原因 ⇒ 照红', () => {
  const { judgeFile, PKG_A, PKG_DROP_B, parseLedger } = __test__
  const led = (recs) => parseLedger(recs.map((r) => JSON.stringify(r)).join('\n'))
  const base = { path: 'package.json', headText: PKG_A, candText: PKG_DROP_B, candAbsent: false }
  const withReason = judgeFile({ ...base, ledger: led([{ path: 'package.json', entry: 'check:b', reason: 'G-1058643 有意退役' }]) })
  const bare = judgeFile({ ...base, ledger: led([{ path: 'package.json', entry: 'check:b', reason: '' }]) })
  const malformed = judgeFile({ ...base, ledger: led([{ path: 'package.json' }]) })
  assert.equal(withReason.p1.length, 0)
  assert.equal(withReason.exempted.length, 1, '豁免条目必须仍被点名')
  assert.equal(bare.p1.length, 1, '裸标记不生效 ⇒ 照红')
  assert.equal(malformed.p1.length, 1)
  assert.ok(malformed.und.length >= 1, '畸形记录必须落未判定并点名')
})

test('T7 空枚举与两面旗同给都判死(2),绝不记绿', () => {
  const dir = mkScratch('regsup-t7-')
  try {
    seedScriptsOnly(dir)
    mkdirSync(join(dir, 'docs'), { recursive: true })
    writeFileSync(join(dir, 'docs', 'a.md'), '# 没有注册表的仓\n', 'utf8')
    git(['add', '-A'], dir)
    git(['commit', '-qm', 'seed: 无注册表'], dir)
    const empty = runGate(dir, [])
    assert.equal(empty.rc, 2, `枚举到 0 个注册表文件必须判死:${empty.out.slice(0, 200)}`)
    assert.match(empty.out, /枚举到 0 个注册表文件/)
  } finally {
    rmScratch(dir)
  }
  const d = mkScratch('regsup-t7b-')
  try {
    seedRegistryRepo(d)
    const both = runGate(d, ['--staged', '--worktree'])
    assert.equal(both.rc, 2, '两面旗同给不得猜哪个面优先')
    assert.match(both.out, /无法判定/)
  } finally {
    rmScratch(d)
  }
})

test('T8 变异自证:把 P2 的逐行等值换成行数等值 ⇒ 自检对应变红并点名 S10', () => {
  const dir = mkScratch('regsup-t8-')
  try {
    seedRegistryRepo(dir)
    const target = join(dir, 'scripts', GATE_NAME)
    const src = readFileSync(target, 'utf8')
    const perLine = 'for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false'
    assert.ok(src.includes(perLine), '变异点必须存在(否则这条锁已经空转)')
    writeFileSync(target, src.replace(perLine, 'return true // 变异:只比行数'), 'utf8')
    const mut = runGate(dir, ['--self-test'])
    assert.equal(mut.rc, 1, '行数等值版判据必须让自检变红')
    assert.match(mut.out, /✗ S10/, `必须点名 S10:${mut.out.slice(-400)}`)
    // 对照臂:同一份自检在未变异的原件上必须是绿的(否则"红"不是变异造成的)
    const orig = runGate(REPO, ['--self-test'])
    assert.equal(orig.rc, 0, `原件自检必须绿:${orig.out.slice(-400)}`)
  } finally {
    rmScratch(dir)
  }
})

test('T9 真仓现读:射程必须非空、缺省档不得在干净面上造假红', () => {
  const r = __test__.run({ root: REPO, face: 'worktree' })
  assert.ok(r.enumerated >= 2, `必须枚举到注册表文件(实得 ${r.enumerated})`)
  assert.ok(r.docs.some((d) => d.path === 'package.json'))
  assert.ok(r.docs.some((d) => d.path === __test__.RUNNER_PATH))
  const runnerDoc = r.docs.find((d) => d.path === __test__.RUNNER_PATH)
  assert.ok(runnerDoc.headEntries > 150, `runner 注册块数量级必须看得见(实得 ${runnerDoc.headEntries})`)
  const def = runGate(REPO, [])
  assert.equal(def.rc, 0, `缺省档只报数:${def.out.slice(-300)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
