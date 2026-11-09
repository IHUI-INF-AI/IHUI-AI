// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// @gen-rn-host-shell —— 本文件为生成物,勿手改结构;共享屏 props 变更后重跑:
//   node scripts/gen-rn-host-shell.mjs --screen=packages/app/src/features/finance/FinanceScreen.tsx --write --force

import { FinanceScreen as SharedFinanceScreen } from '@ihui/rn-app'

/**
 * RN 宿主薄壳 —— 真相源 finance/FinanceScreen.tsx。
 * 端内不写布局、不写样式:视觉与结构全在共享屏,本屏只做平台注入(取词/主题/返回)。
 */
export function FinanceScreen() {
  return (
    <SharedFinanceScreen />
  )
}
