// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import {} from 'react-native'
import { appAlert } from '../components/BottomPops'
import { checkPaymentStatus, createWechatAppPayment } from '@ihui/api-client'
import { isWeChatInstalled, openWeChatPayment } from '../lib/wechat-pay'

export interface UseWechatPaymentMessages {
  wechatNotInstalled?: string
  nativeUnavailable?: string
  payCancelled?: string
  payFailed?: string
  paySuccess?: string
  /**
   * 支付结果未确认时的提示（2026-11-07 DBG-30 新增）。
   * 场景：微信 SDK 返回成功但服务端轮询未拿到 paid，或轮询本身失败。
   * 此时**不能**当成功（会给用户白送充值/余额），只能提示由订单页按服务端状态刷新。
   */
  payConfirming?: string
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
  payConfirming: '支付结果确认中,请稍后在订单中查看',
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
          appAlert('提示', messages?.wechatNotInstalled ?? DEFAULT_MESSAGES.wechatNotInstalled)
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
          appAlert('提示', payRes.error ?? '创建支付订单失败')
          onFail?.('CREATE_ORDER_FAILED')
          return
        }

        /**
         * 以服务端订单状态为唯一权威(2026-11-08 XUI-008):
         * DEV mock(后端未配微信支付)只是「没调起 SDK」,不等于「已付款」——
         * 订单在服务端仍是 pending,客户端直调 onSuccess 会让用户白拿充值/余额。
         * 真实回调和 mock 都必须走这一条确认路径,查不到 paid 一律按「确认中」。
         */
        const confirmByServer = async (orderNo: string | undefined) => {
          if (!orderNo) {
            // 没有 outTradeNo ⇒ 连向服务端确认的凭据都没有,更不能当成功
            appAlert('提示', messages?.payConfirming ?? DEFAULT_MESSAGES.payConfirming)
            onFail?.('MISSING_OUT_TRADE_NO')
            return
          }
          const statusRes = await checkPaymentStatus(orderNo)
          if (statusRes.success && statusRes.data?.paid) {
            appAlert('提示', messages?.paySuccess ?? DEFAULT_MESSAGES.paySuccess)
            await onSuccess?.(orderNo)
          } else {
            // 2026-11-07(DBG-30 资金安全):原实现在这里"乐观提示成功"并调 onSuccess ——
            // 后端明确 paid=false 或查询本身失败时也照给充值/余额,等于用户没付钱就拿到额度。
            // 微信支付的权威源是服务端订单状态与回调,客户端轮询不到 paid 只能提示"确认中",
            // 由订单页按服务端刷新;绝不在客户端把未确认当成功。
            appAlert('提示', messages?.payConfirming ?? DEFAULT_MESSAGES.payConfirming)
            onFail?.('PAYMENT_NOT_CONFIRMED')
          }
        }

        // 3. DEV mock 回退(无微信支付配置):不得直通成功,仍以服务端订单状态为准
        if (payRes.data.mock) {
          await confirmByServer(payRes.data.outTradeNo)
          return
        }

        // 4. 调起微信 APP 支付(传签名参数给 react-native-wechat-lib)
        if (!payRes.data.prepayData) {
          appAlert('提示', messages?.nativeUnavailable ?? DEFAULT_MESSAGES.nativeUnavailable)
          onFail?.('NATIVE_UNAVAILABLE')
          return
        }
        const paySuccess = await openWeChatPayment(payRes.data.prepayData)
        if (!paySuccess) {
          appAlert('提示', messages?.payCancelled ?? DEFAULT_MESSAGES.payCancelled)
          onFail?.('USER_CANCELLED')
          return
        }

        // 5. 查询支付状态确认
        await confirmByServer(payRes.data.outTradeNo)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg === 'WECHAT_NOT_INSTALLED') {
          appAlert('提示', messages?.wechatNotInstalled ?? DEFAULT_MESSAGES.wechatNotInstalled)
        } else if (errMsg === 'WECHAT_NATIVE_UNAVAILABLE') {
          appAlert('提示', messages?.nativeUnavailable ?? DEFAULT_MESSAGES.nativeUnavailable)
        } else {
          appAlert('提示', messages?.payFailed ?? DEFAULT_MESSAGES.payFailed)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
