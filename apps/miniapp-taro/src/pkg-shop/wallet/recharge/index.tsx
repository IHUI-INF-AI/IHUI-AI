// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/app-topup/AppTopupScreen.tsx
// 薄壳(第 3 批):页面渲染全部交给共享屏 AppTopupScreen,本端只保留
//   ① G-933 冷启动鉴权门控(getProfile → /user/profile 需鉴权);
//   ② 微信/支付宝支付平台调用与回执跳转;
//   ③ 金额档位/文案/用户资料的本端映射(recharge-props.ts)。
// 观感差异(已知并接受):原页整屏 loading 遮罩改为共享屏提交中态;原自定义金额标签并入输入占位。

import { useTt } from '@/i18n'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { createRecharge, createAlipayMiniappPayment, getProfile, type UserInfo } from '@/api'
import { requestWxPayment, requestAliPayment, type AnyPayParams } from '@/utils/pay'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { AppTopupScreen as SharedAppTopupScreen } from '@ihui/rn-app/features/app-topup/AppTopupScreen'
import { onToast } from '@/host/on-toast'
import type { TFunction } from '@ihui/types'
import {
  PRESET_AMOUNTS,
  TOKEN_RATE,
  buildAmountOptions,
  buildPayMethods,
  buildRateTiers,
  buildRechargeUser,
  buildRechargeTexts,
  buildWechatPayParams,
  resolveRechargeAmount,
  yuanToCents,
} from './recharge-props'

type PayMethod = 'wechat' | 'alipay'

export default function RechargePage() {
  const tt = useTt()
  const { resolvedTheme } = useTheme()

  const [user, setUser] = useState<UserInfo | null>(null)
  const [selectedId, setSelectedId] = useState('100')
  const [customAmount, setCustomAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('wechat')
  const [submitting, setSubmitting] = useState(false)

  const finalAmount = resolveRechargeAmount(selectedId, customAmount)

  const { waitUntilReady } = useAuthReadyGate()

  const loadProfile = useCallback(() => {
    getProfile()
      .then((u) => {
        if (u) setUser(u)
      })
      .catch(() => {})
  }, [])

  // G-933 冷启动门控:getProfile → /user/profile 需鉴权(miniapp-compat-routes.ts:2247 checkAuth),
  // 整块延后到鉴权判定落定。
  useEffect(() => {
    return waitUntilReady(loadProfile)
  }, [waitUntilReady, loadProfile])

  const onSelectAmount = useCallback((id: string) => {
    setSelectedId(id)
    setCustomAmount('')
  }, [])

  const onCustomAmountChange = useCallback((text: string) => {
    setCustomAmount(text)
    if (text) setSelectedId('')
  }, [])

  const payOrder = useCallback(
    async (amount: number, method: PayMethod) => {
      if (method === 'alipay') {
        const res = await createAlipayMiniappPayment({
          amount,
          subject: tt('wallet.recharge.submit', '充值'),
        })
        const orderNo = res.outTradeNo || ''
        if (!res.tradeNo) {
          onToast(tt('pay.configNotReady', '支付宝支付配置未就绪'), { kind: 'error' })
          Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` })
          return
        }
        try {
          await requestAliPayment({ tradeNO: res.tradeNo } as AnyPayParams)
          Taro.redirectTo({
            url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&amount=${amount}&status=paid`,
          })
        } catch {
          Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` })
        }
        return
      }
      // 微信下单 amount 单位是分(page 输入/展示是元);orderType=2 由 createRecharge 固定
      const res = await createRecharge(yuanToCents(amount), method)
      const orderNo = res.outTradeNo || ''
      // 后端返回扁平签名(无 payParams 包络);mock/缺签名 ⇒ null,不得直跳 paid
      const payParams = buildWechatPayParams(res)
      if (!payParams) {
        Taro.redirectTo({
          url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&amount=${amount}&status=pending`,
        })
        return
      }
      try {
        await requestWxPayment(payParams)
        Taro.redirectTo({
          url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&amount=${amount}&status=paid`,
        })
      } catch {
        Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` })
      }
    },
    [tt],
  )

  const onSubmit = useCallback(async () => {
    if (!finalAmount || finalAmount < 1) {
      onToast(tt('wallet.recharge.invalidAmount', '请输入有效金额'), { kind: 'error' })
      return
    }
    setSubmitting(true)
    try {
      await payOrder(finalAmount, payMethod)
    } catch {
      // XUI-073:下单本身失败时根本没有 orderNo,不能跳到一个「单号为空」的结果页;
      // 就地提示失败,留在充值页让用户重试。
      onToast(tt('wallet.recharge.submitFailed', '充值提交失败,请重试'), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [finalAmount, payMethod, payOrder, tt])

  const texts = {
    ...buildRechargeTexts(tt),
    submit: `${tt('wallet.recharge.submit', '充值')} ¥${finalAmount.toFixed(2)}`,
  }

  return (
    <ThemeRoot>
      <SharedAppTopupScreen
        t={tt as unknown as TFunction}
        selectedId={selectedId}
        customAmount={customAmount}
        payMethod={payMethod}
        refreshing={false}
        introVisible={false}
        userTier="normal"
        amountOptions={buildAmountOptions(PRESET_AMOUNTS)}
        payMethods={buildPayMethods(tt)}
        onSelectAmount={onSelectAmount}
        onCustomAmountChange={onCustomAmountChange}
        onSelectPayMethod={(id: string) => setPayMethod(id as PayMethod)}
        onRefresh={loadProfile}
        onSubmit={onSubmit}
        onCloseIntro={() => {}}
        onBack={() => {
          void Taro.navigateBack()
        }}
        colorScheme={resolvedTheme}
        user={buildRechargeUser(user)}
        rateTiers={buildRateTiers(TOKEN_RATE)}
        submitting={submitting}
        texts={texts}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
