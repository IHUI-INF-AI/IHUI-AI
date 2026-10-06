// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/check-registry-worktree-superset.mjs(票面 G-1058643)
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

/** 夹具:真仓 HEAD 的两份注册表原样落盘(positive control 删的是**真存在的条目行**)。
 *  `opts.ledger`:台账内容 —— 缺省写一份合法的 `{"entries": []}`(模拟本票落地后的仓),
 *  传 `null` 表示"这份台账压根没进夹具"(用来构造"未 add / 干净签出拿不到"那一臂),
 *  传字符串则逐字落盘(用来构造坏 JSON)。 */
function seedRegistryRepo(dir, opts = {}) {
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
  if (opts.ledger !== null) {
    mkdirSync(join(dir, dirname(__test__.EXEMPT_LEDGER)), { recursive: true })
    writeFileSync(
      join(dir, __test__.EXEMPT_LEDGER),
      typeof opts.ledger === 'string' ? opts.ledger : JSON.stringify({ entries: [] }, null, 2),
      'utf8',
    )
  }
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
  // 夹具格式跟台账本身走(2026-10-06 起为 JSON + 四必填字段),判据仍全部由门体提供。
  const led = (recs) => parseLedger(JSON.stringify({ entries: recs }))
  const base = { path: 'package.json', headText: PKG_A, candText: PKG_DROP_B, candAbsent: false }
  const withReason = judgeFile({ ...base, ledger: led([{ path: 'package.json', entry: 'check:b', reason: 'G-1058643 有意退役', reviewBy: '2099-01-01' }]) })
  const bare = judgeFile({ ...base, ledger: led([{ path: 'package.json', entry: 'check:b', reason: '', reviewBy: '2099-01-01' }]) })
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

// ─────────────────────────────────────────────────────────────────────────────
// T10–T15:豁免台账的"面判据"(票面 2026-10-06:台账从被 .gitignore 吞掉的机器-local 路径
// 搬进 scripts/data/,并补"缺字段 / 过期 / 清单腐烂 / 整份不在被审面 / 坏 JSON"五型)。
// §22c:以下每一条都调门体导出的 __test__ 判据(parseLedger / judgeLedger / entryLive /
// ledgerBlocking / run / report),测试里**不抄任何判据常量**。
// ─────────────────────────────────────────────────────────────────────────────

test('T10 形状锁:旧的那条 gitignored 台账路径不得回潮,新台账住在 scripts/data/ 且真读得出合法 JSON', () => {
  const src = readFileSync(GATE, 'utf8')
  // 字面量按段拼(否则这条锁会被测试自己的源码点亮 —— 门体 S4b 踩过同一坑)
  const OLD = ['.ihui-agent/', 'registry-superset-exempt', '.jsonl'].join('')
  assert.ok(!src.includes(OLD), '源码里再出现旧路径 = "换机即失明"的出口回潮')
  assert.equal(__test__.EXEMPT_LEDGER, 'scripts/data/registry-superset-exemptions.json')
  assert.ok(__test__.EXEMPT_LEDGER.startsWith('scripts/data/'), '台账必须住在受版本控制的目录')
  assert.ok(__test__.EXEMPT_LEDGER.endsWith('.json'), '格式改成 JSON:坏一行只会整份读不出,不会"半份生效"')
  assert.deepEqual(__test__.LEDGER_FIELDS, ['path', 'entry', 'reason', 'reviewBy'])
  const raw = readFileSync(join(REPO, __test__.EXEMPT_LEDGER), 'utf8')
  const p = __test__.parseLedger(raw)
  assert.equal(p.present, true, '真仓台账文件必须存在')
  assert.equal(p.broken, null, `真仓台账必须是可解析的合法形状:${p.broken}`)
  assert.ok(Array.isArray(JSON.parse(raw).entries), '顶层 entries 必须是数组')
  assert.equal(p.ok.size, 0, '当前真仓台账应为如实零豁免(旧路径从未落盘 ⇒ 迁移条目数 0)')
  // 取版仍只走共用层:门体不得自己按磁盘 join 直读被审内容(守门 118 判 half-wired 那一型)
  assert.ok(!/readFileSync\s*\(/.test(src), '门体一律走 face-reader 的 catBatch / readWorktreeFile')
})

test('T11 台账必须在 git ls-files 面上:未 add ⇒ 问责档判红,add 后 ⇒ 绿(端到端成对)', () => {
  const dir = mkScratch('regsup-t11-')
  try {
    // ledger:null ⇒ 夹具里压根没有这份台账(模拟本票落地前 / 作者机上没 add 的状态)
    seedRegistryRepo(dir, { ledger: null })
    const listed = (d) =>
      String(git(['ls-files', '--', __test__.EXEMPT_LEDGER], d)).split(/\r?\n/).filter(Boolean).length
    mkdirSync(join(dir, dirname(__test__.EXEMPT_LEDGER)), { recursive: true })
    writeFileSync(join(dir, __test__.EXEMPT_LEDGER), JSON.stringify({ entries: [] }, null, 2), 'utf8')
    assert.equal(listed(dir), 0, '臂 A 前提:台账未进索引 ⇒ git ls-files 零命中')
    const red = runGate(dir, ['--staged', '--strict'])
    assert.equal(red.rc, 1, `台账不在被审面必须判红(不得折成零豁免记绿):${red.out.slice(-320)}`)
    assert.match(red.out, /候选面取不到台账/)
    assert.match(red.out, /台账判据 1 条/)
    // 同一份盘上内容,缺省(磁盘)档只点名不判红 ⇒ §12e 安全网:没 add 的台账不卡提交链
    const soft = runGate(dir, ['--worktree', '--strict'])
    assert.equal(soft.rc, 0, `盘上有台账 ⇒ 磁盘档读得到,不该红:${soft.out.slice(-200)}`)
    git(['add', __test__.EXEMPT_LEDGER], dir)
    assert.equal(listed(dir), 1, '臂 B:台账进索引 ⇒ git ls-files 命中')
    const green = runGate(dir, ['--staged', '--strict'])
    assert.equal(green.rc, 0, `add 之后同一判据必须转绿:${green.out.slice(-320)}`)
    assert.match(green.out, /台账判据 0 条/)
    git(['commit', '-qm', 'chore: 台账入库'], dir)
    // 臂 C:干净签出(克隆)拿得到台账 ⇒ 磁盘问责档零台账判据(这一臂证的正是原缺陷)
    const clone = mkScratch('regsup-t11c-')
    try {
      git(['clone', '-q', '--no-hardlinks', dir, clone])
      assert.equal(listed(clone), 1, '干净签出必须拿得到台账(旧路径在这一点上永远做不到)')
      const cc = runGate(clone, ['--worktree', '--strict'])
      assert.equal(cc.rc, 0, `克隆里的门必须读得到台账:${cc.out.slice(-320)}`)
      assert.match(cc.out, /台账判据 0 条/)
      // 与臂 C 成对:把台账从盘上删掉 ⇒ 磁盘问责档必须响亮判红,而不是"当作没有豁免"
      rmSync(join(clone, __test__.EXEMPT_LEDGER))
      const del = runGate(clone, ['--worktree', '--strict'])
      assert.equal(del.rc, 1, `删掉出口必须判红:${del.out.slice(-320)}`)
      assert.match(del.out, /唯一出口删掉了/)
    } finally {
      rmScratch(clone)
    }
  } finally {
    rmScratch(dir)
  }
})

test('T12 坏 JSON 台账 ⇒ 无法判定(exit 2),绝不静默当空台账;缺省档点名后仍只报数', () => {
  const dir = mkScratch('regsup-t12-')
  try {
    seedRegistryRepo(dir)
    writeFileSync(join(dir, __test__.EXEMPT_LEDGER), '{"entries": [ {"path": "x", },', 'utf8')
    git(['add', __test__.EXEMPT_LEDGER], dir)
    const st = runGate(dir, ['--staged'])
    assert.equal(st.rc, 2, `坏 JSON 必须落"无法判定"而不是 0/1:${st.out.slice(-320)}`)
    assert.match(st.out, /无法判定/)
    assert.match(st.out, /解析失败/)
    const strict = runGate(dir, ['--worktree', '--strict'])
    assert.equal(strict.rc, 2, `磁盘问责档同样拒绝出清洁单:${strict.out.slice(-200)}`)
    // 缺省档(盘上这份可能正被并行会话编辑)⇒ 只报数,但必须点名,且不得说成"零豁免通过"
    const soft = runGate(dir, [])
    assert.equal(soft.rc, 0, `缺省档只报数:${soft.out.slice(-200)}`)
    assert.match(soft.out, /台账·未判定\] \(整份台账\):台账 JSON 解析失败/)
    assert.ok(!/结论.*台账判据 0 条.*未判定 0 条/.test(soft.out), '坏 JSON 绝不可能读出"未判定 0 条"的清洁单')
    // 与上成对:形状不对(顶层不是对象)也走 broken,而不是当成空表
    writeFileSync(join(dir, __test__.EXEMPT_LEDGER), '[1,2,3]', 'utf8')
    git(['add', __test__.EXEMPT_LEDGER], dir)
    const shape = runGate(dir, ['--staged'])
    assert.equal(shape.rc, 2, `形状不对也判无法判定:${shape.out.slice(-200)}`)
    assert.match(shape.out, /形状/)
  } finally {
    rmScratch(dir)
  }
})

test('T13 台账四维(缺字段/过期/腐烂/不在面)全判红,路径没被审到落未判定(读 __test__ 判据)', () => {
  const { parseLedger, judgeLedger } = __test__
  const mk = (entries) =>
    judgeLedger({
      ledger: parseLedger(JSON.stringify({ entries })),
      p1Keys: new Set(),
      scopePaths: new Set(['package.json']),
      today: '2026-10-06',
      presentOnBase: false,
    })
  // ① 缺字段:四字段各自缺失都点名缺谁
  const miss = mk([
    { path: 'package.json', entry: 'a', reason: 'r' },
    { path: 'package.json', entry: 'b', reviewBy: '2030-01-01' },
    { entry: 'c', reason: 'r', reviewBy: '2030-01-01' },
    { path: 'package.json', reason: 'r', reviewBy: '2030-01-01' },
  ])
  assert.equal(miss.defects.length, 4, JSON.stringify(miss.defects.map((x) => x.why)))
  for (const f of ['reviewBy', 'reason', 'path', 'entry'])
    assert.ok(miss.defects.some((x) => x.why.includes(f)), `必须点名缺的字段 ${f}`)
  assert.equal(miss.broken, null, '缺字段是红,不是"读不出"')
  // ② 过期:复核日已过 ⇒ 红,且豁免即时失效(entryLive 与判据同源)
  const exp = mk([{ path: 'package.json', entry: 'a', reason: 'r', reviewBy: '2020-01-01' }])
  assert.equal(exp.defects.length, 1)
  assert.match(exp.defects[0].why, /复核日/)
  assert.equal(__test__.entryLive({ reviewBy: '2020-01-01' }, '2026-10-06'), false)
  assert.equal(__test__.entryLive({ reviewBy: '2026-10-07' }, '2026-10-06'), true)
  // ③ 腐烂:登记了而被审面没命中 ⇒ 红;路径没进射程 ⇒ 未判定(不把"没看"写成"看了没命中")
  const rot = mk([{ path: 'package.json', entry: 'ghost', reason: 'r', reviewBy: '2030-01-01' }])
  assert.equal(rot.defects.length, 1)
  assert.match(rot.defects[0].why, /腐烂/)
  const off = mk([{ path: 'apps/api/package.json', entry: 'build', reason: 'r', reviewBy: '2030-01-01' }])
  assert.equal(off.defects.length, 0, '没审到的路径不得判腐烂')
  assert.equal(off.unjudged.length, 1, '但必须落未判定并点名')
  // ④ 整份不在被审面 ⇒ 红(两种归因分开写)
  const absent = judgeLedger({
    ledger: parseLedger(null),
    p1Keys: new Set(),
    scopePaths: new Set(),
    today: '2026-10-06',
    presentOnBase: false,
  })
  assert.equal(absent.defects.length, 1, '台账不在被审面上不是"零豁免"')
  assert.match(absent.defects[0].why, /候选面取不到台账/)
  const deleted = judgeLedger({ ledger: parseLedger(null), p1Keys: new Set(), scopePaths: new Set(), today: '2026-10-06', presentOnBase: true })
  assert.match(deleted.defects[0].why, /唯一出口删掉了/)
  // 定级:台账维只随 --strict 判红(§12e 安全网;升档前置写在门头注释里)
  assert.equal(__test__.ledgerBlocking({ face: 'worktree', strict: false }), false)
  assert.equal(__test__.ledgerBlocking({ face: 'worktree', strict: true }), true)
  assert.equal(__test__.ledgerBlocking({ face: 'staged', strict: false }), false)
  const rep = (face, strict, led) =>
    __test__.report(
      { face, strict, day: '2026-10-06', docs: [], p1: 0, p2: 0, und: 0, exempted: 0, led, ledDefects: led ? [{ key: 'k', path: 'package.json', why: '构造' }] : [], ledUnjudged: [], enumerated: 2, error: null },
      { json: true },
    )
  assert.equal(rep('worktree', false, 3), 0, '缺省档:台账判据只点名')
  assert.equal(rep('staged', false, 3), 0, '提交链档:面状态型判据不得卡在本提交人头上(未升档前)')
  assert.equal(rep('worktree', true, 3), 1, '问责档:同一计数判红')
})

test('T14 过期豁免端到端:债还在 ⇒ 豁免失效并双红(台账 + P1);未过期 ⇒ 豁免生效转绿', () => {
  const dir = mkScratch('regsup-t14-')
  try {
    const { headPkg } = seedRegistryRepo(dir)
    const order = __test__.extractPkgEntries(headPkg).order
    const entry = order.includes('check:percent-clamp') ? 'check:percent-clamp' : order[0]
    const lines = headPkg.split(/\r?\n/)
    const at = lines.findIndex((l) =>
      new RegExp(`^\\s*"${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`).test(l),
    )
    assert.ok(at > 0, `夹具里必须能定位 ${entry} 那一行`)
    lines.splice(at, 1)
    writeFileSync(join(dir, 'package.json'), lines.join('\n'), 'utf8')
    const rec = (reviewBy) => JSON.stringify({ entries: [{ path: 'package.json', entry, reason: '构造:票面演练', reviewBy }] }, null, 2)
    // 臂 A:复核日已过 ⇒ ① 台账判据红(过期)② 豁免即时失效 ⇒ 那一格重新显形为 P1
    writeFileSync(join(dir, __test__.EXEMPT_LEDGER), rec('2000-01-01'), 'utf8')
    git(['add', '-A'], dir)
    const gone = runGate(dir, ['--staged', '--strict'])
    assert.equal(gone.rc, 1, `过期必须判红:${gone.out.slice(-360)}`)
    assert.match(gone.out, /复核日 .* 已过/)
    assert.ok(gone.out.includes(`[P1 缺失] ${entry}`), `过期即失效:那一行必须重新点名:${gone.out.slice(-360)}`)
    assert.match(gone.out, /台账判据 1 条/)
    // 臂 B:与 A 成对,只把复核日换成"未到期" ⇒ 豁免生效,P1 归零、台账判据归零 ⇒ 绿
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    writeFileSync(join(dir, __test__.EXEMPT_LEDGER), rec(future), 'utf8')
    git(['add', '-A'], dir)
    const live = runGate(dir, ['--staged', '--strict'])
    assert.equal(live.rc, 0, `未过期且四字段齐 ⇒ 该绿:${live.out.slice(-360)}`)
    assert.ok(live.out.includes(`[豁免] ${entry}`), '被豁免的条目仍要点名')
    assert.match(live.out, /P1 缺失 0 条/)
    assert.match(live.out, /台账判据 0 条/)
    // 臂 C:与 B 成对,只把 reason 掏空 ⇒ 裸标记不生效(照红),并点名缺 reason
    writeFileSync(join(dir, __test__.EXEMPT_LEDGER), JSON.stringify({ entries: [{ path: 'package.json', entry, reason: '   ', reviewBy: future }] }, null, 2), 'utf8')
    git(['add', '-A'], dir)
    const bare = runGate(dir, ['--staged', '--strict'])
    assert.equal(bare.rc, 1, `裸原因不生效必须判红:${bare.out.slice(-320)}`)
    assert.match(bare.out, /缺 reason/)
    assert.ok(bare.out.includes(`[P1 缺失] ${entry}`))
  } finally {
    rmScratch(dir)
  }
})

test('T15 清单腐烂端到端:登记了却没用上 ⇒ 红;路径没进射程 ⇒ 未判定不判红', () => {
  const dir = mkScratch('regsup-t15-')
  try {
    seedRegistryRepo(dir)
    const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    // 臂 A:干净面上登记一条"免检"⇒ 没有任何 HEAD-有-候选-无 的站点 ⇒ 腐烂
    writeFileSync(
      join(dir, __test__.EXEMPT_LEDGER),
      JSON.stringify({ entries: [{ path: 'package.json', entry: 'check:no-such-writeback', reason: '构造:债已清仍挂账', reviewBy: future }] }, null, 2),
      'utf8',
    )
    git(['add', '-A'], dir)
    const rot = runGate(dir, ['--staged', '--strict'])
    assert.equal(rot.rc, 1, `腐烂必须判红:${rot.out.slice(-320)}`)
    assert.match(rot.out, /清单腐烂/)
    assert.match(rot.out, /台账判据 1 条/)
    // 臂 B:与 A 成对,路径换成"本轮根本没被审到"的那一枚 ⇒ 判不出腐烂 ⇒ 未判定,不判红
    writeFileSync(
      join(dir, __test__.EXEMPT_LEDGER),
      JSON.stringify({ entries: [{ path: 'apps/api/package.json', entry: 'build', reason: '构造:射程外', reviewBy: future }] }, null, 2),
      'utf8',
    )
    git(['add', '-A'], dir)
    const off = runGate(dir, ['--staged', '--strict'])
    assert.equal(off.rc, 0, `没审到的路径不得判腐烂:${off.out.slice(-320)}`)
    assert.match(off.out, /该路径本轮不在射程内/)
    assert.match(off.out, /未判定 1 条/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
