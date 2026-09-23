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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
