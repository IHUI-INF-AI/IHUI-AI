// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import Clipboard from '@react-native-clipboard/clipboard'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getDeveloperDevInfo, type DeveloperDevInfo } from '@ihui/api-client'
import type { DeveloperSpaceEntryId, DeveloperSpaceInfo } from '@ihui/types'
import { DeveloperScreen as SharedDeveloperScreen } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

/**
 * DeveloperScreen 开发者空间页(mobile-rn 端薄壳)
 *
 * 渲染层与段落构成一律住在共享屏 `packages/app/src/features/developer/DeveloperScreen.tsx`
 * (跨端唯一真相源);本壳只做四件事:取数(GET /api/developer/dev-info 单次聚合)、i18n 取词、
 * 主题接线、导航/剪贴板等端能力注入。禁止在这里再写一份版式 —— 那是守门
 * `check-cross-end-screen-coverage.mjs` R4「RN 下沉率」要拦的形态。
 *
 * 端能力标注:依赖 @react-native-clipboard/clipboard 与 Native Stack 导航(RN 特有)。
 */

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 由聚合数据派生信息卡原料(取词与占位交共享屏,日期在本端按 locale 格式化) */
function buildInfo(
  data: DeveloperDevInfo | null,
  fallback: { email?: string; phone?: string; nickname?: string; username?: string },
  formatExpiry: (iso: string) => string,
): DeveloperSpaceInfo | null {
  const subscription = data?.subscription ?? null
  if (!subscription) return null
  const account = data?.account ?? null
  const developer = data?.developer ?? null
  return {
    application: developer
      ? {
          name: developer.name ?? '',
          description: developer.description ?? '',
          status: developer.status,
        }
      : null,
    account:
      account?.email ??
      account?.phone ??
      account?.nickname ??
      account?.username ??
      fallback.email ??
      fallback.phone ??
      fallback.nickname ??
      fallback.username ??
      '',
    apiKeyCount: data?.apiKeys.count ?? 0,
    // 明文 secret 后端只在创建时返回一次,这里只能是首个可用密钥的公开标识
    copyableApiKey: data?.apiKeys.firstActiveKey ?? null,
    website: developer?.website ?? '',
    expiry: subscription.endTime ? formatExpiry(subscription.endTime) : null,
  }
}

export default function DeveloperScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const { user } = useAuth()
  const [devData, setDevData] = useState<DeveloperDevInfo | null>(null)
  const [infoLoaded, setInfoLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await getDeveloperDevInfo().catch(() => null)
        if (!cancelled && res?.success) setDevData(res.data)
      } catch {
        // 信息加载失败不阻塞页面:信息卡按「无有效订阅」不渲染
      } finally {
        if (!cancelled) setInfoLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const formatExpiry = useCallback(
    (iso: string): string => new Intl.DateTimeFormat(locale).format(new Date(iso)),
    [locale],
  )

  const info = useMemo(
    () => (infoLoaded ? buildInfo(devData, user ?? {}, formatExpiry) : null),
    [infoLoaded, devData, user, formatExpiry],
  )

  const notify = useCallback(
    (messageKey: string): void => appAlert(t('common.hint'), t(messageKey)),
    [t],
  )

  /** 成为开发者 / 续费同为开通封面页(选套餐 + 一键开通支付) */
  const openCover = useCallback((): void => navigation.navigate('DevEnterCover'), [navigation])

  const copyApiKey = useCallback(
    (apiKey: string): void => {
      try {
        Clipboard.setString(apiKey)
        notify('devSpace.copied')
      } catch {
        notify('devSpace.copyFailed')
      }
    },
    [notify],
  )

  const openProblem = useCallback(
    (url: string): void => {
      try {
        Clipboard.setString(url)
        notify('devSpace.linkCopied')
      } catch {
        notify('devSpace.linkCopyFailed')
      }
    },
    [notify],
  )

  const pressEntry = useCallback(
    (id: DeveloperSpaceEntryId): void => {
      switch (id) {
        case 'myAgents':
          navigation.navigate('DevEnter')
          break
        case 'agentIncome':
          navigation.navigate('ModelIncome', { agentId: undefined })
          break
        case 'n8nModel':
          navigation.navigate('N8nModel')
          break
        case 'businessCard':
          navigation.navigate('BusinessCard', {})
          break
      }
    },
    [navigation],
  )

  return (
    <View style={{ flex: 1 }}>
      <NavChrome>
        <NavBar title={t('devSpace.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <SharedDeveloperScreen
        t={t}
        colorScheme={resolvedTheme}
        avatarUrl={user?.avatar ?? ''}
        displayName={user?.nickname ?? user?.username ?? t('devSpace.notLoggedIn')}
        subscribed={Boolean(devData?.subscription)}
        info={info}
        onBecomeDeveloper={openCover}
        onRenew={openCover}
        onCopyApiKey={copyApiKey}
        onEntryPress={pressEntry}
        onProblemPress={openProblem}
        onContactService={() => navigation.navigate('CustomerService')}
      />
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
