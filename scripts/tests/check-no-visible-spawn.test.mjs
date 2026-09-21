// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { __test__ as src } from '../check-no-visible-spawn.mjs'

test('导入源模块不得触发 main() 副作用(§22d isDirectRun)', () => {
  // 若 main() 被误执行,进程会因 process.exit 在此处直接终止,断言根本跑不到;
  // 这里额外校验导出对象形状齐全。
  for (const key of ['scanSource', 'scanCallEnd', 'skipQuoted', 'firstArg', 'isConsoleTarget', 'listCandidates', 'CONSOLE_LITERALS']) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
})

test('skipQuoted: 普通字符串与转义引号', () => {
  // 0=' 1=a 2=\ 3=' 4=b 5=' 6=x  → 闭合引号在 5,返回 6
  assert.equal(src.skipQuoted(`'ab'x`, 0, "'"), 4)
  assert.equal(src.skipQuoted(`'a\\'b'x`, 0, "'"), 6)
})

test('skipQuoted: 模板串内的 ${} 不当作结束', () => {
  const s = '`a${b}c`rest'
  assert.equal(src.skipQuoted(s, 0, '`'), 8)
})

test('scanCallEnd: 字符串/模板内的括号不影响配平', () => {
  const s = `f('a)b(', x)`
  assert.equal(s.slice(0, src.scanCallEnd(s, 1)), s)
})

test('scanCallEnd: 注释内的括号被跳过', () => {
  const s = 'f(/* ( */ x, y)'
  assert.equal(s.slice(0, src.scanCallEnd(s, 1)), s)
})

test('firstArg: 顶层逗号处截断,嵌套括号内的逗号不截断', () => {
  assert.equal(src.firstArg(`'git status', { encoding: 'utf8' }`), `'git status'`)
  assert.equal(src.firstArg(`'git', ['log', '-1', 'a,b'], {}`), `'git'`)
  assert.equal(src.firstArg(`{ a: 1 }`), `{ a: 1 }`)
})

test('isConsoleTarget: 白名单内的字面量命中(含绝对路径与路径+参数)', () => {
  const hits = [
    "'git status'",
    "'node'",
    '"pnpm"',
    '`git push origin ${b}`',
    "'C:/Program Files/Git/cmd/git.exe'", // 正斜杠绝对路径(AGENTS.md 推荐写法)
    "'C:\\\\Program Files\\\\Git\\\\cmd\\\\git.exe'", // 反斜杠绝对路径(源文本里是双反斜杠)
    "'/usr/bin/git status'", // 路径 + 参数
    "'node -e \"console.log(1)\"'", // 命令串带参数与引号
  ]
  for (const t of hits) {
    assert.equal(src.isConsoleTarget(t), true, `应命中: ${t}`)
  }
})

test('isConsoleTarget: 非控制台程序与未知变量一律放过(宁漏不误报)', () => {
  for (const t of [`'open'`, `'code'`, 'someHelper', 'resolve(p)', `''`]) {
    assert.equal(src.isConsoleTarget(t), false, `应放过: ${t}`)
  }
})

test('isConsoleTarget: process.execPath 与约定标识符命中', () => {
  assert.equal(src.isConsoleTarget('process.execPath'), true)
  assert.equal(src.isConsoleTarget('spawn(process.execPath'), true)
  assert.equal(src.isConsoleTarget('GIT_BIN'), true)
  assert.equal(src.isConsoleTarget('npmExec'), true)
})

test('scanSource: 漏 windowsHide 的控制台派生被抓住', () => {
  const cases = [
    `execSync('git status', { encoding: 'utf8' })`,
    `spawnSync('git', ['rev-parse', 'HEAD'])`,
    `spawn('git', args, { stdio: 'inherit' })`,
    `execFileSync(process.execPath, ['x.mjs'], { encoding: 'utf8' })`,
    'execSync(`git push origin ${b}`, { stdio: "pipe" })',
  ]
  for (const c of cases) {
    assert.equal(src.scanSource(c, 'a.mjs').length, 1, `应抓 1 处: ${c}`)
  }
})

test('scanSource: 已带 windowsHide 或非控制台程序不误报', () => {
  const cases = [
    `execSync('git status', { encoding: 'utf8', windowsHide: true })`,
    `spawnSync('git', args, {\n  cwd: ROOT,\n  windowsHide: true,\n})`,
    `spawn('open', ['http://x'])`,
    `spawnSync(someHelperBin, ['a'], { encoding: 'utf8' })`,
  ]
  for (const c of cases) {
    assert.equal(src.scanSource(c, 'a.mjs').length, 0, `应 0 误报: ${c}`)
  }
})

test('scanSource: 注释行内的调用不算违规', () => {
  const s = `// execSync('git status', { encoding: 'utf8' })\nconst a = 1`
  assert.equal(src.scanSource(s, 'a.mjs').length, 0)
})

test('scanSource: 外层违规时同一行内层嵌套按一处报', () => {
  const s = `execFileSync('git', ['show', execSync('git x', { encoding: 'utf8' })], { encoding: 'utf8' })`
  assert.equal(src.scanSource(s, 'a.mjs').length, 1)
})

test('scanSource: 外层已带 windowsHide 时仍抓内层漏参(否则漏报)', () => {
  const s = `execFileSync('git', ['show', execSync('git x', { encoding: 'utf8' })], { windowsHide: true })`
  assert.equal(src.scanSource(s, 'a.mjs').length, 1)
})

test('scanSource: 同一文件多文件连续扫描不串档(模块级正则 lastIndex 必须重置)', () => {
  const one = `execSync('git status', { encoding: 'utf8' })`
  assert.equal(src.scanSource(one, 'a.mjs').length, 1)
  assert.equal(src.scanSource(one, 'b.mjs').length, 1, '第二次扫描必须同样命中')
  assert.equal(src.scanSource('const x = 1', 'c.mjs').length, 0)
  assert.equal(src.scanSource(one, 'd.mjs').length, 1, '干净文件之后仍要能命中')
})

test('scanSource: 绝对路径 git.exe 漏参被抓住(Windows 真实形态,曾因空格切分漏报)', () => {
  const s = `execFileSync('C:/Program Files/Git/cmd/git.exe', ['rev-parse', 'HEAD'], { encoding: 'utf8' })`
  assert.equal(src.scanSource(s, 'a.mjs').length, 1)
  const ok = `execFileSync('C:/Program Files/Git/cmd/git.exe', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true })`
  assert.equal(src.scanSource(ok, 'a.mjs').length, 0)
})

test('scanSource: 违规项带文件名/行号/函数名,便于定位', () => {
  const s = `const a = 1\nexecSync('git status', { encoding: 'utf8' })\n`
  const [v] = src.scanSource(s, 'scripts/x.mjs')
  assert.equal(v.file, 'scripts/x.mjs')
  assert.equal(v.line, 2)
  assert.equal(v.fn, 'execSync')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
