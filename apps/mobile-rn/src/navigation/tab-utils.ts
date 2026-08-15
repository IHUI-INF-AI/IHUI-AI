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

/** 恒等映射:tab key → tab key(历史兼容,保留函数签名避免调用方改动) */
export function mainScreenForTab(tab: MainTabKey): MainTabKey {
  return tab
}
