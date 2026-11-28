/**
 * expo-web-browser 测试替身。
 *
 * 真包 WebBrowser.ts 首行 import 'expo-modules-core',后者 EventEmitter 求值期读
 * globalThis.Expo.EventEmitter ⇒ jsdom TypeError,登录 / OAuth 套件收集期整体失败。
 * 与 expo-linking / expo-device / expo-blur 同型,收口在配置层 alias。
 *
 * 覆盖面按 src 实际用到的成员:openBrowserAsync / openAuthSessionAsync / dismissBrowser /
 * warmUpAsync / coolDownAsync / WebBrowserResultType。
 */

export enum WebBrowserResultType {
  CANCEL = 'cancel',
  DISMISS = 'dismiss',
  OPENED = 'opened',
  LOCKED = 'locked',
}

export interface WebBrowserResult {
  type: WebBrowserResultType
  url?: string
}

export async function openBrowserAsync(url: string): Promise<WebBrowserResult> {
  void url
  return { type: WebBrowserResultType.OPENED }
}

export async function openAuthSessionAsync(
  url: string,
  redirectUrl?: string,
): Promise<WebBrowserResult> {
  void url
  void redirectUrl
  return { type: WebBrowserResultType.DISMISS }
}

export async function dismissBrowser(): Promise<void> {}

export async function warmUpAsync(): Promise<void> {}

export async function coolDownAsync(): Promise<void> {}
