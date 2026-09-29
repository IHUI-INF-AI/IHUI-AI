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
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { AnyPayParams } from '@ihui/types'
import { get } from '@/utils/api-bridge'
import { wechatPay } from '@/api'
import { requestWxPayment } from '@/utils/pay'
import { requestPushSubscription } from '@/utils/push-init'
import ThemeRoot from '@/components/ThemeRoot'
import { useTt } from '@/i18n'

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

/** 后端 edu-ledger 递出来的账目视图(欠费额、到期日、逾期天数都在这里面) */
interface LedgerView {
  totalFee: number
  paidAmount: number
  arrears: number
  nextDueDate: string | null
  overdueCount: number
  dueSoonCount: number
  unallocatedPaid: number
  schedules: { dueDate: string; amountDue: number; status: string; overdueDays: number }[]
}

interface MyBillsResp {
  enrollments: EnrollmentBill[]
  payments: PaymentItem[]
  ledgers?: { enrollmentId: string; ledger: LedgerView | null }[]
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

/** 枚举码 → i18n key(文案在 packages/i18n/messages/miniapp-taro/*.json 的 bill 命名空间;码不在表内原样展示) */
const BUSINESS_LINE_KEY: Record<string, string> = {
  after_school_care: 'bill.businessLine.after_school_care',
  kindergarten: 'bill.businessLine.kindergarten',
  academic: 'bill.businessLine.academic',
  ai_course: 'bill.businessLine.ai_course',
  other: 'bill.businessLine.other',
}

const ENROLL_STATUS_KEY: Record<string, string> = {
  enrolled: 'bill.enrollStatus.enrolled',
  graduated: 'bill.enrollStatus.graduated',
  withdrawn: 'bill.enrollStatus.withdrawn',
  suspended: 'bill.enrollStatus.suspended',
}

const PAY_METHOD_KEY: Record<string, string> = {
  cash: 'bill.payMethod.cash',
  transfer: 'bill.payMethod.transfer',
  wechat: 'bill.payMethod.wechat',
  alipay: 'bill.payMethod.alipay',
  credit_card: 'bill.payMethod.credit_card',
  other: 'bill.payMethod.other',
}

export default function Bill() {
  const tt = useTt()
  const [data, setData] = useState<MyBillsResp>({ enrollments: [], payments: [], ledgers: [] })
  const [loading, setLoading] = useState(false)
  const [payingId, setPayingId] = useState('')
  const mountedRef = useRef(false)

  /** 枚举码翻译:码在映射表内走词典,不在(后端新码)原样展示 —— 同旧 `MAP[code] ?? code` 语义 */
  const codeText = useCallback(
    (map: Record<string, string>, code: string) => {
      const k = map[code]
      return k ? tt(k, code) : code
    },
    [tt],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<MyBillsResp>('/edu-ai-management/my-bills')
      setData({
        enrollments: res?.enrollments ?? [],
        payments: res?.payments ?? [],
        ledgers: res?.ledgers ?? [],
      })
    } catch {
      // api-bridge 已统一 toast
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 欠费额与到期日一律取自后端账目出口(edu-ledger),本页不再自己算
   * `totalFee - paidAmount` —— 那与本仓已经出现过的"三处各写一遍欠费算式"是同一条缝:
   * 名单说欠费、流水说已缴,催缴于是发给错的人。
   * 取不到 ledger 时 due 记 0 且**不给支付按钮**:凑一个金额出来让用户按它付款,
   * 比暂时不能付款更坏。
   */
  const ledgerById = useMemo(() => {
    const m = new Map<string, LedgerView>()
    for (const row of data.ledgers ?? []) {
      if (row.ledger) m.set(row.enrollmentId, row.ledger)
    }
    return m
  }, [data.ledgers])

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
      title: ok
        ? tt('bill.subscribed', '已开启微信催费提醒')
        : tt('bill.subscribeFailed', '未完成订阅授权'),
      icon: ok ? 'success' : 'none',
    })
  }

  const onPay = async (item: EnrollmentBill) => {
    if (payingId) return
    const due = ledgerById.get(item.id)?.arrears ?? 0
    if (due <= 0) return
    setPayingId(item.id)
    try {
      // 下单:金额元→分(orders.amount 单位分),orderType=9 学费,productId=报名ID
      const res = (await wechatPay({
        amount: due * 100,
        orderType: '9',
        productId: item.id,
        description: tt('bill.payDesc', '学费-{name}', { name: item.className }),
      })) as WechatPayCreateResp
      // mock 模式(后端未配置微信支付凭证)
      if (res.mock) {
        Taro.showToast({
          title: tt('bill.payMockOk', '支付成功(mock,支付凭证未配置)'),
          icon: 'none',
          duration: 2500,
        })
        await load()
        return
      }
      if (!res.paySign || !res.timestamp || !res.nonceStr || !res.package) {
        Taro.showToast({ title: tt('bill.payParamsMissing', '支付参数缺失,请联系机构'), icon: 'none' })
        return
      }
      await requestWxPayment({
        timeStamp: res.timestamp,
        nonceStr: res.nonceStr,
        package: res.package,
        signType: res.signType ?? 'RSA',
        paySign: res.paySign,
      } as AnyPayParams)
      Taro.showToast({ title: tt('bill.payOk', '缴费成功'), icon: 'success' })
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
              {tt('bill.wxSubscribe', '微信催费提醒')}
            </Text>
            <Text className="mt-[6rpx] block text-[length:22rpx] text-[var(--color-surface-light)] opacity-80">
              {tt('bill.wxSubscribeDesc', '订阅后欠费催缴将推送到微信')}
            </Text>
          </View>
          <View
            className="shrink-0 rounded-xl bg-[var(--color-surface-light)] px-[28rpx] py-[12rpx]"
            hoverClass="opacity-60"
            onClick={() => void onSubscribe()}
          >
            <Text className="text-[length:26rpx] font-medium text-primary">
              {tt('bill.subscribe', '订阅')}
            </Text>
          </View>
        </View>

        {/* 学费账单(报名维度) */}
        <View className="mx-[20rpx] mt-[24rpx]">
          <Text className="text-[length:28rpx] font-semibold text-foreground">
            {tt('bill.title', '学费账单')}
          </Text>
        </View>
        {data.enrollments.length > 0 ? (
          <View className="mt-[16rpx] px-[20rpx]">
            {data.enrollments.map((item) => {
              const ledger = ledgerById.get(item.id)
              const due = ledger?.arrears ?? 0
              const overdueDays = ledger
                ? Math.max(0, ...ledger.schedules.map((s) => s.overdueDays))
                : 0
              return (
                <View
                  key={item.id}
                  className="mb-[20rpx] rounded-lg border border-[var(--color-border)] bg-card p-[24rpx]"
                >
                  <View className="flex items-center justify-between gap-[16rpx]">
                    <Text className="flex-1 truncate text-[length:32rpx] font-semibold text-foreground">
                      {item.className}
                    </Text>
                    <View className="shrink-0 rounded-sm bg-[var(--color-muted)] px-[12rpx] py-[4rpx]">
                      <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                        {codeText(ENROLL_STATUS_KEY, item.status)}
                      </Text>
                    </View>
                  </View>
                  <View className="mt-[12rpx] flex items-center gap-[16rpx]">
                    <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                      {item.termName}
                    </Text>
                    <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                      {codeText(BUSINESS_LINE_KEY, item.businessLine)}
                    </Text>
                  </View>
                  <View className="mt-[16rpx] flex items-center justify-between">
                    <Text className="text-[length:24rpx] text-muted-foreground">
                      {tt('bill.feeSummary', '应缴 ¥{total} · 已缴 ¥{paid}', {
                        total: item.totalFee.toLocaleString(),
                        paid: item.paidAmount.toLocaleString(),
                      })}
                    </Text>
                    <Text
                      className={`text-[length:30rpx] font-bold ${
                        due > 0
                          ? 'text-[var(--color-danger)]'
                          : 'text-[var(--color-success-deep-text)]'
                      }`}
                    >
                      {!ledger
                        ? tt('bill.ledgerNotReady', '账目未就绪')
                        : due > 0
                          ? tt('bill.arrears', '欠费 ¥{amount}', { amount: due.toLocaleString() })
                          : tt('bill.paidOff', '已缴清')}
                    </Text>
                  </View>
                  {ledger?.nextDueDate ? (
                    <View className="mt-[8rpx]">
                      <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                        {overdueDays > 0
                          ? tt('bill.overdue', '已逾期 {days} 天', { days: overdueDays })
                          : tt('bill.dueOn', '{date} 到期', { date: ledger.nextDueDate })}
                      </Text>
                    </View>
                  ) : null}
                  {ledger && due > 0 ? (
                    <View
                      className={`mt-[20rpx] rounded-xl bg-primary py-[16rpx] text-center ${
                        payingId === item.id ? 'opacity-50' : ''
                      }`}
                      hoverClass="opacity-60"
                      onClick={() => void onPay(item)}
                    >
                      <Text className="text-[length:28rpx] font-semibold text-[var(--color-surface-light)]">
                        {payingId === item.id
                          ? tt('bill.paying', '支付中…')
                          : tt('bill.payOnline', '在线缴纳 ¥{amount}', {
                              amount: due.toLocaleString(),
                            })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : (
          <View className="py-[48rpx] text-center text-[length:26rpx] text-muted-foreground">
            <Text>{loading ? tt('bill.loading', '加载中…') : tt('bill.empty', '暂无报名账单')}</Text>
          </View>
        )}

        {/* 缴费记录 */}
        {data.payments.length > 0 ? (
          <View className="mx-[20rpx] mt-[32rpx]">
            <Text className="text-[length:28rpx] font-semibold text-foreground">
              {tt('bill.paymentHistory', '缴费记录')}
            </Text>
            <View className="mt-[16rpx] rounded-lg border border-[var(--color-border)] bg-card px-[24rpx]">
              {data.payments.map((p, idx) => (
                <View
                  key={p.id}
                  className={`flex items-center justify-between py-[20rpx] ${
                    idx > 0 ? 'border-t border-[var(--color-border)]' : ''
                  }`}
                >
                  <View className="flex-1">
                    <Text className="block text-[length:26rpx] text-foreground">
                      {codeText(PAY_METHOD_KEY, p.paymentMethod)}
                      {p.status === 'refunded' ? tt('bill.refunded', '(已退费)') : ''}
                    </Text>
                    <Text className="mt-[4rpx] block text-[length:22rpx] text-[var(--color-text-tertiary)]">
                      {p.paymentDate}
                      {p.receiptNo ? ` · ${tt('bill.receiptNo', '单号 {no}', { no: p.receiptNo })}` : ''}
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
            className="h-[72rpx] rounded-sm text-[length:26rpx] leading-[72rpx]" /* 控件档 sm:项目不允许胶囊 */
            plain
            onClick={() => void onSubscribe()}
          >
            {tt('bill.enableArrearsRemind', '开启欠费提醒')}
          </Button>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
