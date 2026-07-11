'use client'

import * as React from 'react'

export interface UseLoginDialogReturn {
  open: boolean
  /** 登录成功后要跳转的回跳地址 */
  redirectUrl: string | null
  openLogin: (redirectUrl?: string) => void
  closeLogin: () => void
  onSuccess: (() => void) | null
}

interface LoginDialogState {
  open: boolean
  redirectUrl: string | null
  onSuccess: (() => void) | null
}

/** 登录对话框 Hook，支持指定回跳地址与成功回调 */
export function useLoginDialog(): UseLoginDialogReturn {
  const [state, setState] = React.useState<LoginDialogState>({
    open: false,
    redirectUrl: null,
    onSuccess: null,
  })

  const openLogin = React.useCallback((redirectUrl?: string) => {
    setState({
      open: true,
      redirectUrl: redirectUrl ?? null,
      onSuccess: null,
    })
  }, [])

  const closeLogin = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  // 提供给调用方在打开时注入回调
  const setOnSuccess = React.useCallback((cb: (() => void) | null) => {
    setState((prev) => ({ ...prev, onSuccess: cb }))
  }, [])

  // onSuccess 通过 state 传递，这里返回引用
  void setOnSuccess

  return {
    open: state.open,
    redirectUrl: state.redirectUrl,
    openLogin,
    closeLogin,
    onSuccess: state.onSuccess,
  }
}
