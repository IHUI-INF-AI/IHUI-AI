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

test('T3 陈旧 dist 前置必须早于并发主流程,且两种结论都要出声', () => {
  // 2026-11-07(T1 提速):主流程由"spawnSync('pnpm -r run typecheck')"改为
  // runTypecheckProjects();判据不变的部分仍要求"前置真接了、且早于类型检查"。
  const iCall = SRC.lastIndexOf('await staleDistPreflight()')
  const iRunner = SRC.indexOf('runTypecheckProjects({')
  assert.ok(iRunner > 0, '找不到并发主流程(主流程被改写 ⇒ 本锁须同步)')
  assert.ok(iCall > 0, '前置被摘线 ⇒ 本文件回到"拿旧产物下结论"的原病')
  assert.ok(iCall < iRunner, '前置必须早于全量 typecheck')
  assert.match(SRC, /IHUI_SKIP_STALE_DIST_PREFLIGHT/, '应急开关必须在位')
  assert.ok(
    /跳过陈旧 dist 前置重建[\s\S]{0,200}旧产物/.test(SRC),
    '跳过时必须打印"结论可能来自旧产物",静默开关等于没有护栏',
  )
  assert.match(SRC, /不带着旧产物继续跑类型检查[\s\S]{0,160}process\.exit/, '重建失败必须非零退出')
  assert.match(SRC, /无需重建/, '全绿时也必须出一行"前置跑过了"——否则"没跑"与"跑了没事"同形')
  // 并发主流程必须真的把所有包跑完而不是遇红即停(否则错误被吃掉,判据降级)。
  assert.match(SRC, /discoverTypecheckProjects\(ROOT\)/)
  assert.match(SRC, /runTypecheckProjects\(\{[\s\S]{0,200}projects: _projects/)
  assert.match(SRC, /process\.exit\(_typecheckRun\.exitCode/)
})

test('T4 pickStalePackages 必须可被直接审(§22c):实现住 lib/,脚本保留同名导出', () => {
  // 2026-11-07:判据实现搬进 scripts/lib/stale-dist.mjs(供夹具直接 import),
  // typecheck-full 保留 export 别名,审的人不用进主流程文件。
  assert.match(SRC, /export \{ pickStalePackages \}/, '脚本未保留判据导出')
  const lib = readFileSync(join(ROOT, 'scripts', 'lib', 'stale-dist.mjs'), 'utf8')
  assert.match(lib, /export function pickStalePackages/, 'lib 里找不到判据函数')
})

test('T5 自检不得建 os.tmpdir 锁(自检不派生 tsc,并发自检不该在共享临时目录上互等)', () => {
  const iGuard = SRC.indexOf('if (!_SELF_TEST) {')
  const iLock = SRC.indexOf('_mkLock(_lockDir')
  assert.ok(iGuard > 0, '--self-test 必须整体跳过串行锁(锁落 os.tmpdir 是共享面)')
  assert.ok(iLock > 0, '找不到真实全量跑的建锁调用(结构变了须同步本测试)')
  assert.ok(iGuard < iLock, '建锁必须在自检闸门之下,否则自检又去 os.tmpdir 落锁')
})

test('T6 --preflight-only 必须只建产物不判类型,且不得被再入守卫/串行锁吞掉', () => {
  // 2026-11-06:push 门的定向快通道复用本档(typecheck-full --preflight-only)补跑前置。
  // 三条结构约束,每条都对应一种"看起来接了、实际没跑"的假接线:
  // ① 分支必须自己 exit,不得落进清 .tsbuildinfo 与 pnpm -r 主流程(那是类型检查,不是前置);
  // ② 必须早于再入守卫 IHUI_TYPECHECK_FULL_CHILD —— 否则被调用方带着该 env 起本档时静默 exit 0,
  //    旧产物照旧,"前置没跑"与"前置跑了没事"同形;
  // ③ 必须早于建锁 —— 否则 push 侧会被另一会话的全量 typecheck 串行拖到超时,把真结论换成超时红。
  const iFlag = SRC.indexOf("'--preflight-only'")
  assert.ok(iFlag > 0, '--preflight-only 分支不见了 ⇒ 快通道前置无实现可复用')
  const iPreflightCall = SRC.indexOf('staleDistPreflight()', iFlag)
  assert.ok(iPreflightCall > iFlag, '--preflight-only 分支必须真调 staleDistPreflight()')
  const iExitAfter = SRC.indexOf('process.exit(0)', iPreflightCall)
  assert.ok(iExitAfter > iPreflightCall, '--preflight-only 必须建完即退,不得落进主流程')
  const iReentry = SRC.indexOf("process.env.IHUI_TYPECHECK_FULL_CHILD === '1'")
  const iLock = SRC.indexOf('_mkLock(_lockDir')
  const iClean = SRC.indexOf('清除 .tsbuildinfo 增量缓存')
  assert.ok(iFlag < iReentry, '前置档必须早于再入守卫,否则会被 IHUI_TYPECHECK_FULL_CHILD=1 静默吞掉')
  assert.ok(iFlag < iLock, '前置档必须早于建锁,否则 push 会在另一会话的全量门上干等')
  assert.ok(iFlag < iClean, '前置档不得触发清 .tsbuildinfo(那是全量跑的破坏性动作)')
})

test('T7 --preflight-only 构建失败必须 exit 2 未判定,且全量通道退出码语义不被改动', () => {
  // 铁律:前置只负责"把输入面准备好",取不到输入面就不许给结论 —— 既不许报绿(exit 0),
  // 也不许沿用 build 的退出码(通常 1,上层会把它读成"类型检查有结论的失败"=已入库红)。
  // 2026-11-07:失败分支改成"全部拓扑层跑完再汇总"(并发下要先收齐错误),判据仍在。
  const iFlag = SRC.indexOf("'--preflight-only'")
  // 文件里有两处 `if (_PREFLIGHT_ONLY)`:开头是"只跑前置就退",失败出口那处在函数尾部。
  const iGuarded = SRC.lastIndexOf('if (_PREFLIGHT_ONLY) {')
  assert.ok(iGuarded > iFlag, '前置档的失败出口必须显式区分,否则会与全量通道共用退出码')
  const iExit2 = SRC.indexOf('process.exit(2)', iGuarded)
  assert.ok(iExit2 > iGuarded, '构建失败必须落 process.exit(2)')
  const guarded = SRC.slice(iGuarded, iExit2)
  assert.match(guarded, /未判定\(exit 2\)/, '前置失败必须明写"未判定(exit 2)"')
  assert.match(guarded, /产物面取不到/, '前置失败必须给出"产物面取不到"的可读理由')
  assert.match(guarded, /复现: pnpm --filter/, '前置失败必须给一键复现命令')
  assert.ok(!/process\.exit\(0\)/.test(guarded), '前置失败分支内不得出现 exit 0/放行')
  // 全量通道原行为保持不变:build 失败沿用其退出码;只有"产物未刷新"才补 exit 2。
  assert.match(
    SRC.slice(iExit2),
    /不带着旧产物继续跑类型检查[\s\S]{0,200}process\.exit\(nonzero && nonzero\.rc \? nonzero\.rc : 2\)/,
    '全量通道的失败语义被顺手改了 —— 本次只允许给前置档补死判据',
  )
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
