// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { gitBinary, Undetermined } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-rn-global-css-sync.mjs'
import { __test__ as sync } from '../sync-rn-global-css.mjs'

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
// - 取材面(2026-09-26 收口,守门 36/124/93 同口径):默认判 **HEAD blob**;`--staged` 判**索引 blob**;
//   `--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;任一面取不到 ⇒ exit 2 且**不回落**另一个面 ——
//   判的是"这次提交会带走的那一份",而不是"盘上此刻恰好是什么"。
//   (旧形态两个缺陷叠在一起:默认判磁盘 + 索引取不到悄悄回落 HEAD;下面 F 组成对用例把两者钉死不得回来。)
// - 退出码:0 = 一致;1 = 值漂移/缺档;**2 = 无法判定(某个面取不到 / 两面旗同给,既不冒红也不记绿)**
// - CLI 标志:--quiet(抑制通过消息,错误仍走 stderr)/ --staged(索引面)/ --worktree(仅人工)
// ============================================================

// ─── 辅助:创建临时环境(复制脚本 + 写入 fixture + **提交成一个真 git 仓**) ───
// 源脚本基于 import.meta.url 解析 root,所以必须把脚本复制到临时目录,
// 并在 tempDir/apps/mobile-rn/global.css 与
// tempDir/packages/design-tokens/src/styles/tokens.css 放置 fixture。
// 落点按 §26/§15b 唯一制:`scripts/lib/scratch-dir.mjs` 的 mkScratch(与工作树同盘的
// DevEnv/Temp,绝不落 C 盘活 TEMP,也绝不在仓库树里留夹具)。
function createTempEnv(rnCss, tokensCss) {
  const dir = mkScratch('rn-css-sync')
  // 复制源脚本**连同它的相对 import 闭包**到 tempDir/scripts/(不改源脚本,只读复制)。
  // 本脚本 import 了 design-token-blocks / sync-rn-global-css / face-reader 三跳,
  // 只拷一份必然 ERR_MODULE_NOT_FOUND(exit 1、stdout 空)。闭包必须推导,不能手抄清单
  // (见 lib/scratch-module-closure.mjs 头注记录的两次同型事故)。
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
  // 2026-09-26:本门取材面收口为统一口径后,默认面是 **HEAD blob**,所以夹具必须**连提交**
  // —— 只 add 不 commit 的话每条夹具用例都会红在"HEAD 取不到",而那与判据无关(夹具失效,
  // 不是门坏了;miniapp-tokens-sync 夹具同型教训)。三面现场(索引/磁盘各改各的)由 F 组用例
  // 在这个基线上再演化。
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'fixture')
  return dir
}

/**
 * 演练仓里的 git:绝对路径来自取材层(不赌 PATH,§5b);autocrlf 关掉 —— 否则索引 blob
 * 与盘上字节不等,三面比对的夹具会假红(守门 36 镜像测试同口径)。身份用 `-c` 传,不落 config。
 */
function git(cwd, ...args) {
  return execFileSync(
    gitBinary(),
    [
      '-c', 'safe.directory=*',
      '-c', 'core.quotepath=false',
      '-c', 'core.autocrlf=false',
      '-c', 'user.name=gate-fixture',
      '-c', 'user.email=gate-fixture@invalid',
      '-C', cwd,
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true, timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
  )
}

// ─── 辅助:运行复制的脚本 ───
function runScript(tempDir, args = []) {
  const scriptPath = join(tempDir, 'scripts', 'check-rn-global-css-sync.mjs')
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: tempDir,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// ─── 辅助:断言通过(exit 0 + stdout 含"受管档逐位同值且无缺档",并带受管档计数)───
// 2026-09-25:门把英文 "in sync" 换成了中文计数句。断言仍要求**带数字**,
// 这样"扫到 0 档却报绿"那型假绿不会被放宽成通过。
// 2026-09-26:结论行末必须写明取材面 —— 不写面的绿灯报告读不出结论的口径(守门 36 同型)。
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
  assert.match(
    r.stdout,
    /\(取材面:.+\)\n?$/,
    `同步行末必须写明取材面\nstdout: ${r.stdout}`,
  )
}

// ─── 辅助:断言不一致(exit 1 + stderr 含汇总计数行,行末点名取材面)───
function assertMismatch(r) {
  assert.equal(
    r.status,
    1,
    `应 exit 1(不一致),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(
    r.stderr,
    /Found \d+ 处值漂移 \/ \d+ 处缺档\(取材面:/,
    `stderr 末行应含"值漂移/缺档 + 取材面"汇总行\nstderr: ${r.stderr}`,
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
    rmScratch(dir)
  }
})

// ─── 3b. 反假绿/反回落锁:--staged 索引面取不到 ⇒ **exit 2 无法判定**,绝不借 HEAD 那份冒充 ───
// 2026-09-26 收口的关键一格:夹具现在带提交,HEAD **明明还留着这份文件**,旧实现会在索引
// 取不到时悄悄回落读 HEAD 然后 exit 0 —— 把"没判"写成"判过了"(自洽而错位的假绿)。
// 收口后必须显式喊"无法判定";反向对照:同一夹具默认档判 HEAD 照常 exit 0,
// 两面各判各的面、同一瞬间结论不同形,正是"没有回落"的方向性证明。
test('反假绿/反回落: --staged 取不到索引面 → exit 2(HEAD 还留着这份,也不许借)', () => {
  const dir = createTempEnv(
    `:root {\n  --color-primary: #fff;\n}\n`,
    `:root {\n  --color-primary: #fff;\n}\n`,
  )
  try {
    // 把源头从**索引**里摘掉(磁盘与 HEAD 都还在)⇒ 索引面结构性取不到
    git(dir, 'rm', '--cached', '-q', '--', 'packages/design-tokens/src/styles/tokens.css')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 2, `取不到该面应 exit 2,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /无法判定/, `stderr 应说明"无法判定"\nstderr: ${r.stderr}`)
    assert.match(
      r.stderr,
      /索引 取不到 packages\/design-tokens\/src\/styles\/tokens\.css/,
      `必须点名"索引"这一面取不到的是哪个文件\nstderr: ${r.stderr}`,
    )
    // 反向对照:同一夹具的默认档(HEAD 面)不受索引摘除影响,照常绿
    const head = runScript(dir)
    assert.equal(head.status, 0, `HEAD 面不该被索引摘除牵连(两面独立);实际 ${head.status}\n${head.stdout}${head.stderr}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. CLI: --staged 判索引面(这次提交会带走的那一份)→ exit 0 ───
test('CLI: --staged 判索引面 → exit 0 同步消息(结论行点名索引 blob)', () => {
  const dir = createTempEnv(
    `:root {\n  --color-bg: #000;\n}\n`,
    `:root {\n  --color-bg: #000;\n}\n`,
  )
  try {
    const r = runScript(dir, ['--staged'])
    assertPass(r)
    assert.match(
      r.stdout,
      /\(取材面:索引 blob/,
      `--staged 的结论行必须点名索引面\nstdout: ${r.stdout}`,
    )
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ============================================================
// 检查 14+(2026-09-26 取材面收口):成对用例全部在 mkScratch 临时 git 仓里造
// 「HEAD ≠ 索引 ≠ 磁盘」三面互异的现场 —— 证明取材面这类行为**只能用纯函数 + 构造面**,
// 不得依赖真仓瞬时状态(真仓此刻三面同值,拿它取证等于什么都没测)。
// ============================================================

const TOKENS_FACE = `:root {\n  --color-x: #000000;\n}\n`
const RN_HEAD = `:root {\n  --color-x: #000000;\n}\n`
const RN_INDEX = `:root {\n  --color-x: #111111;\n}\n`
const RN_WORKTREE = `:root {\n  --color-x: #222222;\n}\n`
const RN_REL = 'apps/mobile-rn/global.css'

/** 在已提交的干净基线上,把 global.css 演化出三面互异的内容:head=P0, index=P1, worktree=P2。 */
function tamperThreeFaces(dir) {
  const rnAbs = join(dir, RN_REL)
  writeFileSync(rnAbs, RN_INDEX, 'utf8')
  git(dir, 'add', '--', RN_REL)
  writeFileSync(rnAbs, RN_WORKTREE, 'utf8')
  return rnAbs
}

// ─── F1(纯函数,构造面):faceFromArgv 四态 —— "默认档判 HEAD 而非磁盘"的反向锁 ───
// 结论行会被人改,函数不会;只靠跑一次真仓看末行的取证等于没取证。
test('F1 faceFromArgv 默认必须是 head,四态齐全(把默认面改回磁盘的那一刻本条必红)', () => {
  assert.equal(gate.faceFromArgv([]).face, 'head', '默认档回到磁盘 = 本门又在判滞后工作树')
  assert.equal(gate.faceFromArgv(['--staged']).face, 'staged')
  assert.equal(gate.faceFromArgv(['--worktree']).face, 'worktree')
  const both = gate.faceFromArgv(['--staged', '--worktree'])
  assert.equal(both.face, null)
  assert.match(String(both.error), /互斥/)
  assert.ok(
    gate.FACE_TXT.head && gate.FACE_TXT.staged && gate.FACE_TXT.worktree,
    '三面文案都得在位(结论行末必须能写明用的哪个面)'
  )
})

// ─── F2(纯函数 + 临时 git 仓):readFaceInputs 三面各读各的;取不到必抛、不回落 ───
test('F2 readFaceInputs 对同一夹具 head/staged/worktree 三份内容互不相等', () => {
  const dir = createTempEnv(RN_HEAD, TOKENS_FACE)
  try {
    tamperThreeFaces(dir)
    assert.notEqual(RN_INDEX, RN_WORKTREE, '夹具本身必须三面互异,否则下面三条断言两两同真')
    assert.equal(
      gate.readFaceInputs(dir, 'head')[RN_REL],
      RN_HEAD,
      '默认档必须读 HEAD blob —— 不是磁盘(把默认面改回磁盘的那一刻本条必红)'
    )
    assert.equal(
      gate.readFaceInputs(dir, 'staged')[RN_REL],
      RN_INDEX,
      '--staged 必须读索引 blob —— 不是盘上随后那份(盘上随后改对不算修好)'
    )
    assert.equal(gate.readFaceInputs(dir, 'worktree')[RN_REL], RN_WORKTREE, '只有逃生舱档读磁盘')
    // 源与副本必须同面同轮:head 面的 tokens 也取自已提交的 P0 版本
    assert.equal(gate.readFaceInputs(dir, 'head')[sync.TOKENS_SOURCE_REL], TOKENS_FACE)

    // 该面取不到 ⇒ 抛 Undetermined,**不回落**另一个面(回落分支已被删的形状锁见 F5):
    // `-f` 必需 —— 此刻索引(P1)与 HEAD(P0)、磁盘(P2)三者互异,git 默认拒绝摘除这种
    // "staged 内容不同于双方"的项;不加 -f 红在 git,而不是红在门的判据。
    git(dir, 'rm', '--cached', '-q', '-f', '--', RN_REL)
    assert.throws(
      () => gate.readFaceInputs(dir, 'staged'),
      (e) => e instanceof Undetermined && /索引 取不到 apps\/mobile-rn\/global\.css/.test(e.message),
      '回落分支若还活着,这里会安静地返回 HEAD 那份而不是抛 —— "没判"被写成"判过了"'
    )
    // 方向性对照:同一瞬间 HEAD 面照常取得到 ⇒ 两结论异形,证明两把管子彼此独立
    assert.equal(gate.readFaceInputs(dir, 'head')[RN_REL], RN_HEAD)
  } finally {
    rmScratch(dir)
  }
})

// ─── F3(CLI 成对):默认判 HEAD 绿 / --staged 判索引红并点名索引值 / --worktree 点名磁盘值 ───
test('F3 CLI 三面各判各的:盘与索引都漂而 HEAD 干净 ⇒ 默认绿;--staged 红在 #111111 而非 #222222', () => {
  const dir = createTempEnv(RN_HEAD, TOKENS_FACE)
  try {
    tamperThreeFaces(dir)

    const head = runScript(dir)
    assert.equal(
      head.status,
      0,
      `索引/磁盘都漂而 HEAD 没漂,默认档必判绿(判到红 = 默认面又不是 HEAD 了)\n${head.stdout}${head.stderr}`
    )
    assert.match(head.stdout, /All 1 个受管档[\s\S]*\(取材面:HEAD blob/, '绿灯结论行必须写明判的是 HEAD')

    const staged = runScript(dir, ['--staged'])
    assert.equal(staged.status, 1, `索引漂了 --staged 必须红\n${staged.stdout}${staged.stderr}`)
    assert.match(staged.stderr, /#111111/, '必须点名**索引**里那份的实得值')
    assert.doesNotMatch(staged.stderr, /#222222/, '不得把磁盘那份的值混进 --staged 的报告')
    assert.match(staged.stderr, /Found 1 处值漂移 \/ 0 处缺档\(取材面:索引 blob/, '红灯末行也必须写明面')

    const wt = runScript(dir, ['--worktree'])
    assert.equal(wt.status, 1, `磁盘漂了 --worktree 必须红\n${wt.stdout}${wt.stderr}`)
    assert.match(wt.stderr, /#222222/, '逃生舱档点名的必须是磁盘值')
    assert.doesNotMatch(wt.stderr, /#111111/, '磁盘面不得混读索引那份')

    const both = runScript(dir, ['--staged', '--worktree'])
    assert.equal(both.status, 2, '两面旗同给必须判死,不得任选一面冒充另一面')
    assert.match(both.stderr, /互斥/)
  } finally {
    rmScratch(dir)
  }
})

// ─── F4(夹具失效对照):只 add 不 commit ⇒ 默认档(HEAD 面)取不到 ⇒ exit 2,不回落磁盘 ───
// 这条钉的是"HEAD 不存在"这一形态:F2/F3 证明了三面同仓时各读各的,这里证明**没有 HEAD**
// 时门不许悄悄退成磁盘 —— 否则换机/浅克隆/worktree 场景下它会拿半路磁盘内容冒充已入库基线。
test('F4 有仓无提交(HEAD 不存在)⇒ 默认档 exit 2 无法判定(不借磁盘冒绿)', () => {
  const dir = mkScratch('rn-css-sync-nohead')
  try {
    copyScriptWithClosure(SCRIPTS_DIR, 'check-rn-global-css-sync.mjs', join(dir, 'scripts'), [
      'lib/face-reader.mjs',
      'lib/design-token-blocks.mjs',
      'sync-rn-global-css.mjs',
    ])
    mkdirSync(join(dir, 'apps', 'mobile-rn'), { recursive: true })
    writeFileSync(join(dir, 'apps', 'mobile-rn', 'global.css'), RN_HEAD, 'utf8')
    mkdirSync(join(dir, 'packages', 'design-tokens', 'src', 'styles'), { recursive: true })
    writeFileSync(join(dir, 'packages', 'design-tokens', 'src', 'styles', 'tokens.css'), TOKENS_FACE, 'utf8')
    git(dir, 'init', '-q')
    git(dir, 'add', '-A') // 有索引、无 HEAD —— 默认档必须判死,而不是回落索引或磁盘
    const r = runScript(dir)
    assert.equal(r.status, 2, `HEAD 不存在时默认档不许 exit 0/1,实得 ${r.status}\n${r.stdout}${r.stderr}`)
    assert.match(r.stderr, /无法判定/, r.stderr)
    assert.match(r.stderr, /HEAD 取不到/, '必须点名是 HEAD 这一面取不到')
    // 同一夹具 --staged 面照常可判(索引在)⇒ "判死"精确绑定在缺失的那一面,不是整机罢工
    assert.equal(runScript(dir, ['--staged']).status, 0, '索引面完好时 --staged 应绿')
  } finally {
    rmScratch(dir)
  }
})

// ─── F5(形状锁):旧的两个缺陷形态必须从门本体里整段消失(散写回潮由机器发现) ───
test('F5 门本体不得再出现 gitShow 回落管子或磁盘 readFileSync(回落分支已被删的形状锁)', () => {
  const src = readFileSync(join(SCRIPTS_DIR, 'check-rn-global-css-sync.mjs'), 'utf8')
  assert.doesNotMatch(src, /gitShow/, '回落 HEAD 的那把管子又被写回来了(旧缺陷①②的载体)')
  assert.doesNotMatch(src, /===\s*null\s*\?\s*gitShow\(.HEAD:/, '回落分支的原形状不得回来:取不到=判过,是假绿')
  assert.doesNotMatch(src, /readFileSync\(join\(root/, '默认面又被写成读磁盘了(旧缺陷①本体)')
  assert.doesNotMatch(src, /from 'node:fs'/, '门本体不得自带磁盘读取 —— 磁盘面只走层的 readWorktreeFile')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '取材必须走共用层(绝对路径 git/超时/截断都由层兜)')
  assert.match(src, /catBatch/, '源与副本必须一次 batch 同面同轮读完(混面会产出假红/假绿)')
  assert.match(src, /def: 'head'/, '默认档必须钉在 head,不许各写各的')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
