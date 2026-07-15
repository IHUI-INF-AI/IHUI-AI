import { logger } from '@/utils/logger'
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface TraderLevel {
  id: string
  name: string
  desc: string
  icon?: string
}
interface TraderPrivilege {
  id: string
  title: string
  desc: string
  icon?: string
}
interface VipTraderInfo {
  levels: TraderLevel[]
  privileges: TraderPrivilege[]
}
interface ApplyForm {
  name: string
  phone: string
  experience: string
  reason: string
}

const initialForm: ApplyForm = { name: '', phone: '', experience: '', reason: '' }

export default function VipTraderIndexPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [info, setInfo] = useState<VipTraderInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState('')
  const [form, setForm] = useState<ApplyForm>(initialForm)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await get<VipTraderInfo>('/vip/trader')
      setInfo(res)
      const levels = res.levels
      const levelParam = router.params.level
      if (levelParam) {
        const matched = levels.find((l) => l.id === levelParam)
        if (matched) {
          setSelectedLevel(matched.id)
          return
        }
      }
      if (levels.length > 0 && levels[0]) {
        setSelectedLevel(levels[0].id)
      }
    } catch (e) {
      logger.error('unknown', '加载操盘手信息', e)
    } finally {
      setLoading(false)
    }
  }, [router.params.level])

  useDidShow(() => {
    loadData()
  })

  const onFieldChange = useCallback((field: keyof ApplyForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev }
      next[field] = value
      return next
    })
  }, [])

  const onSelectLevel = useCallback((id: string) => {
    setSelectedLevel(id)
  }, [])

  const onSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      Taro.showToast({ title: t('vipTrader.enterName'), icon: 'none' })
      return
    }
    if (!form.phone.trim()) {
      Taro.showToast({ title: t('vipTrader.enterPhone'), icon: 'none' })
      return
    }
    if (!selectedLevel) {
      Taro.showToast({ title: t('vipTrader.selectLevel'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await post('/vip/trader/apply', {
        level: selectedLevel,
        name: form.name.trim(),
        phone: form.phone.trim(),
        experience: form.experience.trim() || undefined,
        reason: form.reason.trim() || undefined,
      })
      Taro.showToast({ title: t('vipTrader.submitted'), icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 1000)
    } catch (e) {
      logger.error('unknown', '提交申请', e)
    } finally {
      setSubmitting(false)
    }
  }, [form.name, form.phone, form.experience, form.reason, selectedLevel, t])

  if (loading && !info) {
    return (
      <View className="vip-trader-page">
        <View className="trader-empty">
          <Text>{t('vipTrader.loading')}</Text>
        </View>
      </View>
    )
  }

  if (!info) {
    return (
      <View className="vip-trader-page">
        <View className="trader-empty">
          <Text>{t('vipTrader.empty')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className="vip-trader-page">
      <View className="trader-header">
        <Text className="trader-title">{t('vipTrader.title')}</Text>
        <Text className="trader-subtitle">{t('vipTrader.subtitle')}</Text>
      </View>

      <View className="trader-section">
        <Text className="section-title">{t('vipTrader.levelSection')}</Text>
        <View className="level-list">
          {info.levels.map((item) => (
            <View
              key={item.id}
              className={`level-item${selectedLevel === item.id ? ' active' : ''}`}
              onClick={() => onSelectLevel(item.id)}
            >
              {item.icon ? (
                <Image className="level-icon" src={item.icon} mode="aspectFit" />
              ) : (
                <View className="level-icon-default">
                  <Text className="level-icon-text">V</Text>
                </View>
              )}
              <View className="level-content">
                <Text className="level-name">{item.name}</Text>
                <Text className="level-desc">{item.desc}</Text>
              </View>
              <View className={`level-radio${selectedLevel === item.id ? ' checked' : ''}`} />
            </View>
          ))}
        </View>
      </View>

      <View className="trader-section">
        <Text className="section-title">{t('vipTrader.privilegeSection')}</Text>
        <View className="priv-list">
          {info.privileges.map((item) => (
            <View key={item.id} className="priv-item">
              {item.icon ? (
                <Image className="priv-icon" src={item.icon} mode="aspectFit" />
              ) : (
                <View className="priv-icon-default">
                  <Text className="priv-icon-text">★</Text>
                </View>
              )}
              <View className="priv-content">
                <Text className="priv-item-title">{item.title}</Text>
                <Text className="priv-item-desc">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="trader-section">
        <Text className="section-title">{t('vipTrader.formSection')}</Text>
        <View className="form">
          <View className="form-item">
            <Text className="form-label">{t('vipTrader.nameLabel')}</Text>
            <Input
              className="form-input"
              type="text"
              placeholder={t('vipTrader.namePlaceholder')}
              value={form.name}
              onInput={(e) => onFieldChange('name', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('vipTrader.phoneLabel')}</Text>
            <Input
              className="form-input"
              type="number"
              placeholder={t('vipTrader.phonePlaceholder')}
              value={form.phone}
              onInput={(e) => onFieldChange('phone', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('vipTrader.experienceLabel')}</Text>
            <Input
              className="form-input"
              type="text"
              placeholder={t('vipTrader.experiencePlaceholder')}
              value={form.experience}
              onInput={(e) => onFieldChange('experience', e.detail.value)}
            />
          </View>
          <View className="form-item">
            <Text className="form-label">{t('vipTrader.reasonLabel')}</Text>
            <Input
              className="form-input"
              type="text"
              placeholder={t('vipTrader.reasonPlaceholder')}
              value={form.reason}
              onInput={(e) => onFieldChange('reason', e.detail.value)}
            />
          </View>
          <Button
            className="submit-btn"
            loading={submitting}
            disabled={submitting}
            onClick={onSubmit}
          >
            {t('vipTrader.submit')}
          </Button>
        </View>
      </View>
    </View>
  )
}
