// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/developer/DeveloperScreen.tsx
// 小程序端渲染层(逐元素同形本屏 ①③④ 三段;共享屏 ② 开发者信息卡依赖
// GET /developer/dev-info 聚合接口与本端 developerInfo.* 词包,二者均未就位 ⇒ 本端暂不渲染,
// 与本屏「无有效订阅 ⇒ info 为 null ⇒ ② 整块缺席」的既有语义同形)。
// 分段数据(四入口构成/顺序/取词键 + 两张问题卡)一律取自
// @ihui/shared/constants/developer-space,端内不得再抄一份表(§0.6)。
import { useCallback, useEffect, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { DeveloperSpaceEntryId } from '@ihui/types'
import {
  DEVELOPER_DEFAULT_LOGO_URL,
  DEVELOPER_SPACE_ENTRIES,
  DEVELOPER_SPACE_PROBLEMS,
} from '@ihui/shared/constants/developer-space'
import { useI18n, useTt } from '@/i18n'
import * as api from '@/api'
import type { UserInfo } from '@/api'
import { logger } from '@/utils/logger'
import LineIcon, { type IconName } from '@/components/LineIcon'
import ThemeRoot from '@/components/ThemeRoot'

/**
 * 端内渲染细节:lucide 线性字形名与路由落点。
 * 跨端共用的**构成/顺序/取词键**住在共享表,这里只补本端才有的两件事
 * (图标素材名 —— 本端禁 CDN 位图当 UI 图标;路由 —— 端内页面拓扑与 RN 不同名)。
 */
const ENTRY_GLYPH: Record<DeveloperSpaceEntryId, IconName> = {
  myAgents: 'bot',
  agentIncome: 'wallet',
  n8nModel: 'zap',
  businessCard: 'user',
}

/** 对齐 RN 壳 pressEntry:我的智能体 / 智能体收入 / n8n 智能体 / 创客名片 */
const ENTRY_ROUTE: Record<DeveloperSpaceEntryId, string> = {
  myAgents: '/pkg-ai/developer/index',
  agentIncome: '/pkg-ai/developer/income',
  n8nModel: '/pkg-ai/dev-enter/n8n-model/index',
  businessCard: '/pkg-ai/business-card/index',
}

/** 成为开发者 / 续费同落点:选套餐 + 一键开通支付(RN openCover → DevEnterCover 的同语义端内页) */
const SUBSCRIBE_URL = '/pkg-shop/pay/index?type=developer'

/** 客服入口(RN onContactService → CustomerService) */
const SERVICE_URL = '/pkg-about/about/contact'

/** 无有效订阅时的账号原料缺省(信息卡未渲染,只用于订阅态判定) */
function readSubscription(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return null
  return (raw as { subscription?: unknown }).subscription ?? null
}

export default function DevSpace() {
  const { t } = useI18n()
  const tt = useTt()
  const [profile, setProfile] = useState<UserInfo | null>(null)
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: t('devSpace.title') })
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [pf, subRes] = await Promise.all([
        api.getProfile().catch(() => null),
        api.getMyDeveloperSubscription().catch(() => null),
      ])
      if (cancelled) return
      if (pf) setProfile(pf as UserInfo)
      const sub = readSubscription(subRes)
      // 显式两值判空(不用松等 != null,eqeqeq 禁),语义与原意一致:null 与 undefined 都算未订阅
      setSubscribed(sub !== null && sub !== undefined)
    })().catch((e: unknown) => logger.error('dev-space', '加载开发者空间', e))
    return () => {
      cancelled = true
    }
  }, [])

  const openSubscribe = useCallback((): void => {
    void Taro.navigateTo({ url: SUBSCRIBE_URL })
  }, [])

  const pressEntry = useCallback((id: DeveloperSpaceEntryId): void => {
    void Taro.navigateTo({ url: ENTRY_ROUTE[id] })
  }, [])

  /** 点击语义对齐 RN 壳:复制链接并提示到浏览器打开(端侧承载点不同,由本端决定) */
  const copyProblemLink = useCallback(
    (url: string): void => {
      void Taro.setClipboardData({
        data: url,
        success: () =>
          Taro.showToast({ title: t('devSpace.linkCopied'), icon: 'none', duration: 2000 }),
        fail: () => Taro.showToast({ title: t('devSpace.linkCopyFailed'), icon: 'none' }),
      })
    },
    [t],
  )

  const openService = useCallback((): void => {
    void Taro.navigateTo({ url: SERVICE_URL })
  }, [])

  const avatarUrl = profile?.avatar || DEVELOPER_DEFAULT_LOGO_URL
  const displayName = profile?.nickname || profile?.username || t('devSpace.notLoggedIn')

  return (
    <ThemeRoot>
      <ScrollView scrollY className="h-full bg-background">
        <View className="flex flex-col p-[20rpx] pb-[48rpx]">
          {/* ① 头部用户卡 */}
          <View className="mb-[20rpx] flex flex-col items-center rounded-lg bg-card p-[28rpx]">
            <Image
              className="h-[128rpx] w-[128rpx] rounded-2xl"
              src={avatarUrl}
              mode="aspectFill"
            />
            <Text className="mb-[16rpx] mt-[16rpx] block text-[length:34rpx] font-semibold leading-[46rpx] text-foreground">
              {displayName}
            </Text>
            <View
              className="rounded-sm bg-cta px-[40rpx] py-[10rpx]"
              onClick={openSubscribe}
              hoverClass="opacity-80"
            >
              <Text className="text-[length:28rpx] font-semibold leading-[40rpx] text-cta-foreground">
                {subscribed ? t('devSpace.renew') : tt('developer.becomeDeveloper', '成为开发者')}
              </Text>
            </View>
          </View>

          {/* ③ 四个功能入口(顺序即跨端表顺序) */}
          <View className="mb-[20rpx] flex flex-row rounded-xl bg-card py-[24rpx]">
            {DEVELOPER_SPACE_ENTRIES.map((entry) => (
              <View
                key={entry.id}
                className="flex flex-1 flex-col items-center gap-[8rpx]"
                onClick={() => pressEntry(entry.id)}
                hoverClass="opacity-70"
              >
                <View className="flex h-[96rpx] w-[96rpx] items-center justify-center rounded-2xl bg-muted">
                  <LineIcon
                    name={ENTRY_GLYPH[entry.id]}
                    size={56}
                    color="var(--color-foreground)"
                  />
                </View>
                <Text className="block text-[length:26rpx] leading-[36rpx] text-foreground">
                  {t(entry.labelKey)}
                </Text>
              </View>
            ))}
          </View>

          {/* ④ 问题解答卡 + 咨询客服 */}
          <View className="flex flex-col gap-[16rpx]">
            <Text className="mb-[8rpx] block text-[length:30rpx] font-semibold leading-[40rpx] text-foreground">
              {t('devSpace.faqHeading')}
            </Text>
            {DEVELOPER_SPACE_PROBLEMS.map((problem) => (
              <View
                key={problem.id}
                className="flex flex-col rounded-lg bg-card p-[24rpx]"
                onClick={() => copyProblemLink(problem.url)}
                hoverClass="opacity-80"
              >
                <Text className="mb-[8rpx] block text-[length:30rpx] font-semibold leading-[40rpx] text-foreground">
                  {t(problem.titleKey)}
                </Text>
                <Text className="mb-[16rpx] block text-[length:26rpx] leading-[36rpx] text-muted-foreground">
                  {t(problem.descKey)}
                </Text>
                <View className="self-start rounded-sm bg-cta px-[24rpx] py-[8rpx]">
                  <Text className="text-[length:26rpx] font-medium leading-[36rpx] text-cta-foreground">
                    {t(problem.btnKey)}
                  </Text>
                </View>
              </View>
            ))}
            <View
              className="flex flex-col items-center rounded-sm bg-card p-[24rpx]"
              onClick={openService}
              hoverClass="opacity-90"
            >
              <Text className="block text-[length:30rpx] font-semibold leading-[40rpx] text-foreground">
                {t('devSpace.contactHeading')}
              </Text>
              <Text className="mt-[6rpx] block text-[length:24rpx] leading-[34rpx] text-muted-foreground">
                {t('devSpace.contactDesc')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
