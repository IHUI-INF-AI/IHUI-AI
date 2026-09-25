#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:产物预算门 A8(scripts/check-artifact-budget.mjs)
 *
 * 为什么单独有一支"接线条件不变量"(本文件唯一一支读仓库状态的测试):
 * 本门的注册由主会话统一做(实现角色禁止改 guardian-runner / package.json / workflows)。
 * 于是两头都不能写死:
 *   - 写"必须已登记"为硬断言 ⇒ 接线之前全队恒红,结局是 --no-verify(§12e 同型);
 *   - 省掉这条断言 ⇒ 接线后被谁咬掉、或只接提交链不接 CI,无人知道(守门 70/76/81
 *     反复记过同一型:"判据存在而永不调用 = 没有")。
 * 所以判据写成**条件不变量**:未登记 ⇒ 打印"待接线"并放过;已登记 ⇒ mode 必须是
 * warn(磁盘产物不是提交者能保证的东西)、skipEnv 必须存在、编号不得重复、
 * 且必须同时有 CI 面调用点(本门唯一能真判红的地方)。
 *
 * 跑法:node --test scripts/tests/check-artifact-budget.test.mjs
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as ab } from '../check-artifact-budget.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const SCRIPT = 'check-artifact-budget.mjs'
const SKIP_ENV = 'HUSKY_SKIP_ARTIFACT_BUDGET'

/** §22c 锚点:源脚本必须 export __test__ 且键齐(缺一条就是双真相漂移)。 */
test('C0 源脚本 export __test__ 且核心判据可被直接 import', () => {
  for (const k of [
    'BUDGET',
    'resolveTarget',
    'classifyEntry',
    'parseSubPackageRoots',
    'accumulateBuckets',
    'judgeBudget',
    'findDanglingSourceMaps',
    'decideExit',
  ]) {
    assert.ok(ab[k], `__test__ 缺键 ${k}`)
  }
})

/** 在演练仓里造一份 miniapp 产物目录。sizes = { 相对 dist 的路径: 字节数 }。 */
function makeDist(repoDir, relDist, files, appJson) {
  const d = join(repoDir, relDist)
  for (const [rel, size] of Object.entries(files)) {
    const abs = join(d, rel)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, 'z'.repeat(size))
  }
  if (appJson !== null) {
    mkdirSync(d, { recursive: true })
    writeFileSync(
      join(d, 'app.json'),
      appJson ?? JSON.stringify({ pages: [], subpackages: [{ root: 'pkg-ai' }] }),
    )
  }
  return d
}

/** 造一个只放了本门脚本(+ 它的 import 闭包)的演练仓。 */
function mkFakeRepo(prefix) {
  const dir = mkScratch(prefix)
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  // 闭包必须是**推导**的:本门顶层 import ./lib/scratch-dir.mjs,手抄清单少一跳就
  // 是 ERR_MODULE_NOT_FOUND(本仓同日连吃两次)。
  const copied = copyScriptWithClosure(join(REPO, 'scripts'), SCRIPT, join(dir, 'scripts'), [
    'lib/scratch-dir.mjs',
  ])
  assert.ok(copied.includes('lib/scratch-dir.mjs'), '闭包必须含 scratch-dir')
  return dir
}

function run(repoDir, args, env = {}) {
  return spawnSync(process.execPath, [join(repoDir, 'scripts', SCRIPT), ...args], {
    cwd: repoDir,
    encoding: 'utf8',
    windowsHide: true,
    env: { ...process.env, ...env },
  })
}

test('C1 未知 target ⇒ exit 2 并点名,绝不回落默认档', () => {
  const dir = mkFakeRepo('ab-c1-')
  try {
    const r = run(dir, ['--target', 'nope'])
    assert.equal(r.status, 2, `stdout=${r.stdout} stderr=${r.stderr}`)
    assert.match(r.stderr, /未知 --target "nope"/)
    assert.match(r.stderr, /miniapp/)
    // 反向对照:回落默认档会跑出 miniapp 的判定 —— 那正是被禁的行为
    assert.doesNotMatch(r.stderr + r.stdout, /未判定:产物目录不存在/)
  } finally {
    rmScratch(dir)
  }
})

test('C1b 缺 --target / 未知参数同样 exit 2(白名单开关)', () => {
  const dir = mkFakeRepo('ab-c1b-')
  try {
    assert.equal(run(dir, []).status, 2)
    const r = run(dir, ['--target', 'miniapp', '--puhs'])
    assert.equal(r.status, 2)
    assert.match(r.stderr, /未知参数/)
  } finally {
    rmScratch(dir)
  }
})

test('C2 产物目录不存在 ⇒ exit 0 + 逐条"未判定:<原因>" + 构建命令', () => {
  const dir = mkFakeRepo('ab-c2-')
  try {
    const r = run(dir, ['--target', 'miniapp'])
    assert.equal(r.status, 0, `不该因机器态判红: ${r.stdout}${r.stderr}`)
    assert.match(r.stdout, /未判定:产物目录不存在/)
    assert.match(r.stdout, /pnpm --filter @ihui\/miniapp-taro build/)
    assert.match(r.stdout, /不冒红也不静默记绿/)
    const j = JSON.parse(run(dir, ['--target', 'miniapp', '--json']).stdout)
    assert.equal(j.undetermined, true)
    assert.equal(j.exists, false)
  } finally {
    rmScratch(dir)
  }
})

test('C3 超预算 ⇒ exit 1,且实测/上限/余量三个数都必须出现', () => {
  const dir = mkFakeRepo('ab-c3-')
  try {
    makeDist(dir, 'apps/miniapp-taro/dist', { 'pages/index/blob.js': 2 * 1024 * 1024 + 1000 })
    const r = run(dir, ['--target', 'miniapp'])
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stdout, /实测 2,09[0-9],[0-9]{3} B/)
    assert.match(r.stdout, /上限 2,097,152 B/)
    assert.match(r.stdout, /超硬上限/)
    const j = JSON.parse(run(dir, ['--target', 'miniapp', '--json']).stdout)
    assert.equal(j.status, 'over')
    assert.equal(j.limitBytes, 2_097_152)
    assert.ok(j.measuredBytes > j.limitBytes)
    assert.ok(j.marginBytes < 0)
    assert.equal(j.undetermined, false)
  } finally {
    rmScratch(dir)
  }
})

test('C4 破告警水位但未超上限 ⇒ 仍判红,但文案必须与"超上限"分得清', () => {
  const dir = mkFakeRepo('ab-c4-')
  try {
    makeDist(dir, 'apps/miniapp-taro/dist', { 'pages/index/blob.js': 2_054_751 })
    const r = run(dir, ['--target', 'miniapp'])
    assert.equal(r.status, 1, '现实测 97.98% 的形态必须当轮判红(规格验收)')
    assert.match(r.stdout, /破告警水位/)
    // 余量必须与真仓那个数量级一致(夹具主包 = 该文件 + app.json,故用 4x,xxx 而不是钉死 42,401)
    assert.match(r.stdout, /余量 4[0-9],[0-9]{3} B/)
    // 两态必须分得清 —— 比 JSON 的 status,不比人读文案:文案里"尚未超硬上限"这种
    // 说明性措辞会被子串判据误伤(第一版就在这里红过一次)。
    const j = JSON.parse(run(dir, ['--target', 'miniapp', '--json']).stdout)
    assert.equal(j.status, 'over-water')
    assert.ok(j.marginBytes > 0, '破水位时余量必须仍为正')
    assert.equal(j.fail, true)
  } finally {
    rmScratch(dir)
  }
})

/**
 * 主包口径的构造面证明(规格风险条:"累加范围错一位就把 42KB 报成 800KB")。
 * 同一份 3 MiB 字节,放分包 root 下必须绿、放主包必须红 —— 两支共用一份夹具,
 * 差别只有那一个文件的落点,所以红了不可能是别的原因。不靠真仓状态。
 */
test('C5 分包目录不得计入主包(构造面正反同夹具对照)', () => {
  const dir = mkFakeRepo('ab-c5-')
  try {
    const appJson = JSON.stringify({
      pages: ['pages/index/index'],
      subpackages: [{ root: 'pkg-ai', pages: ['a'] }],
      subPackages: undefined,
    })
    makeDist(dir, 'apps/miniapp-taro/dist', { 'pkg-ai/blob.js': 3 * 1024 * 1024 }, appJson)
    const sub = run(dir, ['--target', 'miniapp'])
    assert.equal(sub.status, 0, `分包体积被算进主包了:\n${sub.stdout}`)
    assert.match(sub.stdout, /主包 实测 [0-9]{2,3} B/)
    assert.match(sub.stdout, /pkg-ai: 3,145,728 B/)

    // 反向:把同一个文件挪进主包(其余一字不改)⇒ 必红
    mkdirSync(join(dir, 'apps/miniapp-taro/dist/pages/index'), { recursive: true })
    writeFileSync(
      join(dir, 'apps/miniapp-taro/dist/pages/index/blob.js'),
      readFileSync(join(dir, 'apps/miniapp-taro/dist/pkg-ai/blob.js')),
    )
    const main = run(dir, ['--target', 'miniapp'])
    assert.equal(main.status, 1, '同一批字节挪进主包必须判红,否则 C5 的正例无牙')
    assert.match(main.stdout, /超硬上限/)
  } finally {
    rmScratch(dir)
  }
})

test('C5b 嵌套分包 root(pages/member)同样不得计入主包', () => {
  const dir = mkFakeRepo('ab-c5b-')
  try {
    makeDist(
      dir,
      'apps/miniapp-taro/dist',
      { 'pages/member/blob.js': 2 * 1024 * 1024 },
      JSON.stringify({ pages: ['pages/index/index'], subpackages: [{ root: 'pages/member' }] }),
    )
    const r = run(dir, ['--target', 'miniapp'])
    assert.equal(r.status, 0, `嵌套分包被算进主包:\n${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('C6 主包清单读不出 ⇒ exit 2 无法判定(既不冒红也不记绿)', () => {
  const dir = mkFakeRepo('ab-c6-')
  try {
    makeDist(dir, 'apps/miniapp-taro/dist', { 'pages/index/a.js': 10 }, null) // 无 app.json
    const r = run(dir, ['--target', 'miniapp'])
    assert.equal(r.status, 2, r.stdout + r.stderr)
    assert.match(r.stderr, /无法判定/)
    assert.match(r.stderr, /app\.json/)
    // 反向:JSON 坏了也是"无法判定",不是"判据红"
    writeFileSync(join(dir, 'apps/miniapp-taro/dist/app.json'), '{oops')
    assert.equal(run(dir, ['--target', 'miniapp']).status, 2)
  } finally {
    rmScratch(dir)
  }
})

test('C7 AB2 只拦"引用在而 .map 不在"的悬空态,成对在位必须绿', () => {
  const dir = mkFakeRepo('ab-c7-')
  try {
    makeDist(
      dir,
      'apps/miniapp-taro/dist',
      { 'pages/index/a.js': 1 },
      JSON.stringify({ pages: [] }),
    )
    const abs = join(dir, 'apps/miniapp-taro/dist/pages/index/a.js')
    writeFileSync(abs, 'x\n//# sourceMappingURL=a.js.map\n')
    let r = run(dir, ['--target', 'miniapp'])
    assert.equal(r.status, 1, `悬空 map 引用未被拦:\n${r.stdout}`)
    assert.match(r.stdout, /AB2 悬空 map 引用: 1 处/)
    assert.match(r.stdout, /pages\/index\/a\.js -> a\.js\.map/)
    // 补上 .map ⇒ 同一份引用注释必须转为绿(证明拦的是"悬空",不是"有 sourcemap")
    writeFileSync(`${abs}.map`, '{"version":3,"sources":[],"mappings":""}')
    r = run(dir, ['--target', 'miniapp'])
    assert.equal(r.status, 0, `成对存在仍判红 = 把"清 sourcemap"立成了判据主体:\n${r.stdout}`)
    assert.match(r.stdout, /已随产物带出 1 处/)
  } finally {
    rmScratch(dir)
  }
})

test('C8 新鲜度必须如实报:结论区含产物 mtime 与"可能是上一次构建的产物"', () => {
  const dir = mkFakeRepo('ab-c8-')
  try {
    makeDist(
      dir,
      'apps/miniapp-taro/dist',
      { 'pages/index/a.js': 10 },
      JSON.stringify({ pages: [] }),
    )
    const r = run(dir, ['--target', 'miniapp'])
    assert.match(r.stdout, /产物最新 mtime: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    assert.match(r.stdout, /这可能是上一次构建的产物/)
    const j = JSON.parse(run(dir, ['--target', 'miniapp', '--json']).stdout)
    assert.ok(j.newestMtimeMs > 0 && typeof j.ageHours === 'number')
  } finally {
    rmScratch(dir)
  }
})

test('C9 未校准档只报数不判红,但必须把理由与 AB2 计数喊出来', () => {
  const dir = mkFakeRepo('ab-c9-')
  try {
    makeDist(dir, 'apps/web/out', { 'index.html': 10, 'a.js': 10 })
    writeFileSync(join(dir, 'apps/web/out/a.js'), 'x\n//# sourceMappingURL=gone.js.map\n')
    const r = run(dir, ['--target', 'web-static'])
    assert.equal(r.status, 0, `未校准档被判红:\n${r.stdout}`)
    assert.match(r.stdout, /未校准依据/)
    assert.match(r.stdout, /AB2 未启用判红/)
    assert.match(r.stdout, /a\.js -> gone\.js\.map/)
  } finally {
    rmScratch(dir)
  }
})

/**
 * C10 --self-test 经 CLI 真跑也必须 0 失败(不只 import 判据)。
 * ⚠ 跑的是**真仓那一份**脚本:scratch-dir.mjs 的落点由"脚本自身位置往上两级"推导,
 * 拷进 `<演练仓>/scripts/` 后那个推导会算到演练仓外面,mkdir 直接 EPERM(第一版就这样
 * 红过 —— 红的是夹具落点、不是判据)。其余用例只走判定路径、不碰 mkScratch,
 * 所以才放在演练仓里。
 */
test('C10 --self-test 经 CLI 真跑必须 0 失败', () => {
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', SCRIPT), '--self-test'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /失败 0/)
})

test('C10b 紧急跳过开关只关"要不要判",不关"报不报"', () => {
  const dir = mkFakeRepo('ab-c10b-')
  try {
    makeDist(dir, 'apps/miniapp-taro/dist', { 'pages/index/blob.js': 3 * 1024 * 1024 })
    assert.equal(run(dir, ['--target', 'miniapp']).status, 1, '不跳过时必须判红,否则下面那半无意义')
    const skipped = run(dir, ['--target', 'miniapp'], { [SKIP_ENV]: '1' })
    assert.equal(skipped.status, 0)
    assert.match(skipped.stdout, /跳过产物预算门/)
  } finally {
    rmScratch(dir)
  }
})

/**
 * C11 接线条件不变量(见文件头)。未登记 ⇒ 打印"待接线"、不判失败。
 */
test('C11 接线条件不变量:登记了就 mode=warn + skipEnv + 编号唯一 + CI 调用点', () => {
  const runnerPath = join(REPO, 'scripts', 'guardian-runner.mjs')
  const pkgPath = join(REPO, 'package.json')
  assert.ok(existsSync(runnerPath), '找不到 guardian-runner.mjs,本断言失去对象')
  const runner = readFileSync(runnerPath, 'utf8')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

  const marker = `script: '${SCRIPT}'`
  const idx = runner.indexOf(marker)
  if (idx === -1) {
    const inPkg = Object.values(pkg.scripts ?? {}).some((v) => String(v).includes(SCRIPT))
    if (!inPkg) {
      console.log(`ℹ️ 待接线:${SCRIPT} 尚未登记进提交链 / package.json(由主会话统一接线,不判失败)`)
      return
    }
  }

  // 已登记 ⇒ 四条都必须成立
  const blocks = []
  let at = -1
  while ((at = runner.indexOf(marker, at + 1)) !== -1) {
    const start = runner.lastIndexOf('\n  {', at)
    const end = runner.indexOf('\n  }', at)
    assert.ok(start !== -1 && end !== -1, '注册块边界解析失败(格式变了,请同步本测试)')
    blocks.push(runner.slice(start, end))
  }
  assert.equal(blocks.length, 1, `本门在 runner 中必须恰好出现一次,实得 ${blocks.length}`)
  const block = blocks[0]
  const idm = block.match(/id:\s*'([^']+)'/)
  assert.ok(idm, '注册块缺 id')
  const idCount =
    runner.match(new RegExp(`id: '${idm[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) ?? []
  assert.equal(
    idCount.length,
    1,
    `编号 ${idm[1]} 在 runner 中被两道门共用(撞号会串 skipEnv 与失败归属)`,
  )
  assert.match(
    block,
    /mode:\s*'warn'/,
    '本门判磁盘产物 ⇒ 提交链必须 warn。blocking 的结果是每一次提交都被拦,' +
      '而恒红门唯一结局是逼人 --no-verify,连带废掉全部守门(AGENTS §12e)。',
  )
  assert.ok(
    block.includes(`skipEnv: '${SKIP_ENV}'`),
    `注册块必须声明 skipEnv: '${SKIP_ENV}'(脚本本身读的是这个名)`,
  )

  const ciDirs = [join(REPO, '.github', 'workflows')]
  const cited = ciDirs.some((d) => {
    if (!existsSync(d)) return false
    return readdirSync(d)
      .filter((f) => /\.ya?ml$/.test(f))
      .some((f) => readFileSync(join(d, f), 'utf8').includes(SCRIPT))
  })
  assert.ok(
    cited,
    `${SCRIPT} 已接提交链却没有 CI 调用点。本门唯一能真判红的地方是 CI(那里产物必然存在);` +
      '只接提交链 = 退化成一台永远不会真红的 warn。',
  )
})

// ── C12:提交链里的「可执行性」(G-176)────────────────────────────────
// 本门刻意「缺/未知 --target 即 exit 2、不回落默认档」,而 runner 曾以 `args: []` 登记它,
// 且提交链会给每道门自动下发 --staged ⇒ 它在链里 100% 跑不起来。exit 2 被 warn 档计成
// 「警告」,看起来像检测结果,实际含义是"这道门从没运行过" —— 那比恒红更坏(恒红至少逼人去看)。
test('C12 链式调用形态必须可执行:--target + --staged 不得 exit 2', () => {
  const r = spawnSync(
    process.execPath,
    [join(REPO, 'scripts', SCRIPT), '--target', 'miniapp', '--staged'],
    { encoding: 'utf8', windowsHide: true, timeout: 240000 },
  )
  assert.notEqual(
    r.status,
    2,
    `链式形态被判"无法判定" ⇒ 本门在提交链里等于没跑\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.ok(r.status === 0 || r.status === 1, `应给出真结论(0 或 1),实得 ${r.status}`)
})

test('C12b runner 的 110 注册块必须带 --target(args 为空就是本门的死因)', () => {
  const runner = readFileSync(join(REPO, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const at = runner.indexOf(`script: '${SCRIPT}'`)
  assert.ok(at > 0, 'runner 里没有本门注册块,本断言失去对象')
  const block = runner.slice(runner.lastIndexOf('\n  {', at), runner.indexOf('\n  }', at))
  assert.match(
    block,
    /args: \[[^\]]*'--target'/,
    "args 必须含 --target:空 args 让本门在链里恒 exit 2(它不回落默认档是对的,别让它没参数跑)",
  )
})

test('C12c 反向对照:未知参数仍必须 exit 2(证明 C12 的绿不是"什么都收"换来的)', () => {
  const r = spawnSync(
    process.execPath,
    [join(REPO, 'scripts', SCRIPT), '--totally-unknown-flag'],
    { encoding: 'utf8', windowsHide: true, timeout: 120000 },
  )
  assert.equal(r.status, 2, `未知参数应仍判"无法判定",实得 ${r.status}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
