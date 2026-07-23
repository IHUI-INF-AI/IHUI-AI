import { View, Text, Input } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow, navigateTo, showToast } from '@tarojs/taro'
import { getDeveloperIncome, post } from '@/api'
import { useI18n } from '@/i18n'
import './income.css'

interface IncomeRecordItem {
  id: string
  title?: string
  time?: string
  amount: number
}

interface DeveloperIncomeInfo {
  total?: number
  available?: number
  withdrawn?: number
  list?: IncomeRecordItem[]
}

export default function DeveloperIncome() {
  const { t } = useI18n()
  const [info, setInfo] = useState<DeveloperIncomeInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPopup, setShowPopup] = useState(false)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = (await getDeveloperIncome()) as DeveloperIncomeInfo
      setInfo(res)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const available = info?.available ?? 0
  const list = [...(info?.list || [])].sort((a, b) =>
    (b.time || '').localeCompare(a.time || ''),
  )

  const openPopup = () => {
    if (available <= 0) {
      showToast({ title: t('developer.income.noAvailable'), icon: 'none' })
      return
    }
    setAmount('')
    setShowPopup(true)
  }
  const closePopup = () => {
    if (!submitting) setShowPopup(false)
  }

  const confirmWithdraw = useCallback(async () => {
    const num = Number(amount)
    if (!num || num <= 0) {
      showToast({ title: t('developer.income.invalidAmount'), icon: 'none' })
      return
    }
    if (num > available) {
      showToast({ title: t('developer.income.exceedAvailable'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await post('/developer/withdrawals', { amount: num })
      showToast({ title: t('developer.income.withdrawSubmitted'), icon: 'success' })
      setShowPopup(false)
      await load()
    } catch {
      showToast({ title: t('developer.income.withdrawFailed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [amount, available, load, t])

  const goWithdrawal = () => navigateTo({ url: '/pages/developer/withdrawal' })

  return (
    <View className="income-page">
      <View className="page-header">
        <Text className="page-title">{t('developer.income.income')}</Text>
      </View>
      <View className="summary-card">
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.totalYuan')}</Text>
          <Text className="summary-value">{loading ? '--' : info?.total ?? 0}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.availableYuan')}</Text>
          <Text className="summary-value">{loading ? '--' : available}</Text>
        </View>
        <View className="summary-item">
          <Text className="summary-label">{t('developer.income.withdrawnYuan')}</Text>
          <Text className="summary-value">{loading ? '--' : info?.withdrawn ?? 0}</Text>
        </View>
      </View>
      <View className="action-bar">
        <View
          className={`withdraw-btn${available <= 0 ? ' disabled' : ''}`}
          onClick={openPopup}
        >
          <Text className="withdraw-btn-text">{t('developer.income.withdraw')}</Text>
        </View>
        <View className="record-entry" onClick={goWithdrawal}>
          <Text className="record-entry-text">{t('developer.income.withdrawRecord')}</Text>
          <Text className="record-entry-arrow">›</Text>
        </View>
      </View>
      {list.length ? (
        <View className="record-section">
          <Text className="section-title">{t('developer.income.details')}</Text>
          {list.map((r) => (
            <View key={r.id} className="record-item">
              <View className="record-info">
                <Text className="record-title">{r.title || '智能体收入'}</Text>
                <Text className="record-time">{r.time || ''}</Text>
              </View>
              <Text className="record-amount">+¥{r.amount}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {showPopup ? (
        <View className="popup-mask" onClick={closePopup}>
          <View className="popup-card" onClick={(e) => e.stopPropagation()}>
            <Text className="popup-title">{t('developer.income.withdrawPopup')}</Text>
            <Text className="popup-balance">
              {t('developer.income.withdrawAvailable')}{available}
            </Text>
            <View className="popup-input-wrap">
              <Text className="popup-currency">¥</Text>
              <Input
                className="popup-input"
                type="digit"
                placeholder={t('developer.income.withdrawPlaceholder')}
                value={amount}
                onInput={(e) => setAmount(e.detail.value)}
              />
            </View>
            <View className="popup-all" onClick={() => setAmount(String(available))}>
              <Text className="popup-all-text">{t('developer.income.withdrawAll')}</Text>
            </View>
            <View className="popup-actions">
              <View className="popup-btn popup-cancel" onClick={closePopup}>
                <Text className="popup-cancel-text">{t('common.cancel')}</Text>
              </View>
              <View className="popup-btn popup-confirm" onClick={confirmWithdraw}>
                <Text className="popup-confirm-text">
                  {submitting ? t('common.loading') : t('common.confirm')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
