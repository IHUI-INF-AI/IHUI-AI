/**
 * 微信 APP 支付共享 Hook(mobile-rn 端)
 *
 * 抽自 VipScreen 的 pay 函数,统一封装:
 * ① 检查微信安装 ② 创建订单 ③ DEV mock 回退 ④ 调起支付 ⑤ 查询状态
 *
 * 平台独占:依赖 RN react-native-wechat-lib,不放 packages/shared(AGENTS.md §3
 * 共享层优先:依赖 RN 原生模块,不适合跨端共享)。
 *
 * 用法:
 *   const { paying, pay } = useWechatPayment({
 *     orderType: 2, // 充值订单
 *     onSuccess: () => reloadBalance(),
 *   })
 *   await pay(1000, '充值 10 元') // amountCents 单位:分
 */
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { checkPaymentStatus, createWechatAppPayment } from '@ihui/api-client'
import { isWeChatInstalled, openWeChatPayment } from '../lib/wechat-pay'

export interface UseWechatPaymentMessages {
  wechatNotInstalled?: string
  nativeUnavailable?: string
  payCancelled?: string
  payFailed?: string
  paySuccess?: string
}

export interface UseWechatPaymentOptions {
  /** 订单类型(VIP=1, 充值=2, 课程=3...)对齐后端 orderType 枚举 */
  orderType: number
  /** 支付成功回调(刷新数据等) */
  onSuccess?: (outTradeNo: string) => void | Promise<void>
  /** 支付失败/取消回调 */
  onFail?: (reason: string) => void
  /** 自定义错误提示文案(缺省走内置中文) */
  messages?: UseWechatPaymentMessages
}

export interface UseWechatPaymentReturn {
  /** 支付中(禁用按钮防重复点击) */
  paying: boolean
  /** 触发支付(amountCents 单位分,description 订单描述) */
  pay: (amountCents: number, description: string) => Promise<void>
}

const DEFAULT_MESSAGES: Required<UseWechatPaymentMessages> = {
  wechatNotInstalled: '未安装微信客户端',
  nativeUnavailable: '微信支付暂不可用',
  payCancelled: '已取消支付',
  payFailed: '支付失败,请重试',
  paySuccess: '支付成功',
}

/** 微信 APP 支付共享 Hook(抽自 VipScreen pay 函数,供 AppTopupScreen / VipScreen 等复用) */
export function useWechatPayment(options: UseWechatPaymentOptions): UseWechatPaymentReturn {
  const { orderType, onSuccess, onFail, messages } = options
  const [paying, setPaying] = useState(false)

  const pay = useCallback(
    async (amountCents: number, description: string) => {
      if (paying) return
      setPaying(true)
      try {
        // 1. 检查微信客户端是否安装
        const installed = await isWeChatInstalled()
        if (!installed) {
          Alert.alert('提示', messages?.wechatNotInstalled ?? DEFAULT_MESSAGES.wechatNotInstalled)
          onFail?.('WECHAT_NOT_INSTALLED')
          return
        }

        // 2. 创建微信 APP 支付订单(后端返回签名参数)
        const payRes = await createWechatAppPayment({
          amount: amountCents,
          orderType,
          description,
        })
        if (!payRes.success || !payRes.data) {
          Alert.alert('提示', payRes.error ?? '创建支付订单失败')
          onFail?.('CREATE_ORDER_FAILED')
          return
        }

        // 3. DEV mock 回退(无微信支付配置,直接标记成功)
        if (payRes.data.mock) {
          Alert.alert('提示', messages?.paySuccess ?? DEFAULT_MESSAGES.paySuccess)
          await onSuccess?.(payRes.data.outTradeNo)
          return
        }

        // 4. 调起微信 APP 支付(传签名参数给 react-native-wechat-lib)
        if (!payRes.data.prepayData) {
          Alert.alert('提示', messages?.nativeUnavailable ?? DEFAULT_MESSAGES.nativeUnavailable)
          onFail?.('NATIVE_UNAVAILABLE')
          return
        }
        const paySuccess = await openWeChatPayment(payRes.data.prepayData)
        if (!paySuccess) {
          Alert.alert('提示', messages?.payCancelled ?? DEFAULT_MESSAGES.payCancelled)
          onFail?.('USER_CANCELLED')
          return
        }

        // 5. 查询支付状态确认
        const orderNo = payRes.data.outTradeNo
        if (orderNo) {
          const statusRes = await checkPaymentStatus(orderNo)
          if (statusRes.success && statusRes.data?.paid) {
            Alert.alert('提示', messages?.paySuccess ?? DEFAULT_MESSAGES.paySuccess)
            await onSuccess?.(orderNo)
          } else {
            // SDK 返回成功但后端状态未同步,乐观提示
            Alert.alert('提示', messages?.paySuccess ?? DEFAULT_MESSAGES.paySuccess)
            await onSuccess?.(orderNo)
          }
        } else {
          Alert.alert('提示', messages?.paySuccess ?? DEFAULT_MESSAGES.paySuccess)
          await onSuccess?.('')
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg === 'WECHAT_NOT_INSTALLED') {
          Alert.alert('提示', messages?.wechatNotInstalled ?? DEFAULT_MESSAGES.wechatNotInstalled)
        } else if (errMsg === 'WECHAT_NATIVE_UNAVAILABLE') {
          Alert.alert('提示', messages?.nativeUnavailable ?? DEFAULT_MESSAGES.nativeUnavailable)
        } else {
          Alert.alert('提示', messages?.payFailed ?? DEFAULT_MESSAGES.payFailed)
        }
        onFail?.(errMsg)
      } finally {
        setPaying(false)
      }
    },
    [paying, orderType, onSuccess, onFail, messages],
  )

  return { paying, pay }
}
