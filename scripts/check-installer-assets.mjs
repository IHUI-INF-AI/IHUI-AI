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
const src = readFileSync(NSI, 'utf8')

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
