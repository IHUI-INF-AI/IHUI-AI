// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门「mobile-rn 版本号单调递增对账」(check-mobile-version-code.mjs)的镜像测试。
 *
 * 本门拦的是"版本号回潮":app.json 无 android.versionCode ⇒ Expo prebuild 默认恒为 1,
 * CI nightly 包覆盖任何更高 versionCode 的构建必被 Android 降级保护拒(2026-10-12
 * 装机实测:install -r / -r -d / uninstall -k 三连拒,只有全删重装,登录态全丢)。
 * 它的危险形态全部安静:① 门没注册(判据对、无人调度);② 号段边界在门里抄了第二份
 * (与 app.config.js 漂开后照样绿);③ "取不到面"被折成通过;④ 只判磁盘不判索引
 * (提交带走了旧配置而门读的是修好的盘上面)。每一臂都配反向对照。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { judgeResolved } from '../check-mobile-version-code.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const REPO = resolve(SCRIPTS_DIR, '..')
const GATE_REL = 'check-mobile-version-code.mjs'
const GIT = process.env.GIT_BIN || 'git'

const gitIn = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 64 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

function runGate(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', GATE_REL), ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 64 << 20,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const PKG = JSON.stringify({ name: 'ihui-ai-mobile', version: '0.0.5', type: 'module' })
const APPJSON = JSON.stringify({
  expo: {
    name: 'IHUI AI',
    slug: 'ihui-ai-mobile',
    version: '0.0.5',
    ios: { bundleIdentifier: 'ai.ihui.mobile' },
    android: { package: 'zh.ai.sq' },
    extra: { WX_APP_APPID: 'wx85fa429a9331b5c8', WX_UNIVERSAL_LINK: 'https://aizhs.top/' },
  },
})
// 合法夹具:过去时刻的硬戳(与测试运行时刻无关,永不为未来号)
const GOOD_CONFIG = `module.exports = ({ config }) => ({ ...config, android: { ...config.android, versionCode: 26101208 }, ios: { ...config.ios, buildNumber: '26101208' } })\nmodule.exports.VERSION_CODE_FLOOR = 26010100\nmodule.exports.VERSION_CODE_CEILING = 2100000000\n`
// 回潮夹具 A:解析器整只被删(2026-10-12 事故前的真实形态:无注入也无边界导出)
const BAD_CONFIG = `module.exports = ({ config }) => ({ ...config, version: '0.0.5' })\n`
// 回潮夹具 B:边界导出还在但注入被摘 —— 日常回归的最可能形态(改配置的人动了函数体)
const BAD_CONFIG_KEEP_BOUNDS = `${BAD_CONFIG}module.exports.VERSION_CODE_FLOOR = 26010100\nmodule.exports.VERSION_CODE_CEILING = 2100000000\n`

/** 夹具 git 仓:门 + lib 闭包 + 被审三件,可控的两面现场。 */
function makeRepo(dir, { appConfigText = GOOD_CONFIG, commit = true, trackConfig = true } = {}) {
  copyScriptWithClosure(SCRIPTS_DIR, GATE_REL, join(dir, 'scripts'), ['lib/face-reader.mjs'])
  const rel = (name) => join('apps', 'mobile-rn', name)
  mkdirSync(dirname(join(dir, rel('x'))), { recursive: true })
  writeFileSync(join(dir, rel('app.json')), APPJSON, 'utf8')
  writeFileSync(join(dir, rel('package.json')), PKG, 'utf8')
  writeFileSync(join(dir, rel('app.config.js')), appConfigText, 'utf8')
  gitIn(dir, ['init', '-q', '.'])
  gitIn(dir, ['config', 'user.email', 't@example.invalid'])
  gitIn(dir, ['config', 'user.name', 'mirror test'])
  if (trackConfig) {
    gitIn(dir, ['add', '-A', '--'])
    if (commit) gitIn(dir, ['commit', '-q', '-m', 'base'])
  } else {
    // 只提交除 app.config.js 以外的(模拟"配置未跟踪"的取材失败现场)
    gitIn(dir, ['add', '-A', '--', 'scripts', 'apps/mobile-rn/app.json', 'apps/mobile-rn/package.json'])
    if (commit) gitIn(dir, ['commit', '-q', '-m', 'base'])
  }
}

/* ---------------------------- 装车证明与唯一实现 ---------------------------- */

test('M1 装车证明:runner 里必须有本门注册块,且 blocking + skipEnv + stagedTriggers 逐字在位', () => {
  // 取**工作树**那一份:提交链消费的就是盘上这份(门与注册块同枚入库,入库后两面等价);
  //  unlike 守门 199 的 HEAD 面取材,本门连注册块一起是本枚提交带进来的,提交前 HEAD 面
  // 必然没有它 —— 按 HEAD 判会把"还没提交"读成"没装车"。
  const src = execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(join(REPO, 'scripts/guardian-runner.mjs'))},'utf8'))`], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const at = src.indexOf(`script: '${GATE_REL}'`)
  assert.ok(at > 0, `runner 里没有 ${GATE_REL} 的注册块 ⇒ 门存在而无人调度,提交链上永远不跑`)
  const block = src.slice(Math.max(0, at - 900), at + 900)
  assert.match(block, /id:\s*'201'/, '注册 id 必须是 201(现读最大值 200 的下一号)')
  assert.match(block, /mode:\s*'blocking'/, '定级必须 blocking(本型没有"只报数"的价值:号段回潮是硬伤)')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_MOBILE_VERSION_CODE'/, '缺应急跳过变量 = 文档写了跑不通的出路')
  assert.match(block, /stagedTriggers:\s*\['apps\/mobile-rn\/'/, '缺 stagedTriggers = 改 mobile-rn 时门根本不醒')
})

test('M2 方向锁:script 行被改名后,M1 那种"已装车"结论不得成立', () => {
  const src = execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(join(REPO, 'scripts/guardian-runner.mjs'))},'utf8'))`], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const at = src.indexOf(`script: '${GATE_REL}'`)
  assert.ok(at > 0, '本臂的前置:runner 里得有本门(与 M1 同一条事实,不另建假设)')
  const renamed = src.slice(0, at) + src.slice(at).replace(`script: '${GATE_REL}'`, `script: '${GATE_REL.replace('check-', 'check-ZZ-')}'`)
  assert.ok(renamed.indexOf(`script: '${GATE_REL}'`) < 0, '替换没命中 ⇒ 这条反向锁没牙')
})

test('M3 唯一实现锁:号段边界必须由被审模块导出、门按参数消费,门内不得烘焙常量', () => {
  // 行为钉(不是源码 grep):同一解析产物换 floor 就得换结论 —— 证明 floor 是入参不是常量。
  const base = { resolved: { android: { versionCode: 150 }, ios: { buildNumber: '150' } }, now: new Date() }
  assert.equal(judgeResolved({ ...base, floor: 100, ceiling: 1000 }).ok, true, 'floor=100 时 150 必须放行')
  assert.equal(judgeResolved({ ...base, floor: 200, ceiling: 1000 }).ok, false, 'floor=200 时 150 必须判红')
  // 反向:门确实读模块导出的边界(真实 app.config.js 尾部那两个导出)
  const cfg = execFileSync(process.execPath, ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(join(REPO, 'apps/mobile-rn/app.config.js'))},'utf8'))`], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.match(cfg, /module\.exports\.VERSION_CODE_FLOOR\s*=/, 'app.config.js 必须导出 VERSION_CODE_FLOOR')
  assert.match(cfg, /module\.exports\.VERSION_CODE_CEILING\s*=/, 'app.config.js 必须导出 VERSION_CODE_CEILING')
})

test('M4 门内自检必须全绿(13 例,含全部反向枝)', () => {
  const r = runGate(REPO, ['--self-test'])
  assert.equal(r.code, 0, `self-test 必须全绿:\n${r.out.slice(0, 1200)}`)
  assert.match(r.out, /self-test: pass 13 \/ fail 0/, '例数漂移 ⇒ 自检被改过,逐例核')
})

/* ---------------------------- 真仓阳性对照 ---------------------------- */

test('M5 真仓阳性对照:工作树面必须绿且号段合法(看不见存量不算通过)', () => {
  const r = runGate(REPO, ['--worktree', '--json'])
  assert.equal(r.code, 0, `真仓工作树面不得判红(修复在盘上):\n${r.out.slice(0, 800)}`)
  const j = JSON.parse(r.out.slice(r.out.indexOf('{')))
  assert.equal(j.ok, true)
  assert.equal(typeof j.versionCode, 'number')
  assert.ok(j.versionCode >= 26010100, `versionCode ${j.versionCode} 低于号段下限`)
  assert.equal(j.buildNumber, String(j.versionCode), '两端必须同源')
})

/* ---------------------------- 端到端双向锁 ---------------------------- */

test('M6 端到端:合法配置全绿 / 两种回潮形态判红且点名问题', () => {
  const dir = mkScratch('mvc-e2e-')
  try {
    makeRepo(dir)
    const green = runGate(dir, ['--worktree'])
    assert.equal(green.code, 0, `合法配置必须绿:\n${green.out}`)
    // 回潮 A:解析器整只被删(app.json 也不声明)—— 2026-10-12 事故前的真实形态。
    // 此时边界导出也随解析器一起消失,红因报"未导出 VERSION_CODE_FLOOR"(号段判不出)。
    writeFileSync(join(dir, 'apps/mobile-rn/app.config.js'), BAD_CONFIG, 'utf8')
    const redA = runGate(dir, ['--worktree'])
    assert.equal(redA.code, 1, `回潮配置必须判红:\n${redA.out}`)
    assert.ok(/VERSION_CODE_FLOOR|versionCode/.test(redA.out), '红必须点名版本号号段的问题')
    // 回潮 B:边界导出还在、只摘注入 —— 必须直接点名 versionCode,不得只拿边界说事
    writeFileSync(join(dir, 'apps/mobile-rn/app.config.js'), BAD_CONFIG_KEEP_BOUNDS, 'utf8')
    const redB = runGate(dir, ['--worktree'])
    assert.equal(redB.code, 1, `摘注入必须判红:\n${redB.out}`)
    assert.ok(/versionCode/.test(redB.out), '摘注入的红必须点名 versionCode')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M7 面Flag 锁:索引注毒必红、同形态只写工作树必绿 —— 证明判的是"这次提交带走的那一份"', () => {
  const dir = mkScratch('mvc-face-')
  try {
    makeRepo(dir)
    // 索引注入回潮配置,工作树保持合法 ⇒ --staged 必须红(它判索引)
    writeFileSync(join(dir, 'apps/mobile-rn/app.config.js'), BAD_CONFIG, 'utf8')
    gitIn(dir, ['add', '--', 'apps/mobile-rn/app.config.js'])
    const red = runGate(dir, ['--staged'])
    assert.equal(red.code, 1, `索引面注入回潮必须判红:\n${red.out}`)
    // 工作树写回合法、索引仍是毒 ⇒ --worktree 必须绿(两面结论互斥才是"判了面")
    writeFileSync(join(dir, 'apps/mobile-rn/app.config.js'), GOOD_CONFIG, 'utf8')
    const green = runGate(dir, ['--worktree'])
    assert.equal(green.code, 0, `工作树面(已写回合法)必须绿:\n${green.out}`)
    const stillRed = runGate(dir, ['--staged'])
    assert.equal(stillRed.code, 1, '索引没动 ⇒ --staged 必须仍然红(证明它真的在判索引)')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M8 面旗矛盾判死:--staged 与 --worktree 同给 ⇒ exit 2,不得挑一面假装通过', () => {
  const dir = mkScratch('mvc-conflict-')
  try {
    makeRepo(dir)
    const r = runGate(dir, ['--staged', '--worktree'])
    assert.equal(r.code, 2, `两面旗同给必须判死:\n${r.out}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('M9 取材失败判"未判定":app.config.js 未进索引 ⇒ --staged exit 2,绝不冒绿也绝不冒红', () => {
  const dir = mkScratch('mvc-miss-')
  try {
    // 提交时刻意不带 app.config.js(只在工作树)
    makeRepo(dir, { trackConfig: false })
    const r = runGate(dir, ['--staged'])
    assert.equal(r.code, 2, `索引取不到被审文件必须判"无法判定"(exit 2):\n${r.out}`)
    assert.ok(/无法判定/.test(r.out), '结论行必须写明是无法判定,不得静默')
    // 同一现场 --worktree 有内容 ⇒ 绿(证明 exit 2 是"这一面没有"而非门坏了)
    const w = runGate(dir, ['--worktree'])
    assert.equal(w.code, 0, `工作树面有合法配置必须绿:\n${w.out}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
