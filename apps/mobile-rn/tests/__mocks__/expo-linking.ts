/**
 * expo-linking 测试替身。
 *
 * 真包 Linking.ts 首行 import 'expo-modules-core',后者的 EventEmitter 在模块求值期读
 * globalThis.Expo.EventEmitter ⇒ jsdom 下直接 TypeError,凡经 src/platform/linking.ts 的套件
 * 收集期整体失败。与 expo-device / expo-blur / expo-audio 同型,收口在配置层 alias。
 *
 * 覆盖面按 src 实际用到的成员:openURL / canOpenURL / openSettings / parse /
 * createURL / getInitialURL / addEventListener。
 */

export interface QueryParams {
  [key: string]: string | undefined
}

export function createURL(path: string, queryParams?: QueryParams): string {
  const qs = queryParams
    ? Object.entries(queryParams)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''
  return `ihui://${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`
}

export function parse(url: string): { hostname: string | null; path: string | null; queryParams: QueryParams } {
  try {
    const u = new URL(url)
    return {
      hostname: u.hostname || null,
      path: u.pathname.replace(/^\//, '') || null,
      queryParams: Object.fromEntries(u.searchParams.entries()),
    }
  } catch {
    return { hostname: null, path: null, queryParams: {} }
  }
}

export async function getInitialURL(): Promise<string | null> {
  return null
}

export async function openURL(url: string): Promise<true> {
  void url
  return true
}

export async function canOpenURL(url: string): Promise<boolean> {
  return Boolean(url)
}

export async function openSettings(): Promise<void> {}

export function addEventListener(
  _type: 'url',
  _handler: (event: { url: string }) => void,
): { remove: () => void } {
  return { remove: () => {} }
}
