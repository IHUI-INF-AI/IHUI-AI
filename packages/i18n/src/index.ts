// @ihui/i18n — IHUI-AI 4 端(web/extension/miniapp-taro/mobile-rn)i18n 翻译单一来源共享包
//
// 用法:
//   import { translate, getValueByPath, type Locale, type Messages } from '@ihui/i18n'
//   import zhCN from '@ihui/i18n/messages/web/zh-CN.json'
//   import en from '@ihui/i18n/messages/web/en.json'
//
// 翻译文件目录结构:
//   packages/i18n/messages/<端>/<locale>.json
//   - web/           (从 apps/web/messages/ 迁移)
//   - extension/     (从 apps/extension/src/i18n/messages/ 迁移)
//   - miniapp-taro/  (从 apps/miniapp-taro/src/i18n/ 迁移,.ts → .json)
//   - mobile-rn/     (从 apps/mobile-rn/src/i18n/messages/ 迁移,.ts → .json)

export * from './types'
export * from './loader'
