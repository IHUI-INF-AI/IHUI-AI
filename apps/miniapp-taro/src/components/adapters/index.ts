/**
 * Taro 适配层 barrel 导出 — apps/miniapp-taro
 *
 * 复用 packages/app 共享组件的 props 契约 + 主题/数据/状态机,
 * 替换 web 元素为 @tarojs/components 的 View/Text/ScrollView/Image + onTap 事件。
 *
 * 18 个共享组件适配器(起步 4 通用 + 二批 5 通用 + 三批 9 屏):
 *
 * 起步批次(4 通用组件):
 * - SectionHeader: "标题 + 查看更多" 区块头部
 * - ColorfulLoader: 72 点彩色旋转加载器
 * - PayButton: 5 种类型支付按钮 + 自绘 Modal
 * - Selecter: 5 种类型通用选择器(scale/video/voice/ratio/default)
 *
 * 二批(5 通用组件,其他 agent):
 * - Carousel: 横向轮播(图/卡) + 指示器 + 自动播放
 * - NavBar: 状态栏 + 返回按钮 + 标题/副标题 + 右侧动作
 * - TabBar: 5 Tab 状态机 + safe area 适配
 * - Toolbar: 水平工具栏 + active 状态 + 分隔线
 * - UserInfoCard: 未登录/已登录态 + 角色 badge + 智汇值格式化
 *
 * 三批(9 屏共享组件,P2-F.2 + P2-F.3,本批次):
 * - FeedbackScreen: 反馈提交(类型选择 + 内容输入 + 联系方式 + 提交)
 * - SettingsScreen: 设置(密码修改 + 通知开关 + 账户跳转 + 退出)
 * - OrderScreen: 订单列表(tab 切换 + 卡片列表 + 下拉刷新)
 * - WalletScreen: 钱包(余额卡片 + 交易列表 + 下拉刷新)
 * - MessageCenterScreen: 消息中心(tab 切换 + 消息列表 + 下拉刷新)
 * - StudyPlanScreen: 学习计划(状态徽章 + 进度条 + 卡片列表)
 * - CertificateScreen: 证书列表(状态徽章 + 卡片列表 + 下拉刷新)
 * - NoteListScreen: 笔记列表(卡片列表 + 创建按钮 + 下拉刷新)
 * - NoteDetailScreen: 笔记详情(内容 + 元信息 + 返回)
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

// ===== 三批:9 屏共享组件(P2-F.2 + P2-F.3) =====

export { FeedbackScreen } from './FeedbackScreen.taro'
export type {
  FeedbackScreenProps,
  FeedbackType,
  FeedbackSubmitPayload,
} from './FeedbackScreen.taro'

export { SettingsScreen } from './SettingsScreen.taro'
export type { SettingsScreenProps, SharedNotificationToggles } from './SettingsScreen.taro'

export { OrderScreen } from './OrderScreen.taro'
export type { OrderScreenProps, AppOrderStatus, OrderItem, OrderTab } from './OrderScreen.taro'

export { WalletScreen } from './WalletScreen.taro'
export type { WalletScreenProps, WalletBalance } from './WalletScreen.taro'

export { MessageCenterScreen } from './MessageCenterScreen.taro'
export type {
  MessageCenterScreenProps,
  MessageCenterItem,
  MessageTab,
} from './MessageCenterScreen.taro'

export { StudyPlanScreen } from './StudyPlanScreen.taro'
export type { StudyPlanScreenProps, PlanStatus, StudyPlanItem } from './StudyPlanScreen.taro'

export { CertificateScreen } from './CertificateScreen.taro'
export type {
  CertificateScreenProps,
  CertificateItem,
  CertificateStatus,
} from './CertificateScreen.taro'

export { NoteListScreen } from './NoteListScreen.taro'
export type { NoteListScreenProps, NoteListItem } from './NoteListScreen.taro'

export { NoteDetailScreen } from './NoteDetailScreen.taro'
export type { NoteDetailScreenProps, NoteDetailItem } from './NoteDetailScreen.taro'
