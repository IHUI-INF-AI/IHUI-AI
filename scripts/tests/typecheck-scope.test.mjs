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
  assert.match(out, /闭包为空\(本次改动无人 import\),scope 逐字不变/, '必须给出"闭包为空"的可读理由')
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
    /import \{ buildFileGraph, widenOverDependents \} from '\.\/lib\/import-graph\.mjs'/,
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
    /退回未加宽 scope\(=改前行为\)/,
    '建图失败必须明写"退回未加宽 scope",让人看得见判据被跳过',
  )
})
