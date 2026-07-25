import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { UserInfo, DeveloperSubscription } from '@/api'
import { useI18n } from '@/i18n'

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

const QA_KEYS = [
  'plaza.cover.qa0',
  'plaza.cover.qa1',
  'plaza.cover.qa2',
  'plaza.cover.qa3',
] as const

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
    <View className="min-h-[100vh] bg-background px-[24rpx] pt-[24rpx] pb-[160rpx]">
      {/* 未开发者入口引导(entry) */}
      {!isDev ? (
        <View className="bg-card rounded-2xl py-[40rpx] px-[32rpx] mb-[24rpx]">
          <Text className="block text-[34rpx] font-semibold text-foreground mb-[12rpx]">{tt('plaza.cover.entryTitle', '成为开发者')}</Text>
          <Text className="block text-[26rpx] text-muted-foreground leading-[1.5] mb-[32rpx]">
            {tt('plaza.cover.entryDesc', '开通专属开发者空间,上架智能体获取收益')}
          </Text>
          <View className="flex items-center justify-center h-[80rpx] bg-primary rounded-lg" onClick={toPay}>
            <Text className="text-[28rpx] text-primary-foreground">{tt('plaza.cover.becomeDeveloper', '立即成为开发者')}</Text>
          </View>
        </View>
      ) : null}

      {/* 头部用户卡片 */}
      <View className="flex items-center gap-[24rpx] bg-card rounded-2xl p-[32rpx] mb-[24rpx]">
        <Image
          className="w-[96rpx] h-[96rpx] rounded-2xl bg-background"
          src={profile?.avatar || '/static/default-avatar.png'}
          mode="aspectFill"
        />
        <View className="flex-1 flex flex-col gap-[8rpx]">
          <Text className="text-[32rpx] font-semibold text-foreground">{profile?.nickname || tt('plaza.cover.guest', '游客')}</Text>
          {waitting ? (
            <Text className="text-[24rpx] text-warning">
              {tt('plaza.cover.opening', '专属开发者空间开通中…')}
            </Text>
          ) : isDev ? (
            <Text className="text-[24rpx] text-success">{tt('plaza.cover.opened', '开发者空间已开通')}</Text>
          ) : (
            <Text className="text-[24rpx] text-muted-foreground">{tt('plaza.cover.notOpened', '未开通')}</Text>
          )}
        </View>
      </View>

      {/* 成为开发者按钮(未开通且无 developerLink 时) */}
      {!isDev && !devInfo.developerLink ? (
        <View className="flex items-center justify-center h-[88rpx] bg-primary rounded-xl mb-[24rpx]" onClick={toPay}>
          <Text className="text-[30rpx] text-primary-foreground">{tt('plaza.cover.toPay', '成为开发者')}</Text>
        </View>
      ) : null}

      {/* 三个入口卡片(dev_list) */}
      <View className="bg-card rounded-2xl overflow-hidden mb-[24rpx]">
        {DEV_ENTRIES.map((e) => (
          <View key={e.key} className="flex items-center gap-[20rpx] p-[32rpx]" onClick={() => toEntry(e.target)}>
            <Text className="text-[40rpx] leading-none">{e.icon}</Text>
            <Text className="flex-1 text-[30rpx] text-foreground">{tt(e.titleKey, e.titleFb)}</Text>
            <Text className="text-[36rpx] text-muted-foreground leading-none">›</Text>
          </View>
        ))}
      </View>

      {/* 开发者信息卡(developer_info_body) */}
      {isDev ? (
        <View className="bg-card rounded-2xl p-[32rpx] mb-[24rpx]">
          <Text className="block text-[30rpx] font-semibold text-foreground mb-[24rpx]">{tt('plaza.cover.devInfoTitle', '开发者账号信息')}</Text>
          <View className="flex items-center gap-[16rpx] py-[20rpx]">
            <Text className="w-[96rpx] text-[26rpx] text-muted-foreground shrink-0">{tt('plaza.cover.account', '账号')}</Text>
            <Text className="flex-1 text-[26rpx] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{devInfo.signNickname || '-'}</Text>
            <Text className="text-[24rpx] text-primary px-[20rpx] py-[8rpx] bg-background rounded-lg shrink-0" onClick={() => copy(devInfo.signNickname || '')}>
              {tt('plaza.cover.copy', '复制')}
            </Text>
          </View>
          <View className="flex items-center gap-[16rpx] py-[20rpx]">
            <Text className="w-[96rpx] text-[26rpx] text-muted-foreground shrink-0">{tt('plaza.cover.password', '密码')}</Text>
            <Text className="flex-1 text-[26rpx] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{devInfo.signPassword || '-'}</Text>
            <Text className="text-[24rpx] text-primary px-[20rpx] py-[8rpx] bg-background rounded-lg shrink-0" onClick={() => copy(devInfo.signPassword || '')}>
              {tt('plaza.cover.copy', '复制')}
            </Text>
          </View>
          <View className="flex items-center gap-[16rpx] py-[20rpx]">
            <Text className="w-[96rpx] text-[26rpx] text-muted-foreground shrink-0">{tt('plaza.cover.url', '网址')}</Text>
            <Text className="flex-1 text-[26rpx] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{devInfo.address || '-'}</Text>
            <Text className="text-[24rpx] text-primary px-[20rpx] py-[8rpx] bg-background rounded-lg shrink-0" onClick={() => copy(devInfo.address || '')}>
              {tt('plaza.cover.copy', '复制')}
            </Text>
          </View>
          <View className="flex items-center gap-[16rpx] py-[20rpx]">
            <Text className="w-[96rpx] text-[26rpx] text-muted-foreground shrink-0">{tt('plaza.cover.expire', '到期')}</Text>
            <Text className="flex-1 text-[26rpx] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{expiresAtStr}</Text>
            <Text className="text-[24rpx] text-primary-foreground px-[20rpx] py-[8rpx] bg-primary rounded-lg shrink-0" onClick={toPay}>
              {tt('plaza.cover.renew', '续费')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* 继续接单按钮(to_plaza) */}
      {isDev ? (
        <View className="flex items-center justify-center h-[88rpx] bg-card rounded-xl mb-[24rpx]" onClick={toPlaza}>
          <Text className="text-[30rpx] text-primary">{tt('plaza.cover.continueOrder', '继续接单')}</Text>
        </View>
      ) : null}

      {/* 未开发者问答列表(un_developer) */}
      {!isDev ? (
        <View className="bg-card rounded-2xl overflow-hidden">
          <Text className="block text-[30rpx] font-semibold text-foreground pt-[32rpx] px-[32rpx] pb-[8rpx]">{tt('plaza.cover.qaTitle', '常见问题')}</Text>
          {QA_FALLBACK.map((qa, i) => (
            <View key={i} className="flex items-center gap-[16rpx] px-[32rpx] py-[28rpx]" onClick={() => toWeb(qa.url)}>
              <Text className="flex-1 text-[28rpx] text-foreground">{tt(QA_KEYS[i] ?? 'plaza.cover.qa0', qa.title)}</Text>
              <Text className="text-[36rpx] text-muted-foreground leading-none">›</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
