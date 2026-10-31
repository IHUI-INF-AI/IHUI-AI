// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export { default as NavBar } from './NavBar'

export { default as ModelList } from './ModelList'
export type { ModelItem } from './ModelList'

export { default as DrawerComponent } from './DrawerComponent'

export { default as Ranking } from './Ranking'
export type { RankingItem } from './Ranking'

export { default as FloatBox } from './FloatBox'

export { default as EmptyState } from './EmptyState'

export type { ModelType } from './ModelTypeButton'

export { default as ModelTypeButtonGroup } from './ModelTypeButtonGroup'

export type { AgentInfo } from './AgentListPanel'

export { default as ModelConfigDialog } from './ModelConfigDialog'
export type { ModelConfig } from './ModelConfigDialog'

export { default as BottomActionBar } from './BottomActionBar'

export { default as VideoPlayer } from './VideoPlayer'

export { default as VideoInfo } from './VideoInfo'

export { default as VideoTabs } from './VideoTabs'
export type { VideoTabKey } from './VideoTabs'

export { default as LikeFavoriteShare } from './LikeFavoriteShare'

export { default as Catalog } from './Catalog'
export type { ChapterItem } from './Catalog'

export { default as Introduction } from './Introduction'

export { default as Comment } from './Comment'
export type { CommentItem } from './Comment'

export { default as PayPopup } from './PayPopup'
export type { PayInfo } from './PayPopup'

// ============ P0-2 通用组件(组内件数不写进标题 —— 摘除死件后任何静态计数都会腐烂) ============

export { default as SearchBar } from './SearchBar'

// ============ P0-2 VIP 弹窗 4 组件 ============
export { default as VipBenefitsPopup } from './VipBenefitsPopup'
export type { VipBenefit } from './VipBenefitsPopup'

export { default as VipPriceSelector } from './VipPriceSelector'
export type { PriceOption } from './VipPriceSelector'

export { default as VipPayConfirm } from './VipPayConfirm'

// ============ P0-2 分销 5 组件 ============

// ============ P0-2 学习系统 12 组件 ============
export { default as CourseHeader } from './CourseHeader'
export type { CourseHeaderData } from './CourseHeader'

export { default as LessonListItem } from './LessonListItem'

export { default as ProgressCircle } from './ProgressCircle'

export { default as NoteEditor } from './NoteEditor'

export { default as TeacherCard } from './TeacherCard'

export { default as CourseIntro } from './CourseIntro'

export { default as LessonComplete } from './LessonComplete'

export { default as StudyStats } from './StudyStats'

export { default as CourseRating } from './CourseRating'

export { default as QrCodeShare } from './QrCodeShare'

export { default as LearningStreak } from './LearningStreak'
export type { StreakDay } from './LearningStreak'

// ============ P0-2 消息系统 8 组件 ============
export { default as MessageTabs } from './MessageTabs'
export type { MessageTabItem } from './MessageTabs'

export { default as SystemNotice } from './SystemNotice'
export type { SystemNoticeItem } from './SystemNotice'

export { default as PrivateMessageList } from './PrivateMessageList'
export type { PrivateMessageItem } from './PrivateMessageList'

export { default as MessageDetail } from './MessageDetail'
export type { MessageDetailItem } from './MessageDetail'

export { default as UnreadBadge } from './UnreadBadge'

export { default as MessageActions } from './MessageActions'

export { default as NotificationSettings } from './NotificationSettings'
export type { NotificationSettingItem } from './NotificationSettings'

// ============ AI 聊天 3 组件 ============
export { default as InputArea } from './InputArea'
export type { InputFileItem } from './InputArea'

export { default as SkillsPopup } from './SkillsPopup'
export type { AgentItem } from './SkillsPopup'

export { default as MaterialPopup } from './MaterialPopup'
export type { MaterialTab } from './MaterialPopup'

export { default as IntelligentAssistant } from './IntelligentAssistant'

// ============ P2 通用扩展组件(2026-07-30) ============

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
