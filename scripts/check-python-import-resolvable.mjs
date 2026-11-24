#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 手动问责工具:ai-service 的**本地 import 必须在被审面解析得到**(票 D174/R3 期间实测到的那一型)。
//
// 现场:HEAD 里 `app/services/mcp_server.py` 有 `from app.core.internal_ticket import ...`,
// 而 `app/core/internal_ticket.py` 只存在于另一路会话的**未跟踪工作树文件**里。
// 后果两笔:① mypy 把该模块当缺失依赖 ⇒ 报 `no-any-return`(这次是靠它被撞出来的);
// ② 运行时走到那条 edu 工具路径就 ImportError —— 而 typecheck/纯函数用例/大部分守门全绿,
//    因为它们跑在**同一份被污染的工作树**上(那个文件在盘上就"能跑")。
// 这与守门 98(TS 悬空具名导入)/149(barrel 漏导出)是同族,只是 Python 侧此前无人看守。
//
// 用法:
//   node scripts/check-python-import-resolvable.mjs            # 判 HEAD 面(默认)
//   node scripts/check-python-import-resolvable.mjs --staged   # 判索引面
//   node scripts/check-python-import-resolvable.mjs --strict   # 有未判定即 exit 2(拒绝出合格证)
//   node scripts/check-python-import-resolvable.mjs --self-test
//
// 定级:warn + 手动问责,**刻意不接提交链** —— 接进去之前必须先把现读存量清零,
// 否则就是一台与任何提交都无关的恒红门,唯一结局是各会话 `--no-verify`、连带全部守门作废(AGENTS §12f)。
// 接线前置与取号规矩同 `scripts/audit-benchmark-delivery.mjs`(见台账 G-816103)。
//
// 2026-10-06(G-998191)git 出口收口:本门唯一的 git 派生 —— `listFacePy()` 里那两处
// (`ls-files --cached` / `ls-tree -r --name-only`)—— 由本地 `git()` 包装的
// `execFileSync('git', …)` 裸调用,迁到取材层 `scripts/lib/face-reader.mjs` 的 `gitRaw`
// (仓内逐文件迁移的存量债,判据在 `scripts/tests/face-reader.test.mjs` 的
// `BARE_GIT_BASELINE`,只减不增)。收益不止"统一"本身:裸调用依赖 PATH、且每处都要各自
// 记得写全 stdio/timeout/maxBuffer 三项。逐条行为面对照见 `listFacePy()` 的头注
// (其中 **quotepath 一项是纠偏**,不是等价替换 —— 且它纠的是一条会**静默漏判**的哑尺子风险)。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = 'apps/ai-service'
// 只判**仓内自有包**的 import(第三方库不在射程:`from fastapi import` 之类永远判不出)
const LOCAL_PREFIXES = ['app.', 'scripts.']

// 本门的两处清单派生:timeout 与旧实现同为 180s(与下面 `catBatch` 的 240s 一起构成
// 取材面的两档预算;旧 `git()` 的 `GIT_TIMEOUT` 即 180000,逐字沿用而非改小)。
const GIT_TIMEOUT = 180000

/** 清单与内容同面同轮:先取被审面的 .py 清单,再一次性 cat-file --batch 读正文。
 *
 *  2026-10-06(G-998191)两处 git 派生迁到取材层 `gitRaw`,行为面逐条对照(不靠记忆,逐项核过):
 *   · **stdio**:旧 `git()` 自己写死 `['ignore','pipe','pipe']`,注释记着它的成因 ——
 *     本机交互会话里 Node 建子进程 stdin 管道确定性失败(EBUSY / errno -4082),而本门
 *     这两处(`ls-files` / `ls-tree`)不吃 stdin。`gitRaw` 把这一档**写死**在层里
 *     (face-reader.mjs:94,不带 input 即 'ignore'),不再由每个调用方各自记得传。
 *     ⚠️ 但**另一条通道相反**:`run()` 里 `catBatch(ROOT, specs, …)` 用 `input` 喂清单,
 *     必须 `stdio[0]='pipe'` —— 设成 'ignore' 时清单被 git 静默丢弃且**不报错**,
 *     只是"每个对象都取不到"。两态都由层按 `opts.input` 自动分派,本文件两头都不必再手写。
 *   · **绝对路径 git**:`gitRaw` 走层内 `resolveGitBin()`;旧裸调用写死 'git' 依赖 PATH,
 *     而本机 IDE/会话环境里 PATH 上的 git 未必是仓里那一份(见本文件 `qtdemo` 实测:
 *     不带 stdio 兜底的裸 execFileSync 当场 EBUSY)。
 *   · **safe.directory**:层统一 `-c safe.directory=*`,与旧裸调用一致,无行为差。
 *   · **windowsHide / timeout / maxBuffer**:层全给足(windowsHide=true;timeout 本处显式
 *     180000 沿用旧值,不落层默认 60s;maxBuffer 层默认 64MB)。maxBuffer 这一项**不是等价替换,
 *     是收窄**:旧 `git()` 给的是 `1<<28`(256MB)。实测本门两处输出的真实量级 ——
 *     `ls-tree -r --name-only -- apps/ai-service/` = 80052 字节、全仓 `ls-files --cached`
 *     = 711026 字节 ⇒ 对 64MB 有 94x 余量,且这两条命令输出的是**路径清单**而非文件正文
 *     (正文走下面的 `catBatch`,那里另行给了 `1<<28`)。故 64MB 够用且不构成行为漂移。
 *   · **quotepath —— 这一项是纠偏,且纠的是一条会静默漏判的哑尺子风险**(实测,非推断):
 *     层强制 `core.quotepath=false`,而旧裸调用吃 git 默认的 quotepath=**true**,
 *     后者把非 ASCII 路径转义成八进制并**加双引号**。本门对清单做的第一道过滤是
 *     `.endsWith('.py')`,而转义后的行以 `.py"` 结尾 ⇒ **带中文/重音目录的 .py 文件
 *     在旧形态下会被这道过滤整条丢掉**,不进 `tracked`、也不进 `trackedDirs`。
 *     方向是"少一条漏判"(真模块存在却读成不存在 ⇒ 假红;反之该文件里的 import 无人审判)。
 *     当前被审面上 17 条非 ASCII 路径**全是 .md/.png/.txt/.json,`.py` 结尾 0 条**,
 *     所以本门现读结论不受影响 —— 这是"此刻无暴露",不是"此处无纠偏面"。
 *     同样的机制在 `ls-files` 侧一字不差地复现(两取值实测不相等)。
 *   · **失败语义**:层失败抛 `Undetermined`(Error 子类),旧形态抛裸 Error。两者都被本文件
 *     最外层 `catch` 折成同一条「工具自身失败 ⇒ exit 2」,不把"取不到"折叠成"通过"。
 */
function listFacePy(face) {
  const out =
    face === 'staged'
      ? gitRaw(['ls-files', '--cached', `${PKG}/`], ROOT, { timeout: GIT_TIMEOUT })
      : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', `${PKG}/`], ROOT, {
          timeout: GIT_TIMEOUT,
        })
  return out
    .split('\n')
    .filter((l) => l.endsWith('.py'))
}

const IMPORT_RE = /^[ \t]*(?:from|import)[ \t]+([a-zA-Z_][\w.]*)[ \t]*(?:import|,|$)/gm

/** 把一个 `app.a.b` 形式的 import 映射成候选文件路径(模块 or 包 __init__)。 */
export function candidatesFor(modName) {
  const rel = modName.split('.').join('/')
  return [`${PKG}/${rel}.py`, `${PKG}/${rel}/__init__.py`]
}

export function collectLocalImports(src) {
  const out = new Set()
  for (const m of src.matchAll(IMPORT_RE)) {
    const name = m[1] ?? ''
    if (LOCAL_PREFIXES.some((p) => name === p.slice(0, -1) || name.startsWith(p))) out.add(name)
  }
  return [...out].sort()
}

/** 核心判据:返回 unresolvable(被审面既没有该模块文件、也没有那个目录)与 undetermined 两类。
 *
 * 两条收窄都是被实测逼出来的(第一版报了 6 处,其中 5 处是假阳):
 *  ① **目录存在即算解析成功**:`app/middleware` 这种命名空间包(没有 `__init__.py`)运行时合法,
 *     只按"文件在不在"判就会把它读成悬空 import;
 *  ② **测试面不在射程**:用例常故意 import 一个不存在的模块名去 monkeypatch 桩(`app.ghost`),
 *     那不是交付缺陷。本工具判的是"会上生产的那份代码有没有引用没入库的模块"。
 */
export function judgeImports({ fileContents, trackedSet, trackedDirs }) {
  const unresolvable = []
  const undetermined = []
  for (const [file, src] of fileContents) {
    if (src === null) {
      undetermined.push({ file, reason: '取不到内容' })
      continue
    }
    if (isTestPath(file)) continue
    for (const mod of collectLocalImports(src)) {
      const cands = candidatesFor(mod)
      const asFile = cands.some((c) => trackedSet.has(c))
      // 命名空间包 = **该模块自己的目录**存在(如 `app/middleware/`),不是它的父目录。
      // 上一版写成"父目录在 ⇒ 解析得到",结果连本次真正要抓的那一条(import 一个没入库的
      // 兄弟模块)都被判成通过 —— 判据放宽一格就把尺子弄哑,而哑尺子的绿灯与真绿灯长得一样。
      const rel = mod.split('.').join('/')
      const asNamespacePkg = trackedDirs.has(`${PKG}/${rel}/`)
      if (!asFile && !asNamespacePkg) unresolvable.push({ file, mod, candidates: [...cands, `${PKG}/${rel}/`] })
    }
  }
  return { unresolvable, undetermined }
}

/** 测试/夹具路径(不在本工具射程内,见上)。 */
export function isTestPath(p) {
  return /(^|\/)(tests|__tests__|e2e)(\/|$)/.test(p) || /\.(test|spec)\.[a-z]+$/.test(p)
}

export function run({ staged = false, strict = false } = {}) {
  const picked = selectFace({ staged, worktree: argvWorktree(), def: 'head' })
  if (picked.error) {
    console.error('❌ ' + picked.error)
    return 2
  }
  const face = picked.face
  const tracked = new Set(listFacePy(face))
  const files = [...tracked].filter((x) => x.startsWith(PKG + '/'))
  if (files.length === 0) {
    console.error('❌ 被审面上一个 .py 都没取到 ⇒ 尺子空转,不得读成通过')
    return 2
  }
  const specs = files.map((x) => (face === 'staged' ? ':' + x : 'HEAD:' + x))
  let bodies
  try {
    bodies = catBatch(ROOT, specs, { maxBuffer: 1 << 28, timeout: 240000 })
  } catch (e) {
    console.error('❌ 取材失败(' + face + '):' + (e && e.message ? e.message : String(e)) + ' ⇒ 无法判定')
    return 2
  }
  const fileContents = new Map(files.map((x, i) => [x, bodies.get(specs[i]) ?? null]))
  // 目录集合:命名空间包(无 __init__.py)也算解析得到
  const trackedDirs = new Set()
  for (const p of tracked) {
    let i = p.lastIndexOf('/')
    while (i > 0) {
      trackedDirs.add(p.slice(0, i + 1))
      i = p.lastIndexOf('/', i - 1)
    }
  }
  const { unresolvable, undetermined } = judgeImports({ fileContents, trackedSet: tracked, trackedDirs })
  console.log('[py-import] 面=' + face + ' 判了 ' + files.length + ' 个文件')
  for (const u of unresolvable)
    console.log(`  ❌ ${u.file}: import '${u.mod}' 在被审面无对应文件(候选:${u.candidates.join(' / ')})`)
  for (const u of undetermined) console.log('  ❔ ' + u.file + ':' + u.reason + '(不记为通过)')
  if (unresolvable.length === 0 && undetermined.length === 0) {
    console.log('✅ 本地 import 全部在被审面解析得到')
    return 0
  }
  if (unresolvable.length > 0) console.log('判定:' + unresolvable.length + ' 处解析不到 —— 典型成因是"调用方落地了、被 import 的模块还在别人工作树里未跟踪"')
  return strict && undetermined.length > 0 ? 2 : 1
}

function argvWorktree() {
  return false
}

function selfTest() {
  const pass = []
  const fail = []
  const t = (n, c) => (c ? pass : fail).push(n)
  t('① 只认包内前缀', collectLocalImports("from app.core.x import y\nfrom fastapi import FastAPI\nimport os").join('|') === 'app.core.x')
  t('② 模块与包两种落点都算解析成功', candidatesFor('app.core.x').join('|') === 'apps/ai-service/app/core/x.py|apps/ai-service/app/core/x/__init__.py')
  const tracked = new Set([
    'apps/ai-service/app/services/a.py',
    'apps/ai-service/app/core/ok.py',
    'apps/ai-service/app/middleware/trace_context.py',
  ])
  const trackedDirs = new Set([
    'apps/ai-service/app/',
    'apps/ai-service/app/services/',
    'apps/ai-service/app/core/',
    'apps/ai-service/app/middleware/',
  ])
  const judged = judgeImports({
    fileContents: new Map([
      ['apps/ai-service/app/services/a.py', "from app.core.ok import f\nfrom app.core.missing import g\nfrom app.middleware.trace_context import h\n"],
    ]),
    trackedSet: tracked,
    trackedDirs,
  })
  t('③ 悬空 import 被点名(存在的两个都不报)', judged.unresolvable.length === 1 && judged.unresolvable[0].mod === 'app.core.missing')
  t('④ 能解析的不报(含命名空间包目录形态)', !judged.unresolvable.some((u) => u.mod === 'app.core.ok' || u.mod === 'app.middleware'))
  t('⑤ 取不到内容 ⇒ 未判定(不并成"没问题")', judgeImports({ fileContents: new Map([['x.py', null]]), trackedSet: tracked, trackedDirs }).undetermined.length === 1)
  t('⑥ 测试/夹具面不在射程(用例故意 import 假模块不是交付缺陷)', judgeImports({
    fileContents: new Map([['apps/ai-service/tests/t_x.py', "import app.ghost\n"]]),
    trackedSet: tracked,
    trackedDirs,
  }).unresolvable.length === 0)
  console.log(`✅ ${pass.length} 条 / ❌ ${fail.length} 条`)
  for (const f of fail) console.log(`   ❌ ${f}`)
  return fail.length === 0 ? 0 : 1
}

export const __test__ = { collectLocalImports, candidatesFor, judgeImports, selfTest, LOCAL_PREFIXES, PKG }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  try {
    process.exit(argv.includes('--self-test') ? selfTest() : run({ staged: argv.includes('--staged'), strict: argv.includes('--strict') }))
  } catch (e) {
    console.error(`❌ 工具自身失败(不记为通过):${e?.message ?? e}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
