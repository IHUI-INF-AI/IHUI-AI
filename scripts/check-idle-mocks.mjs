#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 空转 mock 检查器(2026-11-07 立)。
 *
 * 判据:对每个 `vi.mock` / `jest.mock` / `vi.doMock` / `vi.doUnmock` 的模块 id,
 * 取被测对象的运行时 import 图(测试文件运行时 import 去掉 mock 自身与 test-support 目录后作种子 BFS;
 * 类型 import 边不计),若被 mock 的 id 不在图内 ⇒ 空转。
 *
 * 三分类(处置动作不同,不许合成一个数):
 *   1) inert       纯惰性:测试自己也不 import 该 id,且目标模块文件存在 ⇒ 删 mock 声明;
 *   2) driven      测试在用(import 了该 id / `vi.mocked(...)`)但 SUT 运行时不经过它
 *                   ⇒ 测试结构信号:在 mock 一个并不隔离的边界;
 *   3) deadAir     真空气断言:目标模块文件不存在,或 mock 的门面其实现体经另一入口进入 SUT 图
 *                   ⇒ 缺陷:改 mock 目标(不许两个都 mock)或删掉并补真判据。
 *
 * 口径边界:动态拼接 import、未覆盖别名可能漏判;`.js`→`.ts`、index、扩展名候选已覆盖。
 *
 * 用法:
 *   node scripts/check-idle-mocks.mjs                  # 全仓扫描 + 与基线比对(新增空转即红)
 *   node scripts/check-idle-mocks.mjs --staged         # 只查本次暂存的测试文件(门用,快)
 *   node scripts/check-idle-mocks.mjs --update-baseline # 重新生成基线(仅在全绿且人工确认后)
 *   node scripts/check-idle-mocks.mjs --json           # 机器可读输出
 *
 * 门 302(push 门)调用全量档;`--staged` 只判本批暂存测试文件,用于快速反馈。
 * 豁免规则:存量空转登记在 scripts/data/idle-mocks-baseline.json 的 waivers
 * (`<testFile>::<mockId>` → 允许出现次数)。新增(超出现有次数)即红;
 * 豁免清单只允许变短 —— 当前次数少于豁免次数时给 warning,提示删掉已失效条目。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const req = createRequire(path.join(root, 'package.json'))
const ts = req('typescript')

const BASELINE_PATH = path.join(here, 'data', 'idle-mocks-baseline.json')
const TEST_RE = /(\.test\.|\.spec\.)/
const codeExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

const args = new Set(process.argv.slice(2))
const stagedOnly = args.has('--staged')
const updateBaseline = args.has('--update-baseline')
const jsonOut = args.has('--json')

function gitList(argv) {
  return execFileSync('git', argv, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

const all = gitList(['ls-files'])
const codeFiles = all.filter(
  (f) =>
    codeExt.has(path.extname(f)) &&
    !f.endsWith('.d.ts') &&
    !f.includes('node_modules/') &&
    !f.includes('/dist/') &&
    !f.includes('/.next') &&
    !f.includes('/coverage/'),
)
const codeSet = new Set(codeFiles.map((f) => f.replace(/\\/g, '/')))

// ── AST:imports / mocks ────────────────────────────────────────────────────
const cache = new Map()
function parseFile(rel) {
  if (cache.has(rel)) return cache.get(rel)
  const abs = path.join(root, rel)
  let text
  try {
    text = fs.readFileSync(abs, 'utf8')
  } catch {
    cache.set(rel, { imports: [], mocks: [] })
    return cache.get(rel)
  }
  const kind =
    rel.endsWith('.tsx') ? ts.ScriptKind.TSX
    : rel.endsWith('.jsx') ? ts.ScriptKind.JSX
    : rel.endsWith('.js') || rel.endsWith('.mjs') || rel.endsWith('.cjs') ? ts.ScriptKind.JS
    : ts.ScriptKind.TS
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, kind)
  const imports = []
  const mocks = []
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

  const addImport = (specNode, typeOnly) => {
    if (!specNode || !ts.isStringLiteralLike(specNode)) return
    imports.push({ spec: specNode.text, typeOnly, line: lineOf(specNode) })
  }

  const walk = (node) => {
    if (ts.isImportDeclaration(node)) {
      addImport(node.moduleSpecifier, !!node.importClause?.isTypeOnly)
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      addImport(node.moduleSpecifier, !!node.isTypeOnly)
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addImport(node.arguments[0], false)
      } else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') {
        addImport(node.arguments[0], false)
      } else if (ts.isPropertyAccessExpression(node.expression)) {
        const obj = node.expression.expression
        const name = node.expression.name.text
        if (ts.isIdentifier(obj) && (obj.text === 'vi' || obj.text === 'jest')) {
          if (name === 'mock' || name === 'doMock' || name === 'unmock' || name === 'doUnmock') {
            const arg = node.arguments[0]
            if (arg && ts.isStringLiteralLike(arg)) {
              // factory 是否"接了外部 spy"(属性值是标识符或函数,而非内联 vi.fn()):
              // 这是"测试在驱动这个 mock"的机械信号,用于区分纯惰性与 mock 目标错。
              let wired = false
              const factory = node.arguments[1]
              if (factory && (ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))) {
                const body = factory.body
                if (ts.isObjectLiteralExpression(body)) {
                  for (const p of body.properties) {
                    if (!ts.isPropertyAssignment(p)) continue
                    const v = p.initializer
                    if (ts.isIdentifier(v) || ts.isArrowFunction(v) || ts.isFunctionExpression(v)) {
                      wired = true
                    }
                  }
                }
              }
              mocks.push({ id: arg.text, line: lineOf(arg), kind: `${obj.text}.${name}`, wired })
            }
          }
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(sf)
  const out = { imports, mocks }
  cache.set(rel, out)
  return out
}

// ── 模块解析 ───────────────────────────────────────────────────────────────
const extOrder = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
function tryFile(base) {
  const cleaned = base.replace(/\\/g, '/').replace(/^\.\//, '')
  const candidates = [cleaned]
  if (/\.(js|jsx|mjs|cjs)$/.test(cleaned)) candidates.push(cleaned.replace(/\.(js|jsx|mjs|cjs)$/, ''))
  for (const c of candidates) if (codeSet.has(c)) return c
  for (const c of candidates) for (const ext of extOrder) if (codeSet.has(c + ext)) return c + ext
  for (const c of candidates) for (const ext of extOrder) if (codeSet.has(c + '/index' + ext)) return c + '/index' + ext
  return null
}

const projectOf = (rel) => rel.split('/').slice(0, 2).join('/')

function resolveSpec(spec, fromRel) {
  const fromDir = path.posix.dirname(fromRel)
  if (spec.startsWith('.')) {
    const target = path.posix.normalize(path.posix.join(fromDir, spec))
    const hit = tryFile(target) || tryFile(target + '/index')
    return hit ? { kind: 'file', path: hit } : { kind: 'unresolved-local', spec }
  }
  if (spec.startsWith('@/') || spec.startsWith('~/')) {
    const hit = tryFile(path.posix.join(projectOf(fromRel), 'src', spec.slice(2)))
    return hit ? { kind: 'file', path: hit } : { kind: 'unresolved-local', spec }
  }
  if (spec.startsWith('@ihui/')) {
    const rest = spec.slice('@ihui/'.length)
    const [pkg, ...tail] = rest.split('/')
    const pkgDir = pkg === 'rn-app' ? 'app' : pkg
    const behind = tail.join('/')
    const hit =
      tryFile(path.posix.join('packages', pkgDir, 'src', behind)) ||
      tryFile(path.posix.join('packages', pkgDir, behind)) ||
      tryFile(path.posix.join('packages', pkgDir, behind, 'index'))
    return hit ? { kind: 'file', path: hit } : { kind: 'external', spec }
  }
  return { kind: 'external', spec }
}

const isTestSupport = (rel) =>
  /\/(tests|__tests__|test|testing|test-utils|fixtures|mocks)\//.test('/' + rel) ||
  /^(setup|test-setup|vitest-setup|jest-setup)/.test(path.posix.basename(rel))

function buildGraph(seedRelPaths) {
  const visited = new Set()
  const runtimeSpecs = new Set()
  const depth = new Map()
  const queue = seedRelPaths.map((p) => ({ path: p, d: 1 }))
  while (queue.length) {
    const { path: cur, d } = queue.shift()
    if (visited.has(cur)) continue
    visited.add(cur)
    depth.set(cur, d)
    for (const imp of parseFile(cur).imports) {
      if (imp.typeOnly) continue
      runtimeSpecs.add(imp.spec)
      const r = resolveSpec(imp.spec, cur)
      if (r.kind === 'file' && !visited.has(r.path) && !isTestSupport(r.path)) {
        queue.push({ path: r.path, d: d + 1 })
      }
    }
  }
  return { visited, runtimeSpecs, depth }
}

/**
 * 判定 mock 是否"经另一入口进入 SUT 图":mock 目标文件自身的运行时 import 里,
 * 有 SUT 图已使用的模块(原始 spec 命中,或解析后落在已访问节点上)。
 * 典型:`vi.mock('@/lib/api')` 而 SUT 已改从 `@ihui/api-client` 取。
 */
function isFacadeAnotherEntry(mockFile, graph) {
  // 只认"薄门面":被测模块自身不是组件(.tsx),且它 import 的实现模块已被 SUT 图使用。
  // 组件桩(mock 一个 .tsx 视图)不算"另一入口",避免把 UI stub 误判成缺陷。
  if (mockFile.endsWith('.tsx') || mockFile.endsWith('.jsx')) return false
  for (const imp of parseFile(mockFile).imports) {
    if (imp.typeOnly) continue
    if (graph.runtimeSpecs.has(imp.spec)) return true
    const r = resolveSpec(imp.spec, mockFile)
    if (r.kind === 'file' && graph.visited.has(r.path)) return true
  }
  return false
}

function analyze(testFile, graph, parsed) {
  const results = []
  for (const m of parsed.mocks) {
    const r = resolveSpec(m.id, testFile)
    let reached = false
    if (r.kind === 'file' && graph.visited.has(r.path) && !isTestSupport(r.path)) reached = true
    if (!reached && graph.runtimeSpecs.has(m.id)) reached = true
    if (reached) continue

    let category
    if (r.kind === 'unresolved-local') category = 'deadAir'
    else if (r.kind === 'file' && m.wired && isFacadeAnotherEntry(r.path, graph)) category = 'deadAir'
    else if (parsed.imports.some((i) => i.spec === m.id)) category = 'driven'
    else category = 'inert'

    results.push({
      test: testFile,
      line: m.line,
      id: m.id,
      kind: m.kind,
      resolved: r.kind,
      category,
      testImportsMock: parsed.imports.some((i) => i.spec === m.id),
    })
  }
  return results
}

// ── 主流程 ─────────────────────────────────────────────────────────────────
const baseline = fs.existsSync(BASELINE_PATH)
  ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'))
  : { waivers: {} }

let targets = codeFiles.filter((f) => TEST_RE.test(path.posix.basename(f)))
if (stagedOnly) {
  const staged = gitList(['diff', '--cached', '--name-only']).filter((f) => TEST_RE.test(path.posix.basename(f)))
  targets = targets.filter((f) => staged.includes(f.replace(/\\/g, '/')) || staged.includes(f))
}

const idle = []
const stats = { testFilesScanned: targets.length, testFilesWithMocks: 0, mockDeclarations: 0 }

for (const tf of targets) {
  const parsed = parseFile(tf)
  if (parsed.mocks.length === 0) continue
  stats.testFilesWithMocks++
  stats.mockDeclarations += parsed.mocks.length

  const mockIds = new Set(parsed.mocks.map((m) => m.id))
  const seeds = []
  for (const imp of parsed.imports) {
    if (imp.typeOnly || mockIds.has(imp.spec)) continue
    const r = resolveSpec(imp.spec, tf)
    if (r.kind === 'file' && !TEST_RE.test(r.path) && !isTestSupport(r.path)) seeds.push(r.path)
  }
  const graph = buildGraph(seeds)
  idle.push(...analyze(tf, graph, parsed))
}

const byCategory = { inert: 0, driven: 0, deadAir: 0 }
for (const it of idle) byCategory[it.category]++
for (const it of idle) it.waived = false

// 基线比对:key = file::id,按次数计。
// 全仓模式才做"新增即红";--staged 只判本批改动的测试文件(同样按次数)。
const currentCounts = new Map()
for (const it of idle) {
  const k = `${it.test}::${it.id}`
  currentCounts.set(k, (currentCounts.get(k) || 0) + 1)
}
const newViolations = []
for (const [k, n] of currentCounts) {
  const allowed = baseline.waivers[k] || 0
  if (n > allowed) {
    for (let i = allowed; i < n; i++) newViolations.push(k)
  } else {
    for (const it of idle) if (`${it.test}::${it.id}` === k) it.waived = true
  }
}
const shrinkable = Object.entries(baseline.waivers)
  .filter(([k, n]) => (currentCounts.get(k) || 0) < n)
  .map(([k, n]) => ({ key: k, allowed: n, now: currentCounts.get(k) || 0 }))

const report = {
  generatedAt: new Date().toISOString(),
  mode: stagedOnly ? 'staged' : 'full',
  testFilesScanned: stats.testFilesScanned,
  testFilesWithMocks: stats.testFilesWithMocks,
  mockDeclarations: stats.mockDeclarations,
  idleMockCount: idle.length,
  byCategory,
  newViolations,
  shrinkable,
  idle,
}

if (!jsonOut) {
  console.info(`空转 mock 检查(${report.mode})`)
  console.info(`  测试文件 ${stats.testFilesScanned} / 含 mock ${stats.testFilesWithMocks} / mock 声明 ${stats.mockDeclarations}`)
  console.info(`  空转 ${idle.length}:纯惰性 ${byCategory.inert} / 测试在用但不达被测对象 ${byCategory.driven} / 真空气断言 ${byCategory.deadAir}`)
  if (newViolations.length) {
    console.info(`\n❌ 新增空转 ${newViolations.length} 处(基线外,必须处置):`)
    for (const v of newViolations) console.info(`   ${v}`)
  }
  if (shrinkable.length) {
    console.info(`\n⚠ 可缩短的豁免 ${shrinkable.length} 条(清单只能变短,请从基线删除):`)
    for (const s of shrinkable) console.info(`   ${s.key}  基线 ${s.allowed} → 现读 ${s.now}`)
  }
  if (!newViolations.length) console.info('\n✅ 无新增空转')
}

if (updateBaseline) {
  const waivers = {}
  for (const [k, n] of currentCounts) waivers[k] = n
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true })
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: '空转 mock 存量豁免清单。只允许变短:处置后从 waivers 删除对应 key。',
        baseline: {
          testFilesScanned: stats.testFilesScanned,
          testFilesWithMocks: stats.testFilesWithMocks,
          mockDeclarations: stats.mockDeclarations,
          idleMockCount: idle.length,
          byCategory,
        },
        waivers,
      },
      null,
      2,
    ) + '\n',
  )
  console.info(`\n已写入基线:${path.relative(root, BASELINE_PATH)}`)
}

if (jsonOut) console.info(JSON.stringify(report, null, 2))
process.exit(newViolations.length ? 1 : 0)
