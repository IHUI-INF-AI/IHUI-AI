// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/typecheck-full.mjs 的陈旧 dist 前置(§22c)
//
// 为什么只能 spawn:typecheck-full 顶层就是 CLI 主流程且**没有 §22d isDirectRun 守卫**
// —— import 它会清掉全仓 .tsbuildinfo 并真的开始跑 typecheck。所以判据函数不能被 import,
// 只能把脚本起来验(与 merge-live-doc 的装车证明同一处理)。
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = join(ROOT, 'scripts', 'typecheck-full.mjs')
const SRC = readFileSync(CLI, 'utf8')

test('T1 自检必须跑通(六条成对正反例,含"src 比 dist 旧不得判陈旧"的反向对照)', () => {
  const r = spawnSync(process.execPath, [CLI, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `自检退出码非 0:\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /--self-test:\d+ 通过 \/ 0 失败/, '末行必须报"0 失败"')
})

test('T2 自检短路必须排在清缓存之前(否则每跑一次自检就全量清一次 .tsbuildinfo)', () => {
  const iSelf = SRC.indexOf("'--self-test'")
  const iClean = SRC.indexOf('清除 .tsbuildinfo 增量缓存')
  assert.ok(iSelf > 0, '--self-test 分支不见了 = 自检退化成没有')
  assert.ok(iClean > 0, '找不到清缓存那一行(判据被搬走,须同步本测试)')
  assert.ok(iSelf < iClean, '自检必须早于破坏性动作')
  assert.match(SRC, /process\.exit\(bad \? 1 : 0\)/, '自检分支必须自己退出,不得落到主流程')
})

test('T3 陈旧 dist 前置必须真接在主 typecheck 之前,且两种结论都要出声', () => {
  // 2026-11-07:主 typecheck 从「单次 pnpm -r」改为「逐包执行器」。
  // 执行顺序不能再按字面出现位置判(runner 定义在文件前部,主流程调用在后面),
  // 必须锁「主流程里 perPackage 调用晚于 preflight 调用」+「spawn 住在执行器内部」。
  const iRunnerDef = SRC.indexOf('function runTypecheckPerPackage()')
  const iSpawn = SRC.indexOf("spawnSync('pnpm', ['--filter', pkg.name, 'run', 'typecheck']")
  const iLog = SRC.indexOf('运行分包 typecheck')
  const iCall = SRC.lastIndexOf('staleDistPreflight()')
  const iRunnerCall = SRC.lastIndexOf('const perPackage = runTypecheckPerPackage()')
  assert.ok(
    iSpawn > 0 && iLog > 0,
    '找不到分包 typecheck 的 spawn/日志行(主流程被改写 ⇒ 本锁须同步)',
  )
  assert.ok(iRunnerDef > 0 && iSpawn > iRunnerDef, '逐包 spawn 必须住在执行器内部')
  assert.ok(iCall > 0, '前置被摘线 ⇒ 本文件回到"拿旧产物下结论"的原病')
  assert.ok(iRunnerCall > 0, '主流程必须显式调用逐包执行器')
  assert.ok(iCall < iRunnerCall, '前置必须早于全量 typecheck(按主流程调用序判,不按函数定义位置)')
  assert.match(SRC, /IHUI_SKIP_STALE_DIST_PREFLIGHT/, '应急开关必须在位')
  assert.ok(
    /跳过陈旧 dist 前置重建[\s\S]{0,200}旧产物/.test(SRC),
    '跳过时必须打印"结论可能来自旧产物",静默开关等于没有护栏',
  )
  assert.match(SRC, /不带着旧产物继续跑类型检查[\s\S]{0,160}process\.exit/, '重建失败必须非零退出')
  assert.match(SRC, /无需重建/, '全绿时也必须出一行"前置跑过了"——否则"没跑"与"跑了没事"同形')
})

test('T4 pickStalePackages 必须被 export(§22c:判据要能被直接审,不得只活在脚本里)', () => {
  assert.match(SRC, /export function pickStalePackages/, '判据函数未导出')
})

test('T6 分包计时必须逐包落盘、失败即停、汇总点名最慢包', () => {
  assert.match(SRC, /appendTiming\(\{\s*event: 'start', package: pkg\.name/, '每包开始必须落盘')
  assert.match(
    SRC,
    /event: 'finish',[\s\S]{0,80}package: pkg\.name,[\s\S]{0,80}elapsedMs,/,
    '每包结束必须落盘耗时',
  )
  assert.match(SRC, /return \{ ok: false, status: r\.status \?\? 1 \}/, '失败必须 fail-fast 非零退出')
  assert.match(SRC, /最慢包:/, '全量汇总必须点名最慢包')
  assert.match(SRC, /IHUI_TYPECHECK_TIMINGS_FILE/, '读数落盘路径必须可覆盖以便复查')
})

test('T7 check-typecheck 超时分支必须先落分包读数再杀进程,且仍归 undetermined', () => {
  const WRAP = readFileSync(join(ROOT, 'scripts', 'check-typecheck.mjs'), 'utf8')
  assert.match(WRAP, /dumpTypecheckTimings\(\)\n\s*\/\/ G-611/, '超时日志必须先于 killChildTree')
  assert.match(WRAP, /非类型检查结论/, '超时文案必须保留「非结论」语义')
  assert.match(WRAP, /if \(outcome\.kind === 'timeout'\) \{\s*process\.exit\(1\)/, '超时只能 exit 1(undetermined),不得转 pass')
})

test('T5 自检不得建 os.tmpdir 锁(自检不派生 tsc,并发自检不该在共享临时目录上互等)', () => {
  const iGuard = SRC.indexOf('if (!_SELF_TEST) {')
  const iLock = SRC.indexOf('_mkLock(_lockDir')
  assert.ok(iGuard > 0, '--self-test 必须整体跳过串行锁(锁落 os.tmpdir 是共享面)')
  assert.ok(iLock > 0, '找不到真实全量跑的建锁调用(结构变了须同步本测试)')
  assert.ok(iGuard < iLock, '建锁必须在自检闸门之下,否则自检又去 os.tmpdir 落锁')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
