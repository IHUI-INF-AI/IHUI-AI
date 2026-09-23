// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 桌面安装器跨文件几何/集合不变量的注入式回归测试。
// 判"闸门有效"不能只看它对正确输入返回 0 —— 必须逐条注入违规,证明它咬得住具体那一条。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = join(import.meta.dirname, '..', '..')
const SCRIPT = join(ROOT, 'scripts/check-installer-assets.mjs')
const W = join(ROOT, 'apps/desktop/src-tauri/windows')
const GEN = join(ROOT, 'scripts/desktop-installer-assets.mjs')

const ui = readFileSync(join(W, 'ihui-ui.nsi'), 'utf8')
const inst = readFileSync(join(W, 'installer.nsi'), 'utf8')
const gen = readFileSync(GEN, 'utf8')

function withFixtures(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-geo-'))
  const env = {
    ...process.env,
    IHUI_NSI_PATH: join(dir, 'ui.nsi'),
    IHUI_INSTALLER_NSI_PATH: join(dir, 'installer.nsi'),
    IHUI_ASSET_GEN_PATH: join(dir, 'gen.mjs'),
  }
  const base = { 'ui.nsi': ui, 'installer.nsi': inst, 'gen.mjs': gen }
  try {
    for (const [name, content] of Object.entries({ ...base, ...files })) writeFileSync(join(dir, name), content)
    return fn(env)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function runGuard(env) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT], { encoding: 'utf8', env, windowsHide: true, cwd: ROOT })
    return { code: 0, text: out }
  } catch (e) {
    return { code: e.status ?? -1, text: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

test('基线:真实源文件必须全绿', () => {
  const r = withFixtures({}, (env) => runGuard(env))
  assert.equal(r.code, 0, r.text.slice(-600))
})

test('注入违规:CTA 洞外扩 2px(用户报的"方形白边"旧写法)必须被拦', () => {
  const mutated = ui.replace('!insertmacro IHUI_PX $R2 688', '!insertmacro IHUI_PX $R2 686')
  assert.notEqual(mutated, ui, '注入失败:找不到 CTA 洞 left 行')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0)
  assert.match(r.text, /洞与按钮矩形不等大/)
})

test('注入违规:双环环心与百分比控件中心错开必须被拦', () => {
  const mutated = gen.replace('const PCT_CY = 220', 'const PCT_CY = 260')
  assert.notEqual(mutated, gen, '注入失败:找不到 PCT_CY')
  const r = withFixtures({ 'gen.mjs': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0)
  assert.match(r.text, /垂直中心/)
})

test('注入违规:轨道刻度回退到旧集合(与埋点脱钩)必须被拦', () => {
  const mutated = gen.replace('const PB_TICKS = [12, 34, 52, 64, 72, 80, 88, 93, 97]', 'const PB_TICKS = [20, 45, 65, 85, 92]')
  assert.notEqual(mutated, gen, '注入失败:找不到 PB_TICKS')
  const r = withFixtures({ 'gen.mjs': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0)
  assert.match(r.text, /安装埋点集合/)
})

test('注入违规:百分比控件退回 SS_RIGHT(数字会在环里左右漂)必须被拦', () => {
  const mutated = ui.replace('!insertmacro IHUI_TEXTCTL $IHUIPCT ${IHUI_PCT_STYLE}', '!insertmacro IHUI_TEXTCTL $IHUIPCT 0x50000002')
  assert.notEqual(mutated, ui, '注入失败:找不到 IHUIPCT 创建行')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0)
  assert.match(r.text, /SS_CENTER/)
})

// ─── 不变量 D(维护页卡片/指示器几何)的注入回归 ───────────────────
// 这三例各自钉住一个"只读代码看不出来"的失效模式:卡片几何漂移、
// 指示器矩形与位图不等大、以及生成器用符号常量(C_L/C_W)时判据解不开
// 而恒报"缺少"(实测修判据前就是这种假红,修后若无这三例则会变成假绿)。

test('注入违规:重装页卡片 define 与位图烧入框错开必须被拦', () => {
  const mutated = ui.replace('!define IHUI_RCARD_Y1   340', '!define IHUI_RCARD_Y1   350')
  assert.notEqual(mutated, ui, '注入失败:找不到 IHUI_RCARD_Y1')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0)
  assert.match(r.text, /重装页卡片几何漂移/)
})

test('注入违规:重装页指示器矩形与位图尺寸不等大必须被拦', () => {
  const mutated = ui.replace('!define IHUI_RIND_SIZE  20', '!define IHUI_RIND_SIZE  24')
  assert.notEqual(mutated, ui, '注入失败:找不到 IHUI_RIND_SIZE')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0)
  assert.match(r.text, /重装页指示器 \$IHUIRI1 矩形/)
})

test('判据必须能解析生成器的符号常量(RCARD_X = C_L,不是字面量)', () => {
  // 反证:把生成器侧改成与 define 不同的字面量 → 必须报漂移。
  // 若解析器解不开 `= C_L`,这里会误报"缺少可解析的常量"而不是"漂移"。
  const mutated = gen.replace('const RCARD_X = C_L', 'const RCARD_X = 300')
  assert.notEqual(mutated, gen, '注入失败:找不到 const RCARD_X = C_L')
  const r = withFixtures({ 'gen.mjs': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0)
  assert.match(r.text, /重装页卡片几何漂移:IHUI_RCARD_X=288 != 生成器 RCARD_X=300/)
  assert.doesNotMatch(r.text, /缺少可解析的常量 RCARD_X/)
})

// ─── 不变量 F(目录页输入框垂直居中)的注入回归 ─────────────────────
// 这条闸的由来:用户报"安装路径容器内的文字没有居中,下面空了很多",根因是 Win32
// 单行 Edit 顶对齐文字、控件比字行高多出的部分全落在下方。修复 commit 57e4443bd6
// (IHUI_EDIT_H 28→22、IHUI_EDIT_Y 306→309)本身无闸 —— 下面三例逐条证明它会变红。

test('注入违规:目录页输入框退回旧的顶对齐几何(Y=306)必须被拦', () => {
  const mutated = ui.replace('!define IHUI_EDIT_Y     309', '!define IHUI_EDIT_Y     306')
  assert.notEqual(mutated, ui, '注入失败:找不到 !define IHUI_EDIT_Y 309')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /垂直居中/)
  assert.match(r.text, /Y 应为 309,实际 306/)
})

test('注入违规:生成器容器矩形改了而 define 不动必须被拦(证明它在跟位图对账)', () => {
  // 只动位图侧(容器高 36→18),define 保持 309/22 → 垂直居中与"高不超出容器"两条同时红。
  // 若判据只是"define 自比"而不读生成器,这一例必然假绿。
  const mutated = gen.replace('y="302" width="412" height="36"', 'y="302" width="412" height="18"')
  assert.notEqual(mutated, gen, '注入失败:找不到目录页容器 <rect> 的 y/height')
  const r = withFixtures({ 'gen.mjs': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /垂直居中/)
  assert.match(r.text, /输入框高度 22 超出容器高 18/)
})

test('注入违规:目录页输入框宽度顶穿容器右缘必须被拦', () => {
  const mutated = ui.replace('!define IHUI_EDIT_W     384', '!define IHUI_EDIT_W     420')
  assert.notEqual(mutated, ui, '注入失败:找不到 !define IHUI_EDIT_W 384')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /水平越出容器/)
})
// ─── 不变量 G(重装页 DPI 重锚链完整 + 寄存器洁净)的注入回归 ──────────
// 这条闸钉的是"重锚只重摆控件、不重摆窗口几何"这一族失效。取样一律**动态定位**
// (先找分支再改写),不写死存量行 —— 2026-09-23 本文件曾因夹具写死存量条目,
// 存量一变自测就自伤变红。

/** 定位 uiSrc 里"重装页 DPI 重锚分支"并交给 fn 改写(找不到即抛,不让注入静默失效) */
function mutateReanchorBranch(uiSrc, fn) {
  const from = uiSrc.indexOf('${If} $0 != $IHUIDPIW')
  assert.ok(from >= 0, '注入失败:找不到重装页 DPI 重锚分支判定行')
  const stop = uiSrc.indexOf('${EndIf}', from)
  assert.ok(stop > from, '注入失败:重锚分支没有配平的 ${EndIf}')
  return uiSrc.slice(0, from) + fn(uiSrc.slice(from, stop)) + uiSrc.slice(stop)
}

test('注入违规:重锚分支丢掉裁剪区域重算(窗口框跟了、region 仍按旧档硬裁)必须被拦', () => {
  const mutated = mutateReanchorBranch(ui, (branch) => {
    const next = branch.replace(/!insertmacro IHUI_WINDOW_RGN[^\n]*\n/, '')
    assert.notEqual(next, branch, '注入失败:重锚分支里没有 !insertmacro IHUI_WINDOW_RGN')
    return next
  })
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /重锚分支缺 !insertmacro IHUI_WINDOW_RGN/)
})

test('注入违规:重锚分支退回只定档不定窗(旧敞口原样)必须被拦', () => {
  const mutated = mutateReanchorBranch(ui, (branch) => {
    const next = branch.replace(/!insertmacro IHUI_GUIINIT_SIZE[^\n]*\n/, '')
    assert.notEqual(next, branch, '注入失败:重锚分支里没有 !insertmacro IHUI_GUIINIT_SIZE')
    return next
  })
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /重锚分支缺 !insertmacro IHUI_GUIINIT_SIZE/)
})

test('注入违规:圆角宏的临时量挪回 $R0(会把 PageReinstall 的版本比较结果清掉)必须被拦', () => {
  const mutated = ui.replace(/!macro IHUI_WINDOW_RGN([\s\S]*?)!macroend/, (m, body) =>
    m.replace(body, body.replace(/\.R6/g, '.R0').replace(/p R6/g, 'p R0').replace(/\$R6/g, '$R0')),
  )
  assert.match(mutated, /!macro IHUI_WINDOW_RGN[\s\S]*?\.R0/, '注入失败:圆角宏里找不到 .R6 输出')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /当临时量/)
})

test('注入违规:installer.nsi 里主题宏不再被 PageReinstall 插入(整条链静默消失)必须被拦', () => {
  const mutated = inst.replace(/^\s*!insertmacro IHUI_REINSTALLTHEME\s*$/m, '; (被删)')
  assert.notEqual(mutated, inst, '注入失败:找不到 IHUI_REINSTALLTHEME 的插入行')
  const r = withFixtures({ 'installer.nsi': mutated }, (env) => runGuard(env))
  assert.notEqual(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /未插入 IHUI_REINSTALLTHEME/)
})

test('不误伤:与重锚链无关的真实改动(改顶档 DPI 阈值 + 分支内加注释)必须仍全绿', () => {
  // 反证上一族假红:动 !define 值、在重锚分支里加注释,都不该让 G 变红。
  const cap = ui.match(/^\s*!define\s+IHUI_DPI_CAP\s+(\d+)/m)
  assert.ok(cap, '夹具失效:找不到 !define IHUI_DPI_CAP')
  const other = cap[1] === '96' ? '120' : '96'
  let mutated = ui.replace(/^(\s*)!define\s+IHUI_DPI_CAP\s+\d+/m, `$1!define IHUI_DPI_CAP ${other}`)
  assert.notEqual(mutated, ui, '夹具失效:顶档阈值改写未生效')
  mutated = mutateReanchorBranch(mutated, (branch) => branch + '  ; 只加一条注释,几何链一字未动\n')
  const r = withFixtures({ 'ui.nsi': mutated }, (env) => runGuard(env))
  assert.equal(r.code, 0, r.text.slice(-600))
  assert.match(r.text, /七条跨文件不变量成立/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
