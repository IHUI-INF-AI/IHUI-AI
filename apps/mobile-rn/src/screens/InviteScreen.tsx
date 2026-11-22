// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { InviteScreen as SharedInviteScreen } from '@ihui/rn-app'
import type { InviteInfo, InviteRecordItem } from '@ihui/types'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 与 DistributionScreen 同源的邀请落地页(对齐 Uniapp 分销页分享链接的拼法) */
const INVITE_BASE_URL = 'https://www.aizhs.top'

/** GET /distribution/overview 的真实回包字段(routes/distribution.ts:87-99) */
interface DistributionOverview {
  totalCommission: number
  inviteCode: string | null
  invitedCount: number
}

/** GET /distribution/invited-users 的行(routes/distribution.ts:178-190) */
interface InvitedUserRow {
  id: string
  username: string
  nickname: string | null
  createdAt: string
}

function formatInvitedAt(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

export function InviteScreen() {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [records, setRecords] = useState<InviteRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [infoRes, listRes] = await Promise.all([
        // 邀请码/已邀请数/累计奖励的真值都在 overview(inviteCode/invitedCount/totalCommission);
        // invite-info 的 inviteUrl 恒 null,不作数据源。
        fetchApi<DistributionOverview>('/distribution/overview'),
        // 后端 GET /distribution/invited-users 两个分支都包 list 键(传 page/pageSize 回
        // {list,total,page,pageSize}，不传回 {list,total})，而同页 overview 回的是对象本身 ⇒
        // 记录那半按数组读会让"已邀请用户"永远空列表。
        fetchApi<{ list: InvitedUserRow[] }>('/distribution/invited-users'),
      ])
      if (!infoRes.success || !listRes.success) throw new Error()
      const ov = infoRes.data
      const inviteCode = ov?.inviteCode ?? ''
      setInfo(
        ov
          ? {
              inviteCode,
              // 邀请链接仓库内无端点下发,按既有模式用真实 inviteCode 拼(DistributionScreen 同款);
              // 无邀请码就不给这个字段,不发 undefined。
              ...(inviteCode
                ? { inviteUrl: `${INVITE_BASE_URL}/register?inviteCode=${inviteCode}` }
                : {}),
              totalInvited: ov.invitedCount,
              totalReward: ov.totalCommission,
            }
          : null,
      )
      // 行字段归一:nickname 缺省落 username,invitedAt ← createdAt(同一真值,更名投影);
      // reward/status 后端不下发 ⇒ 不投影,渲染层按可选缺失处理。
      setRecords(
        (listRes.data?.list ?? []).map((row) => ({
          id: row.id,
          nickname: row.nickname ?? row.username,
          invitedAt: formatInvitedAt(row.createdAt),
        })),
      )
    } catch {
      setError(t('invite.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onShare = async () => {
    // 无真实链接就不发 Share(避免 '…: undefined')
    if (!info?.inviteUrl) return
    try {
      await Share.share({ message: `${t('invite.shareText')}: ${info.inviteUrl}` })
    } catch {
      // ignore
    }
  }

  return (
    <SharedInviteScreen
      t={t}
      info={info}
      records={records}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onShare={onShare}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
