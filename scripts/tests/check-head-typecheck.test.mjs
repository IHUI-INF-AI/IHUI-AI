// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:scripts/check-head-typecheck.mjs
// 纪律:归因判据一律走 `check-ops-patrol.mjs` 的那一份生产实现,本文件**不重写三态规则**(§22c 红线)。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { attribBuildFailures } from '../check-ops-patrol.mjs'
import { __test__ as gate } from '../check-head-typecheck.mjs'

const GATE_REL = 'scripts/check-head-typecheck.mjs'

function headFile(rel) {
  try {
    return gitRaw(['show', `HEAD:${rel}`], process.cwd()).toString()
  } catch {
    return null
  }
}

/**
 * 两条取材口径分开,不许混:
 *  - **仓库状态**(有没有被注册进提交链)只能按 HEAD 读 —— 磁盘那份常年滞后,按磁盘读会把刚经对象
 *    空间落地的注册判成"未装"(守门 157 同一课)。
 *  - **源码写法锁**(守卫形状 / 派生参数 / 有没有第二份判据)只能读工作树 —— 本镜像与门体同枚提交,
 *    读 HEAD 会让它在落地前恒红、落地后红在上一版上(§22c 那条"镜像必须能自证有牙"同理)。
 */
const gateSource = () => readFileSync(join(process.cwd(), GATE_REL), 'utf8')

function makeRepo(relPath, committedContent, worktreeContent = null) {
  const scratch = mkScratch('head-tc-')
  const root = join(scratch, 'repo')
  const file = join(root, relPath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, committedContent, 'utf8')
  gitRaw(['init', '-q'], root)
  gitRaw(['add', '--', relPath], root)
  gitRaw(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture'], root)
  if (worktreeContent !== null) writeFileSync(file, worktreeContent, 'utf8')
  return { scratch, root }
}

const ERR_LINE = "src/a.ts(1,7): error TS2304: Cannot find name 'missingSymbol'"

function judge(root, rel, stdout) {
  const deps = gate.makeHeadFaceDeps({ root })
  return gate.judgeOneEnd({ rel, run: { stdout, stderr: '', status: 2, ms: 1 }, attribution: (text) => attribBuildFailures(text, deps), deps })
}

test('T1 装载方向锁:注册与否按 HEAD 读;未注册 ⇒ 门体头注必须自称未接线', () => {
  const runner = headFile('scripts/guardian-runner.mjs') || ''
  const src = gateSource()
  const registered = runner.includes('check-head-typecheck.mjs')
  if (!registered) {
    assert.ok(/刻意不在提交链/.test(src), '未注册而头注没声明"刻意不在提交链" ⇒ 守门 89 的 R2 会对每次提交恒红(§12e)')
    assert.ok(!/已接进 ?(pre-commit|提交链)/.test(src), '未注册却自称已接线 = 文档撒谎')
  } else {
    const at = runner.indexOf('check-head-typecheck.mjs')
    const entry = runner.slice(Math.max(0, at - 500), at + 500)
    assert.ok(/mode:\s*'(warn|blocking)'/.test(entry), '已注册但条目缺 mode ⇒ 定级不明确')
    assert.ok(/HUSKY_SKIP_HEAD_TYPECHECK/.test(entry), '已注册但条目缺 skipEnv ⇒ 应急出路是假的(守门 46/11c/50 那一课)')
  }
  return true
})

test('T2 归因判据唯一实现:门体必须 import 那一份,且不得自己再定义/再建桶', () => {
  const src = gateSource()
  assert.ok(/import\s*\{\s*attribBuildFailures\s*\}\s*from\s*'\.\/check-ops-patrol\.mjs'/.test(src), '没引那一份归因判据 ⇒ 存在第二份真相风险')
  assert.ok(!/function\s+attribBuildFailures/.test(src), '门体内不得再定义 attribBuildFailures')
  assert.ok(!/buckets/.test(src), '门体内不得自建三态桶(那是第二份判据)')
  return true
})

test('T3 临时 git 仓三臂:干净⇒landed / 脏而 HEAD 无该标识符⇒in-flight / HEAD 没这文件⇒未判定', () => {
  const a = makeRepo('packages/x/src/a.ts', 'const bad = missingSymbol\n')
  const b = makeRepo('packages/y/src/a.ts', 'const bad = otherThing\n', 'const bad = missingSymbol\n')
  const c = makeRepo('packages/z/src/keep.ts', 'export const k = 1\n')
  try {
    assert.equal(judge(a.root, 'packages/x', ERR_LINE).state, 'landed', '文件与 HEAD 无差 ⇒ 必须判已入库红(阳性对照:这一臂不红就说明判据没牙)')
    assert.equal(judge(b.root, 'packages/y', ERR_LINE).state, 'in-flight', 'HEAD 同行找不到标识符且文件脏 ⇒ 不得冒充已入库的红')
    assert.equal(judge(c.root, 'packages/z', "src/new.ts(1,7): error TS2304: Cannot find name 'missingSymbol'").state, 'undetermined', 'HEAD 里没有的文件不许读成"对已入库代码的红"')
  } finally {
    for (const r of [a, b, c]) rmScratch(r.scratch)
  }
  return true
})

test('T4 装配阳性对照:真仓 HEAD 里存在的文件必须读得到(照 check-ops-patrol 的失明型缺陷)', () => {
  const deps = gate.makeHeadFaceDeps({})
  assert.equal(deps.readHeadLine('package.json', 1), '{', '取不到真存在的文件 ⇒ 尺子失明,整面结论不得发合格证')
  assert.equal(deps.readHeadLine('package.json/nope__definitely_absent__.ts', 1), null, '取不到必须给 null,不许"大概就是它"')
  const n = deps.countDirty()
  assert.ok(n === -1 || n >= 0, 'countDirty 只能是在飞数或 -1(问不到),不许把问不到折成 0')
  return true
})

test('T5 有端没跑 ⇒ 不得宣布"净";一把都没跑 ⇒ rc=2', () => {
  const s = gate.summarize([{ end: 'apps/a', state: 'ok', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1, skipped: [{ end: 'apps/b', why: '超总预算' }] })
  assert.ok(!/\| 判定=净 \|/.test(s.line), '把"没跑到"写成"全仓干净"是本仓最高频失效型')
  assert.ok(s.warn.includes('apps/b'), '未跑到的端必须点名')
  assert.equal(gate.summarize([], { budgetMs: 1, spentMs: 0, skipped: [{ end: 'x', why: '缺 tsc' }] }).rc, 2)
  return true
})

test('T6 §22d 入口守卫形状锁 + 异步 main + __test__ 在守卫之后', () => {
  const src = gateSource()
  assert.ok(/const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/.test(src), '缺 §22d 守卫(或裸拼 file://,Windows 永不匹配 ⇒ CLI 永不触发 main)')
  assert.ok(src.indexOf('if (isDirectRun)') < src.indexOf('export const __test__'), '__test__ 导出必须在守卫之后(§22d)')
  assert.ok(/async function main\(\)/.test(src), 'main() 必须是 async —— 同步 main 不能被 .catch 兜(§22d 红线)')
  assert.ok(src.includes("import { fileURLToPath, pathToFileURL } from 'node:url'"), '两个 URL 工具都要显式 import')
  return true
})

test('T7 派生形状锁:windowsHide + 显式 stdio + 不经 shell + 数字 timeout', () => {
  const src = gateSource()
  const at = src.indexOf('spawn(process.execPath')
  assert.ok(at > -1, '找不到 tsc 派生调用 ⇒ 本锁无从可查(锁本身失效也要红)')
  const call = src.slice(at, at + 800)
  assert.ok(call.includes('windowsHide: true'), '缺 windowsHide ⇒ 用户桌面反复弹窗(§5b)')
  assert.ok(call.includes("stdio: ['ignore', 'pipe', 'pipe']"), '缺显式 stdio ⇒ 本机 spawnSync EBUSY(§12g)')
  assert.ok(!/shell:\s*true/.test(call), '不得经 cmd.exe 派生(§12g:100% EBUSY)')
  assert.ok(/timeout:\s*timeoutMs/.test(call), '必须有数字 timeout(守门 80 那一型:无界挂起)')
  return true
})

test('T8 rebase 走真判据:非 web 端的相对路径必须按仓内路径归因,且 rebase 幂等', () => {
  const r = makeRepo('apps/other/src/a.ts', 'const bad = missingSymbol\n')
  try {
    const deps = gate.makeHeadFaceDeps({ root: r.root })
    const rebased = gate.rebaseErrorPaths(ERR_LINE, 'apps/other')
    assert.ok(rebased.startsWith('apps/other/src/a.ts(1,7)'), '没补仓内前缀 ⇒ 会被判据的 src/→apps/web 映射带去比错文件(2026-10-11 实测:mobile-rn 的报错被比到 apps/web/src/screens/…)')
    const verdict = attribBuildFailures(rebased, deps)
    assert.ok(!verdict.includes('apps/web'), '不该出现 web 前缀映射 —— 那正是本工具修掉的误归因')
    assert.equal(gate.parseAttribution(verdict), 'landed', verdict)
    assert.equal(gate.rebaseErrorPaths(rebased, 'apps/other'), rebased, 'rebase 必须幂等(重复跑不产生双层前缀)')
  } finally {
    rmScratch(r.scratch)
  }
  return true
})

test('T9 镜像不得把状态结论手抄成字面量(判据必须真被调用)', () => {
  const own = readFileSync(new URL(import.meta.url), 'utf8')
  assert.ok(!/=\s*['"](?:landed|in-flight|undetermined)['"]/.test(own), '测试里手造状态结论 ⇒ 断言退化成复读机(§22c)')
  assert.ok(own.includes('attribBuildFailures('), '必须调生产归因入口')
  return true
})

test('T10 脏树告示必须有牙:landed + 在飞改动 ⇒ 挂"候选",净面不挂(常亮的告示等于没有)', () => {
  const dirty = gate.summarize([{ end: 'a', state: 'landed', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1, dirtyCount: 70 })
  assert.ok(dirty.caveat.includes('候选') && dirty.line.includes('在飞改动 70'), '报错文件干净不代表它依赖的文件干净 —— 实测误报型必须被这句拦住')
  const clean = gate.summarize([{ end: 'a', state: 'landed', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1, dirtyCount: 0 })
  assert.equal(clean.caveat, '')
  assert.equal(clean.rc, 1)
  assert.equal(gate.summarize([{ end: 'a', state: 'landed', detail: '', ms: 1 }], { budgetMs: 1, spentMs: 1, dirtyCount: 5, requireClean: true }).rc, 2, '--require-clean 且树脏 ⇒ 不许把候选当结论交出去')
  return true
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
