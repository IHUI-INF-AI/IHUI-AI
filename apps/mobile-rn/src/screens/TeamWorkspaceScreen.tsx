// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelTeamInvitation,
  deleteTeamById,
  getTeamById,
  getTeamInvitationsById,
  getTeamMembersById,
  inviteTeamMember,
  removeTeamMember,
  updateTeamById,
  updateTeamMemberRole,
} from '@ihui/api-client'
import { formatDateOnly } from '@ihui/shared/utils/date-utils'
import {
  TeamWorkspaceScreen as SharedTeamWorkspaceScreen,
  type TeamWorkspaceInfo,
  type TeamWorkspaceInvitation,
  type TeamWorkspaceMember,
  type TeamWorkspaceRole,
  type TeamWorkspaceSettingsForm,
  type TeamWorkspaceTab,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type LocalParamList = RootStackParamList & {
  TeamWorkspace: { teamId: string }
}
type TeamWorkspaceRouteProp = RouteProp<LocalParamList, 'TeamWorkspace'>
type NavigationProp = NativeStackNavigationProp<LocalParamList>

/**
 * RN 端「协作团队详情/成员/邀请管理」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/teams/TeamWorkspaceScreen.tsx`,本文件只管平台侧:
 * 取词、主题、导航落点与确认弹窗,以及 /api/teams/:id 全家桶
 * (对齐 web teams/[id]/PageClient.tsx:37/:43/:49/:73/:83/:88/:95/:100/:112)。
 *
 * 邀请列表 403(非 owner/admin)与 web 同口径:不弹错,列表按空态渲染。
 */
export function TeamWorkspaceScreen() {
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<TeamWorkspaceRouteProp>()
  const { teamId } = route.params
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [team, setTeam] = useState<TeamWorkspaceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TeamWorkspaceTab>('members')

  const [membersLoading, setMembersLoading] = useState(false)
  const [members, setMembers] = useState<TeamWorkspaceMember[]>([])
  const [invitationsLoading, setInvitationsLoading] = useState(false)
  const [invitations, setInvitations] = useState<TeamWorkspaceInvitation[]>([])

  const [invitee, setInvitee] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  const [settingsForm, setSettingsForm] = useState<TeamWorkspaceSettingsForm>({
    name: '',
    description: '',
  })
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await getTeamMembersById(teamId)
      if (res.success) {
        setMembers(
          (res.data.members ?? []).map((m) => ({
            id: m.id,
            userId: m.userId,
            nickname: m.nickname || m.email || m.userId,
            role: m.role as TeamWorkspaceRole,
            joinedAt: formatDateOnly(m.joinedAt),
          })),
        )
      }
    } finally {
      setMembersLoading(false)
    }
  }, [teamId])

  const loadInvitations = useCallback(async () => {
    setInvitationsLoading(true)
    try {
      const res = await getTeamInvitationsById(teamId)
      // 403/失败与 web 同口径:按空列表渲染,不打断页面
      setInvitations(
        res.success
          ? (res.data.invitations ?? []).map((inv) => ({
              id: inv.id,
              invitee: inv.invitee || '-',
              status: inv.status,
              expiresAt: formatDateOnly(inv.expiresAt),
            }))
          : [],
      )
    } finally {
      setInvitationsLoading(false)
    }
  }, [teamId])

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const [detailRes] = await Promise.all([
          getTeamById(teamId),
          loadMembers(),
          loadInvitations(),
        ])
        if (!detailRes.success) {
          setError(detailRes.error || t('teamsPage.notFound'))
          return
        }
        const detail = detailRes.data.team
        setTeam({
          id: detail.id,
          name: detail.name,
          slug: detail.slug,
          description: detail.description,
          ownerName: detail.ownerName || '-',
          createdAt: formatDateOnly(detail.createdAt),
        })
        setSettingsForm((prev) =>
          prev.name === '' && prev.description === ''
            ? { name: detail.name, description: detail.description }
            : prev,
        )
        setError(null)
      } catch {
        setError(t('teamsPage.notFound'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [teamId, loadMembers, loadInvitations, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleSendInvite = useCallback(async () => {
    setInviteError(null)
    if (!invitee.trim()) {
      setInviteError(t('teamsPage.inviteeRequired'))
      return
    }
    setInviting(true)
    try {
      const res = await inviteTeamMember(teamId, invitee.trim())
      if (!res.success) {
        setInviteError(res.error || t('teamsPage.inviteFailed'))
        return
      }
      setInvitee('')
      void loadInvitations()
    } catch {
      setInviteError(t('teamsPage.inviteFailed'))
    } finally {
      setInviting(false)
    }
  }, [invitee, teamId, loadInvitations, t])

  const handleCancelInvite = useCallback(
    async (invitationId: string) => {
      const res = await cancelTeamInvitation(teamId, invitationId)
      if (!res.success) {
        setInviteError(res.error || t('teamsPage.cancelInviteFailed'))
      }
      void loadInvitations()
    },
    [teamId, loadInvitations, t],
  )

  const handleRoleChange = useCallback(
    async (userId: string, next: Extract<TeamWorkspaceRole, 'admin' | 'member'>) => {
      const res = await updateTeamMemberRole(teamId, userId, next)
      if (!res.success) {
        setError(res.error || t('teamsPage.roleChangeFailed'))
      }
      void loadMembers()
    },
    [teamId, loadMembers, t],
  )

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      const res = await removeTeamMember(teamId, userId)
      if (!res.success) {
        setError(res.error || t('teamsPage.removeFailed'))
      }
      void loadMembers()
    },
    [teamId, loadMembers, t],
  )

  const handleSaveSettings = useCallback(async () => {
    setSettingsError(null)
    if (!settingsForm.name.trim()) {
      setSettingsError(t('teamsPage.nameRequired'))
      return
    }
    setSaving(true)
    try {
      const res = await updateTeamById(teamId, {
        name: settingsForm.name.trim(),
        description: settingsForm.description,
      })
      if (!res.success) {
        setSettingsError(res.error || t('teamsPage.saveFailed'))
        return
      }
      const updated = res.data.team
      setTeam((prev) =>
        prev
          ? {
              ...prev,
              name: updated.name,
              slug: updated.slug,
              description: updated.description,
            }
          : prev,
      )
    } catch {
      setSettingsError(t('teamsPage.saveFailed'))
    } finally {
      setSaving(false)
    }
  }, [settingsForm, teamId, t])

  const handleDeleteTeam = useCallback(() => {
    Alert.alert(t('teamsPage.deleteTeam'), t('teamsPage.deleteConfirm'), [
      { text: t('teamsPage.cancel'), style: 'cancel' },
      {
        text: t('teamsPage.deleteTeam'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true)
            try {
              const res = await deleteTeamById(teamId)
              if (!res.success) {
                setError(res.error || t('teamsPage.deleteFailed'))
                return
              }
              navigation.goBack()
            } finally {
              setDeleting(false)
            }
          })()
        },
      },
    ])
  }, [teamId, navigation, t])

  return (
    <SharedTeamWorkspaceScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      refreshing={refreshing}
      error={error}
      team={team}
      onRefresh={() => void load(true)}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      membersLoading={membersLoading}
      members={members}
      onRoleChange={(userId, next) => void handleRoleChange(userId, next)}
      onRemoveMember={(userId) => void handleRemoveMember(userId)}
      invitationsLoading={invitationsLoading}
      invitations={invitations}
      invitee={invitee}
      onInviteeChange={setInvitee}
      onSendInvite={() => void handleSendInvite()}
      inviting={inviting}
      inviteError={inviteError}
      onCancelInvitation={(invitationId) => void handleCancelInvite(invitationId)}
      settingsForm={settingsForm}
      onSettingsChange={(patch) => setSettingsForm((prev) => ({ ...prev, ...patch }))}
      settingsError={settingsError}
      saving={saving}
      onSaveSettings={() => void handleSaveSettings()}
      deleting={deleting}
      onDeleteTeam={handleDeleteTeam}
    />
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
