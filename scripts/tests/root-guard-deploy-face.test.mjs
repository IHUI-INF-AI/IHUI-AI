// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本票(根护栏前置闸读的是换流之前那一面)的"有牙"夹具 —— §22c:判据 import 源脚本 __test__,
 * 本文件零复制判据。
 *
 * 票面出路与最终选择(2026-11-01 ROOTGUARD2 定稿):
 *   ① 把闸面改成"将要检出的那一面"(= origin/main) —— **已被证伪**:生产机上 origin/main 这个
 *      嵌套 remote-tracking ref 会被宿主清理层吞掉、永不更新(deploy/win/ihui-deploy.ps1 头注与
 *      fetch 段两条实证:2026-09-13「fetch 打印 6eedf5b0f1..adcc23136a 但 rev-parse origin/main 仍
 *      读回旧值」;2026-09-28「15 秒竞态 ⇒ 安静地部署旧版本」)。ff 用的是 fetch 当场定格成显式 sha
 *      的 $remoteTip,根本不是 origin/main ⇒ 闸面设成 origin/main 读到的是旧面:自锁没解,旧面若
 *      恰好自洽还会冒绿,而 ff 随后带进不自洽的面照样被构建(比自锁更坏)。
 *   ② 把闸**后移到 ff 之后** —— 本席采用。闸面 = HEAD = 刚被 ff 到、即将被备份/构建/切流的那一面。
 *
 * 本文件钉的格:
 *  ① 反例:清单绑"修对后的哈希",而被审面是旧面(规则文件还是旧内容)⇒ 判红。这正是 44 轮自锁的形状。
 *  ② 正例:同一份清单,被审面与代码同面 ⇒ 绿。
 *  ②b advisory 文档面漂移只告警,不 fail-closed。
 *  ③ / ③b checkAgainstRev 是闸的唯一代码路径(同面同轮 / 篡改即红)。
 *  ③c 劣质 --against-rev ⇒ rc=2 未判定,绝不冒绿(§0.3)。
 *  ④ **默认闸面是 HEAD,不是 origin/main**(夹具仓:HEAD 自洽 / origin/main 不自洽 ⇒ rc=0)。
 *  ⑤ ⑤ 的反向:HEAD 不自洽 / origin/main 自洽 ⇒ rc=1(证明它没有偷偷去读别的面)。
 *  ⑥ 取不到被审面(仓里还没有任何提交)⇒ rc=2 未判定,绝不冒绿。
 *
 * ④⑤⑥ 用真 CLI + 夹具仓:把源脚本连同它的依赖闭包搬进临时仓 —— ROOT 由脚本位置推导,
 * 搬脚本即换判定根,**不给生产脚本开任何 env 换根后门**(护栏脚本开换根后门 = 开一条绕过通道)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { __test__ as rg } from '../root-guard.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const RG_CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'root-guard.mjs')
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const git = (...a) =>
  execFileSync('git', a.flat(), {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()

// ── 构造"已被重新封存"的清单 M:绑定的是**修对后的内容哈希** ──
const FIXED_FILE = 'FIXED guardian-runner content @ HEAD'
const FIXED_SECTION = '## 0. 全局铁律\nA\nB\n'
const OLD_FILE = 'OLD guardian-runner content @ stale face'

const M = {
  targets: [
    {
      id: 'guardian-runner',
      path: 'scripts/guardian-runner.mjs',
      mode: 'file',
      sha256: rg.sha256Of(FIXED_FILE),
    },
    {
      id: 'agents-ironlaw',
      path: 'AGENTS.md',
      mode: 'section',
      start: '## 0. 全局铁律',
      sha256: rg.sha256Of(FIXED_SECTION),
    },
  ],
}

// 把"被审面"建模成 {相对路径 → 内容} 的映射,供注入式 readFile 使用(与源脚本 hashTarget
// 的注入契约一致:readFile(绝对路径) 返回该面该路径的内容)。
const faceReaderFrom = (map) => (abs) => {
  const k = String(abs).replace(/\\/g, '/').split('/').pop()
  if (!(k in map)) throw new Error('ENOENT')
  return map[k]
}

test('① 反例:同一份清单 M,闸看旧面(规则文件仍是旧内容)⇒ 判红', () => {
  // 旧面:guardian-runner 还是旧内容(哈希 != M 绑的 FIXED 哈希);AGENTS 段与 M 同(模拟未动铁律)。
  const staleFace = faceReaderFrom({
    'guardian-runner.mjs': OLD_FILE,
    'AGENTS.md': FIXED_SECTION,
  })
  const r = rg.checkAll({ manifest: M, readFile: staleFace, root: '/r' })
  assert.equal(r.verdict, 'fail', `旧面与"修对后的清单"对不上却没判红(verdict=${r.verdict})`)
  const gr = r.targets.find((t) => t.id === 'guardian-runner')
  assert.equal(gr.state, 'fail', 'guardian-runner 在旧面应是 fail(非 advisory、非 pass)')
  assert.equal(gr.actual, rg.sha256Of(OLD_FILE))
  assert.equal(gr.expected, rg.sha256Of(FIXED_FILE))
})

test('② 正例:同一份清单 M,闸看 coherent 面(清单与代码同面)⇒ 绿', () => {
  const coherentFace = faceReaderFrom({
    'guardian-runner.mjs': FIXED_FILE,
    'AGENTS.md': FIXED_SECTION,
  })
  const r = rg.checkAll({ manifest: M, readFile: coherentFace, root: '/r' })
  assert.equal(r.verdict, 'pass', `清单与代码同面却没判绿(verdict=${r.verdict})`)
  for (const t of r.targets) {
    if (t.state === 'warn') continue // advisory 文档面另行覆盖,不在此判据
    assert.equal(t.actual, t.expected, `${t.id} 同面却哈希不一致`)
  }
})

test('②b 正例的反向收紧:coherent 面仅铁律段被改(文档面)、guardian-runner 同面 ⇒ 仍绿(不 fail-closed)', () => {
  // 文档面(agents-ironlaw 为 advisory)被改只告警;只要硬判据(guardian-runner)同面,verdict 仍绿。
  const coherentFileDriftedSection = faceReaderFrom({
    'guardian-runner.mjs': FIXED_FILE,
    'AGENTS.md': '## 0. 全局铁律\nA\nB\nC\n', // 文档面多一行 ⇒ 与 M 绑的哈希不符,但只 warn
  })
  const r = rg.checkAll({ manifest: M, readFile: coherentFileDriftedSection, root: '/r' })
  assert.equal(r.verdict, 'pass', `硬判据同面、仅 advisory 文档面漂移却没绿(verdict=${r.verdict})`)
  const iron = r.targets.find((t) => t.id === 'agents-ironlaw')
  assert.equal(iron.state, 'warn', '文档面漂移应只 warn 不 fail')
})

test('③ 闸的实际路径 checkAgainstRev:可解 sha 且该面清单/代码同轮同面 ⇒ rc=0', () => {
  // 用真实 HEAD 验证:把 HEAD 那一面的真清单喂给 checkAgainstRev 当被审面,目标内容也取自 HEAD
  // ⇒ 同轮同面 ⇒ 绿。这把"判据与真跑代码同面"钉在生产代码路径上,不另写一份判据。
  const head = git('rev-parse', 'HEAD')
  const realManifest = git('show', `${head}:scripts/data/root-guard-manifest.json`)
  const r = rg.checkAgainstRev({ rev: head, readText: () => realManifest })
  assert.equal(r.verdict, 'pass', `HEAD 面清单与代码本应同轮同面却得 ${r.verdict}(${r.why ?? ''})`)
})

test('③b 闸的实际路径 checkAgainstRev:可解 sha 但清单被篡改(清单/代码不同面)⇒ rc=1,绝不放行', () => {
  const head = git('rev-parse', 'HEAD')
  const good = rg.loadManifest(git('show', `${head}:scripts/data/root-guard-manifest.json`))
  const tampered = {
    ...good,
    targets: good.targets.map((t, i) => (i === 0 ? { ...t, sha256: 'f'.repeat(64) } : t)),
  }
  const r = rg.checkAgainstRev({ rev: head, readText: () => JSON.stringify(tampered) })
  assert.equal(
    r.verdict,
    'fail',
    `被审面清单与代码不同面却读出 ${r.verdict}(把没重封的规则文件部署上线)`,
  )
})

test('③d 闸路径认人工解锁(按 id+sha256 绑内容 ⇒ 放不了别的面)', () => {
  // 2026-11-01:闸面切到 HEAD 后,checkAgainstRev 成了闸的**唯一**判定路径。它若把 unlocks 丢掉,
  // `--unlock --ttl-min` 会静默失效(锁文件照写、闸认不出来,现象是"放了锁仍红且无人报错")。
  // 这枚用例钉住"解锁在这个路径上真的生效",并用反控证明它是按内容绑定的、跨不了面。
  const head = git('rev-parse', 'HEAD')
  const good = rg.loadManifest(git('show', `${head}:scripts/data/root-guard-manifest.json`))
  const first = good.targets[0]
  const actualSha = first.sha256 // HEAD 面自洽 ⇒ 清单里的值就是该文件在被审面上的真哈希
  const tampered = {
    ...good,
    targets: good.targets.map((t, i) => (i === 0 ? { ...t, sha256: 'f'.repeat(64) } : t)),
  }
  const unlocked = rg.checkAgainstRev({
    rev: head,
    readText: () => JSON.stringify(tampered),
    unlocks: [
      {
        id: first.id,
        sha256: actualSha,
        reason: '夹具:人工复核后放行',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    ],
  })
  assert.equal(unlocked.verdict, 'pass', `解锁在有效期内却仍判 ${unlocked.verdict}(逃生门静默失效)`)
  assert.equal(unlocked.targets[0].state, 'unlocked', '解锁命中却没落成 unlocked 状态')

  // 反控:把同一枚解锁绑到**另一份内容**(sha 不同)⇒ 不得放行(跨不了面,不冒充解锁)
  const wrongSha = rg.checkAgainstRev({
    rev: head,
    readText: () => JSON.stringify(tampered),
    unlocks: [
      {
        id: first.id,
        sha256: 'e'.repeat(64),
        reason: '夹具:绑错内容',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    ],
  })
  assert.equal(wrongSha.verdict, 'fail', '解锁绑了别的内容却放行了(跨面污染)')
})

test('③c §0.3 闸路径:劣质 --against-rev(解不出 40 位 sha)⇒ rc=2 未判定,绝不冒绿', () => {
  const run = (args) =>
    spawnSync(process.execPath, [RG_CLI, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const bad = run(['--check', '--against-rev', 'deadbeef'])
  assert.equal(
    bad.status,
    2,
    `劣质 rev 被当成被审面却没解成 40 位 sha ⇒ 必须 rc=2(未判定),实得 rc=${bad.status}`,
  )
  assert.ok(/未判定/.test(bad.stderr), '劣质 rev 应点名"未判定",不得静默')
})

// ─── 夹具仓:让"默认闸面到底读哪一枚 ref"变成可观测的差分 ─────────────────────────
// 三档构造(同一份脚本、同一份清单,只改 ref 指向):
//   ④ HEAD 自洽 ∧ origin/main 不自洽 ⇒ 默认 --check 必须 rc=0(若还在读 origin/main 就是 rc=1)
//   ⑤ HEAD 不自洽 ∧ origin/main 自洽 ⇒ 默认 --check 必须 rc=1(若偷读别的面就是 rc=0)
//   ⑥ 仓里没有任何提交(HEAD 解不出 sha)⇒ rc=2 未判定
const GIT_OPTS = {
  encoding: 'utf8',
  windowsHide: true,
  timeout: 60_000,
  maxBuffer: 64 << 20,
}
const runGit = (dir, args) =>
  execFileSync(
    'git',
    [
      '-c',
      'safe.directory=*',
      '-c',
      'user.email=rootguard@e2e.local',
      '-c',
      'user.name=rootguard',
      '-c',
      'core.autocrlf=false',
      '-C',
      dir,
      ...args,
    ],
    { ...GIT_OPTS, stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim()

const MANIFEST_JSON = JSON.stringify(
  {
    version: 1,
    targets: [
      {
        id: 'guardian-runner',
        path: 'scripts/guardian-runner.mjs',
        mode: 'file',
        sha256: rg.sha256Of(FIXED_FILE),
      },
      {
        id: 'agents-ironlaw',
        path: 'AGENTS.md',
        mode: 'section',
        start: '## 0. 全局铁律',
        sha256: rg.sha256Of(FIXED_SECTION),
      },
    ],
  },
  null,
  2,
)

/** 把源脚本 + 依赖闭包搬进夹具(ROOT 由脚本位置推导 ⇒ 搬脚本即换判定根)。 */
function copyGuardInto(dir) {
  mkdirSync(join(dir, 'scripts', 'data'), { recursive: true })
  cpSync(join(ROOT, 'scripts', 'root-guard.mjs'), join(dir, 'scripts', 'root-guard.mjs'))
  // gitdir.mjs 需要它(devEnvRoot);整目录搬而不是逐个点名,免得依赖闭包一变本夹具就假红。
  cpSync(
    join(ROOT, 'scripts', 'seal-c-root-stray.mjs'),
    join(dir, 'scripts', 'seal-c-root-stray.mjs'),
  )
  cpSync(join(ROOT, 'scripts', 'lib'), join(dir, 'scripts', 'lib'), { recursive: true })
}

/**
 * 造两枚提交:coherent(清单与规则文件同面)/ incoherent(规则文件改了、清单没重封)。
 * 夹具仓只纳入"被审对象"三份文件;脚本与 lib 只作运行时依赖,不必入库(面取材读的是 ref)。
 */
function makeFaceFixture(t) {
  const dir = mkScratch('rootguard-face-')
  t.after(() => rmScratch(dir))
  copyGuardInto(dir)
  writeFileSync(join(dir, 'AGENTS.md'), FIXED_SECTION)
  writeFileSync(join(dir, 'scripts', 'guardian-runner.mjs'), FIXED_FILE)
  writeFileSync(join(dir, 'scripts', 'data', 'root-guard-manifest.json'), MANIFEST_JSON)
  runGit(dir, ['init', '-q'])
  runGit(dir, ['add', '--', 'scripts/data', 'scripts/guardian-runner.mjs', 'AGENTS.md'])
  runGit(dir, ['commit', '-q', '-m', 'coherent:清单绑的就是这一面的规则文件'])
  const coherent = runGit(dir, ['rev-parse', 'HEAD'])
  writeFileSync(join(dir, 'scripts', 'guardian-runner.mjs'), OLD_FILE)
  runGit(dir, ['add', '--', 'scripts/guardian-runner.mjs'])
  runGit(dir, ['commit', '-q', '-m', 'incoherent:规则文件改了却没重封清单'])
  const incoherent = runGit(dir, ['rev-parse', 'HEAD'])
  const setHead = (sha) => runGit(dir, ['reset', '-q', '--hard', sha])
  const setOriginMain = (sha) => runGit(dir, ['update-ref', 'refs/remotes/origin/main', sha])
  const runCli = (args) =>
    spawnSync(process.execPath, [join(dir, 'scripts', 'root-guard.mjs'), ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
    })
  return { dir, coherent, incoherent, setHead, setOriginMain, runCli }
}

test('④ 默认闸面是 HEAD,不是 origin/main:HEAD 自洽 ∧ origin/main 不自洽 ⇒ rc=0', (t) => {
  const fx = makeFaceFixture(t)
  fx.setHead(fx.coherent)
  fx.setOriginMain(fx.incoherent)
  // 先证明夹具真的把两面摆反了(否则这一例可能因为两面相同而"恰好"绿)
  assert.equal(runGit(fx.dir, ['rev-parse', 'HEAD']), fx.coherent)
  assert.equal(runGit(fx.dir, ['rev-parse', 'origin/main']), fx.incoherent)

  const plain = fx.runCli(['--check'])
  assert.equal(
    plain.status,
    0,
    `默认 --check 必须判 HEAD(自洽)⇒ rc=0;实得 rc=${plain.status} —— 若 rc=1 说明它还在读 origin/main:` +
      `\nstdout=${plain.stdout}\nstderr=${plain.stderr}`,
  )
  // 同一夹具里,把被审面显式钉到那枚不自洽的 sha ⇒ 必须 rc=1。
  // 这一对合起来才证明"绿是 HEAD 给的,不是它压根没判"。
  const explicitBad = fx.runCli(['--check', '--against-rev', fx.incoherent])
  assert.equal(
    explicitBad.status,
    1,
    `显式审那枚不自洽的 sha 却得 rc=${explicitBad.status} ⇒ 判据本身没牙,④ 的绿不可信`,
  )
})

test('⑤ 反向:HEAD 不自洽 ∧ origin/main 自洽 ⇒ rc=1(它没有偷偷去读别的面)', (t) => {
  const fx = makeFaceFixture(t)
  fx.setHead(fx.incoherent)
  fx.setOriginMain(fx.coherent)
  assert.equal(runGit(fx.dir, ['rev-parse', 'HEAD']), fx.incoherent)
  assert.equal(runGit(fx.dir, ['rev-parse', 'origin/main']), fx.coherent)

  const plain = fx.runCli(['--check'])
  assert.equal(
    plain.status,
    1,
    `默认 --check 必须判 HEAD(不自洽)⇒ rc=1;实得 rc=${plain.status} —— rc=0 说明它把 origin/main 那面当成了被审面:`,
  )
  assert.ok(/判红/.test(plain.stderr), '判红必须点名,不得静默')

  // 同一夹具里显式审那枚自洽的 sha ⇒ rc=0,证明红确实来自 HEAD 面而不是判据坏了。
  const explicitGood = fx.runCli(['--check', '--against-rev', fx.coherent])
  assert.equal(
    explicitGood.status,
    0,
    `显式审那枚自洽的 sha 却得 rc=${explicitGood.status} ⇒ ⑤ 的红不是"面"造成的,判据本身有问题`,
  )
})

test('⑥ §0.3 取不到被审面:仓里还没有任何提交 ⇒ rc=2 未判定,绝不冒绿', (t) => {
  const dir = mkScratch('rootguard-noface-')
  t.after(() => rmScratch(dir))
  copyGuardInto(dir)
  writeFileSync(join(dir, 'AGENTS.md'), FIXED_SECTION)
  writeFileSync(join(dir, 'scripts', 'guardian-runner.mjs'), FIXED_FILE)
  writeFileSync(join(dir, 'scripts', 'data', 'root-guard-manifest.json'), MANIFEST_JSON)
  runGit(dir, ['init', '-q']) // 只 init、不提交 ⇒ HEAD 解不出 40 位 sha
  const r = spawnSync(process.execPath, [join(dir, 'scripts', 'root-guard.mjs'), '--check'], {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  })
  assert.equal(r.status, 2, `取不到 HEAD 面却没落未判定(rc=${r.status})⇒ 这一格会变成"冒绿"`)
  assert.ok(/未判定/.test(r.stderr), '取不到被审面必须点名"未判定",不得静默')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
