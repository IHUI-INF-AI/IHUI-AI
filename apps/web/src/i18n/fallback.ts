// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 缺键 / 缺参的运行期兜底(2026-11-23 立,与静态门配合成双保险)
//
// 事实:next-intl 在两种情况下**既不抛错、也不回落到默认文案**:
//   ① MISSING_MESSAGE       键不存在
//   ② INSUFFICIENT_PARAMS   文案里有 {var},调用没给齐参数(实测:值「对比度低于 {threshold}…」被
//      `t('autoContrastHint')` 无参调用 ⇒ 界面直接显示 appearanceSettings.autoContrastHint)
// 两者都会把整条键路径原样画到界面上 —— 用户看到的就是 `nav.hrGroup` 那一类"键值名"。
//
// 静态门(check-i18n-data-keys / check-i18n-placeholder-arity)负责在提交前拦住;
// 这里是运行期最后一道:漏网时不再显示键路径,显示可读文案,并在控制台点名(按消息去重)。
// 服务端(request.ts)与客户端(i18n-provider)都必须挂 —— 只挂一边,SSR 首帧照样出裸键。

import type { AbstractIntlMessages } from 'next-intl'

/** 兜底文案键(五语言齐备,见 packages/i18n/messages/shared/*.json) */
const TEXT_UNAVAILABLE_KEY = 'common.textUnavailable'
const HARD_FALLBACK = '文案暂不可用'

/** 取点分路径的字符串叶子;不是字符串返回 undefined */
export function leafMessage(messages: AbstractIntlMessages, dotted: string): string | undefined {
  let cur: unknown = messages
  for (const seg of dotted.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return typeof cur === 'string' ? cur : undefined
}

/** 该语言下的兜底文案(词库自带 + 硬兜底,保证永远不显示键路径) */
export function fallbackText(messages: AbstractIntlMessages): string {
  return leafMessage(messages, TEXT_UNAVAILABLE_KEY) ?? HARD_FALLBACK
}

/**
 * next-intl 的 getMessageFallback:缺键/缺参时用它替代默认的 `${namespace}.${key}`。
 * 服务端与客户端传同一实现,口径唯一。
 */
export function makeMessageFallback(messages: AbstractIntlMessages) {
  const text = fallbackText(messages)
  return () => text
}

const seen = new Set<string>()

/**
 * onError:点名"哪个键缺了 / 哪个键参数不齐",按消息去重(避免每帧刷屏)。
 * 只在开发期把细节打到控制台;生产期也打,但只一行,便于按日志追。
 */
export function reportI18nError(error: { code?: string; message?: string }): void {
  const code = String(error.code ?? '')
  if (code !== 'MISSING_MESSAGE' && code !== 'INSUFFICIENT_PARAMS') return
  const msg = String(error.message ?? '')
  if (seen.has(msg)) return
  seen.add(msg)
  const hint =
    code === 'INSUFFICIENT_PARAMS'
      ? '调用没给齐占位符参数 —— 给 t(key, { … }) 补参,复验 node scripts/check-i18n-placeholder-arity.mjs'
      : '词库缺少键 —— 补 packages/i18n/messages/{shared,web}/<locale>.json,复验 node scripts/check-i18n-data-keys.mjs'
  console.error(`[i18n] ${code}:${msg} —— ${hint}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
