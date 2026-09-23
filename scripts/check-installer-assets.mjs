#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安装器品牌资产「引用 ↔ 打包 ↔ 落盘」三方对账守门(blocking)
 *
 * 为什么需要(2026-09-20 真实事故):
 *   新增「最小化」按钮时,ihui-ui.nsi 里加了
 *     !insertmacro IHUI_BTN $IHUIMIN btn-min.bmp 776 20 36 36 IHUIOnMin
 *   但 IHUI_EXTRACTPAGESETS_SET 的 File 清单**漏登记** btn-min.bmp →
 *   $PLUGINSDIR 里根本没有该文件 → LoadImage 返回 0 → STM_SETIMAGE 贴空位图 →
 *   **最小化按钮肉眼不可见**(用户报「最小化按钮没显示」)。编译零报错、语法全对,
 *   只有真机跑起来才暴露 —— 属于典型的「静默失败」,必须由门禁兜住。
 *
 * 三方口径:
 *   ① 引用 refs      : nsi 里被真正加载的位图名(IHUI_BTN / IHUI_PAGEBG /
 *                      IHUI_INST_OVERLAY 宏实参,以及 $PLUGINSDIR\X.bmp 形式的 LoadImage)
 *   ② 打包 packed    : File "/oname=$PLUGINSDIR\X.bmp" 清单
 *   ③ 落盘 onDisk    : apps/desktop/src-tauri/windows/installer-assets/assets-<tier>/X.bmp
 *
 * 三条判定(任一不通过即 exit 1):
 *   A. refs ⊆ packed        —— 引用了但没打包 = 运行期控件空白
 *   B. packed ⊆ onDisk(5 档) —— 打包了但某档位缺文件 = 该 DPI 档位下控件空白
 *                              (File 行按 `${LIT}` 展开成 5 档,缺一档就在那一档炸)
 *   C. refs 非空            —— 解析失灵自我保护(正则被改坏时不至于"零命中即通过")
 *
 * 用法: node scripts/check-installer-assets.mjs
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// IHUI_NSI_PATH 仅用于门禁自测(喂一份「故意缺 File 行」的副本,验证拦截有效)
const NSI = process.env.IHUI_NSI_PATH || join(ROOT, 'apps/desktop/src-tauri/windows/ihui-ui.nsi')
const ASSET_ROOT = join(ROOT, 'apps/desktop/src-tauri/windows/installer-assets')
const TIERS = ['100', '125', '150', '175', '200']

if (!existsSync(NSI)) {
  console.error(`[check-installer-assets] 找不到 ${NSI}`)
  process.exit(1)
}
const src =
  readFileSync(NSI, 'utf8') +
  // 卸载器主题独立成文件(2026-09-22),它同样 File 打包资产 —— 不并入扫描面,
  // 新增的 unconfirm/uninstfiles 会永远被误报「未被打包」,而真正漏登记也报不出来。
  // 自测模式(IHUI_NSI_PATH 喂故意残缺的副本)不并入,保持判据单一。
  (process.env.IHUI_NSI_PATH
    ? ''
    : existsSync(join(ROOT, 'apps/desktop/src-tauri/windows/ihui-uninstaller.nsi'))
      ? readFileSync(join(ROOT, 'apps/desktop/src-tauri/windows/ihui-uninstaller.nsi'), 'utf8')
      : '')

/** @returns {Set<string>} */
function collect(re) {
  const out = new Set()
  for (const m of src.matchAll(re)) out.add(m[1])
  return out
}

function readdirSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

// ---- ① 引用:宏实参 + 裸 LoadImage ----
const refs = new Set([
  ...collect(/!insertmacro\s+IHUI_BTN\s+\$\S+\s+([\w.-]+\.bmp)/g),
  ...collect(/!insertmacro\s+IHUI_PAGEBG\s+([\w.-]+\.bmp)/g),
  ...collect(/!insertmacro\s+IHUI_INST_OVERLAY\s+\$\S+\s+([\w.-]+\.bmp)/g),
  ...collect(/LoadImage\([^)]*`\$PLUGINSDIR\\([\w.-]+\.bmp)`/g),
])

// ---- ② 打包:File "/oname=$PLUGINSDIR\X.bmp" ----
const packed = collect(/File\s+"\/oname=\$PLUGINSDIR\\([\w.-]+\.bmp)"/g)

const fail = []
const warn = []

// C. 自我保护:解析为零命中说明正则/文件结构变了,不能静默通过
if (refs.size === 0) {
  fail.push('解析到 0 个品牌位图引用 —— 正则或 ihui-ui.nsi 结构已变,门禁失效,拒绝放行')
}
if (packed.size === 0) {
  fail.push('解析到 0 条 File 打包记录 —— 正则或 ihui-ui.nsi 结构已变,门禁失效,拒绝放行')
}

// A. 引用 ⊆ 打包
for (const name of [...refs].sort()) {
  if (!packed.has(name)) {
    fail.push(
      `引用了但未打包: ${name}\n` +
        `      → 缺一行: File "/oname=$PLUGINSDIR\\${name}" "\${IHUI_ASSETROOT}\\assets-\${LIT}\\${name}"\n` +
        `        须加在 !macro IHUI_EXTRACTPAGESETS_SET 内(与 btn-close.bmp 同处)`,
    )
  }
}

// B. 打包 ⊆ 落盘(5 档齐全)
for (const name of [...packed].sort()) {
  const missing = TIERS.filter((t) => !existsSync(join(ASSET_ROOT, `assets-${t}`, name)))
  if (missing.length > 0) {
    fail.push(`打包了但档位缺文件: ${name} —— 缺 assets-${missing.join(' / assets-')}`)
  }
}

// 反向提示(非阻塞):落盘有、nsi 从不引用 = 冗余资产(仅提示,不拦)
for (const tier of TIERS) {
  const dir = join(ASSET_ROOT, `assets-${tier}`)
  if (!existsSync(dir)) continue
  for (const f of readdirSafe(dir)) {
    if (f.endsWith('.bmp') && !packed.has(f)) warn.push(`资产未被打包(冗余): assets-${tier}/${f}`)
  }
}

console.log(
  `[check-installer-assets] 引用 ${refs.size} 个 · 打包 ${packed.size} 个 · 档位 ${TIERS.length} 档`,
)
if (warn.length > 0) {
  for (const w of [...new Set(warn)]) console.log(`  ⚠ ${w}`)
}
if (fail.length > 0) {
  console.error(`\n[check-installer-assets] FAIL —— ${fail.length} 项:`)
  for (const f of fail) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log('[check-installer-assets] PASS —— 引用/打包/落盘三方一致')

// ---- 附加守门:GetOptions 不得直接吃 $CMDLINE(2026-09-20 事故) ----
// NSIS ${GetOptions} 是"任意 '/' 后前缀匹配"且大小写不敏感。$CMDLINE 含 exe 完整
// 路径,路径里任何 /ns 段(如 Git Bash 正斜杠路径 .../ihui-nsi-build/nsis-output.exe)
// 都会误匹配 "/NS" → NoShortcutMode=1 → 完成页行3开关静默消失。
// 正确写法:先 ${GetParameters} $R9 剥掉 exe 路径,再 ${GetOptions} $R9 ...
const installerNsi = readFileSync(
  join(ROOT, 'apps/desktop/src-tauri/windows/installer.nsi'),
  'utf8',
)
const badGetOptions = [...installerNsi.matchAll(/\$\{GetOptions\}\s+\$CMDLINE/g)]
if (badGetOptions.length > 0) {
  console.error(
    `\n[check-installer-assets] FAIL —— installer.nsi 有 ${badGetOptions.length} 处 GetOptions 直接解析 \$CMDLINE:\n` +
      `  GetOptions 对 '/' 后做前缀匹配,exe 路径里的 /ns 等段会误匹配开关。\n` +
      `  修法: 每处之前加 \${GetParameters} \$R9,并把 \$CMDLINE 换成 \$R9。`,
  )
  process.exit(1)
}
console.log('[check-installer-assets] PASS —— GetOptions 未直接吃 $CMDLINE(前缀误匹配免疫)')

// =====================================================================
// 附加守门二:七条**跨文件几何/集合不变量**(2026-09-23 起逐条追加)
// 这些约束过去只写在注释里,没有任何闸门 —— 正是本项目反复批判的"造好没装车"。
// 全部做成纯函数 + env 可覆盖路径,便于注入违规自证其有效性(--self-test)。
// =====================================================================

/** 解析 `!define NAME  值` 形式的数值常量 */
function parseDefines(text, names) {
  const out = {}
  for (const n of names) {
    const m = text.match(new RegExp(`^!define\\s+${n}\\s+(-?\\d+)`, 'm'))
    if (!m) return { error: `找不到 !define ${n}` }
    out[n] = Number(m[1])
  }
  return { defines: out }
}

/** 解析 IHUI_INST_HOLES 宏体里的两个洞矩形(left/top/right/bottom 逻辑像素) */
function parseHoleRects(uiSrc) {
  const body = uiSrc.slice(
    uiSrc.indexOf('!macro IHUI_INST_HOLES'),
    uiSrc.indexOf('!macroend', uiSrc.indexOf('!macro IHUI_INST_HOLES')),
  )
  if (!body.startsWith('!macro IHUI_INST_HOLES')) return { error: '找不到 IHUI_INST_HOLES 宏体' }
  const grab = (label) => {
    const i = body.indexOf(label)
    if (i < 0) return null
    const nums = [...body.slice(i, i + 700).matchAll(/!insertmacro IHUI_PX \$R\d+ (-?\d+)/g)].map((m) => Number(m[1]))
    return nums.length >= 4 ? { left: nums[0], top: nums[1], right: nums[2], bottom: nums[3] } : null
  }
  return { cancel: grab('取消槽'), cta: grab('CTA 槽') }
}

/**
 * 不变量 A:内层 dialog 上挖的洞必须与按钮矩形**逐像素等大**。
 * 洞大 → 透出父对话框为 BUTTON 返回的经典面色刷 #f0f0F0,即用户看到的"方形白边"
 * (2026-09-23 PrintWindow 像素取证:槽位内 5760/5760 与位图一致,外 1px 全是 #f0f0f0)。
 * 洞小 → 切掉位图边缘。两种都只能靠这条静态断言拦住。
 */
export function checkHoleEqualsButton({ uiSrc }) {
  const d = parseDefines(uiSrc, ['IHUI_BTN_Y', 'IHUI_CTA_X', 'IHUI_CTA_W', 'IHUI_CANCEL_X', 'IHUI_CANCEL_W'])
  if (d.error) return [d.error]
  const rects = parseHoleRects(uiSrc)
  if (rects.error) return [rects.error]
  // 按钮高度:从 CTA 槽的 IHUI_INST_SLOT 调用里取实参,不写死 40
  const slotH = uiSrc.match(/!insertmacro IHUI_INST_SLOT\s+1\s+btn-continue\.bmp\s+\$\{IHUI_CTA_X\}\s+\$\{IHUI_BTN_Y\}\s+\$\{IHUI_CTA_W\}\s+(\d+)/)
  if (!slotH) return ['找不到 CTA 槽 IHUI_INST_SLOT(btn-continue) 调用,无法确定按钮高度']
  const H = Number(slotH[1])
  const v = []
  const LABEL = { cta: 'CTA 槽', cancel: '取消槽' }
  const want = {
    cta: { left: d.defines.IHUI_CTA_X, top: d.defines.IHUI_BTN_Y, right: d.defines.IHUI_CTA_X + d.defines.IHUI_CTA_W, bottom: d.defines.IHUI_BTN_Y + H },
    cancel: { left: d.defines.IHUI_CANCEL_X, top: d.defines.IHUI_BTN_Y, right: d.defines.IHUI_CANCEL_X + d.defines.IHUI_CANCEL_W, bottom: d.defines.IHUI_BTN_Y + H },
  }
  for (const key of ['cta', 'cancel']) {
    const got = rects[key]
    if (!got) {
      v.push(`IHUI_INST_HOLES 里解析不到 ${LABEL[key]} 洞矩形`)
      continue
    }
    const w = want[key]
    const diff = ['left', 'top', 'right', 'bottom'].filter((k) => got[k] !== w[k])
    if (diff.length > 0) {
      v.push(
        `${LABEL[key]}洞与按钮矩形不等大:洞=(${got.left},${got.top},${got.right},${got.bottom}) ` +
          `按钮=(${w.left},${w.top},${w.right},${w.bottom}),差异字段 ${diff.join('/')}。` +
          `洞偏大会透出父对话框的按钮面色刷(#f0f0f0) → 用户看到"方形白边";洞偏小会切掉位图边缘。`,
      )
    }
  }
  return v
}

/**
 * 不变量 B:百分比控件矩形中心 == 位图里双环环心。
 * 环是位图烧的、数字是运行期 STATIC 画的,只有两者同心,数字才在环心。
 */
export function checkBadgeConcentric({ uiSrc, genSrc }) {
  const d = parseDefines(uiSrc, ['IHUI_PCT_X', 'IHUI_PCT_Y', 'IHUI_PCT_W', 'IHUI_PCT_H'])
  if (d.error) return [`${d.error}(百分比控件矩形)`]
  const g = {}
  for (const n of ['PCT_CX', 'PCT_CY']) {
    const m = genSrc.match(new RegExp(`^const ${n} = (-?\\d+)`, 'm'))
    if (!m) return [`生成器里找不到 const ${n}(双环环心)`]
    g[n] = Number(m[1])
  }
  const cx = d.defines.IHUI_PCT_X + d.defines.IHUI_PCT_W / 2
  const cy = d.defines.IHUI_PCT_Y + d.defines.IHUI_PCT_H / 2
  const v = []
  if (cx !== g.PCT_CX) v.push(`百分比控件水平中心 ${cx} != 环心 PCT_CX ${g.PCT_CX}`)
  if (cy !== g.PCT_CY) v.push(`百分比控件垂直中心 ${cy} != 环心 PCT_CY ${g.PCT_CY}`)
  if (!/\$\{IHUI_PCT_STYLE\}/.test(uiSrc)) v.push('百分比控件未使用 IHUI_PCT_STYLE(必须 SS_CENTER,SS_RIGHT 下位数变化会让数字在环里左右漂)')
  return v
}

/**
 * 不变量 C:Section 埋点集合 == 轨道刻度集合。
 * 刻度是位图烧的、锚点是运行期报的,两者一一对应才表达"过了几关"。
 */
export function checkAnchorsMatchTicks({ installerSrc, genSrc }) {
  const pct = (re) => [...installerSrc.matchAll(re)].map((m) => Number(m[1])).filter((n) => n < 100)
  const inst = pct(/!insertmacro IHUI_PROGRESS (\d+)/g)
  const un = pct(/!insertmacro IHUI_UNPROGRESS (\d+)/g)
  const ticksM = genSrc.match(/const PB_TICKS = \[([\d,\s]+)\]/)
  const unM = genSrc.match(/meterTrack\(\[([\d,\s]+)\]\)/)
  if (!ticksM || !unM) return ['生成器里解析不到 PB_TICKS / meterTrack([...]) 刻度集合']
  const instTicks = ticksM[1].split(',').map((s) => Number(s.trim()))
  const unTicks = unM[1].split(',').map((s) => Number(s.trim()))
  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
  const v = []
  if (!eq(inst, instTicks)) v.push(`安装埋点集合 [${inst.join(',')}] != 轨道刻度 [${instTicks.join(',')}]`)
  if (!eq(un, unTicks)) v.push(`卸载埋点集合 [${un.join(',')}] != 卸载刻度 [${unTicks.join(',')}]`)
  return v
}

/**
 * 解析生成器里的 `const NAME = <表达式>`:支持字面量、标识符引用、以及
 * `A - B` / `A + B` 两元式(版面几何就是这么写的 —— `C_W = C_R - C_L`、
 * `RCARD_X = C_L`)。只认字面量会让"生成器改了布局常量、define 没跟"这类
 * 漂移完全看不见(实测守门对 RCARD_X/W 恒报"缺少")。解不开返回 null。
 */
export function resolveGenConst(genSrc, name, depth = 0) {
  if (depth > 6) return null
  const m = genSrc.match(new RegExp(`^\\s*const ${name}\\s*=\\s*([^;]+);`, 'm'))
  if (!m) return null
  const expr = m[1].trim()
  if (/^-?\d+$/.test(expr)) return Number(expr)
  const bin = expr.match(/^([A-Za-z_]\w*)\s*([-+])\s*([A-Za-z_]\w*)$/)
  if (bin) {
    const a = resolveGenConst(genSrc, bin[1], depth + 1)
    const b = resolveGenConst(genSrc, bin[3], depth + 1)
    if (a === null || b === null) return null
    return bin[2] === '-' ? a - b : a + b
  }
  if (/^[A-Za-z_]\w*$/.test(expr)) return resolveGenConst(genSrc, expr, depth + 1)
  return null
}

/**
 * 不变量 E(Var 作用域顺序):hook 文件里 **Function 体内**不得引用 installer.nsi
 * 在 include 点之后才 `Var` 声明的变量。
 * NSIS 按编译位置解析:宏体在插入点(通常在 Var 之后)展开 → 合法;
 * 而 Function 在定义点即编译 → 引用被 warning 6000 **静默丢弃**,
 * 后果分两种:`${If} $X = …` 恒假(守卫静默失效),`StrCpy $X 1` 退化成单参数
 * (makensis 直接中止)。2026-09-23 真包构建就是这么断在 ihui-ui.nsi 的
 * PageReinstallCard1Click 上,故把这条陷阱固化成闸。
 */
export function checkVarScopeOrder({ installerSrc, sources }) {
  const lines = installerSrc.split(/\r?\n/)
  let includeAt = -1
  // 仓库模板里 hooks 是占位 `!include "{{installer_hooks}}"`(渲染时才换成真路径),
  // 渲染产物里则是 `hooks.nsi` —— 两种形态都要认,否则本闸在任一侧恒"建立不了基线"。
  lines.forEach((l, i) => {
    if (includeAt < 0 && /^\s*!include\s+"(\{\{[^}]+\}\}|[^"]*hooks\.nsi)"/i.test(l)) includeAt = i
  })
  if (includeAt < 0) return ['installer.nsi 里找不到 hooks.nsi 的 !include 行,无法建立 Var 作用域基线']
  const lateVars = []
  lines.forEach((l, i) => {
    const m = l.match(/^\s*Var\s+([A-Za-z_]\w*)/)
    if (m && i > includeAt) lateVars.push(m[1])
  })
  const v = []
  for (const [fname, src] of sources) {
    const code = src
      .split(/\r?\n/)
      .filter((l) => !/^\s*;/.test(l))
      .join('\n')
    for (const fm of code.matchAll(/Function\s+\S+([\s\S]*?)^\s*FunctionEnd/gm)) {
      for (const vn of lateVars) {
        if (new RegExp(`\\$\\{?${vn}\\b`).test(fm[1])) {
          v.push(
            `${fname} 的 Function 体内引用了 installer.nsi 在 include(第 ${includeAt + 1} 行)之后才声明的 $${vn} —— ` +
              `NSIS 会 warning 6000 静默丢弃该引用(条件恒假 / StrCpy 退化中止编译)。` +
              `改读本文件内声明的变量,或改读控件自身状态(如对 radio 发 NSD_GetState)。`,
          )
        }
      }
    }
  }
  return v
}

/**
 * 不变量 D(R70 维护页卡片化):重装确认页卡片/指示器几何三方一致。
 *   ① 卡片框:ihui-ui.nsi 的 IHUI_RCARD_* define == 生成器 RCARD_* 常量
 *     (卡片框烧进 reinstall.bmp,运行期 overlay/文字/指示器都按同一几何叠放,
 *      任何一侧漂移都会出现"卡片框与点击区/文字错位")。
 *   ② 指示器:宏内 IHUIRI1/IHUIRI2 的 CreateControl 矩形(逻辑像素)与
 *     maint-radio-on/off.bmp 实际文件尺寸逐档逐像素等大
 *     (SS_BITMAP 不缩放,rect 与位图不等大即偏移/裁切)。
 * 均从宏调用点解析而非硬编码(参照 checkHoleEqualsButton 模式)。
 */
export function checkReinstallCards({ uiSrc, genSrc, assetRoot }) {
  const v = []
  const defs = {}
  for (const m of uiSrc.matchAll(/^!define\s+(IHUI_[A-Z0-9_]+)\s+(-?\d+)/gm)) defs[m[1]] = Number(m[2])

  // ① 卡片几何:define == 生成器常量
  const CARD_KEYS = ['X', 'Y1', 'Y2', 'W', 'H']
  for (const k of CARD_KEYS) {
    const dn = `IHUI_RCARD_${k}`
    if (defs[dn] === undefined) {
      v.push(`ihui-ui.nsi 缺少 !define ${dn}(重装页卡片几何)`)
      continue
    }
    const got = resolveGenConst(genSrc, `RCARD_${k}`)
    if (got === null) {
      v.push(`生成器缺少可解析的 const RCARD_${k}(重装页卡片几何)`)
      continue
    }
    if (got !== defs[dn]) {
      v.push(`重装页卡片几何漂移:${dn}=${defs[dn]} != 生成器 RCARD_${k}=${got}(位图烧入框与运行期 overlay/文字会错位)`)
    }
  }

  // ② 指示器矩形 vs 位图文件尺寸(逐档)
  // 从 CreateControl 那一行取四个逻辑坐标,而不是"往前找 4 条 IHUI_PX":
  // 宏里 IHUIRI2 复用 IHUIRI1 已算好的 $2/$4/$5,只重算 $3(y),
  // 按 IHUI_PX 取最后 4 条会得到 (y1,size,size,y2) 这种错位四元组。
  const grabRect = (handle) => {
    const pop = uiSrc.indexOf(`Pop $${handle}`)
    if (pop < 0) return null
    const cc = [
      ...uiSrc.slice(0, pop).matchAll(/nsDialogs::CreateControl\s+\S+\s+\S+\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)/g),
    ]
    if (!cc.length) return null
    // `${NAME}` 前缀 2 字符、后缀 `}` 1 字符 → slice(2, -1)。
    // 写成 -2 会连名字末位一起吃掉(IHUI_RIND_X → IHUI_RIND),查表恒 undefined;
    // 旧实现里这条路径因"取不到 4 条 IHUI_PX"提前 return,把这个笔误掩盖成了"解析不到矩形"。
    return cc[cc.length - 1].slice(1).map((tok) => (tok.startsWith('${') ? defs[tok.slice(2, -1)] : Number(tok)))
  }
  for (const handle of ['IHUIRI1', 'IHUIRI2']) {
    const rect = grabRect(handle)
    if (!rect || rect.some((n) => !Number.isFinite(n))) {
      v.push(`ihui-ui.nsi 解析不到重装页指示器 $${handle} 的 CreateControl 矩形(宏结构已变?)`)
      continue
    }
    const [l, t, w, h] = rect
    for (const tier of TIERS) {
      const scale = Number(tier) / 100
      for (const name of ['maint-radio-on.bmp', 'maint-radio-off.bmp']) {
        const path = join(assetRoot, `assets-${tier}`, name)
        if (!existsSync(path)) {
          v.push(`缺少指示器位图: assets-${tier}/${name}(checkReinstallCards)`)
          continue
        }
        const buf = readFileSync(path)
        const bw = buf.readInt32LE(18)
        const bh = buf.readInt32LE(22)
        if (bw !== Math.round(w * scale) || bh !== Math.round(h * scale)) {
          v.push(
            `重装页指示器 $${handle} 矩形 (${l},${t},${w},${h}) 与 assets-${tier}/${name} 尺寸 ${bw}x${bh} 不等大` +
              `(期望 ${Math.round(w * scale)}x${Math.round(h * scale)};SS_BITMAP 不缩放,会偏移/裁切)`,
          )
        }
      }
    }
  }
  return v
}

/** 解析目录页位图容器矩形(x 常写成 ${C_L},必须走 resolveGenConst 而非只认字面量) */
function parseDirPageContainer(genSrc) {
  const at = genSrc.indexOf('function sceneDir(')
  if (at < 0) return { error: '解析不到目录页容器矩形:生成器里没有 function sceneDir(' }
  const next = genSrc.indexOf('\nfunction ', at + 1)
  const body = genSrc.slice(at, next < 0 ? genSrc.length : next)
  const m = body.match(/<rect\s+x="([^"]*)"\s+y="([^"]*)"\s+width="([^"]*)"\s+height="([^"]*)"/)
  if (!m) return { error: '解析不到目录页容器矩形:sceneDir 内没有 <rect x y width height> 输入框容器' }
  const num = (tok) => {
    const inner = tok.trim().replace(/^\$\{(.+)\}$/, '$1').trim()
    if (/^-?\d+$/.test(inner)) return Number(inner)
    const v = resolveGenConst(genSrc, inner)
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  const rect = { left: num(m[1]), top: num(m[2]), w: num(m[3]), h: num(m[4]) }
  if ([rect.left, rect.top, rect.w, rect.h].some((n) => n === null)) {
    return { error: `解析不到目录页容器矩形:${JSON.stringify(m.slice(1))} 含不可解析常量` }
  }
  return { rect }
}

/**
 * 不变量 F(目录页输入框垂直居中):EDIT 矩形必须落在位图容器正中。
 * Win32 单行 Edit **顶对齐文字**,控件比字行高多出的部分全落在下方 —— 用户报的
 * "安装路径容器内的文字没有居中,下面空了很多"即此(2026-09-23 修复 57e4443bd6:
 * IHUI_EDIT_H 28→22、IHUI_EDIT_Y 306→309)。该修复此前**没有任何闸**,任何人把
 * 高度改回去都不会报警,故把"容器矩形来自生成器 / 运行期矩形来自 define"的对账固化。
 */
export function checkEditInContainerCentered({ uiSrc, genSrc }) {
  const d = parseDefines(uiSrc, ['IHUI_EDIT_X', 'IHUI_EDIT_Y', 'IHUI_EDIT_W', 'IHUI_EDIT_H'])
  if (d.error) return [`${d.error}(目录页输入框矩形)`]
  const g = parseDirPageContainer(genSrc)
  if (g.error) return [g.error]
  const { left, top, w, h } = g.rect
  const { IHUI_EDIT_X: X, IHUI_EDIT_Y: Y, IHUI_EDIT_W: W, IHUI_EDIT_H: H } = d.defines
  const v = []
  const wantY = top + Math.round((h - H) / 2)
  if (Y !== wantY) {
    v.push(
      `目录页输入框未在其位图容器内垂直居中:容器 (top=${top}, h=${h})、Edit H=${H} → Y 应为 ${wantY},实际 ${Y}(差 ${Y - wantY})。` +
        `单行 Edit 顶对齐文字,高度富余全落在下方 → 用户看到框底空一行。`,
    )
  }
  if (X < left || X + W > left + w) {
    v.push(
      `目录页输入框水平越出容器:Edit ${X}..${X + W},容器 ${left}..${left + w}` +
        `(左内缩 ${X - left}、右内缩 ${left + w - (X + W)}) —— 输入框会压住/穿出位图描边。`,
    )
  }
  if (H > h) {
    v.push(`目录页输入框高度 ${H} 超出容器高 ${h}(位图框只有 ${h} 高,Edit 会顶穿描边)`)
  }
  return v
}

/**
 * 不变量 G(DPI 重锚定链完整 + 寄存器洁净):重装/升级确认页"进入时重锚"必须走完
 * **整条窗口几何链**,而不是只重摆控件。
 *
 * 敞口定性(2026-09-24 逐行复核):计划里"重锚只更新控件位置、不更新窗口框"的说法
 * **对不上现在的代码** —— ihui-ui.nsi 的 DPI 分支确实 `!insertmacro IHUI_GUIINIT_SIZE`
 * (该宏 812-813 重算 $IHUIWW/$IHUIWH、823 行 SetWindowPos 外框),背景控件 $IHUIBG
 * 与内层 dialog 也按新尺寸重建。真正缺的是**第三步**:IHUI_GUIINIT_COMMON 里 DWM
 * 圆角不可用时的回退分支把窗口裁剪区域(SetWindowRgn)硬钉在调用当时的 $IHUIWW/
 * $IHUIWH 上 —— 窗口框随后被放大时 region 不会跟随,右/下多出来的部分根本不参与绘制,
 * 现象与用户截图同一族。修法 = 把那段抽成 IHUI_WINDOW_RGN,定窗与重锚两处共用一份。
 *
 * 为什么这条必须**跨文件**:(a) 重锚链的入口是 installer.nsi 的 Function PageReinstall
 * 里那行 `!insertmacro IHUI_REINSTALLTHEME`,它被删/挪到 nsDialogs::Show 之后,整条
 * DPI 加固静默消失且编译零报错;(b) 该宏展开在 PageReinstall 内,$R0(版本比较结果,
 * PageLeaveReinstall 还要用)/$R1..$R4 是存活数据 —— 被重锚调用的任何宏都不得把它们
 * 当临时量(旧圆角代码正是用 $R0 收区域句柄,抽成共用宏后若不改就会静默丢选择)。
 */
export function checkDpiReanchorCompleteness({ uiSrc, installerSrc }) {
  const v = []
  const bodyOf = (name) => {
    const at = uiSrc.indexOf(`!macro ${name}`)
    if (at < 0) return null
    const end = uiSrc.indexOf('!macroend', at)
    return end < 0 ? null : uiSrc.slice(at, end)
  }

  // ① 跨文件接线:PageReinstall 体内必须插入主题宏,且早于 nsDialogs::Show
  const fn = installerSrc.match(/Function\s+PageReinstall\b[\s\S]*?\nFunctionEnd/)
  if (!fn) return ['installer.nsi 里找不到 Function PageReinstall,无法建立重锚接线基线']
  const at = fn[0].indexOf('!insertmacro IHUI_REINSTALLTHEME')
  if (at < 0) v.push('installer.nsi 的 PageReinstall 未插入 IHUI_REINSTALLTHEME —— 整条 DPI 重锚链(含窗口框/裁剪区域重算)静默失效')
  const show = fn[0].indexOf('nsDialogs::Show')
  if (at >= 0 && show >= 0 && at > show) v.push('IHUI_REINSTALLTHEME 插在 nsDialogs::Show 之后 —— 页面已进入才重锚,首帧按旧档绘制')

  // ② 重锚分支:从 DPI 不一致判定到其 ${EndIf},必须同时定窗框与定裁剪区域
  const theme = bodyOf('IHUI_REINSTALLTHEME')
  if (!theme) return v.concat(['ihui-ui.nsi 里找不到 IHUI_REINSTALLTHEME 宏体'])
  const from = theme.indexOf('${If} $0 != $IHUIDPIW')
  if (from < 0) {
    v.push('IHUI_REINSTALLTHEME 里没有"窗口 DPI ≠ 布局 DPI"的重锚分支 —— 外部改显示缩放后本页不会再定档')
  } else {
    const stop = theme.indexOf('${EndIf}', from)
    const branch = theme.slice(from, stop < 0 ? theme.length : stop)
    for (const [macro, what] of [
      ['IHUI_GUIINIT_SIZE', '窗口框尺寸/档位($IHUIWW/$IHUIWH + SetWindowPos)'],
      ['IHUI_WINDOW_RGN', '窗口裁剪区域(SetWindowRgn 回退分支)'],
    ]) {
      if (!new RegExp(`!insertmacro\\s+${macro}\\b`).test(branch)) {
        v.push(
          `重装页 DPI 重锚分支缺 !insertmacro ${macro}(=${what}) —— ` +
            `${macro === 'IHUI_WINDOW_RGN' ? '窗口框放大后旧 region 仍按上一档硬裁,右/下内容被切' : '控件按新档摆、窗口框按旧档留,页面溢出'}` +
            `。必须与 IHUI_GUIINIT_COMMON 同源,不得内联复制换算。`,
        )
      }
    }
    // ②b 收敛轮数与顺序(2026-09-25 立):重锚必须与 IHUI_GUIINIT_COMMON 同口径跑**两轮**
    // IHUI_GUIINIT_SIZE。首轮 SetWindowPos 把窗口挪到目标屏后 per-monitor DPI 才生效,
    // 只跑一轮 = 跨屏搬迁时档位/控件坐标整体错一档(2026-09-19 真机 125%/150% 双屏实锤)。
    // 只数**行首锚定**的插入行(注释里提到宏名不计),故夹注释、改缩进都不会误红。
    const insertAt = (src, macro) => {
      const re = new RegExp(`^[ \\t]*!insertmacro[ \\t]+${macro}\\b[ \\t]*(?:;[^\\r\\n]*)?\\r?$`, 'gim')
      const hits = []
      let m
      while ((m = re.exec(src)) !== null) hits.push(m.index)
      return hits
    }
    const sizeAt = insertAt(branch, 'IHUI_GUIINIT_SIZE')
    const rgnAt = insertAt(branch, 'IHUI_WINDOW_RGN')
    if (sizeAt.length === 1) {
      v.push(
        '重装页 DPI 重锚分支只跑 1 轮 IHUI_GUIINIT_SIZE,与 IHUI_GUIINIT_COMMON 的两轮口径不一致 —— 首轮 SetWindowPos 把窗口挪到目标屏后 per-monitor DPI 才生效,不复读重算则跨屏搬迁时档位与控件坐标整体错一档(窗口框与 region 一起偏)。必须紧邻补跑第二轮,不得改回单轮。',
      )
    }
    // 两轮之间不得夹 IHUI_WINDOW_RGN:该宏把 $R6/$R7 当临时量(区域句柄/圆角直径),
    // 夹在中间会让第二轮读到脏的工作区矩形 → 窗口被摆到屏外(比单轮更糟的失效形态)。
    if (sizeAt.length >= 2 && rgnAt.length > 0 && rgnAt[0] < sizeAt[sizeAt.length - 1]) {
      v.push(
        '重装页 DPI 重锚分支把 IHUI_WINDOW_RGN 插在了两轮 IHUI_GUIINIT_SIZE 之间 —— 该宏用 $R6/$R7 当临时量,第二轮再读工作区矩形(R5..R8)拿到的就是脏值,窗口会被摆到屏外。定档两轮必须紧邻、region 宏收尾。',
      )
    }
  }

  // ③ 同源实现:IHUI_WINDOW_RGN 必须存在、被 GUIINIT_COMMON 一起用、几何取自 $IHUIWW/$IHUIWH
  const rgn = bodyOf('IHUI_WINDOW_RGN')
  if (!rgn) {
    v.push('ihui-ui.nsi 里找不到 IHUI_WINDOW_RGN 宏 —— 圆角/裁剪区域没有可共用的单一实现,定窗与重锚必然各自漂移')
  } else {
    const common = bodyOf('IHUI_GUIINIT_COMMON')
    if (!common || !/!insertmacro\s+IHUI_WINDOW_RGN\b/.test(common)) {
      v.push('IHUI_GUIINIT_COMMON 未调用 IHUI_WINDOW_RGN —— 该宏成了只给重锚用的副本,定窗侧仍会各自演化')
    }
    if (!/\$IHUIWW/.test(rgn) || !/\$IHUIWH/.test(rgn)) {
      v.push('IHUI_WINDOW_RGN 没按 $IHUIWW/$IHUIWH 取尺寸(写死字面量 → 重锚后 region 与实际窗口框脱钩)')
    }
    if (!/SetWindowRgn\(p \$HWNDPARENT/.test(rgn)) {
      v.push('IHUI_WINDOW_RGN 里没有 SetWindowRgn(p $HWNDPARENT …) —— 裁剪区域根本没落到窗口上')
    }
    // 寄存器洁净:输出型临时量不得落在 $R0..$R4(PageReinstall 存活数据)
    const outs = [...rgn.matchAll(/\.([Rr])([0-9])\b/g)].map((m) => Number(m[2]))
    const bad = [...new Set(outs.filter((n) => n <= 4))]
    if (bad.length > 0) {
      v.push(
        `IHUI_WINDOW_RGN 用 $R${bad.join('/$R')} 当临时量 —— 该宏被 PageReinstall 内的重锚分支调用时` +
          `会覆写 $R0(版本比较结果)/$R1..$R4(标题与 radio 句柄、内层 dialog),` +
          `后果是选择丢失或后续绘制指向已死句柄。改用 $R6/$R7(它们只在 IHUI_GUIINIT_SIZE` +
          `消费完工作区矩形之后才算死,故本宏必须排在定档定位之后调用)。`,
      )
    }
  }
  return v
}

const UI_SRC_FOR_GEO = readFileSync(process.env.IHUI_NSI_PATH || NSI, 'utf8')
const INSTALLER_SRC_FOR_GEO = readFileSync(process.env.IHUI_INSTALLER_NSI_PATH || join(ROOT, 'apps/desktop/src-tauri/windows/installer.nsi'), 'utf8')
const GEN_SRC_FOR_GEO = readFileSync(process.env.IHUI_ASSET_GEN_PATH || join(ROOT, 'scripts/desktop-installer-assets.mjs'), 'utf8')

const geoFail = [
  ...checkHoleEqualsButton({ uiSrc: UI_SRC_FOR_GEO }),
  ...checkBadgeConcentric({ uiSrc: UI_SRC_FOR_GEO, genSrc: GEN_SRC_FOR_GEO }),
  ...checkAnchorsMatchTicks({ installerSrc: INSTALLER_SRC_FOR_GEO, genSrc: GEN_SRC_FOR_GEO }),
  ...checkReinstallCards({ uiSrc: UI_SRC_FOR_GEO, genSrc: GEN_SRC_FOR_GEO, assetRoot: ASSET_ROOT }),
  ...checkVarScopeOrder({
    installerSrc: INSTALLER_SRC_FOR_GEO,
    sources: [[join(NSI).replace(/^.*[\\/]/, ''), UI_SRC_FOR_GEO]],
  }),
  ...checkEditInContainerCentered({ uiSrc: UI_SRC_FOR_GEO, genSrc: GEN_SRC_FOR_GEO }),
  ...checkDpiReanchorCompleteness({ uiSrc: UI_SRC_FOR_GEO, installerSrc: INSTALLER_SRC_FOR_GEO }),
]
if (geoFail.length > 0) {
  console.error(`\n[check-installer-assets] FAIL —— 跨文件几何/集合不变量被破坏 ${geoFail.length} 项:`)
  for (const m of geoFail) console.error(`  - ${m}`)
  process.exit(1)
}
console.log(
  '[check-installer-assets] PASS —— 洞=按钮矩形、百分比同心、埋点=刻度、重装页卡片/指示器几何、' +
    'Function 体内不引用后置 Var、目录页输入框垂直居中、重装页 DPI 重锚走完窗口框+裁剪区域' +
    '且两轮紧邻定档(与 GUIINIT 同口径,region 宏收尾) 七条跨文件不变量成立',
)

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
