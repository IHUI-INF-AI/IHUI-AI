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
import RNRestart from 'react-native-restart'
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

/**
 * 构造必须容错:网页预览下 expo-file-system 不支持(`Paths.document` 为 undefined),
 * `new File()` 在**模块求值期**抛 `this.validatePath is not a function`,而本文件被
 * ThemeContext 顶层 import ⇒ 整个 bundle 崩掉、浏览器只剩白屏(不是"主题降级",是全 app 打不开)。
 * 落盘本来就只影响下次冷启动的首帧配色,拿不到文件时按 system 解析即为正确降级。
 */
const modeFile: File | null = (() => {
  try {
    return new File(Paths.document, 'ihui-rn-theme-mode')
  } catch {
    return null
  }
})()

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

/**
 * 落盘的是**偏好**(light/dark/system),不是解析结果。
 *
 * 旧实现落的是解析结果,而冷启动 `applied = persistedMode() ?? systemMode()` **无条件优先读文件** ——
 * 偏好为 system 时文件只是"上一次系统档位"的缓存,系统翻档后它就过期了:下次冷启动仍按旧档取色,
 * 而 `useColorScheme()` 给的是新档 ⇒ 同屏分裂**在重启之后依然成立**,且没有 change 事件再去纠正它。
 * 真机实测正是这条路径(系统夜间档冷启动后变化 → 广场正文浅色、chrome 深色)。
 */
const PREF_FILE_SCHEMA = 'v2:'

function persistedPreference(): RnThemePreference | null {
  try {
    if (!modeFile?.exists) return null
    const raw = modeFile.textSync()
    // 旧格式(裸 'light'/'dark',存的是解析结果)一律不认:把它当偏好会把"跟随系统"
    // 悄悄变成"显式深色",且再也回不来。不认 → 按 system 解析,与 initialTheme 一致。
    if (!raw.startsWith(PREF_FILE_SCHEMA)) return null
    const v = raw.slice(PREF_FILE_SCHEMA.length)
    return v === 'light' || v === 'dark' || v === 'system' ? v : null
  } catch {
    return null
  }
}

/** 显式偏好优先,system 时取系统配色 —— 与 web 端 next-themes(defaultTheme="system") 同语义 */
export function resolveRnTheme(preference: RnThemePreference): RnThemeMode {
  return preference === 'light' || preference === 'dark' ? preference : systemMode()
}

let applied: RnThemeMode = resolveRnTheme(persistedPreference() ?? 'system')
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
    modeFile?.write(PREF_FILE_SCHEMA + preference)
  } catch {
    // 落盘失败只影响下次冷启动的首帧配色,不影响本次生效
  }
  return true
}

/**
 * 让模块级 StyleSheet 重新求值。
 *
 * `DevSettings.reload` 在 `__DEV__` 之外是空实现(react-native 的 stub 分支),所以 release 包里
 * 只调它 = 什么都没发生:共享层已按新档翻色,而 86 个文件的模块级取色停在旧档 ⇒ 同屏分裂
 * 会一直持续到用户自己杀掉 App。故 release 走真重启(重启进程 = JS 全量重求值,与冷启动同语义)。
 *
 * 只在**真实换档事件**里被调用(ThemeContext 的 Appearance 监听 / 设置页显式选择),
 * 不在挂载路径上,所以不会自触发循环;`commitRnTheme` 返回 false(解析结果未变)时也不会被调到。
 */
export function reloadForTheme(): void {
  if (__DEV__) {
    try {
      DevSettings?.reload?.('theme')
      return
    } catch {
      // 落到下面的进程重启
    }
  }
  try {
    RNRestart.restart('theme')
  } catch {
    // 重启失败退回下次冷启动生效(偏好已落盘,不会丢)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
