// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 收编试点入口(2026-10-28)。
 *
 * 共享屏是 RN / 小程序的唯一渲染真相源;web 侧经 react-native-web 承载同一份源码。
 * 从包根 `@ihui/rn-app` 导入会把 249 屏的编译闭包整棵拉进 web 路由,故试点期只在此
 * 显式列出被试点的那几屏。收编面扩大时同步追加,不要绕开本入口从包根导入。
 */
export { IcpRecordScreen } from './features/icp-record/IcpRecordScreen'
export { AnnouncementDetailScreen } from './features/announcement-detail/AnnouncementDetailScreen'
export { AgreementScreen } from './features/agreement/AgreementScreen'
// 分类详情页的两段(web 侧原先 inline 实现,2026-11-05 抽为单源后由 web 经本入口消费)
export { CategoryHeader } from './features/category-detail/CategoryHeader'
export { AgentAvatar } from './features/category-detail/AgentAvatar'
export type { CategoryHeaderProps, CategoryDetailScreenProps } from '@ihui/types'
// 考试结果页:整屏单源(骨架来自 feat/exam-result-single-source 59504bbbac,
// 三数/全量解析/rank/三操作一份实现,web 与小程序 RN 壳共消费同一屏;
// 主干另一套「两段抽块」(ExamResultStats.tsx / ReviewList.tsx)已被本屏覆盖,同批删除。
export type {
  ExamResultStatItem,
  ExamResultStatsProps,
  ExamReviewItem,
  ExamReviewListProps,
} from '@ihui/types'
// A2(2026-11-05):AI 会话历史共享屏 —— web 试点承载(react-native-web 同源)
export {
  ConversationHistoryScreen,
  orderHistoryRows,
} from './features/chat/ConversationHistoryScreen'
export type {
  ConversationHistoryGroup,
  ConversationHistoryRow,
} from './features/chat/ConversationHistoryScreen'
export {
  ExamResultStats,
  ExamResultReviewList,
  ExamResultActions,
  normalizeExamAnswer,
  deriveExamResultStats,
  type ExamResultStatsValue,
} from './features/exam-result/exam-result-sections'
export type { ExamResultReviewItem } from './types'
export type { AnnouncementDetailItem } from './types'
// web 收编规模化第一批(2026-11-07):安全审计 / Token 用量 / 应用权限三屏
export { SecurityAuditScreen, auditTypeOf } from './features/security-audit/SecurityAuditScreen'
export type {
  SecurityAuditItem,
  SecurityAuditScreenProps,
  SecurityAuditType,
} from './features/security-audit/SecurityAuditScreen'
export { UsageScreen, formatTokens, usageBarWidth } from './features/usage/UsageScreen'
export type {
  UsageBreakdownRow,
  UsageStats,
  UsageQuota,
  UsageScreenProps,
} from './features/usage/UsageScreen'
export { AppPermissionScreen } from './features/app-permission/AppPermissionScreen'
export type { AppPermissionScreenProps } from './features/app-permission/AppPermissionScreen'
// web 收编第二批(2026-11-07):ICP 备案 / 证书验证 —— 两屏各加"有值才渲染"的可选展示位后由 web 承载
export { CertVerifyScreen } from './features/cert-verify/CertVerifyScreen'
export type { CertVerifyResult, CertVerifyScreenProps } from '@ihui/types'
export type { IcpRecordScreenProps } from '@ihui/types'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
