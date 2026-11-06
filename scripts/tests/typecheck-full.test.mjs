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
  // 2026-11-07:主 typecheck 从「单次 pnpm -r」→「逐包串行」→「受限并发池」。
  // 执行顺序不能按字面出现位置判(执行器定义在文件前部,主流程调用在后面),
  // 必须锁「主流程里 perPackage 调用晚于 preflight 调用」+「spawn 住在单包执行器内部」。
  const iRunnerDef = SRC.indexOf('async function runTypecheckPerPackage()')
  const iOneDef = SRC.indexOf('function runOnePackage(pkg)')
  const iSpawn = SRC.indexOf('pnpm --filter "${pkg.name}" run typecheck')
  const iLog = SRC.indexOf('运行分包 typecheck')
  const iCall = SRC.lastIndexOf('staleDistPreflight()')
  const iRunnerCall = SRC.lastIndexOf('const perPackage = await runTypecheckPerPackage()')
  assert.ok(
    iSpawn > 0 && iLog > 0,
    '找不到分包 typecheck 的 spawn/日志行(主流程被改写 ⇒ 本锁须同步)',
  )
  assert.ok(iRunnerDef > 0 && iOneDef > 0, '并发池与单包执行器都必须存在')
  assert.ok(iSpawn > iOneDef, '逐包 spawn 必须住在单包执行器内部')
  assert.ok(iRunnerDef > iOneDef, '并发池必须复用单包执行器')
  assert.ok(iCall > 0, '前置被摘线 ⇒ 本文件回到"拿旧产物下结论"的原病')
  assert.ok(iRunnerCall > 0, '主流程必须显式调用(并 await)逐包执行器')
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
  assert.match(
    SRC,
    /return \{ ok: false, status: failure\.status \?\? 1 \}/,
    '失败必须 fail-fast 非零退出',
  )
  assert.match(SRC, /最慢包:/, '全量汇总必须点名最慢包')
  assert.match(SRC, /IHUI_TYPECHECK_TIMINGS_FILE/, '读数落盘路径必须可覆盖以便复查')
})

test('T8 并发池:失败不再派发新包、未派发包必须点名、并发度可覆盖且不得超过包数', () => {
  assert.match(
    SRC,
    /async function worker\(\)[\s\S]{0,120}if \(failure\) return/,
    '失败后必须停止派发(失败即停语义不得退化成继续跑)',
  )
  assert.match(SRC, /notRun/, '必须点名「未派发的包」,否则失败现场分不清是失败还是没跑')
  assert.match(
    SRC,
    /previous\.get\(b\.name\) \?\? -1/,
    '派发必须按上一轮实测耗时降序(LPT),否则重包排在最后会拖出长尾',
  )
  assert.match(SRC, /IHUI_TYPECHECK_CONCURRENCY/, '并发度必须可由环境变量覆盖(低内存机器退回 2)')
  assert.match(
    SRC,
    /const workers = Math\.max\(1, Math\.min\(TYPECHECK_CONCURRENCY, packages\.length\)\)/,
    '并发路数不得超过包数',
  )
  assert.match(
    SRC,
    /c=4 → 墙钟 179\.7s/,
    '并发度定档必须写明实测依据(否则下次有人凭感觉改数字)',
  )
  assert.match(
    SRC,
    /300s 阈值一行未改/,
    '必须留档「没有靠调大阈值消红」这件事',
  )
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

test('T9 apps/api 单腿合并档必须覆盖 src ∪ scripts,且覆盖项不得改松(防只改其中一条腿)', () => {
  const apiRoot = join(ROOT, 'apps', 'api')
  const pkg = JSON.parse(readFileSync(join(apiRoot, 'package.json'), 'utf8'))
  // tsconfig 允许整行 // 注释(本仓 scripts 档头注即此形);本测试只剥整行注释,不改其余字节
  const parseJsonc = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\s*\/\/.*$/gm, ''))
  const main = parseJsonc(join(apiRoot, 'tsconfig.json'))
  const merged = parseJsonc(join(apiRoot, 'tsconfig.scripts.json'))

  assert.equal(
    pkg.scripts.typecheck,
    'tsc --noEmit -p tsconfig.scripts.json',
    'typecheck 必须是单腿合并档;再拆回两条腿 ⇒ 本测试红(合并不得被悄悄回退)',
  )
  assert.equal(
    merged.extends,
    './tsconfig.json',
    '合并档必须继承主档,strict 族只在 base 定一处,不得另写一份',
  )
  const inc = merged.include || []
  assert.ok(inc.includes('src/**/*.ts'), '合并档必须覆盖 src —— 只留 scripts 腿会漏 src')
  assert.ok(inc.includes('scripts/**/*.ts'), '合并档必须覆盖 scripts —— 只跑 src 腿会漏 scripts')
  assert.deepEqual(
    merged.exclude,
    main.exclude,
    'exclude 不得比主档更宽(更宽 = 少检查文件,方向是变松)',
  )
  assert.deepEqual(
    main.include,
    ['src/**/*.ts'],
    '主 tsconfig 是 build 档(rootDir=./src 要吐 dist),射程应保持 src 单面',
  )
  assert.deepEqual(merged.compilerOptions.types, ['node'], 'types 必须保持收窄档(全量自动纳入是变松)')
  assert.equal(merged.compilerOptions.noEmit, true, '合并档必须 noEmit(不得让 typecheck 落产物)')

  // 形状锁:合并档只允许覆盖 emit/缓存相关选项;新增任何其它键(尤其 strict 族)都必须先重新证明
  const allowed = new Set([
    'noEmit',
    'rootDir',
    'incremental',
    'tsBuildInfoFile',
    'declaration',
    'sourceMap',
    'types',
  ])
  for (const k of Object.keys(merged.compilerOptions)) {
    assert.ok(allowed.has(k), `合并档新增选项 ${k} —— 必须重新证明"不变松"后再更新本测试`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
