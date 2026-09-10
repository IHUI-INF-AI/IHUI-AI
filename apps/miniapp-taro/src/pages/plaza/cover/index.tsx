// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { UserInfo, DeveloperSubscription } from '@/api'
import { formatDateOnly } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import LineIcon, { type IconName } from '@/components/LineIcon'

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

const QA_FALLBACK = (tt: TtFn): QaItem[] => [
  { title: tt('plazaCover.d1', '什么是开发者空间?'), url: 'https://www.zhihui.com/developer/qa1' },
  { title: tt('plazaCover.d2', '如何成为开发者?'), url: 'https://www.zhihui.com/developer/qa2' },
  {
    title: tt('plazaCover.d3', '开发者能获得什么收益?'),
    url: 'https://www.zhihui.com/developer/qa3',
  },
  { title: tt('plazaCover.d4', '智能体如何上架?'), url: 'https://www.zhihui.com/developer/qa4' },
]

const QA_KEYS = [
  'plaza.cover.qa0',
  'plaza.cover.qa1',
  'plaza.cover.qa2',
  'plaza.cover.qa3',
] as const

/** 三个开发者入口(对标原项目 dev_list) */
const DEV_ENTRIES = (
  tt: TtFn,
): Array<{
  key: string
  icon: IconName
  titleKey: string
  titleFb: string
  target: string
}> => [
  {
    key: 'model',
    icon: 'bot',
    titleKey: 'plaza.cover.entryMyModel',
    titleFb: tt('devEnter.cover.myAgents', '我的智能体'),
    target: '/pages/developer/index',
  },
  {
    key: 'income',
    icon: 'wallet',
    titleKey: 'plaza.cover.entryModelIncome',
    titleFb: tt('devEnter.cover.agentIncome', '智能体收入'),
    target: '/pages/developer/income',
  },
  {
    key: 'n8n',
    icon: 'zap',
    titleKey: 'plaza.cover.entryN8n',
    titleFb: tt('plazaCover.d5', 'n8n 智能体'),
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
  return formatDateOnly(d)
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
    <ThemeRoot>
      {/* 对齐 RN 端共享屏 packages/app/src/features/plaza-cover/PlazaCoverScreen.tsx
          (apps/mobile-rn/src/screens/PlazaCoverScreen.tsx 为薄 wrapper,视觉以共享屏为准):
          scrollContent px20dp→40rpx / pb32dp→64rpx / gap20dp→区块间距 40rpx
          (无 pt,顶部留白由 hero py64rpx 提供,同 RN hero paddingVertical 32dp);
          hero 无卡底居中列 gap12dp→24rpx: 标题 24dp→48rpx/700,副文 14dp→28rpx 行高 19dp→38rpx;
          featureCard: w47% bg-card 描边 1dp→2rpx 圆角 12dp→24rpx p14dp→28rpx gap6dp→12rpx,
          图标 32dp→64(色=RN text.primary),label 16dp→32rpx/600,desc 14dp→28rpx tertiary;
          主钮 = bg-brand(RN brand.DEFAULT)py15dp→30rpx 圆角 24rpx 文字 16dp→32rpx/600。
          token 亮暗自适应修正:RN primaryBtnText 恒白(surface.light)暗色不可读→text-primary-foreground;
          RN text.secondary→muted-foreground / text.tertiary→var(--color-text-tertiary) /
          danger.bright→var(--color-danger-bright)。 */}
      <View className="min-h-[100vh] bg-background px-[40rpx] pb-[64rpx] flex flex-col gap-[40rpx]">
        {/* 头部用户区(对齐 RN hero: 无卡底居中列;状态行与续费入口为小程序独有内容) */}
        <View className="flex flex-col items-center py-[64rpx] gap-[24rpx]">
          <Image
            className="w-[128rpx] h-[128rpx] rounded-full bg-muted"
            src={profile?.avatar || '/static/default-avatar.png'}
            mode="aspectFill"
          />
          <Text className="text-[48rpx] font-bold text-foreground text-center">
            {profile?.nickname || tt('plaza.cover.guest', '游客')}
          </Text>
          {waitting ? (
            <Text className="text-[28rpx] text-warning text-center leading-[38rpx]">
              {tt('plaza.cover.opening', '专属开发者空间开通中…')}
            </Text>
          ) : isDev ? (
            <Text className="text-[28rpx] text-success text-center leading-[38rpx]">
              {tt('plaza.cover.opened', '开发者空间已开通')}
            </Text>
          ) : (
            <Text className="text-[28rpx] text-muted-foreground text-center leading-[38rpx]">
              {tt('plaza.cover.notOpened', '未开通')}
            </Text>
          )}
          {/* 对齐 RN primaryBtn(居中列内非通栏,补 px48rpx;RN 通栏无横向 padding) */}
          <View
            className="flex items-center justify-center px-[48rpx] py-[30rpx] bg-[var(--color-brand)] rounded-[24rpx]"
            onClick={toPay}
            hoverClass="opacity-60"
          >
            <Text className="text-[32rpx] font-semibold text-primary-foreground">
              {isDev
                ? tt('plaza.cover.renew', '续费')
                : tt('plaza.cover.becomeDeveloper', '成为开发者')}
            </Text>
          </View>
        </View>

        {/* 未开发者入口引导(小程序独有区块,RN 无对应;按 featureCard+primaryBtn 视觉语言排布) */}
        {!isDev ? (
          <View className="bg-card border-[2rpx] border-border rounded-[24rpx] p-[28rpx] flex flex-col gap-[12rpx]">
            <Text className="block text-[32rpx] font-semibold text-foreground">
              {tt('plaza.cover.entryTitle', '成为开发者')}
            </Text>
            <Text className="block text-[28rpx] leading-[38rpx] text-[var(--color-text-tertiary)]">
              {tt('plaza.cover.entryDesc', '开通专属开发者空间,上架智能体获取收益')}
            </Text>
            <View
              className="flex items-center justify-center py-[30rpx] bg-[var(--color-brand)] rounded-[24rpx]"
              onClick={toPay}
              hoverClass="opacity-60"
            >
              <Text className="text-[32rpx] font-semibold text-primary-foreground">
                {tt('plaza.cover.becomeDeveloper', '立即成为开发者')}
              </Text>
            </View>
          </View>
        ) : null}

        {/* 成为开发者按钮(未开通且无 developerLink 时,保留既有业务条件;对齐 RN primaryBtn 通栏) */}
        {!isDev && !devInfo.developerLink ? (
          <View
            className="flex items-center justify-center py-[30rpx] bg-[var(--color-brand)] rounded-[24rpx]"
            onClick={toPay}
            hoverClass="opacity-60"
          >
            <Text className="text-[32rpx] font-semibold text-primary-foreground">
              {tt('plaza.cover.toPay', '成为开发者')}
            </Text>
          </View>
        ) : null}

        {/* 三个入口卡片(对齐 RN featureGrid/featureCard: 47% 两列网格,图标 32dp→64
            直接着色 RN text.primary,无圆形底托) */}
        <View className="flex flex-row flex-wrap gap-[24rpx]">
          {DEV_ENTRIES(tt).map((e) => (
            <View
              key={e.key}
              className="w-[47%] bg-card border-[2rpx] border-border rounded-[24rpx] p-[28rpx] flex flex-col items-center gap-[12rpx]"
              onClick={() => toEntry(e.target)}
              hoverClass="opacity-60"
            >
              <LineIcon name={e.icon} size={64} color="var(--color-foreground)" />
              <Text className="text-[32rpx] font-semibold text-foreground text-center">
                {tt(e.titleKey, e.titleFb)}
              </Text>
            </View>
          ))}
        </View>

        {/* 开发者信息卡(小程序独有内容;容器对齐 RN featureCard,行文字 14dp→28rpx,
            复制操作色 = RN brand.DEFAULT / 到期行 danger.bright 同源 token) */}
        {isDev ? (
          <View className="bg-card border-[2rpx] border-border rounded-[24rpx] p-[28rpx]">
            <Text className="block text-[32rpx] font-semibold text-foreground mb-[24rpx]">
              {tt('plaza.cover.devInfoTitle', '开发者账号信息')}
            </Text>
            <View className="flex flex-col gap-[12rpx]">
              <View className="flex items-center">
                <Text className="w-[152rpx] shrink-0 text-[28rpx] text-muted-foreground">
                  {tt('plaza.cover.account', '账号')}
                </Text>
                <Text className="flex-1 min-w-0 text-[28rpx] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                  {devInfo.signNickname || '-'}
                </Text>
                <Text
                  className="pl-[16rpx] shrink-0 text-[28rpx] text-[var(--color-brand)]"
                  onClick={() => copy(devInfo.signNickname || '')}
                >
                  {tt('plaza.cover.copy', '复制')}
                </Text>
              </View>
              <View className="flex items-center">
                <Text className="w-[152rpx] shrink-0 text-[28rpx] text-muted-foreground">
                  {tt('plaza.cover.password', '密码')}
                </Text>
                <Text className="flex-1 min-w-0 text-[28rpx] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                  {devInfo.signPassword || '-'}
                </Text>
                <Text
                  className="pl-[16rpx] shrink-0 text-[28rpx] text-[var(--color-brand)]"
                  onClick={() => copy(devInfo.signPassword || '')}
                >
                  {tt('plaza.cover.copy', '复制')}
                </Text>
              </View>
              <View className="flex items-center">
                <Text className="w-[152rpx] shrink-0 text-[28rpx] text-muted-foreground">
                  {tt('plaza.cover.url', '网址')}
                </Text>
                <Text className="flex-1 min-w-0 text-[28rpx] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                  {devInfo.address || '-'}
                </Text>
                <Text
                  className="pl-[16rpx] shrink-0 text-[28rpx] text-[var(--color-brand)]"
                  onClick={() => copy(devInfo.address || '')}
                >
                  {tt('plaza.cover.copy', '复制')}
                </Text>
              </View>
              {/* 到期行: label/value danger.bright + 续费红字(RN danger.bright 同源) */}
              <View className="flex items-center">
                <Text className="w-[152rpx] shrink-0 text-[28rpx] text-[var(--color-danger-bright)]">
                  {tt('plaza.cover.expire', '到期')}
                </Text>
                <Text className="flex-1 min-w-0 text-[28rpx] text-[var(--color-danger-bright)] overflow-hidden text-ellipsis whitespace-nowrap">
                  {expiresAtStr}
                </Text>
                <Text
                  className="pl-[16rpx] shrink-0 text-[28rpx] font-semibold text-[var(--color-danger-bright)]"
                  onClick={toPay}
                >
                  {tt('plaza.cover.renew', '续费')}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 继续接单按钮(小程序独有区块;语义对应 RN 主钮"进入广场" onEnter→Plaza,
            同为进入广场动作,故用 primaryBtn 视觉) */}
        {isDev ? (
          <View
            className="flex items-center justify-center py-[30rpx] bg-[var(--color-brand)] rounded-[24rpx]"
            onClick={toPlaza}
            hoverClass="opacity-60"
          >
            <Text className="text-[32rpx] font-semibold text-primary-foreground">
              {tt('plaza.cover.continueOrder', '继续接单')}
            </Text>
          </View>
        ) : null}

        {/* 未开发者问答(小程序独有内容;卡片对齐 RN featureCard,标题 = featureLabel 档) */}
        {!isDev ? (
          <View className="flex flex-col gap-[24rpx]">
            <Text className="text-[32rpx] font-semibold text-foreground">
              {tt('plaza.cover.qaTitle', '常见问题')}
            </Text>
            {QA_FALLBACK(tt).map((qa, i) => (
              <View
                key={i}
                className="bg-card border-[2rpx] border-border rounded-[24rpx] p-[28rpx]"
                onClick={() => toWeb(qa.url)}
                hoverClass="opacity-60"
              >
                <Text className="text-[32rpx] font-semibold text-foreground">
                  {tt(QA_KEYS[i] ?? 'plaza.cover.qa0', qa.title)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
