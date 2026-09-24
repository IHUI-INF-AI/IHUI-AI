// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 主题 token 单一入口 —— 让 mobile-rn 的取色与 web 一样跟随主题。
 *
 * 为什么不改成 useTheme() 逐组件取色:全端 86 个文件的配色写在 StyleSheet.create 里
 * (模块求值时一次性取色,共 1439 处 tokens.* 引用)。改成 hook 要把每个 style 搬进
 * makeStyles(tokens),等于重写全端样式层。这里用「模块级可变 token 单例 + 切换后重载 JS」:
 * import 方只换一行 import;主题切换在 JS 重载后全端生效;冷启动用同步文件读回上次解析
 * 结果(expo-file-system 的 File.textSync/write 是同步 API),首帧即正确色,不闪。
 *
 * 生产构建无 DevSettings 时,落盘仍生效 —— 下次冷启动自动是正确主题。
 */
import { Appearance, DevSettings } from 'react-native'
import { File, Paths } from 'expo-file-system'
import { rnDarkTokens, rnLightTokens, type RnThemeTokens } from '@ihui/design-tokens'

export type RnThemeMode = 'light' | 'dark'
/** 与 @ihui/shared/stores theme-store 的 ThemeMode 对齐(system = 跟随系统) */
export type RnThemePreference = RnThemeMode | 'system'

type TokenBag = Record<string, Record<string, string>>

/**
 * 必须**逐命名空间**拷一层:`{...rnLightTokens}` 只拷顶层,`mutableTokens.brand`
 * 与 `rnLightTokens.brand` 就是同一个对象,于是 apply('dark') 会把 PALETTES.light
 * 本身涂成深色,此后 apply('light') 变成自我赋值 —— 浅色再也回不来。
 *
 * 为什么不是"反正会重载 JS 所以无所谓":`DevSettings.reload()` 在非 __DEV__ 下是空实现
 * (react-native/Libraries/Utilities/DevSettings.js 的 stub 分支),所以 release 包里
 * 主题切换确实会在同一 JS 生命周期内跑第二次 apply()。
 */
function clonePalette(src: TokenBag): TokenBag {
  const out: TokenBag = {}
  for (const ns of Object.keys(src)) out[ns] = { ...src[ns] }
  return out
}

const mutableTokens = clonePalette(rnLightTokens as unknown as TokenBag)
const PALETTES: Record<RnThemeMode, TokenBag> = {
  light: rnLightTokens as unknown as TokenBag,
  dark: rnDarkTokens as unknown as TokenBag,
}

/** 对外暴露的 token 对象引用恒定(95 个文件 import 它),内容随主题就地覆写 */
export const tokens = mutableTokens as unknown as RnThemeTokens

const modeFile = new File(Paths.document, 'ihui-rn-theme-mode')

function apply(mode: RnThemeMode): void {
  const source = PALETTES[mode]
  for (const ns of Object.keys(source)) {
    const target = mutableTokens[ns]
    const values = source[ns]
    if (!target || !values) continue
    Object.assign(target, values)
  }
}

function systemMode(): RnThemeMode {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
}

function persistedMode(): RnThemeMode | null {
  try {
    if (!modeFile.exists) return null
    const raw = modeFile.textSync()
    return raw === 'dark' || raw === 'light' ? raw : null
  } catch {
    return null
  }
}

/** 显式偏好优先,system 时取系统配色 —— 与 web 端 next-themes(defaultTheme="system") 同语义 */
export function resolveRnTheme(preference: RnThemePreference): RnThemeMode {
  return preference === 'light' || preference === 'dark' ? preference : systemMode()
}

let applied: RnThemeMode = persistedMode() ?? systemMode()
apply(applied)

export function currentRnTheme(): RnThemeMode {
  return applied
}

/**
 * 应用并落盘目标主题。
 * @returns 是否真的变了(false = 调用方无需重载)
 */
export function commitRnTheme(preference: RnThemePreference): boolean {
  const next = resolveRnTheme(preference)
  if (next === applied) return false
  applied = next
  apply(next)
  try {
    modeFile.write(next)
  } catch {
    // 落盘失败只影响下次冷启动的首帧配色,不影响本次生效
  }
  return true
}

/** 模块级样式只在求值时取色,切换主题必须重载 JS 才能全端重算 */
export function reloadForTheme(): void {
  try {
    DevSettings?.reload?.('theme')
  } catch {
    // 生产构建无 DevSettings:已落盘,下次冷启动生效
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
