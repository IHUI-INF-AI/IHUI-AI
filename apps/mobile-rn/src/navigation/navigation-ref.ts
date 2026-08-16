import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootStackParamList } from './RootNavigator'

/**
 * 全局 navigation ref。
 *
 * 用于在 NavigationContainer 之外的组件(如 GlobalFloatBox 全局浮窗)中触发导航,
 * 替代 useNavigation()(后者要求组件在 NavigationContainer 内)。
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>()

/** 跨组件树安全跳转:仅在导航器就绪后执行 */
export function navigateTo(name: keyof RootStackParamList): void {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never)
  }
}
