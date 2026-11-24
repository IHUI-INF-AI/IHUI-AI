// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/i18n.ts —— RN 壳里 `import { useI18n } from '../i18n'` 的落点。
 *
 * 机制:webpack 的 NormalModuleReplacementPlugin 把相对请求 `../i18n` 换成本文件
 * (见 apps/miniapp-taro/config/index.ts 的 rnShellReplacements)。本文件只做一件事 ——
 * 把**端内已有的 i18n 真相源**(`@/i18n`)整体转出口,再补 RN 侧有、端内没有的名字。
 *
 * 为什么不另建一套取词:RN 壳的 `useI18n()` 取 `{locale, t, setLocale}`,端内的
 * `useI18n()` 取 `{locale, t, tList, setLocale}` —— 端内是超集,直接转出口即同形可用。
 * 再建一份 i18n 就是 §0.6 禁止的第二份真相源(词包与端内 5 语言 JSON 必然漂移)。
 */
import { getMessages } from '@/i18n'

export * from '@/i18n'

/**
 * RN 壳的底栏/卡片文案键在小程序的精简词典里没有收录（词典只保证 tabBar.community/agent/
 * square/user/share 五枚），壳直接取键名会露 `tabBar.market`。这里把 RN 底栏五键补进
 * 端内 zh-CN 词典对象，仍是同一份词典实例（`getMessages('zh-CN')` 返回引用），不另立真相源。
 */
const zhPack = getMessages('zh-CN') as unknown as Record<string, unknown>
try {
  const tabBar = (zhPack.tabBar ?? {}) as Record<string, string>
  Object.assign(tabBar, {
    market: 'AI应用商店',
    plaza: '广场',
    chat: '智汇AI',
    feed: '动态',
    me: '我的',
  })
  zhPack.tabBar = tabBar
  const aiCard = (zhPack.aiCard ?? {}) as Record<string, string>
  if (!aiCard.tFreeUse) aiCard.tFreeUse = '免费使用'
  zhPack.aiCard = aiCard
  // 九宫格「回放列表」在端内词包缺 livePlaybackList 这一组，壳按 RN 词面补齐，
  // 避免回落到 livePlayback.title 的「直播回放」。
  const playbackList = (zhPack.livePlaybackList ?? {}) as Record<string, string>
  if (!playbackList.title) playbackList.title = '回放列表'
  zhPack.livePlaybackList = playbackList
} catch {
  // 词典被冻结时不影响页面渲染，壳会退化为显示键名
}

/**
 * RN 壳里的 `import { messages } from '../i18n'` 会直接按 locale 下标取整包：
 * `messages[locale]`。端内 i18n 只暴露 `getMessages(locale)`，这里补一个同形
 * 只读视图，避免壳页拿到 undefined 后崩在 `messages['zh-CN']`。
 */
export const messages = new Proxy(
  {},
  {
    get: (_target, locale) =>
      typeof locale === 'string' ? getMessages(locale as Locale) : undefined,
  },
) as Record<Locale, ReturnType<typeof getMessages>>

/** RN 壳里 `getValueByPath(messages[locale], 'a.b')` 的同源转出口 */
export { getValueByPath } from '@ihui/i18n/loader'

/** RN 侧的 Locale 形态(壳里有 1 处 `import type { Locale }`),取端内 locale 字面量集 */
export type Locale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
