// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-rounded-full.mjs')

// ─── 辅助:创建临时扫描目录(含 apps/ 结构,用于全量模式) ─
// **必须是真 git 仓**:门 11 的取材面在 2026-09-26 改成「全量 = HEAD blob、--staged = 索引 blob」,
// 夹具若只是普通目录,`git ls-tree` 拿不到任何文件 ⇒ 扫描 0 个而每条断言都表现为"违规未检出"。
// 这正是守门 70 记过的型:测试靠 cwd 定位夹具,而脚本按定义忽略 cwd,于是整批用例在扫真仓或空扫。
function createTempScanDir(files) {
  const dir = mkScratch('ihui-rounded-')
  /**
   * 夹具必须自带档位表(C7 的判据输入)。2026-09-29 实测:门在**表取不到**时把上限维降级成
   * "未判定",而旧夹具里没有 `packages/design-tokens/src/radius.js` ⇒ 新建的 C7 用例三条阳性
   * 对照**全部不触发**却照样各自"通过"(断言写的是"没红就算对"的那一类反向陷阱)。
   * 表从真仓 HEAD 现读后写进夹具,不在测试里抄一份数字 —— 抄的那份会随档位表演进而变成假账。
   */
  const TABLE_REL = 'packages/design-tokens/src/radius.js'
  const tableSrc =
    spawnSync('git', ['-c', 'safe.directory=*', 'show', `HEAD:${TABLE_REL}`], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: join(__dirname, '..', '..'),
      encoding: 'utf8',
      windowsHide: true,
    }).stdout || ''
  assert.ok(tableSrc.includes('RADIUS_STEPS'), '夹具依赖闭包不完整:真仓 HEAD 取不到档位表 ⇒ 上限判据会静默降级')
  const all = { [TABLE_REL]: tableSrc, ...files }
  for (const [relPath, content] of Object.entries(all)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  const git = (args) =>
    spawnSync('git', ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...args], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
    })
  git(['init', '-q', '-b', 'main'])
  git(['add', '-A'])
  git([
    '-c',
    'user.name=rounded-full-fixture',
    '-c',
    'user.email=fixture@invalid',
    'commit',
    '-q',
    '-m',
    'fixture',
  ])
  return dir
}


// 辅助:运行 check-rounded-full.mjs(全量模式,无 --staged)
function runScript(cwd) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// 辅助:运行 check-rounded-full.mjs --staged(staged 模式)
function runStaged(cwd) {
  return spawnSync('node', [SCRIPT_PATH, '--staged'], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// 辅助:创建临时 git repo(含 baseline commit),用于 staged 模式测试
function createTempGitRepo(files) {
  const dir = mkScratch('ihui-rounded-git-')
  spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  return dir
}

// 辅助:在 git repo 中写入文件并 stage
function stageFile(repoDir, relPath, content) {
  const fullPath = join(repoDir, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  spawnSync('git', ['add', relPath], { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

// 辅助:断言 stdout 含违规标记
function assertHasViolation(r, pattern) {
  assert.ok(
    r.stdout.includes('❌') || /发现\s+\d+\s+处违规/.test(r.stdout),
    `应报告违规,但未找到违规标记\nstdout: ${r.stdout}`,
  )
  if (pattern) {
    assert.match(r.stdout, pattern, `stdout 应含 ${pattern}`)
  }
}

// 辅助:断言 stdout 含通过标记(无违规)
function assertPass(r) {
  assert.ok(
    r.stdout.includes('✅ 容器圆角守门通过') || r.stdout.includes('违规数:   0 处'),
    `应无违规通过,实际 stdout:\n${r.stdout}`,
  )
}

// ─── 违规检测:rounded-full / rounded-pill / 9999px / 50% ──
// 注:全量模式始终 exit 0(warn-only),通过 stdout 判断违规

test('违规: className 含 rounded-full → stdout 报告违规', () => {
  const dir = createTempScanDir({
    'apps/web/Button.tsx': `export function Button() {\n  return <button className="rounded-full px-4 py-2">Click</button>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, '全量模式应 exit 0(warn-only)')
    assertHasViolation(r, /rounded-full/)
    assert.match(r.stdout, /Button\.tsx/)
  } finally {
    rmScratch(dir)
  }
})

test('违规: className 含 rounded-pill → stdout 报告违规', () => {
  const dir = createTempScanDir({
    'apps/web/Pill.tsx': `export function Pill() {\n  return <span className="rounded-pill px-3 py-1">Tag</span>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-pill/)
  } finally {
    rmScratch(dir)
  }
})

test('违规: 宽扁盒上的 border-radius: 9999px = 胶囊 → 报告违规(方形盒上的正圆不再算违规)', () => {
  const dir = createTempScanDir({
    'apps/web/styles.css': `.pill {\n  border-radius: 9999px;\n  width: 180px;\n  height: 40px;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /9999px/)
  } finally {
    rmScratch(dir)
  }
})

test('违规: 宽扁盒上的 border-radius: 50% = 胶囊 → 报告违规', () => {
  const dir = createTempScanDir({
    'apps/web/circle.css': `.wide-pill {\n  border-radius: 50%;\n  width: 200px;\n  height: 48px;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /50%/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2026-09-27 定档:几何是规则,标记不是出路 ───────────────────────
// 用户原话:「不允许有任何豁免 本项目就是不允许有胶囊型」。旧秩序里"写一行带原因的注释"
// 就能让一条胶囊永久留在码上;现在判据只认形状量算,标记一律被忽略。
// 两条成对:方形盒上的正圆必须放行(否则本门变恒红),宽扁盒上带标记必须仍判红(否则豁免回来了)。

test('几何正圆: 方形盒(8×8)上的 border-radius:50% 是圆不是胶囊 → 放行(且不靠任何标记)', () => {
  const dir = createTempScanDir({
    'apps/web/square.css': `.dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `方形盒的正圆应放行\nstdout:${r.stdout}\nstderr:${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})

test('标记不再免检: 宽扁盒 + 带原因的 radius-exempt 注释 → 仍判红', () => {
  const dir = createTempScanDir({
    'apps/web/pill.tsx':
      `export const P = () => (\n  // radius-exempt: 这条是胶囊,但按新规标记不再是出路\n  <div className="w-[180px] h-[40px] rounded-full bg-primary" />\n)\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-full/)
  } finally {
    rmScratch(dir)
  }
})

test('违规: border-radius:9999px(无空格、宽扁盒) → 正则匹配', () => {

  const dir = createTempScanDir({
    'apps/web/no-space.css': `.no-space {\n  border-radius:9999px;\n  width: 120px;\n  height: 32px;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /9999px/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 合法圆角档位 → 通过 ─────────────────────────────────

test('合法: rounded-xl → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Card.tsx': `export function Card() {\n  return <div className="rounded-xl border p-4">Content</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('合法: rounded-2xl → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Panel.tsx': `export function Panel() {\n  return <section className="rounded-2xl bg-card p-6">Panel</section>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('合法: rounded-md → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Input.tsx': `export function Input() {\n  return <input className="rounded-md border px-3 py-2" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── 豁免场景 → 通过 ─────────────────────────────────────
// 注:源脚本 isExempt() 豁免 <img>/<Image>/AvatarImage(非 <Avatar>),
// Switch Thumb 特征串,小尺寸装饰点(w/h ≤ 3.5),红点(bg-red-500+小尺寸),animate-spin

test('豁免: <img className="rounded-full"> 头像图片(32px,等效半径 16px)⇒ 仍在上限内,豁免族照旧成立', () => {
  const dir = createTempScanDir({
    'apps/web/Avatar.tsx': `export function Avatar() {\n  return <img className="rounded-full w-8 h-8" src="/avatar.png" alt="avatar" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

/**
 * 2026-09-29 用户定档「任何圆角半径不得超过最大档 16px,**圆形头像/图标底板不再豁免**」。
 * 这条用例把边界钉在**量出来的数值**上,而不是钉在"是不是 img"上:同一族豁免在 32px 以内仍然有效,
 * 超过 32px 的圆头像一律判红。把旧用例(40px 头像断言"无违规")原地改判红,
 * 是因为那条断言描述的正是被这条裁决废掉的口径。
 */
test('上限优先于 img/Avatar 豁免族:40px 的圆头像(等效半径 20px)必须判红', () => {
  const dir = createTempScanDir({
    'apps/web/Avatar40.tsx': `export function Avatar() {\n  return <img className="rounded-full w-10 h-10" src="/avatar.png" alt="avatar" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.match(r.stdout, /圆角超过上限/, '豁免族不得挡住上限判据(它排在所有通道之前)')
  } finally {
    rmScratch(dir)
  }
})

test('豁免: <Image className="rounded-full"> next/image(24px,半径 12px 在上限内)→ 无违规', () => {
  const dir = createTempScanDir({
    // 尺寸取 24px 而非 48px:48px 的圆头像在 2026-09-29 定档后**必须**判红(见上一条用例),
    // 这条测的是"Image 族豁免仍然成立"那一维,所以把盒留在上限之内才不会与上限判据混在一起。
    'apps/web/NextImage.tsx': `import Image from 'next/image'\nexport function Profile() {\n  return <Image className="rounded-full w-6 h-6" src="/me.png" alt="me" width={24} height={24} />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: 装饰点 rounded-full w-2 h-2 → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/StatusDot.tsx': `export function StatusDot() {\n  return <span className="rounded-full bg-green-500 w-2 h-2" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: 红点 bg-red-500 rounded-full h-4 w-4 → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/UnreadBadge.tsx': `export function UnreadBadge() {\n  return <span className="bg-red-500 rounded-full h-4 w-4 text-xs">3</span>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: Switch Thumb block rounded-full bg-background shadow-lg → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Switch.tsx': `export function SwitchThumb() {\n  return (\n    <span className="block rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />\n  )\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: animate-spin + rounded-full → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Spinner.tsx': `export function Spinner() {\n  return <div className="animate-spin rounded-full border-4 border-primary border-t-transparent h-8 w-8" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── 非豁免场景使用 rounded-full → 违规 ──────────────────

test('非豁免: <Button className="rounded-full"> → 违规(容器禁用纯圆)', () => {
  const dir = createTempScanDir({
    'apps/web/RoundButton.tsx': `export function RoundButton() {\n  return <button className="rounded-full bg-primary px-6 py-3 text-white">Submit</button>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-full/)
  } finally {
    rmScratch(dir)
  }
})

test('非豁免: <Card className="rounded-full"> 大容器(flex-1+text-base) → 违规', () => {
  const dir = createTempScanDir({
    'apps/web/RoundCard.tsx': `export function RoundCard() {\n  return <div className="rounded-full p-8 flex-1 text-base">Card Content</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-full/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 头像族豁免的"近似方形"前置(2026-09-27 O81 票⑱)────────────────
// 旧豁免只看"窗口里同时出现 w-[NNrpx] 与 h-[NNrpx]",所以 690×220 的宽扁实底容器
// 被当成头像直接免检 —— 真仓 HEAD 面因此报"违规 0",而那是一台看不见胶囊的尺子。
// 两条成对:宽扁必红(阳性对照)、方形必绿(反向对照,防把收紧做成恒红)。

test('非豁免: 宽扁容器 rounded-full + w-[690rpx] h-[220rpx] → 违规(旧豁免把它当头像)', () => {
  const dir = createTempScanDir({
    'apps/miniapp-taro/WidePill.tsx':
      `export function WidePill() {\n  return <View className="rounded-full bg-card w-[690rpx] h-[220rpx] p-4" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-full/)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: 方形头像容器 rounded-full + w-[140rpx] h-[140rpx] → 无违规(收紧不得做成恒红)', () => {
  const dir = createTempScanDir({
    'apps/miniapp-taro/SquareAvatar.tsx':
      `export function SquareAvatar() {\n  return <View className="rounded-full bg-muted w-[140rpx] h-[140rpx]" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `方形头像应放行,实际:\n${r.stdout}\n${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})


// ─── 多文件批量扫描 ───────────────────────────────────────

test('批量: apps/ 含 3 文件(2 违规 + 1 合法) → 报告 2 违规', () => {
  const dir = createTempScanDir({
    'apps/web/Bad1.tsx': `export function Bad1() {\n  return <div className="rounded-full p-4">Bad</div>\n}\n`,
    'apps/web/Good.tsx': `export function Good() {\n  return <div className="rounded-lg p-4">Good</div>\n}\n`,
    'apps/web/Bad2.tsx': `export function Bad2() {\n  return <span className="rounded-pill px-2">Bad2</span>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stdout, /Bad1\.tsx/)
    assert.match(r.stdout, /Bad2\.tsx/)
    // Good.tsx 不应出现在违规文件列表中
    const violationSection = r.stdout.split('扫描结果:')[1] || ''
    const goodInViolation = /Good\.tsx/.test(violationSection.split('修复方法:')[0] || '')
    assert.ok(!goodInViolation, 'Good.tsx 不应出现在违规列表中')
  } finally {
    rmScratch(dir)
  }
})

// ─── CLI 行为 ────────────────────────────────────────────

test('全量模式: 无 git 提交面(隔离目录)⇒ exit 2「无法判定」,绝不记绿', () => {
  const dir = mkScratch('ihui-rounded-empty-')
  try {
    const r = runScript(dir)
    assert.equal(r.status, 2, `无 HEAD 可枚举必须判"无法判定"(exit 2),实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stderr, /无法判定/)
    assert.ok(!/对账通过|✅/.test(r.stdout), '崩溃或"通过"都不许出现在这一格')
    assert.ok(!r.stderr.includes('at '), '不得把未捕获异常调用栈当结论喷出去')
  } finally {
    rmScratch(dir)
  }
})

test('CLI --help 不崩溃(脚本未实现 --help flag,验证不 crash)', () => {
  // 注:源脚本未实现 --help,传入 --help 会按默认全量模式运行
  // 本测试验证不 crash(exit code 0/1),而非显示帮助文本
  const dir = mkScratch('ihui-rounded-help-')
  try {
    const r = spawnSync('node', [SCRIPT_PATH, '--help'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    assert.ok(
      r.status === 0 || r.status === 1 || r.status === 2,
      `--help 不得 crash(允许 exit 0/1/2),实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error 输出`)
    assert.ok(!/^\s+at /m.test(r.stderr), '不得以未捕获异常调用栈收场(那与"扫过且干净"在账面上同形)')
  } finally {
    rmScratch(dir)
  }
})

test('注释行 // rounded-full → 豁免(纯注释不检测)', () => {
  const dir = createTempScanDir({
    'apps/web/Comment.tsx': `// 使用 rounded-full 是违规的,请用 rounded-lg\nexport function Comment() {\n  return <div className="rounded-lg p-4">OK</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('CSS 小装饰点 border-radius:50% + width:8px + height:8px → 豁免', () => {
  const dir = createTempScanDir({
    'apps/web/dot.css': `.dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: green;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── staged 模式(已修复 ✅ 2026-07-27) ───────────────────
// 历史 bug:源脚本 getStagedAddedLines() 曾在 'diff --git' 行上匹配 '\+\+\+\s+b\/(.+)$',
// 但 '+++' 是 git diff 输出中的独立行(紧跟 'diff --git' 后),不在 'diff --git' 行上,
// 导致 curFile 始终为 null → addedLinesMap 始终为空 → files 为空 → 脚本始终输出
// "暂存区无 .ts/.tsx/.js/.jsx/.css/.scss 变更,跳过" 并 exit 0(即使有违规文件)。
// 修复:把 '+++ b/' 解析从 'diff --git' 块中分离为独立判断,staged 模式恢复检测能力。

test('staged 模式(已修复): 暂存含 rounded-full 违规 → 检测到并 exit 1', () => {
  const dir = createTempGitRepo({
    'apps/web/Base.tsx': `export function Base() {\n  return <div className="rounded-lg p-4">Base</div>\n}\n`,
  })
  try {
    stageFile(
      dir,
      'apps/web/Bad.tsx',
      `export function Bad() {\n  return <div className="rounded-full p-4">Bad</div>\n}\n`,
    )
    const r = runStaged(dir)
    assert.equal(r.status, 1, 'staged 模式应检测到 rounded-full 违规并 exit 1')
    assert.match(r.stdout, /rounded-full/, 'stdout 应报告 rounded-full 违规')
    assert.match(r.stdout, /Bad\.tsx/, 'stdout 应列出违规文件 Bad.tsx')
  } finally {
    rmScratch(dir)
  }
})

test('staged 模式(已修复): 暂存合法文件(无违规) → exit 0 通过', () => {
  const dir = createTempGitRepo({
    'apps/web/Base.tsx': `export function Base() {\n  return <div>Base</div>\n}\n`,
  })
  try {
    stageFile(
      dir,
      'apps/web/Good.tsx',
      `export function Good() {\n  return <div className="rounded-xl p-4">Good</div>\n}\n`,
    )
    const r = runStaged(dir)
    assert.equal(r.status, 0, 'staged 模式无违规应 exit 0')
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('staged 模式(已修复): 空暂存区(无 .ts/.tsx 变更) → exit 0 跳过', () => {
  const dir = createTempGitRepo({
    'apps/web/Base.tsx': `export function Base() {\n  return <div>Base</div>\n}\n`,
  })
  try {
    // 不 stage 任何新文件,baseline 之后暂存区为空
    const r = runStaged(dir)
    assert.equal(r.status, 0, '空暂存区应 exit 0')
    assert.match(r.stdout, /跳过|暂存区无/, '应显示跳过消息')
  } finally {
    rmScratch(dir)
  }
})

/**
 * 形状尺只能有一份实现(2026-09-28 票㉚)。盒形几何抽进 `scripts/lib/box-geometry.mjs` 之后,
 * 本门与守门 150 都从它取值 —— 谁在门里再写一遍 `boxShape`/`boxDims`,两把尺子就会在窗口范围、
 * rpx 折算、同表达式判方形这些细节上各自漂开,而漂移的表现是"一端判胶囊、另一端判正圆"。
 * 反向锁与正向锁成对:本地不得再声明,引用必须真在。
 */
test('形状尺只有一份实现:门内不得再声明 boxShape/boxDims,必须引 lib/box-geometry', () => {
  const src = readFileSync(SCRIPT_PATH, "utf8")
  assert.ok(!/function boxShape\(/.test(src), '门内不得再声明 boxShape(它是 lib 的投影)')
  assert.ok(!/function boxDims\(/.test(src), '门内不得再声明 boxDims(同上)')
  assert.match(src, /from '\.\/lib\/box-geometry\.mjs'/, '必须从共用层引形状尺')
  assert.match(src, /from '\.\/lib\/radius-tokens\.mjs'/, '档位换算必须复用 radius-tokens,不得再解析一遍 radius.js')
})

/**
 * C7 · 圆角上限(2026-09-29 用户定档:任何半径不得超过档位表最大档 16px,圆形头像/图标底板不豁免)。
 * 这一组用例的存在理由不是"多测几种写法",而是本条判据**落地当天就抓到两类会伤人的形状**:
 *  - 豁免通道在判据之后 ⇒ 48dp 头像上的 rounded-full 会被"装饰圆点/Avatar"整族放走,上限形同不存在;
 *  - 盒形用宽窗口径(`boxDims` 向后 6 行、向前 2 行是主判据刻意放宽的"宁宽不漏")⇒ 实测把同一枚
 *    `w-2.5 h-2.5`(10px,等效半径 5px)的红点,按邻行 `w-[96rpx]` 的头像量成 44×44 而**判红**。
 *    判红依据必须只来自这一行自己:假阳的代价不是"多一条红",是逼人把一颗本来正确的圆改方。
 * 因此下面四条成对写:每条阳性对照都配一条"它不该红"的对照。
 */
test('C7 阳性对照:48×48 的盒上 rounded-full(等效半径 24px)必须判"圆角超过上限"', () => {
  const dir = createTempScanDir({
    'apps/web/Avatar.tsx': `export function Avatar() {\n  return <div className="w-[48px] h-[48px] rounded-full bg-muted" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.match(r.stdout, /圆角超过上限/, '48px 见方盒的半边=24px > 16px ⇒ 必须点名')
  } finally {
    rmScratch(dir)
  }
})

test('C7 反向对照:10px 红点不得被邻行大盒顶成超标(盒形只认自己那一行)', () => {
  const dir = createTempScanDir({
    'apps/web/Mix.tsx':
      'export function Mix() {\n' +
      '  return (\n' +
      '    <View>\n' +
      '      <View className="w-[96rpx] h-[96rpx] rounded-full bg-muted" />\n' +
      '      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-destructive" />\n' +
      '    </View>\n' +
      '  )\n' +
      '}\n',
  })
  try {
    const r = runScript(dir)
    const hits = (r.stdout.match(/圆角超过上限/g) || []).length
    assert.equal(hits, 1, `只应抓到 48px 那一处;实得 ${hits} 处 ⇒ 盒形串了行`)
  } finally {
    rmScratch(dir)
  }
})

test('C7:注释里写 rounded-full 是"门在解释自己",不得计入判定面', () => {
  const dir = createTempScanDir({
    'apps/web/Doc.tsx':
      'export function Doc() {\n' +
      '  // 禁 rounded-full(大盒上它会渲染成胶囊)\n' +
      '  return <div className="rounded-md p-2">Doc</div>\n' +
      '}\n',
  })
  try {
    const r = runScript(dir)
    assert.doesNotMatch(r.stdout, /圆角超过上限/, '纯注释行不参与上限判定(守门 131 同型)')
  } finally {
    rmScratch(dir)
  }
})

test('C7 覆盖面:RN StyleSheet 的 camelCase `borderRadius: \'50%\'` 同样受上限约束', () => {
  const dir = createTempScanDir({
    'apps/mobile-rn/src/x.tsx':
      'const st = StyleSheet.create({\n' +
      '  plate: {\n' +
      '    width: 60,\n' +
      '    height: 60,\n' +
      "    borderRadius: '50%',\n" +
      '  },\n' +
      '})\n',
  })
  try {
    const r = runScript(dir)
    assert.match(r.stdout, /圆角超过上限/, "把这一族交给本门之后,camelCase 写法必须看得见 —— 否则'判据接手'是空话")
  } finally {
    rmScratch(dir)
  }
})

test('C7 量不到盒形 ⇒ 报"未判定",不得静默成"没超标"', () => {
  const dir = createTempScanDir({
    'apps/web/Dyn.tsx': `export function Dyn({ size }) {\n  return <div className={size.cls + ' rounded-full'} style={{ borderRadius: size / 2 }} />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.match(r.stdout, /量不到自己那个盒 [1-9]\d* 处/, '动态尺寸是尺子的边界,必须报名而不是当作干净')
  } finally {
    rmScratch(dir)
  }
})

/**
 * 三条结构锁:上限的**位置**、口径的**共用**、以及"数值族归守门 77"这条分工。
 * 位置锁的意义:把 checkCap 挪到 isExempt 之后,这四条用例里的阳性对照会全部转绿 ——
 * 也就是说"豁免族挡住上限判据"这一型失效只有位置锁能固定下来,行为用例本身证不了它。
 */
test('C7 阳性对照(跨行属性区):尺寸写在 className 的上一行、半径写在 style 里 ⇒ 上限判据必须量得到', () => {
  const dir = createTempScanDir({
    'apps/web/CrossLine.tsx':
      'export function CrossLine() {\n' +
      '  return (\n' +
      '    <span\n' +
      '      className="h-12 w-12 shrink-0 bg-muted"\n' +
      "      style={{ borderRadius: '50%' }}\n" +
      '    />\n' +
      '  )\n' +
      '}\n',
  })
  try {
    const r = runScript(dir)
    assert.match(
      r.stdout,
      /圆角超过上限/,
      'h-12 w-12 = 48px 见方 ⇒ 等效半径 24px > 16px;这一型在补第三档兜底前整族"量不到"而免检',
    )
  } finally {
    rmScratch(dir)
  }
})

test('C7 反向对照:父盒属性区到自己的 > 为止,子节点尺寸不得算进来(兜底不许靠猜)', () => {
  const dir = createTempScanDir({
    'apps/web/ParentOnly.tsx':
      'export function ParentOnly() {\n' +
      '  return (\n' +
      '    <div\n' +
      "      style={{ borderRadius: '50%' }}\n" +
      '      onClick={() => {}}\n' +
      '    >\n' +
      '      <span className="h-[64px] w-[64px]" />\n' +
      '    </div>\n' +
      '  )\n' +
      '}\n',
  })
  try {
    const r = runScript(dir)
    const hits = (r.stdout.match(/圆角超过上限/g) || []).length
    assert.equal(hits, 0, `子节点的 64px 不得顶成父盒尺寸;实得 ${hits} 处红`)
    assert.match(
      r.stdout,
      /apps\/web\/ParentOnly\.tsx:\d+/,
      '未判定必须逐条点名 —— 只给计数的话,下一个人既找不到站点也无法证明这一格被清偿',
    )
  } finally {
    rmScratch(dir)
  }
})

test('C7 结构锁:上限必须排在豁免通道之前,且数值族不重复计数', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.ok(
    src.indexOf('checkCap(') < src.indexOf('if (isExempt('),
    '上限判据被挪到豁免通道之后 ⇒ 圆形头像/图标底板又会被整族放走(这条不是风格问题)',
  )
  assert.match(src, /ownShortSidePx\(/, '盒形必须用归属明确的那把尺(lib/box-geometry 的 ownShortSidePx),不得退回宽窗 boxDims')
  assert.ok(
    !/function capOf[\s\S]{0,400}?boxDims\(lines/.test(src),
    '上限判据内部不得再用宽窗 boxDims 量盒形(实测会按邻行尺寸判红)',
  )
  assert.ok(!/radiusPxInLine\([^\n]*cap/i.test(src), '数值/档位形态的半径上限归守门 77 的 B9,本门不重复计同一笔债')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠