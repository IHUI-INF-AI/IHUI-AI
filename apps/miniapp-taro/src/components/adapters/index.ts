/**
 * Taro 适配层 barrel 导出 — apps/miniapp-taro
 *
 * 复用 packages/app 共享组件的 props 契约 + 主题/数据/状态机,
 * 替换 web 元素为 @tarojs/components 的 View/Text/ScrollView/Image + onTap 事件。
 *
 * 4 个起步组件(本批次):
 * - SectionHeader: "标题 + 查看更多" 区块头部
 * - ColorfulLoader: 72 点彩色旋转加载器
 * - PayButton: 5 种类型支付按钮 + 自绘 Modal
 * - Selecter: 5 种类型通用选择器(scale/video/voice/ratio/default)
 *
 * 后续批次:FeedbackScreen / SettingsScreen / ProfileScreen 等 16 屏共享组件。
 */

export { SectionHeader } from './SectionHeader.taro'
export type { SectionHeaderProps } from './SectionHeader.taro'

export { ColorfulLoader } from './ColorfulLoader.taro'
export type { ColorfulLoaderProps } from './ColorfulLoader.taro'

export { PayButton } from './PayButton.taro'
export type { PayButtonProps, PayButtonType } from './PayButton.taro'

export { Selecter } from './Selecter.taro'
export type { SelecterProps, SelecterType, SelecterOption } from './Selecter.taro'
