import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { UserInfo, DeveloperSubscription } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

/** 开发者账号信息(对标原项目 developer_info_body) */
interface DeveloperInfo {
  signNickname?: string
  signPassword?: string
  address?: string
  developerLink?: string
}

/** 未开发者问答(对标原项目 un_developer) */
interface QaItem {
  title: string
  url: string
}

const QA_FALLBACK: QaItem[] = [
  { title: '什么是开发者空间?', url: 'https://www.zhihui.com/developer/qa1' },
  { title: '如何成为开发者?', url: 'https://www.zhihui.com/developer/qa2' },
  { title: '开发者能获得什么收益?', url: 'https://www.zhihui.com/developer/qa3' },
  { title: '智能体如何上架?', url: 'https://www.zhihui.com/developer/qa4' },
]

/** 三个开发者入口(对标原项目 dev_list) */
const DEV_ENTRIES = [
  {
    key: 'model',
    icon: '🤖',
    titleKey: 'plaza.cover.entryMyModel',
    titleFb: '我的智能体',
    target: '/pages/developer/index',
  },
  {
    key: 'income',
    icon: '💰',
    titleKey: 'plaza.cover.entryModelIncome',
    titleFb: '智能体收入',
    target: '/pages/developer/income',
  },
  {
    key: 'n8n',
    icon: '⚡',
    titleKey: 'plaza.cover.entryN8n',
    titleFb: 'n8n 智能体',
    target: '/pages/dev-enter/n8n-model/index',
  },
]

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function formatExpires(time?: string): string {
  if (!time) return '-'
  const d = new Date(time)
  if (Number.isNaN(d.getTime())) return time
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export default function PlazaCover() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [profile, setProfile] = useState<UserInfo | null>(null)
  const [subscription, setSubscription] = useState<DeveloperSubscription | null>(null)
  const [devInfo, setDevInfo] = useState<DeveloperInfo>({})
  const [waitting, setWaitting] = useState(false)

  const load = useCallback(async () => {
    setWaitting(true)
    try {
      const [pf, subRes] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getMyDeveloperSubscription().catch(() => null),
      ])
      if (pf) setProfile(pf as UserInfo)
      const sub = (subRes as { subscription?: DeveloperSubscription } | null)?.subscription ?? null
      setSubscription(sub)
      try {
        const info = (await api.get('/developer/info')) as Record<string, unknown>
        if (info) {
          setDevInfo({
            signNickname: asString(info['signNickname']) || asString(info['account']),
            signPassword: asString(info['signPassword']) || asString(info['password']),
            address: asString(info['address']) || asString(info['url']),
            developerLink: asString(info['developerLink']),
          })
        }
      } catch {
        // 未开发者无账号信息,忽略
      }
    } catch (e) {
      logger.error('plaza/cover', 'load', e)
    } finally {
      setWaitting(false)
    }
  }, [])

  useDidShow(() => {
    load()
  })

  const isDev = !!(
    subscription &&
    subscription.endTime &&
    new Date(subscription.endTime).getTime() > Date.now()
  )

  const toPay = useCallback(() => {
    Taro.navigateTo({ url: '/pages/developer/subscribe' })
  }, [])

  const toPlaza = useCallback(() => {
    Taro.navigateTo({ url: '/pages/plaza/index/index' })
  }, [])

  const toEntry = useCallback((target: string) => {
    Taro.navigateTo({ url: target })
  }, [])

  const toWeb = useCallback((url: string) => {
    Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
  }, [])

  const copy = useCallback((text: string) => {
    if (!text) return
    Taro.setClipboardData({ data: text })
  }, [])

  const expiresAtStr = formatExpires(subscription?.endTime)

  return (
    <View className="pzc-page">
      {/* 未开发者入口引导(entry) */}
      {!isDev ? (
        <View className="pzc-entry">
          <Text className="pzc-entry-title">{tt('plaza.cover.entryTitle', '成为开发者')}</Text>
          <Text className="pzc-entry-desc">
            {tt('plaza.cover.entryDesc', '开通专属开发者空间,上架智能体获取收益')}
          </Text>
          <View className="pzc-entry-btn" onClick={toPay}>
            <Text>{tt('plaza.cover.becomeDeveloper', '立即成为开发者')}</Text>
          </View>
        </View>
      ) : null}

      {/* 头部用户卡片 */}
      <View className="pzc-header-card">
        <Image
          className="pzc-avatar"
          src={profile?.avatar || '/static/default-avatar.png'}
          mode="aspectFill"
        />
        <View className="pzc-user">
          <Text className="pzc-nickname">{profile?.nickname || tt('plaza.cover.guest', '游客')}</Text>
          {waitting ? (
            <Text className="pzc-waitting">
              {tt('plaza.cover.opening', '专属开发者空间开通中…')}
            </Text>
          ) : isDev ? (
            <Text className="pzc-status-active">{tt('plaza.cover.opened', '开发者空间已开通')}</Text>
          ) : (
            <Text className="pzc-status-mute">{tt('plaza.cover.notOpened', '未开通')}</Text>
          )}
        </View>
      </View>

      {/* 成为开发者按钮(未开通且无 developerLink 时) */}
      {!isDev && !devInfo.developerLink ? (
        <View className="pzc-become-btn" onClick={toPay}>
          <Text>{tt('plaza.cover.toPay', '成为开发者')}</Text>
        </View>
      ) : null}

      {/* 三个入口卡片(dev_list) */}
      <View className="pzc-dev-list">
        {DEV_ENTRIES.map((e) => (
          <View key={e.key} className="pzc-dev-item" onClick={() => toEntry(e.target)}>
            <Text className="pzc-dev-icon">{e.icon}</Text>
            <Text className="pzc-dev-title">{tt(e.titleKey, e.titleFb)}</Text>
            <Text className="pzc-dev-arrow">›</Text>
          </View>
        ))}
      </View>

      {/* 开发者信息卡(developer_info_body) */}
      {isDev ? (
        <View className="pzc-info-card">
          <Text className="pzc-info-title">{tt('plaza.cover.devInfoTitle', '开发者账号信息')}</Text>
          <View className="pzc-info-row">
            <Text className="pzc-info-label">{tt('plaza.cover.account', '账号')}</Text>
            <Text className="pzc-info-value">{devInfo.signNickname || '-'}</Text>
            <Text className="pzc-copy" onClick={() => copy(devInfo.signNickname || '')}>
              {tt('plaza.cover.copy', '复制')}
            </Text>
          </View>
          <View className="pzc-info-row">
            <Text className="pzc-info-label">{tt('plaza.cover.password', '密码')}</Text>
            <Text className="pzc-info-value">{devInfo.signPassword || '-'}</Text>
            <Text className="pzc-copy" onClick={() => copy(devInfo.signPassword || '')}>
              {tt('plaza.cover.copy', '复制')}
            </Text>
          </View>
          <View className="pzc-info-row">
            <Text className="pzc-info-label">{tt('plaza.cover.url', '网址')}</Text>
            <Text className="pzc-info-value">{devInfo.address || '-'}</Text>
            <Text className="pzc-copy" onClick={() => copy(devInfo.address || '')}>
              {tt('plaza.cover.copy', '复制')}
            </Text>
          </View>
          <View className="pzc-info-row">
            <Text className="pzc-info-label">{tt('plaza.cover.expire', '到期')}</Text>
            <Text className="pzc-info-value">{expiresAtStr}</Text>
            <Text className="pzc-renew" onClick={toPay}>
              {tt('plaza.cover.renew', '续费')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 继续接单按钮(to_plaza) */}
      {isDev ? (
        <View className="pzc-continue-btn" onClick={toPlaza}>
          <Text>{tt('plaza.cover.continueOrder', '继续接单')}</Text>
        </View>
      ) : null}

      {/* 未开发者问答列表(un_developer) */}
      {!isDev ? (
        <View className="pzc-qa">
          <Text className="pzc-qa-title">{tt('plaza.cover.qaTitle', '常见问题')}</Text>
          {QA_FALLBACK.map((qa, i) => (
            <View key={i} className="pzc-qa-item" onClick={() => toWeb(qa.url)}>
              <Text className="pzc-qa-text">{tt(`plaza.cover.qa${i}`, qa.title)}</Text>
              <Text className="pzc-dev-arrow">›</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
