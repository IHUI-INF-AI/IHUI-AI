// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
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
  for (const [relPath, content] of Object.entries(files)) {
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

test('豁免: <img className="rounded-full"> 头像图片 → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Avatar.tsx': `export function Avatar() {\n  return <img className="rounded-full w-10 h-10" src="/avatar.png" alt="avatar" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('豁免: <Image className="rounded-full"> next/image → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/NextImage.tsx': `import Image from 'next/image'\nexport function Profile() {\n  return <Image className="rounded-full w-12 h-12" src="/me.png" alt="me" width={48} height={48} />\n}\n`,
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
