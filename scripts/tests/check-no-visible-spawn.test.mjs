// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { __test__ as src } from '../check-no-visible-spawn.mjs'

test('导入源模块不得触发 main() 副作用(§22d isDirectRun)', () => {
  // 若 main() 被误执行,进程会因 process.exit 在此处直接终止,断言根本跑不到;
  // 这里额外校验导出对象形状齐全。
  for (const key of [
    'scanSource',
    'scanCallEnd',
    'skipQuoted',
    'firstArg',
    'isConsoleTarget',
    'listCandidates',
    'CONSOLE_LITERALS',
    'stripSelfTestRegions',
    'SELFTEST_BEGIN',
    'SELFTEST_END',
    'exeName',
    'isBatchToken',
    'exeCandidates',
    'passesFilter',
  ]) {
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

// ---------- 盲区 1:控制台程序白名单太窄(2026-09-24 补齐) ----------

test('CONSOLE_LITERALS:补齐 tsx/turbo/vite/uvicorn/adb/cscript/wscript/conhost(npx 本已在表)', () => {
  for (const name of ['tsx', 'turbo', 'vite', 'uvicorn', 'adb', 'cscript', 'wscript', 'conhost', 'npx']) {
    assert.ok(src.CONSOLE_LITERALS.includes(name), `白名单缺少 ${name}`)
  }
})

test('isConsoleTarget:新增程序在裸名 / 绝对路径 / 路径+参数 三种形态下均命中', () => {
  const hits = [
    "'tsx'",
    '"turbo"',
    '`vite build`',
    "'uvicorn app.main:app'",
    "'adb devices'",
    "'cscript //nologo x.vbs'",
    "'wscript x.vbs'",
    "'conhost'",
    "'C:/Program Files/nodejs/node_modules/.bin/turbo.cmd'",
    "'/opt/homebrew/bin/adb -s emulator-5554 shell'",
    "'D:\\\\repo\\\\node_modules\\\\.bin\\\\vite.cmd'",
  ]
  for (const t of hits) {
    assert.equal(src.isConsoleTarget(t), true, `应命中: ${t}`)
  }
})

test('isConsoleTarget:补表不得放大误报面(未知变量与非控制台程序仍放过)', () => {
  for (const t of ['someHelper', 'resolve(p)', `'open'`, `'code'`, `'notepad'`, `'build.bat.js'`, `'turbo.json'`, `''`]) {
    assert.equal(src.isConsoleTarget(t), false, `应放过: ${t}`)
  }
})

// ---------- 盲区 3(同类坑):扩展名剥除与 .bat/.cmd 控制台载体 ----------

test('exeName:剥 .exe/.cmd/.bat/.com(Windows npm shim 形态),兼容正反斜杠与大小写', () => {
  assert.equal(src.exeName('C:/Program Files/Git/cmd/git.exe'), 'git')
  assert.equal(src.exeName('D:\\repo\\node_modules\\.bin\\pnpm.cmd'), 'pnpm')
  assert.equal(src.exeName('/usr/local/bin/tsx.bat'), 'tsx')
  assert.equal(src.exeName('C:/Windows/System32/CONHOST.EXE'), 'conhost')
  assert.equal(src.exeName('scripts/build.com'), 'build')
  assert.equal(src.exeName('git'), 'git')
  assert.equal(src.exeName('turbo.json'), 'turbo.json', '非可执行扩展名不得被剥掉')
})

test('isBatchToken:.bat/.cmd 本身就是控制台载体;.ps1/.vbs/.json 不算', () => {
  assert.equal(src.isBatchToken('build.bat'), true)
  assert.equal(src.isBatchToken('D:/a/BUILD.CMD'), true)
  assert.equal(src.isBatchToken('build.ps1'), false)
  assert.equal(src.isBatchToken('x.vbs'), false)
  assert.equal(src.isBatchToken('git'), false)
})

test('exeCandidates:整串 / 空格首段 / 已知扩展名截断 三种取法都在(含空格绝对路径曾漏报)', () => {
  assert.deepEqual(src.exeCandidates('git status'), ['git status', 'git'])
  assert.ok(
    src.exeCandidates('C:\\Program Files\\nodejs\\node.exe -e "x"').includes('C:\\Program Files\\nodejs\\node.exe'),
    '未加引号的含空格绝对路径必须按扩展名截出真实 exe',
  )
  assert.ok(src.exeCandidates('D:/repo/.bin/tsx.cmd').includes('D:/repo/.bin/tsx.cmd'))
})

test('scanSource:新增程序与 .cmd/.bat 绝对路径漏参均被抓住', () => {
  const cases = [
    `spawnSync('tsx', ['watch', 'src/index.ts'])`,
    `execFileSync('D:/IHUI-AI/node_modules/.bin/pnpm.cmd', ['build'], { encoding: 'utf8' })`,
    `execSync('C:\\\\Program Files\\\\nodejs\\\\node.exe -e "x"', { encoding: 'utf8' })`,
    `spawn('scripts/build.bat', ['-Release'])`,
    `execSync('adb devices', { stdio: 'pipe' })`,
  ]
  for (const c of cases) {
    assert.equal(src.scanSource(c, 'a.mjs').length, 1, `应抓 1 处: ${c}`)
  }
})

test('scanSource:.bat/.cmd 判定不制造新误报(参数位出现 / 已带 windowsHide / 未知变量)', () => {
  const cases = [
    `spawnSync('notepad', ['build.bat'])`,
    `spawnSync(helperBin, ['build.bat'])`,
    `spawnSync('scripts/build.bat', ['-Release'], { windowsHide: true })`,
    `execSync('code --install-extension x.vsix')`,
    `writeFileSync('a.bat', '')`,
  ]
  for (const c of cases) {
    assert.equal(src.scanSource(c, 'a.mjs').length, 0, `应 0 误报: ${c}`)
  }
})

// ---------- 盲区 2:未跟踪(且未被 .gitignore 忽略)文件永不被扫 ----------

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
function gitOut(args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    cwd: repoRoot,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}
// 准入判据直接复用源脚本导出的 passesFilter,测试里不再抄第二份常量(§22c 镜像漂移)
const scannable = (list) => list.filter(src.passesFilter)
// listCandidates 内部用 resolve(f) 依 cwd 判存在,故这组用例必须在仓库根目录跑;
// 其他 cwd 下(node --test 从子目录启动)跳过,避免把"判据没问题"误报成失败。
const atRoot = resolve(repoRoot) === resolve(process.cwd())

test('listCandidates(全量):未跟踪但未被忽略的源文件必须进入清单', (t) => {
  if (!atRoot) return t.skip('需在仓库根目录运行')
  const others = scannable(gitOut(['ls-files', '--others', '--exclude-standard']))
  const got = new Set(src.listCandidates(false))
  for (const f of others) assert.ok(got.has(f), `未跟踪源文件应进扫描清单: ${f}`)
})

test('listCandidates(全量):被 .gitignore 忽略的文件绝不进清单(--exclude-standard 生效)', (t) => {
  if (!atRoot) return t.skip('需在仓库根目录运行')
  const files = src.listCandidates(false)
  // 清单里每个文件都必须能溯源到 git 的"已跟踪"或"未跟踪但未忽略"两个集合之一。
  // 一旦 --exclude-standard 被去掉,本机 .android-toolchain/ 等 30 万+ 被忽略文件会整体涌入,此处立即变红。
  const allowed = new Set([...gitOut(['ls-files']), ...gitOut(['ls-files', '--others', '--exclude-standard'])])
  const foreign = files.filter((f) => !allowed.has(f))
  assert.deepEqual(foreign.slice(0, 5), [], '清单出现被忽略/未知文件 → --exclude-standard 未生效')
  assert.ok(files.every((f) => !/^\.android-toolchain[\\/]/.test(f)), '被忽略目录不得进入清单')
  // 覆盖性(反向):已跟踪且满足准入判据的文件一个都不能少(防"只跑 --others、漏了 ls-files")
  const set = new Set(files)
  for (const f of scannable(gitOut(['ls-files', 'scripts']))) {
    assert.ok(set.has(f), `已跟踪源文件被漏掉: ${f}`)
  }
})

test('listCandidates(--staged):只认暂存区,不把未跟踪文件拉进来(防误阻塞他人提交)', (t) => {
  if (!atRoot) return t.skip('需在仓库根目录运行')
  const others = new Set(gitOut(['ls-files', '--others', '--exclude-standard']))
  for (const f of src.listCandidates(true)) {
    assert.ok(!others.has(f), `staged 模式不应包含未跟踪文件: ${f}`)
  }
})

// ---------- self-test 样例区自我豁免(2026-09-22 修"全量扫描恒红"引入) ----------

const SAMPLE_INSIDE = `spawnSync('git', ['status'])`
const SAMPLE_OUTSIDE = `execSync('git log -1')`
function fixtureWithRegion() {
  return [
    'function selfTest() {',
    src.SELFTEST_BEGIN,
    // 区间内必须是**真实代码**而不是包在反引号里的样例:自 maskInert(2026-09-24)起,
    // 字符串字面量里的 `spawnSync('git', …)` 本来就判 0 —— 若这里仍写成字符串,
    // "标记不能被他文件滥用"这条证明会退化成在测掩码规则,而不是测豁免边界。
    `  ${SAMPLE_INSIDE}`,
    src.SELFTEST_END,
    `  ${SAMPLE_OUTSIDE}`,
    '}',
  ].join('\n')
}

test('stripSelfTestRegions: 成对标记内清空且保留行数;标记缺失/不成对不豁免(宁红不漏)', () => {
  const f = fixtureWithRegion()
  const stripped = src.stripSelfTestRegions(f)
  assert.equal(stripped.split('\n').length, f.split('\n').length, '行数必须保持不变(行号不漂移)')
  assert.ok(!stripped.includes(SAMPLE_INSIDE), '区间内样例应被清空')
  assert.ok(stripped.includes(SAMPLE_OUTSIDE), '区间外代码必须原样保留')
  assert.equal(src.stripSelfTestRegions(`a\n${src.SELFTEST_BEGIN}\nb`), `a\n${src.SELFTEST_BEGIN}\nb`, '缺 end 标记 → 不豁免')
  assert.equal(src.stripSelfTestRegions('const x = 1'), 'const x = 1', '无标记 → 原样返回')
  const dup = [src.SELFTEST_BEGIN, 'a', src.SELFTEST_END, src.SELFTEST_BEGIN, 'b', src.SELFTEST_END].join('\n')
  assert.equal(src.stripSelfTestRegions(dup), dup, '标记不成对(多于 1 组) → 不豁免')
})

test('自我豁免仅对本脚本自身生效,其他文件写同样标记无法绕过(防判据变松)', () => {
  const f = fixtureWithRegion()
  assert.equal(src.scanSource(f, 'scripts/check-no-visible-spawn.mjs').length, 1, '自身:区间外那 1 处仍必须被抓')
  assert.equal(src.scanSource(f, 'scripts/some-other.mjs').length, 2, '其他文件:标记无效,区间内外 2 处都抓')
})

test('真实源文件必须恰好含 1 组成对 self-test 标记(缺失即豁免失效/恒红,需人审)', () => {
  const self = readFileSync(new URL('../check-no-visible-spawn.mjs', import.meta.url), 'utf8')
  assert.equal(self.split('\n').filter((l) => l.trim() === src.SELFTEST_BEGIN).length, 1)
  assert.equal(self.split('\n').filter((l) => l.trim() === src.SELFTEST_END).length, 1)
  assert.equal(src.scanSource(self, 'scripts/check-no-visible-spawn.mjs').length, 0, '自我扫描必须 0 违规(全量恒红回归的直接判据)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// --- N1(2026-09-27 立):按镜像名杀进程 taskkill /IM ---
test('isNameBasedKillCall: 命中与放过成对(含"带 windowsHide 仍命中"与三条反向对照)', () => {
  const hit = [
    `'taskkill', ['/IM', DESKTOP_EXE, '/F'], { stdio: 'ignore', windowsHide: true }`,
    `'taskkill', ['/IM', 'x.exe', '/F']`,
    `'taskkill /IM node.exe /F'`,
    `'taskkill', '/im', 'x'`,
  ]
  for (const inner of hit) assert.ok(src.isNameBasedKillCall(inner), `应命中: ${inner}`)
  const miss = [
    `'taskkill', ['/PID', pid, '/F'], { windowsHide: true }`,
    `'git', ['commit', '-m', 'do not use /im here'], { windowsHide: true }`,
    `'node', ['build', '/images/a.png'], { windowsHide: true }`,
    `KILL_BIN, ['/IM', name, '/F'], { windowsHide: true }`,
    ``,
  ]
  for (const inner of miss) assert.ok(!src.isNameBasedKillCall(inner), `不应命中: ${inner || '(空)'}`)
})

test('N1 判序必须有牙:带 windowsHide 的 taskkill /IM 经 scanSource 仍须报 1 处 name-kill', () => {
  // 这条取代了"按源码文本位置比先后"的写法:位置锁会因为 N1 分支自己也要读 windowsHide
  // 而误判(实测如此),而**行为**判据不受文本挪动影响 ——
  // 若有人把 N1 挪回短路之后,这里实得 0,而本仓那处真实站点正是"带 windowsHide"的形状。
  const v = src.scanSource(
    `spawnSync('taskkill', ['/IM', DESKTOP_EXE, '/F'], { stdio: 'ignore', windowsHide: true })`,
    'probe.mjs',
  )
  assert.equal(v.length, 1, '带 windowsHide 不得让 N1 失明(旧判序会整型隐身)')
  assert.equal(v[0].kind, 'name-kill', '必须是 N1 那一型,而不是"漏 windowsHide"')
  assert.equal(
    src.scanSource(`spawnSync('taskkill', ['/IM', 'a.exe', '/F'])`, 'probe.mjs').length,
    1,
    '同一调用即使同时漏着 windowsHide 也只报一处(不重复计债)',
  )
})

test('剥引号只许一份实现:isConsoleTarget 与 callProgramName 必须共用 unwrapCommandLiteral', () => {
  const self = readFileSync(new URL('../check-no-visible-spawn.mjs', import.meta.url), 'utf8')
  const fnBody = (name) => {
    const i = self.indexOf(`export function ${name}(`)
    assert.ok(i > 0, `缺少 ${name}`)
    return self.slice(i, self.indexOf('\n}', i))
  }
  for (const name of ['isConsoleTarget', 'callProgramName']) {
    assert.ok(fnBody(name).includes('unwrapCommandLiteral('), `${name} 必须走共用取法`)
    assert.ok(!/\.match\(\/\^\(\?:/.test(fnBody(name)), `${name} 不得再自己写一份剥引号正则(两处必漂移)`)
  }
})

// ── G-1058606:在飞未入库必须单独归类,且覆盖面那一维不得被顺手删掉 ──────────────
const BAD_FORM = `spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })`

test('成对锁:同一份违规形态只因"在不不在被审面"而分桶不同(不得互顶)', () => {
  const hits = src.scanSource(BAD_FORM, 'scripts/new-gate.mjs')
  assert.equal(hits.length, 1, '形态本身必须真违规(否则两臂都是假对照)')
  // A 臂:只在磁盘上(未 add)⇒ 不在被审面 ⇒ 进"在飞",绝不进"生产代码"
  const a = src.splitByFace(['scripts/new-gate.mjs'], new Set(['scripts/other.mjs']))
  assert.deepEqual(a.inflight, ['scripts/new-gate.mjs'], '未入库那份必须在飞档')
  assert.deepEqual(a.tracked, [], '未入库那份绝不得算进生产代码档(那会把别人的在飞交付记成本仓欠账)')
  // B 臂:同一份已入库 ⇒ 进"生产代码"
  const b = src.splitByFace(['scripts/new-gate.mjs'], new Set(['scripts/new-gate.mjs']))
  assert.deepEqual(b.tracked, ['scripts/new-gate.mjs'], '已入库那份在生产代码档')
  assert.deepEqual(b.inflight, [], '已入库那份不得躲进在飞档(那是免检通道)')
})

test('--worktree 档不得凭空造出在飞桶(没有"被审面"可言)', () => {
  const w = src.splitByFace(['scripts/new-gate.mjs'], null)
  assert.deepEqual(w.tracked, ['scripts/new-gate.mjs'])
  assert.deepEqual(w.inflight, [], '人工取证档把一切算 tracked,不得给人一个"只报数"的免检位')
})

test('面名必须诚实:掺了在飞副本就不能再一律印 HEAD blob', () => {
  const bare = src.faceLabel('head', 0)
  assert.ok(!bare.includes('在飞'), '没掺就不许声称掺了')
  const mixed = src.faceLabel('head', 2)
  assert.ok(mixed.startsWith(bare) && mixed.includes('在飞'), '掺了必须改名(旧写法把磁盘读数写成被审面读数)')
  assert.equal(src.faceLabel('worktree', 3), src.faceLabel('worktree', 0), '人工档不随在飞数改名')
})

test('被审面路径集:head 取自 HEAD 树、worktree 档返回 null', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url)) // 仓库根:URL 相对基准是文件所在目录,再上两级
  const head = src.facePathSet(root, 'head')
  assert.ok(head instanceof Set && head.size > 100, 'HEAD 树清单必须真取到(取不到应当抛而不是给空集)')
  assert.ok(head.has('scripts/check-no-visible-spawn.mjs'), '本门自身在 HEAD 面上')
  assert.equal(src.facePathSet(root, 'worktree'), null, '--worktree 没有面 ⇒ null,不得当空集(空集会把所有文件判成在飞)')
})

test('形状锁:listCandidates 全量档必须仍并上 --others(票面②:不得为措辞干净删掉那一支)', () => {
  const self = readFileSync(new URL('../check-no-visible-spawn.mjs', import.meta.url), 'utf8')
  const i = self.indexOf('export function listCandidates(')
  assert.ok(i > 0, '缺少 listCandidates')
  const body = self.slice(i, self.indexOf('\n}', i))
  assert.ok(body.includes("'--others'"), '未跟踪新脚本那一支不得摘掉 —— 摘掉 = 覆盖面缩水而账面照样绿')
  assert.ok(body.includes("'--exclude-standard'"), '必须带 --exclude-standard,否则把构建产物全扫进来')
  assert.ok(body.includes('ls-files'), '跟踪面与未跟踪面都要在')
})
