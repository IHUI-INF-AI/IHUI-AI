// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'

/**
 * 同型根因 S-02(2026-11-08 自查):输入法组合态 Enter/逗号误提交。
 *
 * 全仓有 30+ 处 `onKeyDown={(e) => e.key === 'Enter' && submit()}` 形式的输入框
 * (发消息/改名/加标签/加白名单/保存配置),此前只能逐个补 `isComposing` 判断,
 * 新增一处就漏一处。这里在 window 捕获阶段统一拦截:
 * 组合态(isComposing / keyCode 229)下的 Enter 与逗号不再向 React 业务处理器传播,
 * 只留给输入法完成「候选词上屏」。普通 Enter/逗号不受影响。
 */
export function isImeComposingEvent(e: { isComposing?: boolean; keyCode?: number }): boolean {
  return Boolean(e.isComposing) || e.keyCode === 229
}

export function useImeCompositionGuard(): void {
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isImeComposingEvent(e)) return
      if (e.key !== 'Enter' && e.key !== ',') return
      // 捕获阶段截断:React 的委托监听与业务 onKeyDown 都收不到这一下
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
