// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { getQueryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth'

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // 2026-08-06 修复:登录/静默登录成功后失效全部查询。
  // 原因:access token 过期时对话列表等请求 401 进入 error 态(界面"加载失败");
  // 重新登录拿到新 token 后,react-query 缓存仍是失败状态(query key 未变、
  // staleTime 未过期且无 invalidate) → 界面一直显示"加载失败"直到手动刷新。
  // 监听登录态 false→true,全量 invalidate 让所有数据用新 token 重新拉取。
  //
  // 2026-09-18 优化:invalidate 延迟 250ms 执行,错开登录弹窗遮罩淡出窗口
  // (用户反馈"登录成功后从灰到亮渐渐显示页面内容且特别卡顿"根治)。
  // 根因:全量 invalidate → 几十个 useQuery 并发重取 → 响应陆续到达触发多波
  // 全页重渲染,恰与弹窗关闭的 150ms 遮罩淡出同窗口,主线程被占满 → 淡出逐帧掉队。
  // 延迟到淡出结束后再失效重取:淡出期间主线程空闲动画满帧,重取的 loading
  // 发生在遮罩撤走后(正常加载体验)。正确性:token 已即时写入 auth store,
  // 窗口期若有查询自行 refetch 用的已是新 token,2026-08-06 的 401 修复语义不变。
  const prevAuth = useRef(isAuthenticated)
  useEffect(() => {
    if (isAuthenticated && !prevAuth.current) {
      // timer 清理挂在本 effect 的 cleanup:组件卸载自动取消 pending invalidate;
      // window.setTimeout 明确 DOM 语义(返回 number),避免 Node/DOM 混合类型歧义。
      const timer = window.setTimeout(() => {
        void queryClient.invalidateQueries()
      }, 250)
      return () => window.clearTimeout(timer)
    }
    prevAuth.current = isAuthenticated
  }, [isAuthenticated, queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export default QueryProvider
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
