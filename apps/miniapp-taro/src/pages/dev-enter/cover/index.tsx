import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useEffect, useMemo } from 'react'
import * as api from '@/api'
import type { UserInfo } from '@/api'
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import './index.css'

// 开发者账号信息(对标原 developerLink.developer)
interface DeveloperInfo {
  signNickname?: string
  signPassword?: string
  address?: string
}

// 开发者链接(对标原 userInfo.developerLink)
interface DeveloperLink {
  developer?: DeveloperInfo | null
  expiresAt?: number
  expiresAtStr?: string
  type?: number
}

// FAQ 问题项(对标原 problems)
interface FaqItem {
  title: string
  context: string
  btn: string
  url: string
}

// 常见问题(硬编码占位,点击跳 webview)
const FAQ_LIST: FaqItem[] = [
  {
    title: '如何成为开发者？',
    context: '了解开发者开通流程、权益与义务，快速加入开发者计划。',
    btn: '查看开通流程 >',
    url: 'https://blurb.kou.aizhs.top/developer.html',
  },
  {
    title: '开发者收益如何结算？',
    context: '了解智能体收入分成规则、提现周期与结算方式。',
    btn: '了解收益规则 >',
    url: 'https://blurb.kou.aizhs.top/bianxian.html',
  },
  {
    title: '智能体审核规则',
    context: '发布智能体的审核标准、常见拒绝原因与修改建议。',
    btn: '查看审核规则 >',
    url: 'https://blurb.kou.aizhs.top/shangchuan.html',
  },
  {
    title: 'n8n 智能体说明',
    context: 'n8n 工作流智能体的创建、参数配置与发布流程说明。',
    btn: '了解 n8n 智能体 >',
    url: 'https://blurb.kou.aizhs.top/kecheng.html',
  },
]

// 从 userInfo 中安全提取 developerLink(类型守卫)
function readDevLink(userInfo: UserInfo | null): DeveloperLink | null {
  if (!userInfo) return null
  const raw = (userInfo as Record<string, unknown>).developerLink
  if (!raw || typeof raw !== 'object') return null
  const link = raw as Record<string, unknown>
  const dev = link.developer
  const developer: DeveloperInfo | null | undefined =
    dev && typeof dev === 'object'
      ? (dev as DeveloperInfo)
      : dev === null || dev === undefined
        ? null
        : undefined
  return {
    developer: developer === undefined ? null : developer,
    expiresAt: typeof link.expiresAt === 'number' ? link.expiresAt : undefined,
    expiresAtStr:
      typeof link.expiresAtStr === 'string' ? link.expiresAtStr : undefined,
    type: typeof link.type === 'number' ? link.type : undefined,
  }
}

export default function DevEnterCover() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const profile = await api.getProfile()
      setUserInfo(profile)
    } catch (e) {
      logger.error('dev-enter-cover', '加载用户信息', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => {
    loadData()
  })

  // 动态设置导航栏标题(页面无独立 config)
  useEffect(() => {
    Taro.setNavigationBarTitle({
      title: tt('devEnter.cover.title', '开发者详情'),
    })
  })

  // 派生:开发者状态(对标原 computed.developer / expire / waitting)
  const devLink = useMemo(() => readDevLink(userInfo), [userInfo])
  const developer = devLink?.developer ?? null
  const hasDevLink = !!devLink
  const expire = useMemo(() => {
    if (!devLink?.expiresAt) return false
    return Date.now() > devLink.expiresAt * 1000
  }, [devLink])
  // waitting:developerLink 存在但未开通完成(developer 为空)
  const waitting = hasDevLink && !developer
  const showAccount = !!developer && !expire
  const showFaq = !hasDevLink || waitting

  // 复制到剪贴板(对标原 copyText)
  const copyText = useCallback(
    (data: string) => {
      if (!data) return
      Taro.setClipboardData({
        data,
        success: () =>
          Taro.showToast({
            title: tt('devEnter.cover.copySuccess', '已复制'),
            icon: 'none',
          }),
        fail: () => Taro.showToast({ title: tt('common.failed', '复制失败'), icon: 'none' }),
      })
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const toPay = useCallback(() => {
    Taro.navigateTo({ url: '/pages/pay/index?type=developer' })
  }, [])

  const toMyModel = useCallback(() => {
    Taro.navigateTo({ url: '/pages/developer/index' })
  }, [])

  const toModelIncome = useCallback(() => {
    Taro.navigateTo({ url: '/pages/developer/income' })
  }, [])

  const toNbnModel = useCallback(() => {
    Taro.navigateTo({ url: '/pages/dev-enter/n8n-model/index' })
  }, [])

  const renew = useCallback(() => {
    Taro.navigateTo({ url: '/pages/pay/index?type=developer' })
  }, [])

  const toPlaza = useCallback(() => {
    Taro.navigateTo({ url: '/pages/plaza/index/index' })
  }, [])

  const toWeb = useCallback((item: FaqItem) => {
    Taro.navigateTo({
      url: `/pages/webview/index?url=${encodeURIComponent(item.url)}&title=${encodeURIComponent(item.title)}`,
    })
  }, [])

  const avatar = userInfo?.avatar || '/static/default-avatar.png'
  const nickname = userInfo?.nickname || ''

  return (
    <ScrollView className="dev-cover-page" scrollY>
      {/* 用户信息卡 */}
      <View className="dc-header-card">
        <Image className="dc-avatar" src={avatar} mode="aspectFill" />
        <Text className="dc-nickname">{nickname}</Text>

        {waitting ? (
          <View className="dc-waitting">
            <Text className="dc-waitting-text">
              {tt('devEnter.cover.opening', '专属开发者空间开通中…')}
            </Text>
            <Text className="dc-waitting-sub">
              {tt('devEnter.cover.openingTip', '进度查询请加入社区联系工作人员')}
            </Text>
          </View>
        ) : null}

        {!hasDevLink ? (
          <View className="dc-become-btn" onClick={toPay}>
            <Text>{tt('devEnter.cover.becomeDeveloper', '成为开发者')}</Text>
          </View>
        ) : null}
      </View>

      {/* 3 个功能入口 */}
      <View className="dc-entry-list">
        <View className="dc-entry-item" onClick={toMyModel}>
          <View className="dc-entry-icon">
            <Text className="dc-entry-emoji">🤖</Text>
          </View>
          <Text className="dc-entry-text">
            {tt('devEnter.cover.myAgents', '我的智能体')}
          </Text>
        </View>
        <View className="dc-entry-item" onClick={toModelIncome}>
          <View className="dc-entry-icon">
            <Text className="dc-entry-emoji">💰</Text>
          </View>
          <Text className="dc-entry-text">
            {tt('devEnter.cover.agentIncome', '智能体收入')}
          </Text>
        </View>
        <View className="dc-entry-item" onClick={toNbnModel}>
          <View className="dc-entry-icon">
            <Text className="dc-entry-emoji">⚡</Text>
          </View>
          <Text className="dc-entry-text">
            {tt('devEnter.cover.n8nAgents', 'n8n智能体')}
          </Text>
        </View>
      </View>

      {/* 开发者账号信息卡(仅 developer && !expire) */}
      {showAccount && developer ? (
        <View className="dc-account-card">
          <View className="dc-account-row">
            <Text className="dc-account-label">
              {tt('devEnter.cover.account', '账号')}：{developer.signNickname || '-'}
            </Text>
            <Text
              className="dc-copy-btn"
              onClick={() => copyText(developer.signNickname || '')}
            >
              {tt('devEnter.cover.copy', '复制')}
            </Text>
          </View>
          <View className="dc-account-row">
            <Text className="dc-account-label">
              {tt('devEnter.cover.password', '密码')}：{developer.signPassword || '-'}
            </Text>
            <Text
              className="dc-copy-btn"
              onClick={() => copyText(developer.signPassword || '')}
            >
              {tt('devEnter.cover.copy', '复制')}
            </Text>
          </View>
          <View className="dc-account-row">
            <Text className="dc-account-label">
              {tt('devEnter.cover.website', '网址')}：
              {developer.address || tt('devEnter.cover.noWebsite', '无')}
            </Text>
            <Text
              className="dc-copy-btn"
              onClick={() => copyText(developer.address || '')}
            >
              {tt('devEnter.cover.copy', '复制')}
            </Text>
          </View>
          <View className="dc-account-row">
            <Text className="dc-account-label dc-expire-text">
              {tt('devEnter.cover.expireTime', '到期时间')}：
              {devLink?.expiresAtStr || '-'}
            </Text>
            <View className="dc-renew-btn" onClick={renew}>
              <Text>{tt('devEnter.cover.renew', '续费')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* 开发者须知 + 继续接单(仅 developer && !expire) */}
      {showAccount ? (
        <View className="dc-notice-row">
          <Text className="dc-notice-tip">
            {tt('devEnter.cover.devNotice', '开发者须知')}
          </Text>
          <View className="dc-plaza-btn" onClick={toPlaza}>
            <Text>{tt('devEnter.cover.continueOrder', '继续接单')}</Text>
          </View>
        </View>
      ) : null}

      {/* FAQ(非开发者或开通中) */}
      {showFaq ? (
        <View className="dc-faq-section">
          <Text className="dc-faq-title">
            {tt('devEnter.cover.faqTitle', '相关开发者的一系列问题解答？')}
          </Text>
          <View className="dc-faq-grid">
            {FAQ_LIST.map((item, idx) => (
              <View
                key={idx}
                className="dc-faq-item"
                onClick={() => toWeb(item)}
              >
                <Text className="dc-faq-item-title">{item.title}</Text>
                <Text className="dc-faq-item-context">{item.context}</Text>
                <Text className="dc-faq-item-btn">{item.btn}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {loading ? (
        <Text className="dc-loading">{t('common.loading')}</Text>
      ) : null}
    </ScrollView>
  )
}
