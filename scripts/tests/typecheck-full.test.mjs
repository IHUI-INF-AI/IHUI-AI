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

test('T1 自检必须跑通(七条成对正反例,含"整包 mtime 被拉新不得替单产物担保"的正反两面)', () => {
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
  // 顺序判据的坑:`pnpm -r run typecheck` 在**文件头注里也出现过**(它正是被讨论的对象),
  // 取第一次字面出现会拿到注释的位置,于是"前置早于主流程"这条锁结构上永远判不过。
  // 比较基准必须落在真跑它的那次 spawn 与它自己那句日志上。
  const iSpawn = SRC.indexOf("spawnSync('pnpm -r run typecheck'")
  const iLog = SRC.indexOf('运行 pnpm -r run typecheck')
  const iCall = SRC.lastIndexOf('staleDistPreflight()')
  assert.ok(
    iSpawn > 0 && iLog > 0,
    '找不到全量 typecheck 的 spawn/日志行(主流程被改写 ⇒ 本锁须同步)',
  )
  assert.ok(iCall > 0, '前置被摘线 ⇒ 本文件回到"拿旧产物下结论"的原病')
  assert.ok(iCall < iLog && iCall < iSpawn, '前置必须早于全量 typecheck')
  assert.match(SRC, /IHUI_SKIP_STALE_DIST_PREFLIGHT/, '应急开关必须在位')
  assert.ok(
    /跳过陈旧 dist 前置重建[\s\S]{0,200}旧产物/.test(SRC),
    '跳过时必须打印"结论可能来自旧产物",静默开关等于没有护栏',
  )
  assert.match(SRC, /不带着旧产物继续跑类型检查[\s\S]{0,160}process\.exit/, '重建失败必须非零退出')
  assert.match(SRC, /无需重建/, '全绿时也必须出一行"前置跑过了"——否则"没跑"与"跑了没事"同形')
})

test('T4 pickStalePackages 必须住在可 import 的 lib 并能被直接审(§22c)', () => {
  // 2026-11-07 拆出:typecheck-full 顶层是 CLI(import 会清 .tsbuildinfo 并真跑 tsc),
  // 判据留在脚本里则夹具只能 spawn 验,构造面(单产物陈旧)验不了。判据必须住 lib 且被 export。
  const LIB = readFileSync(join(ROOT, 'scripts', 'lib', 'stale-dist.mjs'), 'utf8')
  assert.match(LIB, /export function pickStalePackages/, '判据函数未从 lib 导出')
  assert.match(LIB, /export function collectPackageStates/, '判据输入构造未从 lib 导出')
  assert.match(
    SRC,
    /from '\.\/lib\/stale-dist\.mjs'/,
    'typecheck-full 必须 import 共享判据(不得再写第二份)',
  )
  assert.ok(
    !/export function pickStalePackages/.test(SRC),
    '判据不得在 CLI 里留第二份(两份判据必然漂移)',
  )
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
  assert.ok(
    iFlag < iReentry,
    '前置档必须早于再入守卫,否则会被 IHUI_TYPECHECK_FULL_CHILD=1 静默吞掉',
  )
  assert.ok(iFlag < iLock, '前置档必须早于建锁,否则 push 会在另一会话的全量门上干等')
  assert.ok(iFlag < iClean, '前置档不得触发清 .tsbuildinfo(那是全量跑的破坏性动作)')
})

test('T7 --preflight-only 构建失败必须 exit 2 未判定,且全量通道退出码语义不被改动', () => {
  // 铁律:前置只负责"把输入面准备好",取不到输入面就不许给结论 —— 既不许报绿(exit 0),
  // 也不许沿用 build 的退出码(通常 1,上层会把它读成"类型检查有结论的失败"=已入库红)。
  // 变异实测:把失败分支里的 `if (_PREFLIGHT_ONLY)` 摘掉 ⇒ 本用例红,其余仍绿。
  const iFlag = SRC.indexOf("'--preflight-only'")
  const iFail = SRC.indexOf("if (out.failure === 'build') {", iFlag)
  assert.ok(iFail > iFlag, '找不到前置的构建失败分支(结构变了 ⇒ 本锁须同步)')
  const iGuarded = SRC.indexOf('if (_PREFLIGHT_ONLY) {', iFail)
  assert.ok(iGuarded > iFail, '前置档的失败出口必须显式区分,否则会与全量通道共用退出码')
  const iExit2 = SRC.indexOf('process.exit(2)', iGuarded)
  assert.ok(iExit2 > iGuarded, '构建失败必须落 process.exit(2)')
  assert.ok(iExit2 < SRC.length, '构建失败分支必须自己退出')
  // 读出来那段判据面,钉住"未判定 + 产物面取不到 + 包名 + rc"四件事(不许只留裸 exit 2)。
  const guardedEnd = SRC.indexOf('\n    }', iExit2)
  const guarded = SRC.slice(iGuarded, guardedEnd + 1)
  assert.match(guarded, /未判定\(exit 2\)/, '前置失败必须明写"未判定(exit 2)"')
  assert.match(guarded, /产物面取不到/, '前置失败必须给出"产物面取不到"的可读理由')
  assert.match(guarded, /复现: pnpm --filter/, '前置失败必须给一键复现命令')
  assert.match(guarded, /build rc=/, '前置失败必须点名失败包的 rc(不许只报"命中几个包")')
  assert.ok(!/process\.exit\(0\)/.test(guarded), '前置失败分支内不得出现 exit 0/放行')
  // 全量通道原行为保持不变:仍是 `process.exit(failed?.status ?? 1)`。
  assert.match(
    SRC.slice(guardedEnd),
    /不带着旧产物继续跑类型检查[\s\S]{0,160}process\.exit\(failed\?\.status \?\? 1\)/,
    '全量通道的失败语义被顺手改了 —— 本次只允许给前置档补死判据',
  )
})

test('T7b 重建后产物未刷新 ⇒ 未判定 exit 2(rc=0 不足以放行),逐包名与产物名都要出声', () => {
  // 2026-11-07 病根的另一半:旧门 rc=0 即放行,产物可能一个字节都没变。
  // 复核不过必须走未判定,不许静音、不许把判据放宽成"build 成功即通过"。
  const iVerify = SRC.indexOf("if (out.failure === 'unverified') {")
  assert.ok(iVerify > 0, '找不到复核未通过分支(结构变了 ⇒ 本锁须同步)')
  const tail = SRC.slice(iVerify)
  assert.match(tail, /process\.exit\(2\)/, '复核未通过必须 exit 2 未判定')
  assert.match(tail, /未判定\(exit 2\)/, '必须明写"未判定(exit 2)"')
  assert.match(tail, /未刷新/, '必须打印未刷新的产物名')
  assert.match(tail, /mtime .*→ .* 且内容未变/, '必须给出重建前后 mtime 与"内容未变"的判据')
  assert.match(tail, /bad\.map\(\(r\) => r\.name\)/, '必须逐包名指认,不许只报数量')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
