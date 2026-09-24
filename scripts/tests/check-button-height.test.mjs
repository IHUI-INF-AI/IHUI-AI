// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// check-button-height.mjs 的 §22c 镜像测试。
// 纪律:核心判据一律 import 源脚本 __test__ 导出(§22d isDirectRun 保证 import 零副作用),
// 禁止把源实现复制进本文件。唯一例外 = independentParseSizes():题目要求的"独立解析对照"
// 跨检器,算法与源实现刻意不同(花括号配平取块,而非 indexOf('defaultVariants') 截块)。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { __test__ as bt } from '../check-button-height.mjs'

const SELF = bt.SELF

// ── 装车证明(§22c):源脚本必须 export __test__ 且暴露判据核心,缺一个锚点即红 ──
test('源脚本 __test__ 导出锚点齐全(镜像漂移防线)', () => {
  for (const k of ['resolveRoot', 'loadValidSizes', 'maskComments', 'extractTag', 'extractClasses',
    'extractSize', 'isScannedFile', 'collectViolationsInSource', 'scanTree', 'FALLBACK_SIZES', 'SELF']) {
    assert.ok(k in bt, `__test__ 缺少导出键 ${k}`)
  }
  // import 本文件不触发 main():若触发了,上面 import 阶段就会 exit/刷扫描输出,到不了这里
})

// ── 档位清单动态解析对账(题目要求 6):独立解析 vs 守门解析,真仓 button.tsx 逐档相等 ──
function independentParseSizes(root) {
  const src = readFileSync(path.join(root, 'packages/ui-react/src/components/button.tsx'), 'utf8')
  const start = src.indexOf('size: {')
  assert.ok(start >= 0, '未找到 size: { 块')
  let i = start + 'size:'.length
  let depth = 0
  let blockEnd = -1
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { blockEnd = i; break } }
  }
  assert.ok(blockEnd > start, 'size 块花括号不配平')
  const block = src.slice(start + 'size:'.length + 1, blockEnd)
  const keys = []
  let inBlockComment = false
  for (const line of block.split('\n')) {
    const t = line.trim()
    if (inBlockComment) { if (t.endsWith('*/')) inBlockComment = false; continue }
    if (t.startsWith('/*') && !t.endsWith('*/')) { inBlockComment = true; continue }
    if (t.startsWith('//') || t.startsWith('/*')) continue
    const m = /^(['"]?)([A-Za-z][A-Za-z0-9_-]*)\1\s*:/.exec(t)
    if (m) keys.push(m[2])
  }
  return new Set(keys)
}
test('档位清单 = 真仓 button.tsx 独立解析结果(动态解析真实生效,非硬编码兜底)', () => {
  const fromGate = bt.loadValidSizes(bt.SCRIPT_REPO_ROOT)
  const fromProbe = independentParseSizes(bt.SCRIPT_REPO_ROOT)
  assert.ok(fromGate.size >= 8, `档位集异常小:${[...fromGate]}`)
  assert.deepEqual([...fromGate].sort(), [...fromProbe].sort())
  assert.ok(fromGate.has('icon-2xs'), 'AGENTS §4 明载的 icon-2xs 必须在档(硬编码兜底被移除的回归锚)')
})

// ── 正反成对核心判据(纯函数面,无 fs / 无 git / 不触真仓) ──
const SIZES = new Set(['xs', 'sm', 'default', 'lg', 'icon-2xs', 'icon-xs', 'icon-sm', 'icon'])
test('h-7 w-7 覆盖必红;档位内 size 必绿;非法 size 必红', () => {
  const red = bt.collectViolationsInSource(`const a = <Button className="h-7 w-7" />`, SIZES)
  assert.equal(red.length, 1)
  assert.deepEqual(red[0].bad, ['h-7', 'w-7'])
  assert.equal(bt.collectViolationsInSource(`const a = <Button size="icon-2xs" />`, SIZES).length, 0)
  assert.equal(bt.collectViolationsInSource(`const a = <Button size="sm" />`, SIZES).length, 0)
  const badSize = bt.collectViolationsInSource(`const a = <Button size="xl2" />`, SIZES)
  assert.equal(badSize.length, 1)
  assert.match(badSize[0].bad[0], /size="xl2" 不在档位表/)
})
test('白名单对照:同一段源码里 h-5/h-6 放过而 h-7 必拦(豁免通道不得顺手放宽)', () => {
  const src = `<>
    <Button className="h-5">表格钮</Button>
    <Button className="h-6 w-6">表格钮</Button>
    <Button className="h-7">违规</Button>
  </>`
  const bad = bt.collectViolationsInSource(src, SIZES).flatMap((v) => v.bad)
  assert.ok(!bad.includes('h-5') && !bad.includes('h-6') && !bad.includes('w-6'))
  assert.ok(bad.includes('h-7'))
})
test('非 Button 元素 h-9 不误伤(Input/div/原生 button/相似组件名)', () => {
  const src = `<>
    <Input className="h-9" />
    <div className="h-10 w-11" />
    <button className="h-8 w-8" />
    <ButtonBase className="h-9" />
  </>`
  assert.equal(bt.collectViolationsInSource(src, SIZES).length, 0)
})
test('JSX 边界:多行属性/{...props}/三元 className 判红;注释内 h-7 一律不判红', () => {
  assert.equal(bt.collectViolationsInSource(
    `<Button\n  variant="ghost"\n  {...props}\n  className="h-9"\n/>`, SIZES).length, 1)
  assert.equal(bt.collectViolationsInSource(
    `<Button className={open ? 'h-7 w-7' : 'px-2'} />`, SIZES).length, 1)
  assert.equal(bt.collectViolationsInSource(
    `// <Button className="h-7" /> 注释示例\nconst x = 1\n/* <Button size="nope" /> */`, SIZES).length, 0)
  assert.equal(bt.collectViolationsInSource(
    `const x = <p>{"含 <Button className=\\"h-7\\" 的文案"}</p>`, SIZES).length, 0)
})
test('isScannedFile:button.tsx 本体与测试路径豁免,普通端内文件在扫描面', () => {
  assert.equal(bt.isScannedFile('packages/ui-react/src/components/button.tsx'), false)
  assert.equal(bt.isScannedFile('apps/web/src/demo/tests/x.tsx'), false)
  assert.equal(bt.isScannedFile('apps/web/src/demo/a.test.tsx'), false)
  assert.equal(bt.isScannedFile('apps/web/src/demo/a.tsx'), true)
})
test('resolveRoot:等号/空格/env/默认四通道 + 缺值抛错(不静默)', () => {
  assert.equal(bt.resolveRoot([], {}).root, bt.SCRIPT_REPO_ROOT)
  assert.equal(bt.resolveRoot(['--root', '/tmp/aa'], {}).root, path.resolve('/tmp/aa'))
  assert.equal(bt.resolveRoot(['--root=/tmp/aa'], {}).root, path.resolve('/tmp/aa'))
  assert.equal(bt.resolveRoot([], { BUTTON_HEIGHT_ROOT: '/tmp/aa' }).root, path.resolve('/tmp/aa'))
  assert.throws(() => bt.resolveRoot(['--root='], {}))
  assert.throws(() => bt.resolveRoot(['--root'], {}))
})
test('maskComments 保长保行,字符串不被误伤', () => {
  const src = `const u = "http://a/b" // tail\nconst s = '/* not comment */'`
  const m = bt.maskComments(src)
  assert.equal(m.length, src.length)
  assert.equal(m.split('\n').length, src.split('\n').length)
  assert.match(m, /http:\/\/a\/b/)
  assert.match(m, /\/\* not comment \*\//)
  assert.doesNotMatch(m, /tail/)
})

// ── CLI 端到端装车证明(--self-test 夹具全量 + 根注入退出码) ──
const cli = (args, env) => spawnSync(process.execPath, [SELF, ...args], {
  encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 32 * 1024 * 1024,
  env: env ? { ...process.env, ...env } : process.env,
})
test('CLI --self-test → exit 0(判据在独立夹具里真的能红/能绿)', () => {
  const r = cli(['--self-test'])
  assert.equal(r.status, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /self-test 全部通过/)
})
test('CLI 根注入退出码:不存在目录/等号形态/staged 冲突 → 2(绝不静默 0)', () => {
  const missing = path.join(bt.SCRIPT_REPO_ROOT, '.ihui-agent', 'tmp', 'button-height', 'nope-must-not-exist')
  assert.equal(cli(['--root', missing]).status, 2)
  assert.equal(cli([`--root=${missing}`]).status, 2)
  assert.equal(cli(['--staged', '--root', bt.SCRIPT_REPO_ROOT]).status, 2)
})
test('CLI 真仓默认根全量 → exit 0(全仓现绿;此门恒红=全队 --no-verify,必须先消红)', () => {
  const r = cli([])
  assert.equal(r.status, 0, r.stdout + r.stderr)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
