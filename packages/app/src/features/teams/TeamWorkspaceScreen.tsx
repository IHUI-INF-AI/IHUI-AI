// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { TextField } from '../../components/TextField'
import { CategoryInlineBar } from '../../components/category/CategoryInlineBar'

/** 成员角色(与 api-client TeamRole 同形,共享层不依赖 api-client)。 */
export type TeamWorkspaceRole = 'owner' | 'admin' | 'member'

/** 邀请状态(与 api-client TeamInvitationStatus 同形)。 */
export type TeamWorkspaceInvitationStatus = 'pending' | 'accepted' | 'expired'

export type TeamWorkspaceTab = 'members' | 'invitations' | 'settings'

/** 团队信息卡数据(日期已由 wrapper 格式化)。 */
export interface TeamWorkspaceInfo {
  id: string
  name: string
  slug: string
  description: string
  ownerName: string
  createdAt: string
}

/** 成员行。 */
export interface TeamWorkspaceMember {
  id: string
  userId: string
  nickname: string
  role: TeamWorkspaceRole
  joinedAt: string
}

/** 邀请行。 */
export interface TeamWorkspaceInvitation {
  id: string
  invitee: string
  status: TeamWorkspaceInvitationStatus
  expiresAt: string
}

/** 设置表单(对齐 web TeamSettingsPanel 的 editName/editDesc)。 */
export interface TeamWorkspaceSettingsForm {
  name: string
  description: string
}

export interface TeamWorkspaceScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  refreshing?: boolean
  error?: string | null
  team: TeamWorkspaceInfo | null
  onRefresh: () => void
  activeTab: TeamWorkspaceTab
  onSelectTab: (tab: TeamWorkspaceTab) => void
  membersLoading: boolean
  members: TeamWorkspaceMember[]
  onRoleChange: (userId: string, next: Extract<TeamWorkspaceRole, 'admin' | 'member'>) => void
  onRemoveMember: (userId: string) => void
  invitationsLoading: boolean
  invitations: TeamWorkspaceInvitation[]
  invitee: string
  onInviteeChange: (v: string) => void
  onSendInvite: () => void
  inviting?: boolean
  inviteError?: string | null
  onCancelInvitation: (invitationId: string) => void
  settingsForm: TeamWorkspaceSettingsForm
  onSettingsChange: (patch: Partial<TeamWorkspaceSettingsForm>) => void
  settingsError?: string | null
  saving?: boolean
  onSaveSettings: () => void
  deleting?: boolean
  onDeleteTeam: () => void
}

const TAB_KEYS: TeamWorkspaceTab[] = ['members', 'invitations', 'settings']

const TAB_LABELS: Record<TeamWorkspaceTab, string> = {
  members: 'teamsPage.tabMembers',
  invitations: 'teamsPage.tabInvitations',
  settings: 'teamsPage.tabSettings',
}

const ROLE_LABELS: Record<TeamWorkspaceRole, string> = {
  owner: 'teamsPage.roleOwner',
  admin: 'teamsPage.roleAdmin',
  member: 'teamsPage.roleMember',
}

const INVITATION_STATUS_LABELS: Record<TeamWorkspaceInvitationStatus, string> = {
  pending: 'teamsPage.statusPending',
  accepted: 'teamsPage.statusAccepted',
  expired: 'teamsPage.statusExpired',
}

function initials(name: string): string {
  if (!name) return '?'
  return name.slice(0, 1).toUpperCase()
}

/**
 * 协作团队详情共享屏 — props 注入式跨端组件(对齐 web apps/web/app/(main)/teams/[id]/)
 *
 * 平台无关:渲染团队信息卡 + 成员/邀请/设置三 tab(成员角色与移除、邀请发送与撤销、
 * 团队改名与删除)。平台特定(取数 / 导航 / 确认弹窗 / 日期格式化)由 wrapper 注入。
 * 注意:与 features/team-detail(分销成员详情)同名相近但不同域,本屏承载 /api/teams/:id。
 */
export function TeamWorkspaceScreen({
  t,
  onBack,
  loading,
  refreshing = false,
  error = null,
  team,
  onRefresh,
  activeTab,
  onSelectTab,
  membersLoading,
  members,
  onRoleChange,
  onRemoveMember,
  invitationsLoading,
  invitations,
  invitee,
  onInviteeChange,
  onSendInvite,
  inviting = false,
  inviteError = null,
  onCancelInvitation,
  settingsForm,
  onSettingsChange,
  settingsError = null,
  saving = false,
  onSaveSettings,
  deleting = false,
  onDeleteTeam,
  colorScheme = 'light',
}: TeamWorkspaceScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const tabItems = useMemo(() => TAB_KEYS.map((k) => ({ id: k, label: t(TAB_LABELS[k]) })), [t])

  const roleBadgePalette: Record<TeamWorkspaceRole, { bg: string; fg: string }> = {
    owner: { bg: tk.warning.light, fg: tk.warning.amberText },
    admin: { bg: tk.brandAccent.light, fg: tk.brandAccent.deep },
    member: { bg: tk.surface.muted, fg: tk.text.secondary },
  }

  const invitationBadgePalette: Record<TeamWorkspaceInvitationStatus, { bg: string; fg: string }> =
    {
      pending: { bg: tk.warning.light, fg: tk.warning.amberText },
      accepted: { bg: tk.success.light, fg: tk.success.deepText },
      expired: { bg: tk.surface.muted, fg: tk.text.secondary },
    }

  const header = (
    <View style={styles.header}>
      <BackChevron onPress={onBack} label={t('teamsPage.backToList')} colorScheme={colorScheme} />
      <Text style={styles.title}>{team ? team.name : t('teamsPage.title')}</Text>
    </View>
  )

  if (loading && !team) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <ActivityIndicator color={tk.brand.DEFAULT} />
          <Text style={styles.emptyText}>{t('teamsPage.loading')}</Text>
        </View>
      </View>
    )
  }

  if (error && !team) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} activeOpacity={0.85} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (!team) return null

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tk.text.secondary}
          />
        }
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoName}>{team.name}</Text>
          <Text style={styles.infoDesc}>{team.description || `@${team.slug}`}</Text>
          <Text style={styles.infoMeta}>
            {t('teamsPage.owner')}: {team.ownerName}
          </Text>
          <Text style={styles.infoMeta}>
            {t('teamsPage.createdAt')}: {team.createdAt}
          </Text>
        </View>

        <CategoryInlineBar
          items={tabItems}
          selectedId={activeTab}
          onSelect={(id) => onSelectTab(id as TeamWorkspaceTab)}
          colorScheme={colorScheme}
          contentPaddingHorizontal={0}
          itemGap={6}
        />

        {activeTab === 'members' ? (
          <View style={styles.tabBody}>
            {membersLoading ? (
              <Text style={styles.emptyText}>{t('teamsPage.loading')}</Text>
            ) : members.length === 0 ? (
              <Text style={styles.emptyText}>{t('teamsPage.noMembers')}</Text>
            ) : (
              members.map((m) => (
                <View key={m.id} style={styles.rowCard}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarInitial}>{initials(m.nickname)}</Text>
                  </View>
                  <View style={styles.rowMain}>
                    <View style={styles.nameRow}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {m.nickname}
                      </Text>
                      <View
                        style={[styles.badge, { backgroundColor: roleBadgePalette[m.role].bg }]}
                      >
                        <Text style={[styles.badgeText, { color: roleBadgePalette[m.role].fg }]}>
                          {t(ROLE_LABELS[m.role])}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowSub}>
                      {t('teamsPage.joinedAt')}: {m.joinedAt}
                    </Text>
                  </View>
                  {m.role !== 'owner' ? (
                    <View style={styles.rowActions}>
                      <TouchableOpacity
                        style={styles.textBtn}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        onPress={() =>
                          onRoleChange(m.userId, m.role === 'admin' ? 'member' : 'admin')
                        }
                      >
                        <Text style={styles.textBtnText}>
                          {m.role === 'admin'
                            ? t('teamsPage.makeMember')
                            : t('teamsPage.makeAdmin')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.textBtn}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={t('teamsPage.removeMember')}
                        onPress={() => onRemoveMember(m.userId)}
                      >
                        <Text style={[styles.textBtnText, { color: tk.danger.DEFAULT }]}>
                          {t('teamsPage.removeMember')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'invitations' ? (
          <View style={styles.tabBody}>
            <View style={styles.inviteCard}>
              <Text style={styles.formTitle}>{t('teamsPage.inviteMemberDesc')}</Text>
              {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
              <View style={styles.inviteRow}>
                <TextField
                  colorScheme={colorScheme}
                  value={invitee}
                  onChangeText={onInviteeChange}
                  placeholder={t('teamsPage.inviteePlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <TouchableOpacity
                  style={[styles.inviteBtn, inviting ? styles.btnDisabled : null]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  disabled={inviting}
                  onPress={onSendInvite}
                >
                  <Text style={styles.inviteBtnText}>{t('teamsPage.sendInvite')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {invitationsLoading ? (
              <Text style={styles.emptyText}>{t('teamsPage.loading')}</Text>
            ) : invitations.length === 0 ? (
              <Text style={styles.emptyText}>{t('teamsPage.noInvitations')}</Text>
            ) : (
              invitations.map((inv) => (
                <View key={inv.id} style={styles.rowCard}>
                  <View style={styles.rowMain}>
                    <View style={styles.nameRow}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {inv.invitee}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: invitationBadgePalette[inv.status].bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: invitationBadgePalette[inv.status].fg },
                          ]}
                        >
                          {t(INVITATION_STATUS_LABELS[inv.status])}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowSub}>
                      {t('teamsPage.expiresAt')}: {inv.expiresAt}
                    </Text>
                  </View>
                  {inv.status === 'pending' ? (
                    <TouchableOpacity
                      style={styles.textBtn}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      onPress={() => onCancelInvitation(inv.id)}
                    >
                      <Text style={[styles.textBtnText, { color: tk.danger.DEFAULT }]}>
                        {t('teamsPage.cancelInvite')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'settings' ? (
          <View style={styles.tabBody}>
            <View style={styles.infoCard}>
              <Text style={styles.formTitle}>{t('teamsPage.editTeamDesc')}</Text>
              {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
              <Text style={styles.fieldLabel}>{t('teamsPage.name')}</Text>
              <TextField
                colorScheme={colorScheme}
                value={settingsForm.name}
                onChangeText={(v) => onSettingsChange({ name: v })}
                placeholder={t('teamsPage.namePlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                maxLength={128}
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>{t('teamsPage.description')}</Text>
              <TextField
                colorScheme={colorScheme}
                value={settingsForm.description}
                onChangeText={(v) => onSettingsChange({ description: v })}
                placeholder={t('teamsPage.descriptionPlaceholder')}
                placeholderTextColor={tk.text.tertiary}
                maxLength={2000}
                multiline
                style={styles.inputMultiline}
              />
              <TouchableOpacity
                style={[styles.submitBtn, saving ? styles.btnDisabled : null]}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={saving}
                onPress={onSaveSettings}
              >
                <Text style={styles.submitBtnText}>{t('teamsPage.save')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dangerCard}>
              <Text style={styles.dangerTitle}>{t('teamsPage.dangerZone')}</Text>
              <Text style={styles.dangerDesc}>{t('teamsPage.deleteTeamDesc')}</Text>
              <TouchableOpacity
                style={[styles.deleteBtn, deleting ? styles.btnDisabled : null]}
                activeOpacity={0.85}
                accessibilityRole="button"
                disabled={deleting}
                onPress={onDeleteTeam}
              >
                <Text style={styles.deleteBtnText}>{t('teamsPage.deleteTeam')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: { paddingHorizontal: 10, paddingBottom: 8 },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    scroll: { padding: 12, paddingBottom: 32, gap: 12 },
    center: { alignItems: 'center', paddingVertical: 32, justifyContent: 'center', gap: 8 },
    infoCard: {
      padding: 14,
      gap: 8,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    infoName: { fontSize: 18, fontWeight: '700', color: tk.text.primary },
    infoDesc: { fontSize: 13, color: tk.text.secondary },
    infoMeta: { fontSize: 11, color: tk.text.tertiary },
    tabBody: { gap: 8 },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    avatarBox: {
      width: 40,
      height: 40,
      borderRadius: rnRadius['2xl'],
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitial: { fontSize: 16, fontWeight: '600', color: tk.text.secondary },
    rowMain: { flex: 1, gap: 2 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowTitle: { fontSize: 14, fontWeight: '600', color: tk.text.primary, flexShrink: 1 },
    rowSub: { fontSize: 11, color: tk.text.tertiary },
    rowActions: { flexDirection: 'row', gap: 4 },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: rnRadius.md,
    },
    badgeText: { fontSize: 10, fontWeight: '600' },
    textBtn: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.card,
    },
    textBtnText: { fontSize: 12, color: tk.text.primary },
    inviteCard: {
      padding: 12,
      gap: 8,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
    },
    inviteRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    inviteBtn: {
      paddingHorizontal: 14,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    inviteBtnText: { fontSize: 13, fontWeight: '600', color: tk.brand.ctaForeground },
    formTitle: { fontSize: 13, color: tk.text.secondary },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: tk.text.medium },
    input: {
      height: 44,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
    },
    inputMultiline: {
      minHeight: 72,
      paddingTop: 10,
      paddingBottom: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: 12,
      fontSize: 14,
      color: tk.text.primary,
      textAlignVertical: 'top',
    },
    submitBtn: {
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    submitBtnText: { fontSize: 14, fontWeight: '600', color: tk.brand.ctaForeground },
    btnDisabled: { opacity: 0.6 },
    dangerCard: {
      padding: 14,
      gap: 8,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.danger.light,
      backgroundColor: tk.surface.light,
    },
    dangerTitle: { fontSize: 14, fontWeight: '700', color: tk.danger.DEFAULT },
    dangerDesc: { fontSize: 12, color: tk.text.secondary },
    deleteBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.danger.DEFAULT,
    },
    deleteBtnText: { fontSize: 14, fontWeight: '600', color: tk.danger.DEFAULT },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT },
    emptyText: { fontSize: 14, color: tk.text.tertiary },
    retryBtn: {
      marginTop: 12,
      paddingHorizontal: 10,
      height: 44,
      justifyContent: 'center',
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
    },
    retryBtnText: { color: tk.brand.ctaForeground, fontSize: 14 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
