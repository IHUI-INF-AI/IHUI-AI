import type { LinkingOptions } from '@react-navigation/native'
import type { RootStackParamList } from './RootNavigator'

/**
 * react-navigation linking 配置。
 * 让 Solito TextLink 在 RN 端工作:URL 路径 → screen 映射。
 * 只配置关键路由,其他路由走 navigation.navigate 不受影响。
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ihui://', 'https://ihui.ai'],
  config: {
    screens: {
      // 首页:空路径匹配根路径 /
      Tabs: '',
      // 共享组件 Demo
      SharedDemo: 'shared-demo',
      // 登录/注册
      Login: 'login',
      Register: 'register',
    },
  },
}
