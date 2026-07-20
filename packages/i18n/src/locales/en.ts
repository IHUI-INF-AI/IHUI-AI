/**
 * en locale — 5 语言统一入口
 * 内容物理上位于 packages/i18n/src/locales/_sources/apps/{app}/{lang}.ts
 */

export { default as desktop } from './_sources/apps/desktop/en.js'
export { default as extension } from './_sources/apps/extension/en.js'
export { default as mobile } from './_sources/apps/mobile-rn/en.js'
export { default as miniapp } from './_sources/apps/miniapp-taro/en.js'

/** 共享 common 命名空间(从 desktop canonical 化,各 app 复用) */
export { default as common } from './_sources/apps/desktop/en.js'
