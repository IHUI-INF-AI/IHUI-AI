/**
 * 导航工具
 * 提供页面导航相关功能
 */

import { useRouter } from 'vue-router'

/**
 * 使用导航
 * 组合式函数，提供导航功能
 */
export function useNavigation() {
  const router = useRouter()

  /**
   * 返回首页
   */
  const goHome = () => {
    void router.push('/')
  }

  /**
   * 返回上一页
   */
  const goBack = () => {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        void router.push('/')
      }
    }
  }

  /**
   * 跳转到指定路径
   */
  const navigateTo = (path: string) => {
    void router.push(path)
  }

  return {
    goHome,
    goBack,
    navigateTo,
  }
}

export default useNavigation
