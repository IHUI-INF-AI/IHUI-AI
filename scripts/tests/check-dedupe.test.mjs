// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import {
  writeFileSync,
  readFileSync,
  rmSync,
  copyFileSync,
  cpSync,
  mkdirSync,
} from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-dedupe.mjs')
const SCRIPTS_DIR = join(__dirname, '..')

// ─── 辅助:创建临时项目(含脚本副本,使 __dirname 解析到 tempdir) ──
// 说明:check-dedupe.mjs 用 __dirname 推导 ROOT(=__dirname/..),
// 故将脚本复制到 tempdir/scripts/,ROOT 即为 tempdir,可完全控制环境。
// ⚠️ 2026-11-01 修:门体自 G-54(2026-10-26)起 import './lib/face-reader.mjs',
// 而本夹具过去**只复制门体一枚** ⇒ 副本一加载就 ERR_MODULE_NOT_FOUND、退出码 1,
// 下面这 13 例从那天起全红(红在夹具不在判据;scripts/tests 不在提交链 ⇒ 长期没人看见)。
// 逐文件猜闭包同样会腐烂(gitdir.mjs 还反向 import scripts/ 同级的 seal-c-root-stray.mjs),
// 故整层拷 scripts/;拷完立刻删掉台账副本,让每个夹具自己决定"有没有存量台账"。
function copyScriptsClosure(dir) {
  const target = join(dir, 'scripts')
  mkdirSync(target, { recursive: true })
  cpSync(SCRIPTS_DIR, target, { recursive: true })
  rmSync(join(target, 'data', 'dedupe-stock.json'), { force: true })
  return target
}

function createTempProject() {
  const dir = mkScratch('ihui-dedupe-')
  copyScriptsClosure(dir)
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-dedupe.mjs'))
  return dir
}

// ─── 辅助:初始化 git 仓库(含初始 commit) ──────────────────
function initGitRepo(dir) {
  execSync('git init -b main', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git config user.email test@test.com', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git config user.name test', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git config commit.gpgsign false', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git commit -m "init"', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
}

// ─── 辅助:运行临时项目中的脚本副本 ────────────────────────
function runScript(dir, args = []) {
  return spawnSync('node', [join(dir, 'scripts', 'check-dedupe.mjs'), ...args], {
    cwd: dir,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  })
}

// ─── 辅助:去除 ANSI 颜色码 ────────────────────────────────
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 1. --staged 非 git 目录 → exit 0(git 命令失败,catch 跳过) ──────
test('--staged: 非 git 目录 → exit 0(git 命令抛错,catch 块退出)', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非 git 目录应 exit 0,实际 ${r.status}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. --staged git 仓库无 staged 文件 → exit 0(跳过) ───────────────
test('--staged: git 仓库无 staged 文件 → exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无 staged 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. --staged 暂存其他文件(非 pnpm-lock.yaml)→ exit 0(跳过) ──────
test('--staged: 暂存其他文件(非 pnpm-lock.yaml)→ exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'package.json'), '{}\n')
    execSync('git add package.json', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `暂存非 lockfile 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 4. --staged pnpm-lock.yaml 已暂存但工作树删除 → exit 0(LOCKFILE 不存在) ─
test('--staged: pnpm-lock.yaml 已暂存但工作树删除 → exit 0(LOCKFILE 不存在)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'lockfile content\n')
    execSync('git add pnpm-lock.yaml', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    // 从工作树删除但保留 staged 状态
    rmSync(join(dir, 'pnpm-lock.yaml'))
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `LOCKFILE 不存在应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /未找到 pnpm-lock\.yaml/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. 无 --staged 无 pnpm-lock.yaml → exit 0(跳过) ─────────────────
test('无 --staged: 无 pnpm-lock.yaml → exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir, [])
    assert.equal(r.status, 0, `无 lockfile 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /未找到 pnpm-lock\.yaml/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 6. --staged 暂存 pnpm-lock.yaml.bak(非精确匹配)→ exit 0(跳过) ──
test('--staged: 暂存 pnpm-lock.yaml.bak(非精确匹配)→ exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'pnpm-lock.yaml.bak'), 'backup\n')
    execSync('git add pnpm-lock.yaml.bak', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非精确匹配应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 7. --staged 暂存 subdir/pnpm-lock.yaml(非根路径)→ exit 0(跳过) ──
test('--staged: 暂存 subdir/pnpm-lock.yaml(非根路径)→ exit 0(跳过)', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    mkdirSync(join(dir, 'subdir'), { recursive: true })
    writeFileSync(join(dir, 'subdir', 'pnpm-lock.yaml'), 'lockfile\n')
    execSync('git add subdir/pnpm-lock.yaml', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非根路径应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 8. --staged 附加额外参数 → 仍识别为 staged 模式 ─────────────────
test('--staged: 附加额外参数(--staged --foo --bar)→ 仍识别 staged 模式', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    const r = runScript(dir, ['--staged', '--foo', '--bar'])
    assert.equal(r.status, 0, `额外参数应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /pnpm-lock\.yaml 未变更|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 9. 输出含 [check:dedupe] 前缀 ──────────────────────────────────
test('输出: 消息包含 [check:dedupe] 前缀', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir, [])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /\[check:dedupe\]/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 10. --staged pnpm-lock.yaml 已暂存且存在 → 不跳过,进入 pnpm 检查 ──
test('--staged: pnpm-lock.yaml 已暂存且存在 → 不跳过,进入 pnpm 检查', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE\n')
    execSync('git add pnpm-lock.yaml', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(dir, ['--staged'])
    // 不应输出"未变更,跳过"
    assert.ok(
      !r.stdout.includes('pnpm-lock.yaml 未变更'),
      'pnpm-lock.yaml 已暂存不应跳过',
    )
    // 应进入 pnpm dedupe 检查
    assert.match(r.stdout, /检查依赖版本碎片化/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 11. 无 --staged pnpm-lock.yaml 存在 → 进入 pnpm dedupe 检查 ──────
test('无 --staged: pnpm-lock.yaml 存在 → 进入 pnpm dedupe 检查', () => {
  const dir = createTempProject()
  try {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE\n')
    const r = runScript(dir, [])
    // 应进入 pnpm dedupe 检查(非跳过)
    assert.match(r.stdout, /检查依赖版本碎片化/)
    // 不应输出"未找到 pnpm-lock.yaml"
    assert.ok(
      !r.stdout.includes('未找到 pnpm-lock.yaml'),
      'lockfile 存在不应输出"未找到"',
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── 12. pnpm dedupe --check 失败(无效 lockfile)→ exit 非零 + "失败" ──
test('退出码: pnpm dedupe --check 失败 → exit 非零 + 输出"失败"', () => {
  const dir = createTempProject()
  try {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE CONTENT\n')
    const r = runScript(dir, [])
    // pnpm 对无效 lockfile 应失败(或 pnpm 未安装时 shell 返回非零)
    assert.notEqual(r.status, 0, `无效 lockfile 应 exit 非零,实际 ${r.status}`)
    assert.ok(r.status !== null, '进程不应超时')
    // 2026-11-01 契约更正:门体现在区分两态 —— 解析出"新增碎片"= exit 1 报「失败」;
    // pnpm 跑不出可解析结论(本例的无效 lockfile)= exit 2 报「未判定」(§0.3:
    // 判不出既不记绿也不冒红)。两态都必须非零,且都必须把 pnpm 的原报告带出来。
    assert.ok(r.status === 1 || r.status === 2, `退出码应为 1(判出红)或 2(未判定),实得 ${r.status}`)
    const combined = stripAnsi(r.stdout + r.stderr)
    assert.match(combined, /失败|未判定/)
    assert.match(combined, /pnpm dedupe/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 13. --staged 多文件暂存(含 pnpm-lock.yaml)→ 不跳过,进入 pnpm 检查 ─
test('--staged: 多文件暂存含 pnpm-lock.yaml → 不跳过,进入 pnpm 检查', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'package.json'), '{}\n')
    writeFileSync(join(dir, 'pnpm-lock.yaml'), 'INVALID LOCKFILE\n')
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    execSync('git add package.json pnpm-lock.yaml README.md', {
      cwd: dir,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript(dir, ['--staged'])
    // 不应输出"未变更,跳过"(pnpm-lock.yaml 在暂存列表中)
    assert.ok(
      !r.stdout.includes('pnpm-lock.yaml 未变更'),
      '含 pnpm-lock.yaml 暂存不应跳过',
    )
    // 应进入 pnpm dedupe 检查
    assert.match(r.stdout, /检查依赖版本碎片化/)
  } finally {
    rmScratch(dir)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// §22c 纯判据对照(2026-11-01,门 7 改差值口径同批):直接 import 门体导出的生产判据,
// 不在测试里复制第二份常量或第二把尺子。反向牙的作用:把"新增碎片 vs 存量点名"这一维
// 摘掉,同一份夹具必须当场翻红(否则等于只锁了自检档)。
// ─────────────────────────────────────────────────────────────────────────────
const D = (await import('../check-dedupe.mjs')).__test__
const TODAY = '2026-11-01'
const frag = (pkg, version) => ({ pkg, version, raw: `- ${pkg}@${version}` })
const stock = (over = {}) => ({
  pkg: 'pbkdf2',
  version: '3.1.6',
  reason: '存量:pnpm dedupe rc=0 仍消不掉',
  ticket: 'T-1',
  reviewBy: '2099-01-01',
  ...over,
})

test('D1 台账齐备且无新碎片 ⇒ 0(恒红门被打通的那一格)', () => {
  const r = D.decide({ fragments: [frag('pbkdf2', '3.1.6')], entries: [stock()], today: TODAY, ranOk: true })
  assert.equal(r.code, 0)
  assert.ok(r.lines.some((l) => l.includes('存量点名放行')), '放行必须点名,不许静默')
})

test('D2 反向牙:同一份碎片但台账为空 ⇒ 1(摘掉差值/台账维必翻红)', () => {
  const withLedger = D.decide({ fragments: [frag('pbkdf2', '3.1.6')], entries: [stock()], today: TODAY, ranOk: true })
  const without = D.decide({ fragments: [frag('pbkdf2', '3.1.6')], entries: [], today: TODAY, ranOk: true })
  assert.equal(withLedger.code, 0)
  assert.equal(without.code, 1)
})

test('D3 台账外的新碎片 ⇒ 1(牙没被削掉)', () => {
  const r = D.decide({
    fragments: [frag('pbkdf2', '3.1.6'), frag('left-pad', '1.0.0')],
    entries: [stock()],
    today: TODAY,
    ranOk: true,
  })
  assert.equal(r.code, 1)
  assert.ok(r.lines.some((l) => l.includes('left-pad') && l.includes('新碎片')))
})

test('D4 台账条目到期 ⇒ 1(§0.7 豁免会到期,到期回队列重裁)', () => {
  const r = D.decide({
    fragments: [frag('pbkdf2', '3.1.6')],
    entries: [stock({ reviewBy: '2026-01-01' })],
    today: TODAY,
    ranOk: true,
  })
  assert.equal(r.code, 1)
  assert.ok(r.lines.some((l) => l.includes('已到期')))
})

test('D5 登记了而本次报告一条没命中 ⇒ 1(清单腐烂 = §0.7 验过才免的另一半)', () => {
  const r = D.decide({ fragments: [], entries: [stock()], today: TODAY, ranOk: true })
  assert.equal(r.code, 1)
  assert.ok(r.lines.some((l) => l.includes('腐烂')))
})

test('D6 输出取不到 / pnpm 没跑成 ⇒ 2 未判定(既不记绿也不冒红)', () => {
  assert.equal(D.decide({ fragments: null, entries: [stock()], today: TODAY, ranOk: true }).code, 2)
  assert.equal(D.decide({ fragments: [], entries: [stock()], today: TODAY, ranOk: false }).code, 2)
})

test('D7 台账形态不齐 ⇒ validateLedger 逐条报名(缺字段/日期形错/理由过短)', () => {
  assert.ok(D.validateLedger({ entries: [{ pkg: 'x' }] }).errors.length > 0)
  assert.ok(D.validateLedger({ entries: [stock({ reviewBy: '2099/01/01' })] }).errors.length > 0)
  assert.ok(D.validateLedger({ entries: [stock({ reason: '太短' })] }).errors.length > 0)
  assert.equal(D.validateLedger({ entries: [stock()] }).errors.length, 0)
})

test('D8 解析 pnpm 真实报告形态(要摘掉的那几行 = 碎片身份)', () => {
  const out = [
    'is-typed-array@1.1.15',
    '└── which-typed-array 1.1.22 → 1.1.24',
    '',
    '- pbkdf2@3.1.6',
    '- which-typed-array@1.1.22',
    '',
    'Run pnpm dedupe to apply the changes above.',
  ].join('\n')
  const f = D.parseFragments(out)
  assert.ok(Array.isArray(f) && f.length === 2)
  assert.deepEqual(
    f.map((x) => `${x.pkg}@${x.version}`),
    ['pbkdf2@3.1.6', 'which-typed-array@1.1.22'],
  )
  // 说了"有变更要应用"却解析不到任何一条 ⇒ 必须未判定,不能折成"没有碎片"
  assert.equal(D.parseFragments('dedupe\nRun pnpm dedupe to apply the changes above.'), null)
  // 真的没碎片(报告里没有 apply 行)⇒ []
  assert.deepEqual(D.parseFragments('dedupe --check\nnothing to dedupe'), [])
  // 2026-11-04 实测:pnpm 11.18 干净收尾输出里没有 "dedupe" 字样 ⇒ 必须认成 [],否则恒红/恒未判定
  assert.deepEqual(
    D.parseFragments([
      '✓ Lockfile passes supply-chain policies (verified 1m ago)',
      'Progress: resolved 4445, reused 4049, downloaded 0, added 0, done',
      '[WARN] Issues with peer dependencies found. Run "pnpm peers check" to list them.',
    ].join('\n')),
    [],
  )
  // 没有收尾 done 的残缺进度不得折成"没有碎片"
  assert.equal(D.parseFragments('Progress: resolved 1, reused 0, downloaded 0, added 0'), null)
})

test('D10 pnpm 非零退出却解析不到碎片 ⇒ 未判定(绝不折成"通过")', () => {
  // 真实反例来源:夹具里放一份无效 lockfile,pnpm 报错退出、输出没有碎片行。
  const bad = D.classifyRun({ ranOk: true, status: 1, parsed: [] })
  assert.equal(bad, null)
  assert.equal(D.decide({ fragments: bad, entries: [stock()], today: TODAY, ranOk: true }).code, 2)
  // 对照三格:pnpm 正常退出且无碎片 ⇒ 真通过;pnpm 没跑成 ⇒ 未判定
  assert.deepEqual(D.classifyRun({ ranOk: true, status: 0, parsed: [] }), [])
  assert.equal(D.classifyRun({ ranOk: false, status: null, parsed: [] }), null)
})

test('D9 形态锁:门体只有一把尺,台账落点不得搬进被 gitignore 的目录', () => {
  const src = readFileSync(SOURCE_SCRIPT, 'utf8')
  assert.match(src, /export const __test__ = \{[^}]*decide/)
  // 判决出口唯一:定义一次 + 主路径调用一次(有人在 main 里再拼一份判据 ⇒ 调用数变多即红)
  assert.equal((src.match(/export function decide\(\{/g) ?? []).length, 1)
  assert.equal((src.match(/=\s*decide\(\{/g) ?? []).length, 1)
  // 台账必须住 scripts/data/(.ihui-agent/* 被 gitignore ⇒ 换机失效,门 192 记过这型)
  assert.match(src, /resolve\(HERE, 'data', 'dedupe-stock\.json'\)/)
  // 派生 pnpm 必须显式接管 stdio 且读的就是它(丢 stdout 又去读 ⇒ 结论恒 null,门 199 同型)
  assert.match(src, /stdio: \['ignore', 'pipe', 'pipe'\]/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
