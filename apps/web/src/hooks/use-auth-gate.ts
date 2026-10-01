// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useAuthStore } from '@/stores/auth'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'

/**
 * 登录态门(2026-09-30 整类修复的复用出口,台账任务见 PROJECT_PLAN.md「登录态门整类 campaign」)。
 *
 * 背景:大量个性化页面(浏览历史/收藏/任务列表等)的 react-query 查询没有 enabled 门,
 * 匿名/会话过期时照样发注定 401 的请求 → TanStack 重试三轮(「加载中」空转约 8s)
 * → 落到「操作失败,请稍后重试」,全程零登录引导。首例修复 /chat/history(d38746183b)。
 *
 * 用法:
 *   const { allow } = useAuthGate()
 *   useQuery({ ..., enabled: allow })
 *   if (!allow) return <AuthGatePrompt message="请先登录后查看××" />
 *
 * 注意:admin/* 页面不需要(服务端守卫 307 打回登录);纯公开内容页(文章/活动)不适用。
 *
 * 整类 campaign 扫描(2026-09-30 立,约 100+ 页待逐页套用,修复=两行改动):
 *   for f in $(grep -rln "useQuery\|useInfiniteQuery" apps/web/app --include="*.tsx"); do
 *     case "$f" in *"/admin/"*) continue;; esac
 *     grep -q fetchApi "$f" && ! grep -q "enabled:" "$f" && echo "$f"; done
 * 已修:/chat/history(d38746183b)、/chat/favorites、/member/history(2026-09-30)。
 */
export function useAuthGate() {
  const { ready } = useAuthBootstrap()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return { ready, allow: ready && isAuthenticated }
}
