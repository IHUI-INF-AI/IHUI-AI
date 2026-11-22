// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { generateInvitationCode, getInviteeList, getInvitationCodes } from '@ihui/api-client'
import {
  InvitationsScreen as SharedInvitationsScreen,
  type InviteeRowView,
  type InvitationRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useClipboard } from '../hooks/use-clipboard'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 与 web 同参 Intl.DateTimeFormat(page.tsx:99-105);web 用 next-intl locale,RN 用 useI18n locale */
function makeFormatter(locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (v?: string | null) => {
    if (!v) return '-'
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? '-' : fmt.format(d)
  }
}

/**
 * RN 端「邀请奖励」薄壳 —— 承载 web /invitations。渲染全部委托共享屏,本文件只管:
 * 取数(GET /api/invitations、GET /api/invitations/invitees)、生成(POST /api/invitations)、
 * 复制剪贴板(@react-native-clipboard/clipboard,web 为 navigator.clipboard,同一动作两端各用平台 API)、
 * 登录门(与 web useAuthGate 同口径:未登录不发注定 401 的请求)。
 */
export function InvitationsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [codes, setCodes] = useState<InvitationRowView[]>([])
  const [codesLoading, setCodesLoading] = useState(false)
  const [codesError, setCodesError] = useState<string | null>(null)
  const [invitees, setInvitees] = useState<InviteeRowView[]>([])
  const [inviteesLoading, setInviteesLoading] = useState(false)
  const [inviteesError, setInviteesError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { copy: copyToClipboard } = useClipboard()

  const fmt = useMemo(() => makeFormatter(locale), [locale])

  const loadCodes = useCallback(async () => {
    setCodesLoading(true)
    setCodesError(null)
    try {
      const res = await getInvitationCodes()
      if (!res.success || !res.data) {
        setCodesError(res.error ?? t('invitationsPage.error'))
        return
      }
      setCodes(
        (res.data.list ?? []).map((c) => ({
          id: c.id,
          code: c.code,
          status: c.status,
          rewardText: t('invitationsPage.rewardValue', {
            inviter: c.rewardInviter,
            invitee: c.rewardInvitee,
          }),
          expiresText: `${t('invitationsPage.expiresAt')}: ${fmt(c.expiresAt)}`,
        })),
      )
    } catch {
      setCodesError(t('invitationsPage.error'))
    } finally {
      setCodesLoading(false)
    }
  }, [t, fmt])

  const loadInvitees = useCallback(async () => {
    setInviteesLoading(true)
    setInviteesError(null)
    try {
      const res = await getInviteeList()
      if (!res.success || !res.data) {
        setInviteesError(res.error ?? t('invitationsPage.error'))
        return
      }
      setInvitees(
        (res.data.list ?? []).map((u) => ({
          id: u.invitationId,
          name: u.inviteeNickname ?? u.inviteeEmail ?? '-',
          registeredText: fmt(u.usedAt ?? u.createdAt),
          rewardText: String(u.rewardInvitee),
        })),
      )
    } catch {
      setInviteesError(t('invitationsPage.error'))
    } finally {
      setInviteesLoading(false)
    }
  }, [t, fmt])

  useEffect(() => {
    if (!user) return
    void loadCodes()
    void loadInvitees()
  }, [user, loadCodes, loadInvitees])

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    },
    [],
  )

  const generate = useCallback(async () => {
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await generateInvitationCode()
      if (!res.success) {
        setGenerateError(res.error ?? t('invitationsPage.error'))
        return
      }
      void loadCodes()
    } catch {
      setGenerateError(t('invitationsPage.error'))
    } finally {
      setGenerating(false)
    }
  }, [t, loadCodes])

  const copyCode = useCallback(
    (id: string, code: string) => {
      // 与 web handleCopy 同口径:成功短暂回显「已复制」,失败静默。
      // 写剪贴板走端内单源出口 useClipboard(先例 ChatTemplatesScreen / ImageGenTemplatesScreen),
      // 不在屏里直连 Clipboard —— 后者返回 void,链式 .then 会把失败读成成功。
      void (async () => {
        const ok = await copyToClipboard(code)
        if (!ok) {
          setCopiedId(null)
          return
        }
        setCopiedId(id)
        if (copyTimer.current) clearTimeout(copyTimer.current)
        copyTimer.current = setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
      })()
    },
    [copyToClipboard],
  )

  return (
    <SharedInvitationsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t('invitationsPage.loginRequired')}
      generating={generating}
      generateError={generateError}
      onGenerate={() => void generate()}
      codesLoading={codesLoading}
      codesError={codesError}
      codes={codes}
      copiedId={copiedId}
      onCopy={copyCode}
      inviteesLoading={inviteesLoading}
      inviteesError={inviteesError}
      invitees={invitees}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
