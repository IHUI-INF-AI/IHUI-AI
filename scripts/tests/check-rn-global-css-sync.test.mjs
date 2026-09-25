// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
// 被测脚本与它的闭包都在 `scripts/` 下。`__dirname` 由 `new URL('.', …)` 得来,**带尾斜杠**,
// 所以 `join(__dirname,'..')` 已经是 `scripts/`(再上跳一级就跑到仓库根,闭包必然找不到文件)。
const SCRIPTS_DIR = join(__dirname, '..')

// ============================================================
// 源脚本核心规则(scripts/check-rn-global-css-sync.mjs)
// ============================================================
// - 守门规则:apps/mobile-rn/global.css 中的 --color-* 变量必须与
//   packages/design-tokens/src/styles/tokens.css 保持同步。
//   (NativeWind 4.x = Tailwind v3,无法 @import tokens.css,需手动复制)
// - 路径解析:基于 import.meta.url(非 process.cwd),root = 脚本父目录的上一级
// - mobile-rn 提取::root(浅色)+ .dark(深色)
// - tokens.css 提取:@theme + :root(浅色,两种语法合并)+ .dark(深色)
// - 比较范围:**以源头(tokens.css)为准** —— 逐位同值 + 副本不得缺档(源头有、副本没有 ⇒ 判红)。
//   副本里多出的 --color-* 档属端内自立档,只报数不判红(旧口径"只查 mobile-rn 里存在的变量"
//   会把缺档放过,而 NativeWind 下缺档的真实后果是该色值端内静默取不到 —— 2026-09-25 改)。
// - 取材面:默认磁盘;`--staged` 走**索引面**(取不到回落 HEAD 那份),与全仓
//   "全量判 HEAD blob、--staged 判索引 blob"同口径 —— 判的是"这次提交会带走的那一份"。
// - 退出码:0 = 一致;1 = 值漂移/缺档;**2 = 无法判定(某个面取不到,既不冒红也不记绿)**
// - CLI 标志:--quiet(抑制通过消息,错误仍走 stderr)/ --staged(切索引面,**不是**无操作)
// ============================================================

// ─── 辅助:创建临时环境(复制脚本 + 写入 fixture) ───
// 源脚本基于 import.meta.url 解析 root,所以必须把脚本复制到临时目录,
// 并在 tempDir/apps/mobile-rn/global.css 与
// tempDir/packages/design-tokens/src/styles/tokens.css 放置 fixture。
function createTempEnv(rnCss, tokensCss) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-rn-css-sync-'))
  // 复制源脚本到 tempDir/scripts/(不改源脚本,只读复制)
  // 复制源脚本**连同它的相对 import 闭包**到 tempDir/scripts/(不改源脚本,只读复制)。
  // 原先这里是 `copyFileSync(单个脚本)` —— 而本脚本 import 了 design-token-blocks /
  // sync-rn-global-css / face-reader 三跳,只拷一份必然 ERR_MODULE_NOT_FOUND(exit 1、stdout 空)。
  // 闭包必须推导,不能手抄清单(见 lib/scratch-module-closure.mjs 头注记录的两次同型事故)。
  copyScriptWithClosure(SCRIPTS_DIR, 'check-rn-global-css-sync.mjs', join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/design-token-blocks.mjs',
    'sync-rn-global-css.mjs',
  ])
  // 写入 mobile-rn/global.css fixture
  mkdirSync(join(dir, 'apps', 'mobile-rn'), { recursive: true })
  writeFileSync(join(dir, 'apps', 'mobile-rn', 'global.css'), rnCss)
  // 写入 design-tokens/tokens.css fixture
  mkdirSync(join(dir, 'packages', 'design-tokens', 'src', 'styles'), { recursive: true })
  writeFileSync(join(dir, 'packages', 'design-tokens', 'src', 'styles', 'tokens.css'), tokensCss)
  // 2026-09-25:本门 `--staged` 改为**按索引面取材**(与全仓"全量判 HEAD、staged 判索引"同口径)。
  // 夹具若不进索引,门如实报"取不到 ⇒ 无法判定 exit 2" —— 那不是 bug,是它拒绝冒绿。
  // 所以这里把两份 fixture 落成一个小 git 仓并暂存,模拟"这次提交会带走的那一份"。
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 't@t')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'add', '-A')
  return dir
}

/** 临时仓里的 git:绝对化 safe.directory + windowsHide + timeout(§5b/§52 同口径)。 */
function git(cwd, ...args) {
  return spawnSync('git', ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
}

// ─── 辅助:运行复制的脚本 ───
function runScript(tempDir, args = []) {
  const scriptPath = join(tempDir, 'scripts', 'check-rn-global-css-sync.mjs')
  return spawnSync('node', [scriptPath, ...args], {
    cwd: tempDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 辅助:断言通过(exit 0 + stdout 含"受管档逐位同值且无缺档",并带受管档计数)───
// 2026-09-25:门把英文 "in sync" 换成了中文计数句。断言仍要求**带数字**,
// 这样"扫到 0 档却报绿"那型假绿不会被放宽成通过。
function assertPass(r) {
  assert.equal(
    r.status,
    0,
    `应 exit 0(同步),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(
    r.stdout,
    /All \d+ 个受管档逐位同值且无缺档/,
    `stdout 应含带受管档计数的同步行\nstdout: ${r.stdout}`,
  )
}

// ─── 辅助:断言不一致(exit 1 + stderr 含汇总计数行)───
function assertMismatch(r) {
  assert.equal(
    r.status,
    1,
    `应 exit 1(不一致),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(
    r.stderr,
    /Found \d+ 处值漂移 \/ \d+ 处缺档/,
    `stderr 应含"值漂移/缺档"汇总行\nstderr: ${r.stderr}`,
  )
}

// ============================================================
// 检查 1:CLI 标志 —— --quiet 抑制通过消息(仍 exit 0)
// ============================================================

// ─── 1. CLI: --quiet 同步时抑制 stdout 通过消息(仍 exit 0) ───
test('CLI: --quiet 同步时抑制 stdout 通过消息(仍 exit 0)', () => {
  const dir = createTempEnv(
    `:root {\n  --color-primary: #fff;\n}\n`,
    `:root {\n  --color-primary: #fff;\n}\n`,
  )
  try {
    const r = runScript(dir, ['--quiet'])
    assert.equal(r.status, 0, `--quiet 同步应 exit 0\nstdout: ${r.stdout}`)
    // --quiet 时不应输出通过消息
    assert.equal(r.stdout, '', `--quiet 应抑制 stdout,实际: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3b. 反假绿锁:--staged 时索引与 HEAD 都取不到 ⇒ **exit 2 无法判定**(绝不记绿)───
// 这条就是本次改夹具时暴露出来的新行为:门的取材面换成索引后,"读不到"必须显式失败,
// 否则它会拿磁盘内容冒充"这次提交会带走的那一份",产出与真实提交不一致的结论。
test('反假绿: --staged 取不到索引面 → exit 2 无法判定(不冒绿也不冒红)', () => {
  const dir = createTempEnv(
    `:root {\n  --color-primary: #fff;\n}\n`,
    `:root {\n  --color-primary: #fff;\n}\n`,
  )
  try {
    // 把源头文件从索引里摘掉(夹具仓只 add 过、没有 commit ⇒ HEAD 也没有它)
    git(dir, 'rm', '--cached', '-q', '--', 'packages/design-tokens/src/styles/tokens.css')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 2, `取不到该面应 exit 2,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stderr, /无法判定/, `stderr 应说明"无法判定"\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. CLI: --staged 被接受(无操作,仍全量扫描)→ exit 0 ───
test('CLI: --staged 被接受(无操作)→ exit 0 同步消息', () => {
  const dir = createTempEnv(
    `:root {\n  --color-bg: #000;\n}\n`,
    `:root {\n  --color-bg: #000;\n}\n`,
  )
  try {
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 2:核心规则 —— :root + .dark 全部同步 → exit 0
// ============================================================

// ─── 3. 核心: :root + .dark 全部同步 → exit 0 + 计数消息 ───
test('核心: :root + .dark 全部同步 → exit 0 + 计数消息', () => {
  const rnCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n.dark {\n  --color-primary: #ccc;\n  --color-bg: #111;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n.dark {\n  --color-primary: #ccc;\n  --color-bg: #111;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
    // 通过消息应含变量总数(4 = 2 root + 2 dark)
    assert.match(
      r.stdout,
      /All 4 个受管档逐位同值且无缺档/,
      `stdout 应含带受管档计数的同步行\nstdout: ${r.stdout}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 3:核心规则 —— :root 值不一致 → exit 1
// ============================================================

// ─── 4. 核心: :root 值不一致 → exit 1 + 报告 :root diff ───
test('核心: :root 值不一致 → exit 1 + 报告 :root diff', () => {
  const rnCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #f5f5f5;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    // stderr 应点名到"哪个块 + 哪个档"(2026-09-25:门改中文行格式,不再打 ":root block")
    assert.match(
      r.stderr,
      /:root --color-primary:.*值漂移/,
      `stderr 应含 ":root --color-primary … 值漂移"\nstderr: ${r.stderr}`,
    )
    // stderr 应含变量名 + 双方值
    assert.match(r.stderr, /--color-primary/, `stderr 应含 "--color-primary"\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /#fff/, `stderr 应含 mobile-rn 值 #fff\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /#f5f5f5/, `stderr 应含 tokens 值 #f5f5f5\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 4:核心规则 —— .dark 值不一致 → exit 1
// ============================================================

// ─── 5. 核心: .dark 值不一致 → exit 1 + 报告 .dark diff ───
test('核心: .dark 值不一致 → exit 1 + 报告 .dark diff', () => {
  const rnCss = `:root {\n  --color-primary: #fff;\n}\n.dark {\n  --color-primary: #aaa;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n}\n.dark {\n  --color-primary: #bbb;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    // stderr 应点名 .dark 块与具体档
    assert.match(
      r.stderr,
      /\.dark --color-primary:.*值漂移/,
      `stderr 应含 ".dark --color-primary … 值漂移"\nstderr: ${r.stderr}`,
    )
    assert.match(r.stderr, /#aaa/, `stderr 应含 mobile-rn 值 #aaa\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /#bbb/, `stderr 应含 tokens 值 #bbb\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 5:核心规则 —— mobile-rn 有变量但 tokens 缺失 → exit 1
// ============================================================

// ─── 6. 核心: 源头有而副本缺 ⇒ exit 1 + 报"缺档"(2026-09-25 判据方向)───
test('核心: 源头有而副本缺 → exit 1 + 报"缺档"', () => {
  const rnCss = `:root {\n  --color-accent: #ff0;\n}\n`
  const tokensCss = `:root {\n  --color-other: #abc;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    // 门现在只判"源头有、副本缺"(缺档);副本多出来的档是端内自立档,只报数不判红
    assert.match(r.stderr, /缺档/, `stderr 应含 "缺档"\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /--color-other/, `stderr 应含源头档名\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 核心: 源头 .dark 有、副本缺 ⇒ exit 1 + 点名 .dark 缺档 ───
test('核心: 源头 .dark 有而副本缺 → exit 1 + 点名 .dark 缺档', () => {
  const rnCss = `:root {\n  --color-x: #000;\n}\n`
  const tokensCss = `:root {\n  --color-x: #000;\n}\n.dark {\n  --color-y: #222;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    assert.match(
      r.stderr,
      /\.dark --color-y:.*缺档/,
      `stderr 应含 ".dark --color-y … 缺档"\nstderr: ${r.stderr}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7b. 方向锁:副本多出源头没有的档 ⇒ **不判红**,只作为"端内自立档"报数 ───
// 2026-09-25 判据方向:门只管"源头有、副本缺"与"值漂移"。副本里自立的 --color-* 档
// (端内自己加的)生成器无权删,判它红会把人推向 --no-verify。这一条防止有人把方向改回去
// 或把它当漏判"修好"。
test('方向锁: 副本有、源头没有的自立档 ⇒ exit 0 且计入只报数(不得判红)', () => {
  const rnCss = `:root {\n  --color-x: #000;\n}\n.dark {\n  --color-x: #111;\n}\n`
  const tokensCss = `:root {\n  --color-x: #000;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `自立档不该判红,实际 exit ${r.status}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /All \d+ 个受管档逐位同值且无缺档/, `stdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 6:核心规则 —— tokens 有额外变量(mobile-rn 无)→ exit 0
// ============================================================

// ─── 8. 核心: 源头有而副本未复制 ⇒ **exit 1 + 缺档**(旧版"子集放过"已被推翻)───
// 2026-09-25 判据变更:旧口径把"tokens 有、mobile-rn 没有"当合法子集放过,而 NativeWind 下
// 缺档的真实后果是该色值在端内**静默取不到**(样式不生效但不报错),正是本门该拦的那一型;
// 现在由 `sync-rn-global-css.mjs` 负责补齐,门只管判缺。保留本用例是为把方向钉死。
test('核心: 源头有而副本未复制 → exit 1 + 缺档(旧"子集放过"已废)', () => {
  const rnCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n  --color-extra: #abc;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    assert.match(
      r.stderr,
      /:root --color-extra:.*缺档/,
      `stderr 应点名缺的档\nstderr: ${r.stderr}`,
    )
    // 受管档计数按**源头**算(2 档),不受副本影响
    assert.match(r.stderr, /Found 0 处值漂移 \/ 1 处缺档/, `stderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 7:语法支持 —— tokens.css 使用 @theme {} 语法
// ============================================================

// ─── 9. 语法: tokens.css 使用 @theme {} 语法 → 正确解析 ───
test('语法: tokens.css 使用 @theme {} 语法 → 正确解析,exit 0', () => {
  const rnCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 8:语法支持 —— tokens.css 同时含 @theme + :root(合并)
// ============================================================

// ─── 10. 语法: tokens.css 同时含 @theme + :root(合并,后者覆盖前者)→ exit 0 ───
test('语法: tokens.css @theme + :root 合并(后者覆盖前者)→ exit 0', () => {
  const rnCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n`
  // @theme 定义 --color-primary,:root 定义 --color-bg,合并后两者都在
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n:root {\n  --color-bg: #000;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 9:边界 —— 两个文件都无 --color-* 变量 → exit 0(0 个受管档)
// ============================================================

// ─── 11. 边界: 两文件均无 --color-* 变量 → exit 0(0 个受管档) ───
test('边界: 两文件均无 --color-* 变量 → exit 0(0 个受管档)', () => {
  const rnCss = `:root {\n  --spacing-sm: 4px;\n}\n`
  const tokensCss = `:root {\n  --spacing-sm: 4px;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `无 --color-* 变量应 exit 0\nstdout: ${r.stdout}`)
    assert.match(
      r.stdout,
      /All 0 个受管档逐位同值且无缺档/,
      `stdout 应含 "0 variables"\nstdout: ${r.stdout}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 10:边界 —— 多个 :root 块(后者覆盖前者)
// ============================================================

// ─── 12. 边界: tokens.css 含多个 :root 块(后者覆盖前者)→ 同步 ───
test('边界: tokens.css 多个 :root 块(后者覆盖)→ 同步 exit 0', () => {
  const rnCss = `:root {\n  --color-primary: #final;\n}\n`
  // 第一个 :root 定义旧值,第二个 :root 覆盖为新值,合并后应取新值
  const tokensCss = `:root {\n  --color-primary: #old;\n}\n:root {\n  --color-primary: #final;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 11:边界 —— mobile-rn 含多个 :root 块(后者覆盖前者)
// ============================================================

// ─── 13. 边界: mobile-rn 多个 :root 块(后者覆盖)→ 用合并值比对 ───
test('边界: mobile-rn 多个 :root 块(后者覆盖)→ 用合并值比对 exit 0', () => {
  // mobile-rn 第一个块旧值,第二个块覆盖;tokens 只有最终值 → 同步
  const rnCss = `:root {\n  --color-x: #old;\n}\n:root {\n  --color-x: #new;\n}\n`
  const tokensCss = `:root {\n  --color-x: #new;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 12:输出格式 —— 通过消息含检查提示 + 变量计数
// ============================================================

// ─── 14. 输出: 默认模式 stdout 含 "Checking" 提示 + 受管档计数 ───
test('输出: 默认模式 stdout 含 "Checking" 提示 + 受管档计数', () => {
  const rnCss = `:root {\n  --color-a: #111;\n}\n.dark {\n  --color-a: #222;\n}\n`
  const tokensCss = `:root {\n  --color-a: #111;\n}\n.dark {\n  --color-a: #222;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.stdout}`)
    // 默认模式应输出检查提示
    assert.match(r.stdout, /Checking/, `stdout 应含 "Checking" 提示\nstdout: ${r.stdout}`)
    // 应输出变量计数(2 = 1 root + 1 dark)
    assert.match(
      r.stdout,
      /All 2 个受管档逐位同值且无缺档/,
      `stdout 应含 "2 variables"\nstdout: ${r.stdout}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 13:边界 —— --quiet 不一致时仍输出错误(stderr 不受抑制)
// ============================================================

// ─── 15. 输出: --quiet 不一致时 stderr 仍输出错误(exit 1) ───
test('输出: --quiet 不一致时 stderr 仍输出错误(exit 1)', () => {
  const rnCss = `:root {\n  --color-x: #aaa;\n}\n`
  const tokensCss = `:root {\n  --color-x: #bbb;\n}\n`
  const dir = createTempEnv(rnCss, tokensCss)
  try {
    const r = runScript(dir, ['--quiet'])
    assert.equal(r.status, 1, `--quiet 不一致应 exit 1\nstderr: ${r.stderr}`)
    // --quiet 抑制 stdout 的 "Checking" 提示
    assert.equal(r.stdout, '', `--quiet 应抑制 stdout,实际: ${r.stdout}`)
    // 但 stderr 仍输出错误
    assert.match(r.stderr, /值漂移/, `stderr 应含"值漂移"\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
