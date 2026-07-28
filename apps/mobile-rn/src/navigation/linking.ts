import type { LinkingOptions } from '@react-navigation/native'
import type { RootStackParamList } from './RootNavigator'

/**
 * react-navigation linking 配置。
 * URL 路径 → screen 映射,支持 deep link。
 * 只配置关键路由,其他路由走 navigation.navigate 不受影响。
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['ihui://', 'https://ihui.ai'],
  config: {
    screens: {
      // 首页:空路径匹配根路径 /
      Tabs: '',
      // 共享组件 Demo(对齐 web 端 /shared-demo 路由,跨端 deep link 一致)
      SharedDemo: 'shared-demo',
      // 登录/注册
      Login: 'login',
      Register: 'register',
    },
  },
}
