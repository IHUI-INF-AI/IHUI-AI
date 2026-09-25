// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 我的学费账单(小程序家长端,2026-09-19)。
 * 学员登录后自查:报名(应缴/已缴/欠费) + 最近缴费记录;
 * 欠费条目可发起微信 JSAPI 在线缴费(orderType=9,productId=报名ID,金额元→分),
 * 支付回调由后端 completeOrder → applyEduTuitionOrder 自动入账;
 * 顶部提供「开启微信催费提醒」订阅授权入口(requestSubscribeMessage)。
 * 催费订阅消息跳转页 = /pkg-user/bill/index(本页)。
 */

import { View, Text, Button } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { AnyPayParams } from '@ihui/types'
import { get } from '@/utils/api-bridge'
import { wechatPay } from '@/api'
import { requestWxPayment } from '@/utils/pay'
import { requestPushSubscription } from '@/utils/push-init'
import ThemeRoot from '@/components/ThemeRoot'

interface EnrollmentBill {
  id: string
  classId: string
  className: string
  termId: string
  termName: string
  businessLine: string
  status: string
  totalFee: number // 元
  paidAmount: number // 元
  createdAt: string
}

interface PaymentItem {
  id: string
  enrollmentClassId: string
  amount: number // 元
  paymentDate: string
  paymentMethod: string
  status: string
  receiptNo: string | null
  remark: string | null
  createdAt: string
}

interface MyBillsResp {
  enrollments: EnrollmentBill[]
  payments: PaymentItem[]
}

/** 微信 JSAPI 下单响应(POST /payments/wechat/create) */
interface WechatPayCreateResp {
  outTradeNo: string
  amount: number
  mock?: boolean
  timestamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
}

const BUSINESS_LINE_TEXT: Record<string, string> = {
  after_school_care: '托管',
  kindergarten: '幼儿园',
  academic: '文化课',
  ai_course: 'AI课',
  other: '其他',
}

const ENROLL_STATUS_TEXT: Record<string, string> = {
  enrolled: '在读',
  graduated: '已结业',
  withdrawn: '已退学',
  suspended: '停课',
}

const PAY_METHOD_TEXT: Record<string, string> = {
  cash: '现金',
  transfer: '转账',
  wechat: '微信',
  alipay: '支付宝',
  credit_card: '刷卡',
  other: '其他',
}

export default function Bill() {
  const [data, setData] = useState<MyBillsResp>({ enrollments: [], payments: [] })
  const [loading, setLoading] = useState(false)
  const [payingId, setPayingId] = useState('')
  const mountedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<MyBillsResp>('/edu-ai-management/my-bills')
      setData({ enrollments: res?.enrollments ?? [], payments: res?.payments ?? [] })
    } catch {
      // api-bridge 已统一 toast
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mountedRef.current) return
    mountedRef.current = true
    void load()
  }, [load])

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const onSubscribe = async () => {
    const ok = await requestPushSubscription()
    Taro.showToast({
      title: ok ? '已开启微信催费提醒' : '未完成订阅授权',
      icon: ok ? 'success' : 'none',
    })
  }

  const onPay = async (item: EnrollmentBill) => {
    if (payingId) return
    const due = Math.max(item.totalFee - item.paidAmount, 0)
    if (due <= 0) return
    setPayingId(item.id)
    try {
      // 下单:金额元→分(orders.amount 单位分),orderType=9 学费,productId=报名ID
      const res = (await wechatPay({
        amount: due * 100,
        orderType: '9',
        productId: item.id,
        description: `学费-${item.className}`,
      })) as WechatPayCreateResp
      // mock 模式(后端未配置微信支付凭证)
      if (res.mock) {
        Taro.showToast({ title: '支付成功(mock,支付凭证未配置)', icon: 'none', duration: 2500 })
        await load()
        return
      }
      if (!res.paySign || !res.timestamp || !res.nonceStr || !res.package) {
        Taro.showToast({ title: '支付参数缺失,请联系机构', icon: 'none' })
        return
      }
      await requestWxPayment({
        timeStamp: res.timestamp,
        nonceStr: res.nonceStr,
        package: res.package,
        signType: res.signType ?? 'RSA',
        paySign: res.paySign,
      } as AnyPayParams)
      Taro.showToast({ title: '缴费成功', icon: 'success' })
      await load()
    } catch {
      // requestWxPayment 内部已提示(取消/失败),静默
    } finally {
      setPayingId('')
    }
  }

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background pb-[40rpx]">
        {/* 顶部:订阅催费提醒 */}
        <View className="mx-[20rpx] mt-[20rpx] flex items-center justify-between rounded-xl bg-primary px-[28rpx] py-[24rpx]">
          <View className="flex-1 pr-[16rpx]">
            <Text className="text-[length:30rpx] font-semibold text-[var(--color-surface-light)]">
              微信催费提醒
            </Text>
            <Text className="mt-[6rpx] block text-[length:22rpx] text-[var(--color-surface-light)] opacity-80">
              订阅后欠费催缴将推送到微信
            </Text>
          </View>
          <View
            className="shrink-0 rounded-xl bg-[var(--color-surface-light)] px-[28rpx] py-[12rpx]"
            hoverClass="opacity-60"
            onClick={() => void onSubscribe()}
          >
            <Text className="text-[length:26rpx] font-medium text-primary">订阅</Text>
          </View>
        </View>

        {/* 学费账单(报名维度) */}
        <View className="mx-[20rpx] mt-[24rpx]">
          <Text className="text-[length:28rpx] font-semibold text-foreground">学费账单</Text>
        </View>
        {data.enrollments.length > 0 ? (
          <View className="mt-[16rpx] px-[20rpx]">
            {data.enrollments.map((item) => {
              const due = Math.max(item.totalFee - item.paidAmount, 0)
              return (
                <View
                  key={item.id}
                  className="mb-[20rpx] rounded-xl border border-[var(--color-border)] bg-card p-[24rpx]"
                >
                  <View className="flex items-center justify-between gap-[16rpx]">
                    <Text className="flex-1 truncate text-[length:32rpx] font-semibold text-foreground">
                      {item.className}
                    </Text>
                    <View className="shrink-0 rounded-sm bg-[var(--color-muted)] px-[12rpx] py-[4rpx]">
                      <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                        {ENROLL_STATUS_TEXT[item.status] ?? item.status}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-[12rpx] flex items-center gap-[16rpx]">
                    <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                      {item.termName}
                    </Text>
                    <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                      {BUSINESS_LINE_TEXT[item.businessLine] ?? item.businessLine}
                    </Text>
                  </View>
                  <View className="mt-[16rpx] flex items-center justify-between">
                    <Text className="text-[length:24rpx] text-muted-foreground">
                      应缴 ¥{item.totalFee.toLocaleString()} · 已缴 ¥
                      {item.paidAmount.toLocaleString()}
                    </Text>
                    <Text
                      className={`text-[length:30rpx] font-bold ${
                        due > 0
                          ? 'text-[var(--color-danger)]'
                          : 'text-[var(--color-success-deep-text)]'
                      }`}
                    >
                      {due > 0 ? `欠费 ¥${due.toLocaleString()}` : '已缴清'}
                    </Text>
                  </View>
                  {due > 0 ? (
                    <View
                      className={`mt-[20rpx] rounded-xl bg-primary py-[16rpx] text-center ${
                        payingId === item.id ? 'opacity-50' : ''
                      }`}
                      hoverClass="opacity-60"
                      onClick={() => void onPay(item)}
                    >
                      <Text className="text-[length:28rpx] font-semibold text-[var(--color-surface-light)]">
                        {payingId === item.id ? '支付中…' : `在线缴纳 ¥${due.toLocaleString()}`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : (
          <View className="py-[48rpx] text-center text-[length:26rpx] text-muted-foreground">
            <Text>{loading ? '加载中…' : '暂无报名账单'}</Text>
          </View>
        )}

        {/* 缴费记录 */}
        {data.payments.length > 0 ? (
          <View className="mx-[20rpx] mt-[32rpx]">
            <Text className="text-[length:28rpx] font-semibold text-foreground">缴费记录</Text>
            <View className="mt-[16rpx] rounded-xl border border-[var(--color-border)] bg-card px-[24rpx]">
              {data.payments.map((p, idx) => (
                <View
                  key={p.id}
                  className={`flex items-center justify-between py-[20rpx] ${
                    idx > 0 ? 'border-t border-[var(--color-border)]' : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="block text-[length:26rpx] text-foreground">
                      {PAY_METHOD_TEXT[p.paymentMethod] ?? p.paymentMethod}
                      {p.status === 'refunded' ? '(已退费)' : ''}
                    </Text>
                    <Text className="mt-[4rpx] block text-[length:22rpx] text-[var(--color-text-tertiary)]">
                      {p.paymentDate}
                      {p.receiptNo ? ` · 单号 ${p.receiptNo}` : ''}
                    </Text>
                  </View>
                  <Text className="text-[length:30rpx] font-bold text-foreground">
                    ¥{p.amount.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* 底部说明 */}
        <View className="mt-[32rpx] px-[40rpx] text-center">
          <Button
            className="h-[72rpx] rounded-[36rpx] text-[length:26rpx] leading-[72rpx]" // radius-exempt: 胶囊按钮(高 72rpx,半径=高度一半)
            plain
            onClick={() => void onSubscribe()}
          >
            开启欠费提醒
          </Button>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
