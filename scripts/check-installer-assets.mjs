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
// 附加守门二:三条**跨文件几何/集合不变量**(2026-09-23)
// 这三条过去只写在注释里,没有任何闸门 —— 正是本项目反复批判的"造好没装车"。
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

const UI_SRC_FOR_GEO = readFileSync(process.env.IHUI_NSI_PATH || NSI, 'utf8')
const INSTALLER_SRC_FOR_GEO = readFileSync(process.env.IHUI_INSTALLER_NSI_PATH || join(ROOT, 'apps/desktop/src-tauri/windows/installer.nsi'), 'utf8')
const GEN_SRC_FOR_GEO = readFileSync(process.env.IHUI_ASSET_GEN_PATH || join(ROOT, 'scripts/desktop-installer-assets.mjs'), 'utf8')

const geoFail = [
  ...checkHoleEqualsButton({ uiSrc: UI_SRC_FOR_GEO }),
  ...checkBadgeConcentric({ uiSrc: UI_SRC_FOR_GEO, genSrc: GEN_SRC_FOR_GEO }),
  ...checkAnchorsMatchTicks({ installerSrc: INSTALLER_SRC_FOR_GEO, genSrc: GEN_SRC_FOR_GEO }),
]
if (geoFail.length > 0) {
  console.error(`\n[check-installer-assets] FAIL —— 跨文件几何/集合不变量被破坏 ${geoFail.length} 项:`)
  for (const m of geoFail) console.error(`  - ${m}`)
  process.exit(1)
}
console.log('[check-installer-assets] PASS —— 洞=按钮矩形、百分比同心、埋点=刻度 三条跨文件不变量成立')

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
