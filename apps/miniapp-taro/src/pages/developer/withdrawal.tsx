import { View, Text } from '@tarojs/components'
import { useState, useCallback, useMemo } from 'react'
import { useDidShow } from '@tarojs/taro'
import { getDeveloperWithdrawalList } from '@/api'
import { useI18n } from '@/i18n'
import './withdrawal.css'

// 开发者提现记录项(getDeveloperWithdrawalList 后端未类型化,按页面使用字段定义)
interface WithdrawalItem {
  id: string
  amount: number
  time?: string
  // 后端可能返回多种状态字段,做容错
  status?: string
  statusText?: string
  // 部分后端会拆分申请时间/完成时间
  applyTime?: string
  createdAt?: string
  finishedAt?: string
  // 失败原因
  reason?: string
  remark?: string
}

// 开发者提现列表响应
interface WithdrawalListResponse {
  list?: WithdrawalItem[]
  // 部分后端返回 totalAmount 表示累计提现金额;无此字段时本地累加
  totalAmount?: number
}

// 状态归一化:把后端可能返回的各种状态字符串归到 4 个 UI 状态
function normalizeStatus(raw?: string): 'pending' | 'processing' | 'success' | 'failed' {
  if (!raw) return 'pending'
  const s = raw.toLowerCase()
  if (['success', 'completed', 'done', 'paid', 'finish', 'finished'].includes(s)) return 'success'
  if (['processing', 'processing', 'reviewing', 'approved', 'under_review'].includes(s)) return 'processing'
  if (['failed', 'rejected', 'cancel', 'cancelled', 'deny', 'denied'].includes(s)) return 'failed'
  // pending / waiting / null
  return 'pending'
}

export default function DeveloperWithdrawal() {
  const { t } = useI18n()
  const [list, setList] = useState<WithdrawalItem[]>([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperWithdrawalList()) as WithdrawalListResponse
      const items = res?.list || []
      setList(items)
      // 优先用后端汇总,缺失则本地累加全部申请金额
      const backendTotal = res?.totalAmount
      setTotalAmount(
        typeof backendTotal === 'number'
          ? backendTotal
          : items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
      )
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  // 状态文案:复用 developer.withdrawal 已有 i18n key(processing/empty),
  // 其余状态用 common 已有 key,再不济回退原 statusText
  const statusText = useCallback(
    (item: WithdrawalItem) => {
      const norm = normalizeStatus(item.status)
      if (norm === 'processing') return t('developer.withdrawal.processing')
      if (norm === 'success') return t('common.success')
      if (norm === 'failed') return t('common.failed')
      return t('developer.withdrawal.processing')
    },
    [t],
  )

  const statusClass = useCallback((item: WithdrawalItem) => {
    const norm = normalizeStatus(item.status)
    return `status-${norm}`
  }, [])

  const displayTime = useCallback((item: WithdrawalItem) => {
    return item.time || item.applyTime || item.createdAt || item.finishedAt || ''
  }, [])

  const displayReason = useCallback((item: WithdrawalItem) => {
    return item.reason || item.remark || ''
  }, [])

  const totalSuccess = useMemo(
    () =>
      list
        .filter((it) => normalizeStatus(it.status) === 'success')
        .reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
    [list],
  )

  return (
    <View className="withdrawal-page">
      <View className="page-header">
        <Text className="page-title">{t('developer.withdrawal.title')}</Text>
      </View>
      <View className="summary-card">
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.withdrawnYuan')}</Text>
          <Text className="summary-value">{loading ? '--' : totalAmount}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.withdrawn')}</Text>
          <Text className="summary-value">{loading ? '--' : totalSuccess}</Text>
        </View>
      </View>
      <View className="withdrawal-list">
        {loading ? (
          <Text className="loading-text">{t('common.loading')}</Text>
        ) : list.length ? (
          list.map((item) => (
            <View key={item.id} className="withdrawal-item">
              <View className="withdrawal-info">
                <Text className="withdrawal-amount">¥{item.amount}</Text>
                <Text className="withdrawal-time">{displayTime(item)}</Text>
                {displayReason(item) ? (
                  <Text className="withdrawal-reason">{displayReason(item)}</Text>
                ) : null}
              </View>
              <Text className={`withdrawal-status ${statusClass(item)}`}>
                {item.statusText || statusText(item)}
              </Text>
            </View>
          ))
        ) : (
          <Text className="empty-text">{t('developer.withdrawal.empty')}</Text>
        )}
      </View>
    </View>
  )
}
