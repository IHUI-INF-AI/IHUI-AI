// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useRef, useCallback, useEffect } from 'react'
import { getDistributionInfo, withdraw } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { WithdrawScreen as SharedWithdrawScreen } from '@ihui/rn-app/features/withdraw/WithdrawScreen'
import { onToast } from '@/host/on-toast'
import type { TFunction } from '@ihui/types'
import {
  buildWithdrawMethods,
  buildWithdrawTexts,
  formatWithdrawAmount,
  parseWithdrawAmount,
} from './withdrawal-props'

/**
 * 薄壳(第 3 批):版面/输入/方式选择/记录入口全部交给共享屏 WithdrawScreen,本端只保留
 *   ① G-933 冷启动鉴权门控(getDistributionInfo → 组级 authenticate);
 *   ② 提现提交与成功回退;
 *   ③ 到账方式/文案的本端映射(withdrawal-props.ts)。
 * 观感差异(已知并接受):原页金额输入盒的聚焦描边档由共享屏 TextField 统一承载。
 */
export default function WithdrawalPage() {
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()
  const [available, setAvailable] = useState(0)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('wechat')
  const [submitting, setSubmitting] = useState(false)
  // XUI-066:getDistributionInfo 失败曾被 catch 吞掉,余额显示 0 却仍可点提交。
  const [loadError, setLoadError] = useState('')
  const availableRef = useRef(0)
  // 共享屏 WithdrawScreen 的 balance 约定是「元」，而 getDistributionInfo().available
  // 与 availableWithdrawal 同源、单位是「分」。
  const availableYuan = available / 100
  // 提现成功后的延迟返回定时器:存引用以便卸载时取消,否则用户自行返回会多退一层页面
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (navigateTimerRef.current) clearTimeout(navigateTimerRef.current)
    },
    [],
  )

  const methods = buildWithdrawMethods(tt)
  const texts = buildWithdrawTexts(tt)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const info = await getDistributionInfo()
      setAvailable(info.available)
      availableRef.current = info.available
    } catch {
      setLoadError(tt('common.loadFailed', '加载失败'))
    }
  }, [tt])

  const fillAll = useCallback(() => {
    setAmount(formatWithdrawAmount(availableRef.current / 100))
  }, [])

  const onSubmit = useCallback(async () => {
    const amt = parseWithdrawAmount(amount)
    if (!amt || amt <= 0) {
      onToast(tt('distribution.withdraw.invalidAmount', '请输入有效金额'), { kind: 'error' })
      return
    }
    if (Math.round(amt * 100) > availableRef.current) {
      onToast(tt('distribution.withdraw.insufficient', '可提现余额不足'), { kind: 'info' })
      return
    }
    setSubmitting(true)
    try {
      // 服务端 /distribution/withdraw 收「分」（与 availableWithdrawal 直接比较），
      // 而 parseWithdrawAmount 产出「元」，提交前必须转分。
      await withdraw({ amount: Math.round(amt * 100), type: method })
      onToast(tt('distribution.withdraw.submitted', '提现申请已提交'), { kind: 'success' })
      navigateTimerRef.current = setTimeout(() => Taro.navigateBack(), 800)
    } catch {
      // U-7:提现失败曾被静默吞掉,用户只看到按钮回弹;现在如实提示可重试。
      onToast(tt('common.failed', '操作失败'), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [amount, method, tt, onToast])

  const goRecords = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-ai/developer/withdrawal' })
  }, [])

  useDidShow(() => {
    // G-933 冷启动门控:可提现金额(GET /distribution/overview,组级 authenticate)需鉴权
    gate.waitUntilReady(() => {
      void load()
    })
  })

  return (
    <ThemeRoot>
      <SharedWithdrawScreen
        t={tt as unknown as TFunction}
        amount={amount}
        loading={false}
        error={loadError}
        success=""
        onAmountChange={setAmount}
        onSubmit={onSubmit}
        onBack={() => {
          void Taro.navigateBack()
        }}
        colorScheme={resolvedTheme}
        balance={availableYuan}
        methods={methods}
        method={method}
        onMethodChange={setMethod}
        onFillAll={fillAll}
        onRecords={goRecords}
        recordsLabel={texts.records}
        texts={texts}
        submitting={submitting}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
