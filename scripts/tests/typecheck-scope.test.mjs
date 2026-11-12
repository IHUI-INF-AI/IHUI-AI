// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * typecheck-scope.test.mjs — G-406 ②「`--changed` 不沿反向依赖」侧的镜像测试
 *
 * 票面要治的病(逐字):「我方 PUSH_SCOPE_FILES/stagedTriggers 都是路径前缀 ⇒ **改契约不红 importer**」。
 * 改一份被下游 import 的契约时,importer 自身不在路径清单里 → 它的类型报错被
 * shouldDegrade 当成「本次改动范围外的并行会话噪音」降级放行 ⇒ 净零逃逸。
 * 本门用 scripts/lib/import-graph.mjs 的反向依赖闭包把那些 importer 纳入判据。
 *
 * 为什么这些用例只能 spawn 而不能 import 源脚本:
 *   check-typecheck.mjs 顶层就是 CLI 主流程且**没有 §22d isDirectRun 守卫** ——
 *   import 它会真的开始跑全量 typecheck(与 typecheck-full.test.mjs 同一处理)。
 *   所以判据只能在真仓上把脚本起来验(下面用 --dry-run:它打印判据面且不跑 typecheck)。
 *
 * 为什么必须钉"调用点"而不只是"函数语义":
 *   变异实测(2026-10-04)——把 `_widen = widenScopeOverDependents(...)` 换成常量对象后,
 *   源脚本 --self-test 仍然 rc=0 全绿(它只测函数,测不到主流程的接线),
 *   只有本文件 T2 这类"起脚本看真实判据面"的用例会翻红。
 *   ⇒ T4/T5 是本轮补上的那道缺失防线:源码级钉住接线形态。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLI = join(ROOT, 'scripts', 'check-typecheck.mjs')
const SRC = readFileSync(CLI, 'utf8')

/** 起一次 --dry-run(不跑 typecheck),PUSH_SCOPE_FILES 显式给定 ⇒ 绕开他人暂存面干扰。 */
function dryRun(scopeFiles) {
  const r = spawnSync(process.execPath, [CLI, '--dry-run'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300000,
    windowsHide: true,
    // 必须显式 stdio:win32 上默认的 'pipe' 会让 spawnSync 报 EBUSY(errno -4082)——
    // 那是"子进程 stdin 管道被占"的环境故障,不是本门判据红。第一版没写这一行,
    // 三个 spawn 用例全挂在 status=null 上,而那与判据无关。已在仓内
    // skills/ihui-spawn-ebusy-fix 记过同一根因。
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PUSH_SCOPE_FILES: scopeFiles.join('\n') },
  })
  assert.equal(r.status, 0, `--dry-run 退出码非 0:\n${r.stdout}\n${r.stderr}`)
  return r.stdout
}

/** 取"判据文件数: N"那一行。判据面的权威读数就是它,不是文件清单(清单有 50 条截断)。 */
function scopeCount(out) {
  const m = out.match(/判据文件数: (\d+)/)
  assert.ok(m, `输出里没有"判据文件数"行:\n${out}`)
  return Number(m[1])
}

// 被下游 import 的真实文件(真仓 HEAD 面反向边 4 条 ⇒ 闭包 9)。
const IMPORTED = 'apps/api/src/plugins/csrf.ts'
// 真仓里**无**任何反向边的文件(实测反向边 0 条 ⇒ 闭包 1,用于反例)。
const NO_DOWNSTREAM = 'apps/web/src/lib/py-line-count.ts'

test('T1 正例:改一个被下游 import 的文件 ⇒ scope 必须含那个下游(不止 1 个文件)', () => {
  const out = dryRun([IMPORTED])
  assert.match(out, /反向依赖加宽\(G-406 ②\): 已加宽/, `真仓有下游却未加宽:\n${out}`)
  const n = scopeCount(out)
  assert.ok(n > 1, `加宽后判据文件数应 > 1(实测 ${n})—— 改契约仍未把 importer 纳入,病根未闭合`)
  // 逐个点名:闭包必须真的含那两个真实下游,而不是"数量变多"而已。
  for (const dep of ['apps/api/src/index.ts', 'apps/api/src/server.ts']) {
    assert.ok(out.includes(dep), `scope 应含下游 ${dep}:\n${out}`)
  }
})

test('T2 反例①:改一个无下游的文件 ⇒ scope 逐字不变,不得夹带任何多余项', () => {
  const out = dryRun([NO_DOWNSTREAM])
  assert.match(out, /反向依赖加宽\(G-406 ②\): 未加宽/, `无下游却加宽了(会把全仓塞进判据):\n${out}`)
  assert.equal(scopeCount(out), 1, `无下游时判据文件数必须仍为 1(实测 ${scopeCount(out)})`)
  // 这是"不许把 scope 无条件扩大成全仓"那条的钉子:全仓 8956 顶点,1 才是对的。
  assert.ok(!/apps\/web\/src\/components\//.test(out), `无下游时不得夹带别的文件:\n${out}`)
})

test('T3 反例②:非图顶点的改动(如 .sql)⇒ 行为与"闭包为空"逐字一致,不崩不静默扩大', () => {
  const out = dryRun(['packages/database/drizzle/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql'])
  assert.match(out, /反向依赖加宽\(G-406 ②\): 未加宽/, `.sql 不在 import 图内,应走"闭包为空"分支:\n${out}`)
  assert.equal(scopeCount(out), 1, '非顶点改动的判据面应逐字不变')
  assert.match(out, /改动集无源码扩展名\(\.ts\/\.tsx\/\.js\/\.mjs 等\),import 图闭包必然为空,跳过建图/, '必须给出"非源码扩展名早退"的可读理由')
})

test('T4 接线形态:主流程必须真的调 widen(变异掉这一步时本用例是防线)', () => {
  // 变异实测:把这一行换成常量对象后 --self-test 仍全绿 ⇒ 只有本层能拦住。
  assert.match(
    SRC,
    /const _widen = widenScopeOverDependents\(scopeFilesRaw\)/,
    '主流程未调用 widenScopeOverDependents —— 加宽被摘掉,self-test 测不到(实测仍全绿)',
  )
  assert.match(
    SRC,
    /import \{ buildFileGraph, widenFilesOverDependents \} from '\.\/lib\/import-graph\.mjs'/,
    '未从 import-graph.mjs 引入闭包能力 —— 边解析必须只有那一份实现,不许本地重造',
  )
})

test('T5 边界1:加宽只喂降级判据,定向快通道仍只看原始改动清单', () => {
  // 理由写在源文件边界 1:闭包一跨端就把快通道关掉,单文件 push 从定向几分钟
  // 变成全量 25 分钟 —— 那是拿另一类恒红换本票的绿。两处调用点都必须是 raw。
  // 注意只数**调用点**:`function resolveFastScopeApp(files)` 那行是定义,形参名恒为
  // files,第一版用 /resolveFastScopeApp\((\w+)\)/ 把它连同上面注释里的散文一起数进来
  // (实测 3 处)⇒ 这条断言自己先红。改成"行内出现调用、且该行不是函数定义"的逐行取法。
  const callLines = SRC.split(/\r?\n/).filter(
    (l) => /resolveFastScopeApp\(/.test(l) && !/^\s*function\b/.test(l),
  )
  assert.equal(callLines.length, 2, `预期两处快通道调用点,实测 ${callLines.length}`)
  for (const line of callLines) {
    const arg = line.match(/resolveFastScopeApp\((\w+)\)/)[1]
    assert.equal(
      arg,
      'scopeFilesRaw',
      `快通道必须用 scopeFilesRaw,实测用了 ${arg}(会把快通道关掉): ${line.trim()}`,
    )
  }
  // 反向对照:判据侧确实用的是加宽后的 scopeFiles(否则本票等于没接)。
  assert.match(
    SRC,
    /const scopeFiles = _widen\.files/,
    '降级判据必须用加宽后的 scopeFiles,否则加宽不生效',
  )
})

test('T6 建图失败不得静默:必须退回未加宽 scope 并留下可见理由', () => {
  // 这一格是"判据增强失败"与"类型结论失败"的边界:前者退回改前行为并出声,
  // 后者才按失败处理(§22b)。不许把前者升级成硬拦,也不许静默关掉判据。
  assert.match(SRC, /建图失败/, '源码应保留"建图失败"这一可见告警分支')
  assert.match(
    SRC,
    /退回未加宽 scope\(=改前逐字行为\)/,
    '建图失败必须明写"退回未加宽 scope",让人看得见判据被跳过',
  )
})

// ─── 2026-11-06:定向快通道绕开"陈旧 dist 前置" ⇒ 拿着旧 .d.ts 判干净 HEAD 文件 ──────
// 病形(实测):api-client 的三值 budget 类型随 11945bd4f5 入库后,工作树的 packages/*/dist
// 仍停在二值态。全量通道有 staleDistPreflight 会先重建;快通道直接 spawn app 自己的 tsc,
// 于是 ChatScreen / budget-note / chat-ledger / sse-parse 共 17 处报错全落在**干净的 HEAD 文件**上,
// 归因判成"已入库红",推送被拦死(快通道 exit 1)。下面两是"接线形态"的钉子:
// 变异实测 —— 摘掉快通道这段前置后,T1~T6 仍全绿(它们只看 scope 加宽),只有 T7 会红。

test('T7 接线形态:快通道必须先跑 typecheck-full --preflight-only,再 spawn app 自己的 typecheck', () => {
  assert.match(
    SRC,
    /resolve\(__dirname, 'typecheck-full\.mjs'\), '--preflight-only'/,
    '快通道未复用全量通道的陈旧 dist 前置实现 —— 必须是同一份,不许在本文件重造第二套判据',
  )
  const iPreflight = SRC.indexOf("'--preflight-only'")
  // 与 T3 同坑:spawn 形态在文件头注里也出现过,基准必须落在真跑它的那次调用。
  const iFastTsc = SRC.indexOf("spawnSync('pnpm', ['--filter', String(_fast.name), 'run', 'typecheck']")
  assert.ok(iPreflight > 0, '快通道的陈旧 dist 前置被摘线 ⇒ 回到"拿旧产物下结论"的原病')
  assert.ok(iFastTsc > 0, '找不到快通道的真 typecheck spawn(主流程被改写 ⇒ 本锁须同步)')
  assert.ok(iPreflight < iFastTsc, '前置必须早于快通道 tsc,否则等于没接')
  // 反面对照:前置失败不得静默继续拿旧产物下结论,也不得沿用 build 的退出码冒充"类型红"。
  // 判据(2026-11-06 裁决):只建产物不判类型 ⇒ 建不出来 = 输入面取不到 = `未判定 exit 2`。
  //   不许 exit 0(拿旧 .d.ts 下结论);不许 exit 1(上层读成"已入库红",把 build 失败归错因)。
  assert.match(
    SRC,
    /未判定\(exit 2\):陈旧 dist 前置重建失败[\s\S]{0,200}process\.exit\(2\)/,
    '前置重建失败必须归"未判定 exit 2",不得降级放行(exit 0)、也不得沿用 build 的 1(=冒充类型红)',
  )
})

test('T8 快通道前置必须放在定向前(而不是被 --dry-run 或降级分支吃掉)', () => {
  // --dry-run 只打判据面、不跑类型检查 ⇒ 前置也不该在 dry-run 里起 build(否则 scout 会改写本机 dist)。
  const iDryRunExit = SRC.indexOf('--dry-run')
  assert.ok(iDryRunExit > 0, '找不到 --dry-run 分支(结构变了 ⇒ 本锁须同步)')
  const iPreflight = SRC.indexOf("'--preflight-only'")
  assert.ok(iPreflight > iDryRunExit, '--dry-run 必须先短路,前置不得在只读勘察路径上起 build')
})


// ─── 无 TS 输入面档(2026-11-07 立)────────────────────────────────────
// 背景:全量门在本机已跑不进单门 300s 看门狗(实测单 apps/api 冷跑 >8m54s、apps/web 5m14s,
// 且每趟进门前被清光 .tsbuildinfo)⇒ 任何推送都在拿到结论前被杀。这道档让「改动与 TS 无关」
// 的提交拿到可自证的结论。下面三枚锁分别钉:判据本体、行为双向、出口顺序。
test('T9 无 TS 输入面档必须存在,且扩展名清单逐字在册(变异掉 .ts 必红)', () => {
  assert.match(
    SRC,
    /const TS_INPUT_EXT_RE = \/\\\.\(ts\|tsx\|mts\|cts\)\$\/i/,
    '判据的扩展名清单被改写 —— .ts 少一个字母,含 .ts 的改动就会被误判成"与 TS 无关"(假绿方向)',
  )
  assert.match(
    SRC,
    /const TS_INPUT_BASENAMES = new Set\(\['package\.json', 'pnpm-lock\.yaml', 'pnpm-workspace\.yaml'\]\)/,
    'workspace 拓扑(package.json / lockfile / pnpm-workspace)必须算 TS 输入面:改它们会改变 program 的组成',
  )
  assert.match(SRC, /function resolveNoTsInputFace\(files\)/, '判据函数缺失')
  // allowJs 前提必须**每次现扫**,不许写成常量快照 —— 快照会漂移,而漂移是安静的。
  assert.match(
    SRC,
    /allowJs\\s\*:\\s\*true/,
    'allowJs 前提守卫被摘掉 ⇒ .js/.mjs 是否进 program 这件事无人再验',
  )
  assert.match(SRC, /function listTsconfigPaths\(\)/, 'tsconfig 枚举必须走实扫(取不到要回落全量)')
})

test('T10 行为双向:纯非 TS 面 ⇒ 走本档;含任一 .ts ⇒ 必须回落原路径', () => {
  const pure = dryRun(['scripts/git-guardian.mjs', 'docs/readme-note.md'])
  assert.match(
    pure,
    /将运行路线: 无 TS 输入面档/,
    `纯 .mjs/.md 面应走无 TS 输入面档,实得:\n${pure}`,
  )
  const withTs = dryRun(['scripts/git-guardian.mjs', 'apps/api/src/plugins/csrf.ts'])
  assert.doesNotMatch(
    withTs,
    /将运行路线: 无 TS 输入面档/,
    `只要清单里有一个 .ts 就必须回落原路径(宁慢勿漏),实得:\n${withTs}`,
  )
  // 第三条:package.json 属于拓扑面,即使全无 .ts 也不得走本档。
  const withPkg = dryRun(['scripts/git-guardian.mjs', 'packages/shared/package.json'])
  assert.doesNotMatch(
    withPkg,
    /将运行路线: 无 TS 输入面档/,
    `改 package.json 会改变 exports/types 与 workspace 拓扑 ⇒ 必须回落,实得:\n${withPkg}`,
  )
})

test('T11 出口顺序与措辞:必须在快通道之前,且不得自称 skip', () => {
  const iExit = SRC.indexOf('if (_noTsInput) {')
  const iFastCall = SRC.indexOf('const _fast = scopeEnabled ? resolveFastScopeApp(scopeFilesRaw) : null')
  assert.ok(iExit > 0 && iFastCall > 0, '结构变了(找不到出口或快通道调用),本锁须同步')
  assert.ok(
    iExit < iFastCall,
    '无 TS 输入面档的出口必须早于快通道:快通道对"一个 TS 文件都没碰"的面同样是白跑整 app 全量',
  )
  // 措辞锁:exit 0 不得写成"跳过"(那条路已被"无文件面档"占用,含义是"无对象可查")——
  // 本档的正当性来自"tsc 输入集合未变"这个可自证命题。写成跳过,读日志的人会以为这是绕门口子。
  // 注意不能断言整段无 skip 字样:本档的固定措辞就是"这不是 skip",那句是澄清而非自称。
  const seg = SRC.slice(iExit, iExit + 1600)
  assert.doesNotMatch(seg, /跳过/, '出口文案里出现了"跳过" —— 这是射程之外的通过,不是跳门')
  assert.match(seg, /这不是 skip/, '必须显式说明"这不是 skip"及其证明(否则下一个人仍会当成口子)')
})

// ─── 2026-11-12:共享 tsconfig 基座漏判(实测假绿)─────────────────────────────
// 病形:resolveNoTsInputFace 只按 basename /^tsconfig.*\.json$/ 认 TS 输入,
// packages/tsconfig/base.json 的 basename 是 base.json ⇒ 改它被判「无 TS 输入面」秒过。
// 实测该基座经 extends 影响 packages/sdk 的 program(tsc --showConfig 的 exclude 被继承),
// 不是理论口子。判据改走 listTsconfigPaths() 的实扫集合,下面钉行为与接线。
test('T12 共享 tsconfig 基座(packages/tsconfig/*.json)必须算 TS 输入面,不得秒过', () => {
  for (const p of [
    'packages/tsconfig/base.json',
    'packages/tsconfig/node.json',
    'packages/tsconfig/nextjs.json',
  ]) {
    const out = dryRun([p])
    assert.doesNotMatch(
      out,
      /将运行路线: 无 TS 输入面档/,
      `改共享基座 ${p} 会改变 tsc program 组成,必须回落原路径,实得:${out}`,
    )
  }
  // 反面对照:同目录的非 tsconfig 文件不得被「目录前缀」误伤,本档射程不变。
  const doc = dryRun(['docs/PACKAGES.md'])
  assert.match(doc, /将运行路线: 无 TS 输入面档/, `纯文档面应仍走本档,实得:${doc}`)
  // 接线钉:判据必须真的查实扫集合,而不是换个 basename 正则继续漏。
  assert.ok(
    SRC.includes('cfgSet.has(f)'),
    '未把 tsconfig 实扫集合接进 TS 输入判据 ⇒ 基座改动仍会被误判',
  )
  assert.ok(
    SRC.includes('new Set(cfgs.map('),
    '实扫清单未去重成集合 ⇒ 判据形态被改写,本锁须同步',
  )
})
