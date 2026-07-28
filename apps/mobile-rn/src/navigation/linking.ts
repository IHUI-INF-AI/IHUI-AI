import type { LinkingOptions } from '@react-navigation/native'
import type { RootStackParamList } from './RootNavigator'
import { WEB_BASE } from '@ihui/shared/constants'

/**
 * react-navigation linking 配置。
 * 让 Solito TextLink 在 RN 端工作:URL 路径 → screen 映射。
 * 只配置关键路由,其他路由走 navigation.navigate 不受影响。
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ihui://', WEB_BASE],
  config: {
    screens: {
      // 首页:空路径匹配根路径 /
      Tabs: '',
      // 共享组件 Demo(对齐 web 端 /solito-demo 路由,跨端 deep link 一致)
      SharedDemo: 'solito-demo',
      // 登录/注册
      Login: 'login',
      Register: 'register',
    },
  },
}
