/**
 * 导航 Tab 类型 + 工具函数(独立模块)。
 *
 * 提取原因:screen 需 import MainTabKey / mainScreenForTab,若从 RootNavigator import
 * 会形成 RootNavigator → screen → RootNavigator 的 require cycle(Metro 警告 + 运行时
 * 未初始化值风险,曾导致 "property is not configurable" 崩溃)。独立模块无回环依赖。
 */

export type MainStackParamList = {
  HomeMain: undefined
  CourseMain: undefined
  AiMain: undefined
  LiveMain: undefined
  ProfileMain: undefined
}

export type MainTabKey = keyof MainStackParamList

/**
 * Drawer 5 主菜单 → RN Tab 路由映射(单一来源,2026-08-15 立)。
 *
 * 背景:此前映射表在 5 个 screen 内各自复制(AgentScreen/PlazaScreen/ProfileScreen/
 * ShareScreen/SquareScreen),另有 4 个 screen(HomeScreen/ChatScreen/AiAssistantN8nScreen/
 * StudyIndexScreen)直接 `tab as MainTabKey` 把 DrawerTab('mine'/'home'/'ai')当 Tab 路由名
 * 传入 navigate('Main', { screen: 'mine' }),导致 TabRouter 返回 null,跳转被静默忽略
 * (LogBox: "couldn't be applied to the navigator")。统一收敛到此模块杜绝同类 bug。
 */
// type-only import,编译期擦除,不会引入运行时 require cycle
import type { DrawerTab } from '../components/Drawer'

export const DRAWER_TAB_TO_RN_TAB: Record<DrawerTab, MainTabKey> = {
  home: 'HomeMain',
  ai: 'AiMain',
  square: 'HomeMain', // 广场走 RootStack 独立路由,Tab 兜底回首页
  share: 'HomeMain', // 动态走 RootStack 独立路由,Tab 兜底回首页
  mine: 'ProfileMain',
}

/** 恒等映射:tab key → tab key(历史兼容,保留函数签名避免调用方改动) */
export function mainScreenForTab(tab: MainTabKey): MainTabKey {
  return tab
}
