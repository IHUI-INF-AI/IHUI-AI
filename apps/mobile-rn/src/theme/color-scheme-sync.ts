// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 App 自己的主题解析结果落到**两个非 JS-token 的取色通道**:NativeWind 的 colorScheme store,
 * 以及原生窗口的 night 档位。
 *
 * 为什么必须有这一步:共享 preset 用 `darkMode: 'class'`(`packages/design-tokens/src/tailwind-preset.js:24`),
 * 而 NativeWind 的 `dark:` 变体读的是**它自己的 store** —— 没人 set 过它就恒跟系统外观。
 * 本 App 的主题是「模块级 token 单例 + 重载 JS」(`active-tokens.ts`),两条通道各走各的,
 * 于是 OS=浅色而用户在设置里选深色时:tokens 侧全翻暗、`dark:bg-*` 侧全部不生效(反之亦然)。
 * 守门 83 的 R2 恰恰把"同行有 dark: 变体"当作已配对 ⇒ 不同步这条,那些配对就是纸面上的。
 */
import { Appearance } from 'react-native'
import { colorScheme } from 'nativewind'

export type ResolvedColorScheme = 'light' | 'dark'
/** 与 ThemeContext 的 themeMode / active-tokens 的 RnThemePreference 同三档 */
export type WindowColorSchemePreference = ResolvedColorScheme | 'system'

/**
 * @returns 真正落下去的配色;`null` = 当前环境没有这个 store(如 vitest 下的部分替身),调用方不必因此中断
 */
export function syncNativeWindColorScheme(
  resolved: ResolvedColorScheme,
): ResolvedColorScheme | null {
  try {
    colorScheme.set(resolved)
    return resolved
  } catch {
    return null
  }
}

/**
 * 把 App 解析出的主题落到**原生窗口**(Android activity 的 night 位 / iOS userInterfaceStyle)。
 *
 * 为什么必须有这一步:`app.json` 是 `userInterfaceStyle: "automatic"`,而 `AppTheme` 继承
 * `Theme.AppCompat.DayNight` ⇒ 窗口档位**只跟系统**。App 自己的主题却存在偏好里,两者一旦不一致,
 * 所有**原生**表面就和 App 反色:输入法键盘、`Alert.alert` 对话框、状态栏/导航栏、文本选择手柄。
 * 键盘和对话框都是整片面积,于是"浅色模式一大片黑 / 深色模式一大片白"(真机实拍:App 深色 +
 * 系统浅色 ⇒ 页面已翻暗,而"主题已切换"对话框整块纯白)。
 *
 * 偏好为 `system` 时落 `'unspecified'` 而不是解析结果:那是"把控制权交还系统",
 * 若在此刻钉死成具体档,系统后续翻档会被这个 override 遮掉,"跟随系统"就名存实亡。
 *
 * @returns 真正落下去的值;`null` = 当前环境没有该 API(旧 RN / 部分替身)
 */
export function syncWindowColorScheme(
  preference: WindowColorSchemePreference,
): 'light' | 'dark' | 'unspecified' | null {
  const next: 'light' | 'dark' | 'unspecified' =
    preference === 'system' ? 'unspecified' : preference
  try {
    Appearance.setColorScheme(next)
    return next
  } catch {
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
