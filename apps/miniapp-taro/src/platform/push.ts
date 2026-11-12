// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * `@/platform/push` 的小程序腿 —— **只做转出口**,不实现任何行为。
 *
 * 立因(2026-11-12,构建实证):RN 壳 `apps/mobile-rn/src/{components,screens,hooks}/**`
 * 写 `import … from '@/platform/push'`。这些壳在小程序编译面里(mini 段 `@` → 本端 src),
 * 而本端此前只有 auth/pay 两个同名文件 ⇒ `build:weapp` 在 resolve 阶段硬失败
 * (实测 `resolve '@/platform/audio' in .../src/components` 直接 ✖ Errors)。
 *
 * 为什么是"转出口"而不是"再写一份":§0.6 单一真相源。每个真正的能力承接体早已存在
 * (`src/rn-compat/*` + expo-* 别名表),这里再写一份就是第二套实现,必然漂移。
 */

/**
 * 小程序推送走平台订阅消息(与 expo-notifications 的 token 模型不同源)⇒ 不假装实现。
 * 导出面只为让 RN 壳的 import 通过:未实现的能力一律显式抛错(§XUI-054 不返回空值假装成功)。
 */
function notSupported(api: string): never {
  throw new Error(`${api} is not supported on miniapp`)
}

export const Notifications = {
  async getPermissionsAsync(): Promise<{ status: 'denied' }> {
    return { status: 'denied' }
  },
  async requestPermissionsAsync(): Promise<{ status: 'denied' }> {
    return { status: 'denied' }
  },
  async getExpoPushTokenAsync(): Promise<never> {
    return notSupported('Notifications.getExpoPushTokenAsync')
  },
  async setNotificationHandler(): Promise<never> {
    return notSupported('Notifications.setNotificationHandler')
  },
}
