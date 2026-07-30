/**
 * Taro 适配层 barrel 导出 — apps/miniapp-taro
 *
 * 复用 packages/app 共享组件的 props 契约 + 主题/数据/状态机,
 * 替换 web 元素为 @tarojs/components 的 View/Text/ScrollView/Image + onTap 事件。
 *
 * 9 个共享组件适配器(本批次 + P2-F 二批):
 * - SectionHeader: "标题 + 查看更多" 区块头部
 * - ColorfulLoader: 72 点彩色旋转加载器
 * - PayButton: 5 种类型支付按钮 + 自绘 Modal
 * - Selecter: 5 种类型通用选择器(scale/video/voice/ratio/default)
 * - Carousel: 横向轮播(图/卡) + 指示器 + 自动播放
 * - NavBar: 状态栏 + 返回按钮 + 标题/副标题 + 右侧动作
 * - TabBar: 5 Tab 状态机 + safe area 适配
 * - Toolbar: 水平工具栏 + active 状态 + 分隔线
 * - UserInfoCard: 未登录/已登录态 + 角色 badge + 智汇值格式化
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

export { Carousel } from './Carousel.taro'
export type { CarouselProps } from './Carousel.taro'

export { NavBar } from './NavBar.taro'
export type { NavBarProps } from './NavBar.taro'

export { TabBar } from './TabBar.taro'
export type { TabBarProps, TabBarItemConfig, TabBarKey } from './TabBar.taro'

export { Toolbar } from './Toolbar.taro'
export type { ToolbarProps, ToolbarItem } from './Toolbar.taro'

export { UserInfoCard } from './UserInfoCard.taro'
export type { UserInfoCardProps } from './UserInfoCard.taro'

