// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 部分收敛(2026-11-05):本页是「开发者空间」,声明已由误挂的 plaza-cover/PlazaCoverScreen
// 纠为 features/developer/DeveloperScreen(RN apps/mobile-rn/src/screens/DeveloperScreen.tsx:162 真消费)。
// 只迁两端都显式传且值不同的四段:statusText / entryIds(RN 4 vs 小程序 3,数据源不同) /
// footerAction(进入广场 vs 继续接单) / showApiKeyRow(true vs false)。
// 不迁(留页内,见 dev-guide-card / dev-password-card):未开发者引导卡(RN 无,且与 header CTA
// 重复)、密码行(RN 数据模型无 password,无法两端显式传值)。共享屏为单体 ScrollView,
// 本地两块只能置于屏外顶部;不为凑整页换壳加 headerSlot/footerSlot 单端槽。
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import type { UserInfo, DeveloperSubscription } from '@/api'
import { formatDateOnly } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import type { DeveloperSpaceEntryId } from '@ihui/types'
import { DeveloperScreen } from '@ihui/rn-app/features/developer/DeveloperScreen'
import DevGuideCard from './dev-guide-card'
import DevPasswordCard from './dev-password-card'

/** 开发者账号信息(对标原项目 developer_info_body) */
interface DeveloperInfo {
  signNickname?: string
  signPassword?: string
  address?: string
  developerLink?: string
}

/** 三个开发者入口(小程序数据源;RN 为 DEVELOPER_SPACE_ENTRIES 四入口,少 businessCard) */
const DEV_ENTRY_IDS = ['myAgents', 'agentIncome', 'n8nModel'] as const

const ENTRY_TARGETS: Record<string, string> = {
  myAgents: '/pkg-ai/developer/index',
  agentIncome: '/pkg-ai/developer/income',
  n8nModel: '/pkg-ai/dev-enter/n8n-model/index',
}

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
  const { resolvedTheme } = useTheme()
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
    Taro.navigateTo({ url: '/pkg-ai/developer/subscribe' })
  }, [])

  const toPlaza = useCallback(() => {
    Taro.navigateTo({ url: '/pages/plaza/index/index' })
  }, [])

  const toWeb = useCallback((url: string) => {
    Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
  }, [])

  const copy = useCallback((text: string) => {
    if (!text) return
    Taro.setClipboardData({ data: text })
  }, [])

  const onEntryPress = useCallback((id: DeveloperSpaceEntryId) => {
    const target = ENTRY_TARGETS[id]
    if (target) Taro.navigateTo({ url: target })
  }, [])

  const expiresAtStr = formatExpires(subscription?.endTime)

  const statusText = waitting
    ? tt('plaza.cover.opening', '专属开发者空间开通中…')
    : isDev
      ? tt('plaza.cover.opened', '开发者空间已开通')
      : tt('plaza.cover.notOpened', '未开通')

  const info = isDev
    ? {
        application: null,
        account: devInfo.signNickname || '',
        apiKeyCount: 0,
        copyableApiKey: null,
        website: devInfo.address || '',
        expiry: expiresAtStr,
      }
    : null

  return (
    <ThemeRoot>
      {!isDev ? (
        <DevGuideCard
          title={tt('plaza.cover.entryTitle', '成为开发者')}
          description={tt('plaza.cover.entryDesc', '开通专属开发者空间,上架智能体获取收益')}
          ctaLabel={tt('plaza.cover.becomeDeveloper', '立即成为开发者')}
          onPress={toPay}
        />
      ) : null}
      {isDev ? (
        <DevPasswordCard
          title={tt('plaza.cover.devInfoTitle', '开发者账号信息')}
          label={tt('plaza.cover.password', '密码')}
          value={devInfo.signPassword || ''}
          copyLabel={tt('plaza.cover.copy', '复制')}
          onCopy={() => copy(devInfo.signPassword || '')}
        />
      ) : null}
      <DeveloperScreen
        t={t}
        colorScheme={resolvedTheme}
        avatarUrl={profile?.avatar || ''}
        displayName={profile?.nickname || tt('plaza.cover.guest', '游客')}
        subscribed={Boolean(subscription)}
        info={info}
        statusText={statusText}
        entryIds={DEV_ENTRY_IDS}
        footerAction={
          isDev ? { label: tt('plaza.cover.continueOrder', '继续接单'), onPress: toPlaza } : null
        }
        showApiKeyRow={false}
        onBecomeDeveloper={toPay}
        onRenew={toPay}
        onCopyApiKey={copy}
        onEntryPress={onEntryPress}
        onProblemPress={toWeb}
        onContactService={() => Taro.navigateTo({ url: '/pkg-mirror/customer-service/index' })}
      />
    </ThemeRoot>
  )
}
