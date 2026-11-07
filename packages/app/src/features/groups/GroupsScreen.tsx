// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 我的群组共享屏(RN / web 同源渲染)。
 *
 * 宿主职责:数据编排(GET/POST/PATCH/DELETE/members)、toast/appAlert、ConfirmDialog、
 * NavBar/BackButton、登录态门。
 * 共享屏职责:列表、创建/编辑表单、成员面板展开、危险动作确认触发。
 * 内部零平台判断(无 Platform.OS / window / navigator / 原生弹窗)。
 *
 * 能力并集:创建带描述、编辑、按 ownerId 过滤 mine、成员面板内联展开、
 * 类型徽章 + 成员数 + 创建时间同时保留 —— 不允许为了复用让任何一端丢能力。
 */
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'

export type GroupFilter = 'all' | 'mine'

export interface GroupView {
  id: string
  name: string
  type: string
  description?: string | null
  ownerId?: string | null
  memberCount: number
  createdAt: string
}

export interface GroupFormValues {
  name: string
  description: string
}

export interface GroupConfirmOptions {
  title: string
  message: string
  destructive?: boolean
}

export interface GroupsScreenProps {
  /** 宿主注入的翻译函数(键族统一为 eduAi.groups.*) */
  t: TFunction
  colorScheme?: 'light' | 'dark'
  groups: GroupView[]
  loading: boolean
  error?: string | null
  /** 登录用户 id;提供时才出现 all/mine 过滤(RN/web 均可注入) */
  currentUserId?: string | null
  /** 宿主注入的日期格式化(web formatDate / RN Intl),保证两端同格式 */
  formatDate: (iso: string) => string
  /** 重试入口;提供时错误态出现"重试" */
  onRefresh?: () => void | Promise<void>
  onCreate: (values: GroupFormValues) => Promise<void>
  onUpdate: (id: string, values: GroupFormValues) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddMember: (id: string, userId: string) => Promise<void>
  /** 危险动作二次确认(必填:不允许静默删除) */
  onConfirm: (options: GroupConfirmOptions) => Promise<boolean>
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  const text = String(err ?? '').trim()
  return text || fallback
}

export function GroupsScreen({
  t,
  colorScheme = 'light',
  groups,
  loading,
  error,
  currentUserId,
  formatDate,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
  onAddMember,
  onConfirm,
}: GroupsScreenProps) {
  const { width } = useWindowDimensions()
  const columns = width >= 1024 ? 3 : width >= 640 ? 2 : 1
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [filter, setFilter] = useState<GroupFilter>('all')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [editing, setEditing] = useState<GroupView | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [memberId, setMemberId] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [memberError, setMemberError] = useState<string | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  const visible =
    filter === 'mine' && currentUserId ? groups.filter((g) => g.ownerId === currentUserId) : groups

  const startEdit = (group: GroupView) => {
    setEditing(group)
    setEditName(group.name)
    setEditDescription(group.description ?? '')
    setEditError(null)
    setExpandedId(null)
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setCreateError(t('eduAi.groups.groupNameRequired'))
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      await onCreate({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
    } catch (err) {
      setCreateError(errorMessage(err, t('eduAi.groups.error')))
    } finally {
      setCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!editing) return
    if (!editName.trim()) {
      setEditError(t('eduAi.groups.groupNameRequired'))
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      await onUpdate(editing.id, { name: editName.trim(), description: editDescription.trim() })
      setEditing(null)
    } catch (err) {
      setEditError(errorMessage(err, t('eduAi.groups.error')))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: GroupView) => {
    const ok = await onConfirm({
      title: t('eduAi.groups.deleteTitle'),
      message: t('eduAi.groups.confirmDelete'),
      destructive: true,
    })
    if (!ok) return
    setBusyId(group.id)
    setRowError(null)
    try {
      await onDelete(group.id)
      if (expandedId === group.id) setExpandedId(null)
      if (editing?.id === group.id) setEditing(null)
    } catch (err) {
      setRowError({ id: group.id, message: errorMessage(err, t('eduAi.groups.error')) })
    } finally {
      setBusyId(null)
    }
  }

  const handleAddMember = async (group: GroupView) => {
    if (!memberId.trim()) return
    setAddingId(group.id)
    setMemberError(null)
    try {
      await onAddMember(group.id, memberId.trim())
      setMemberId('')
    } catch (err) {
      setMemberError(errorMessage(err, t('eduAi.groups.error')))
    } finally {
      setAddingId(null)
    }
  }

  const togglePanel = (group: GroupView) => {
    setMemberId('')
    setMemberError(null)
    setExpandedId((current) => (current === group.id ? null : group.id))
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('eduAi.groups.createGroup')}</Text>
        <TextField
          colorScheme={colorScheme}
          value={name}
          onChangeText={setName}
          placeholder={t('eduAi.groups.groupName')}
          style={styles.input}
        />
        <TextField
          colorScheme={colorScheme}
          value={description}
          onChangeText={setDescription}
          placeholder={t('eduAi.groups.description')}
          style={styles.input}
        />
        {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (creating || !name.trim()) && styles.buttonDisabled]}
          onPress={() => void handleCreate()}
          disabled={creating || !name.trim()}
          activeOpacity={0.7}
        >
          <Plus size={16} color={tk.brand.ctaForeground} />
          <Text style={styles.buttonText}>{t('eduAi.groups.createGroup')}</Text>
        </TouchableOpacity>
      </View>

      {editing ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('eduAi.groups.edit')}</Text>
          <Text style={styles.cardSubtitle}>{editing.name}</Text>
          <TextField
            colorScheme={colorScheme}
            value={editName}
            onChangeText={setEditName}
            placeholder={t('eduAi.groups.groupName')}
            style={styles.input}
          />
          <TextField
            colorScheme={colorScheme}
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder={t('eduAi.groups.description')}
            style={styles.input}
          />
          {editError ? <Text style={styles.errorText}>{editError}</Text> : null}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, saving && styles.buttonDisabled]}
              onPress={() => setEditing(null)}
              disabled={saving}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.actionGrow, (saving || !editName.trim()) && styles.buttonDisabled]}
              onPress={() => void handleUpdate()}
              disabled={saving || !editName.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>{t('eduAi.groups.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {currentUserId ? (
        <View style={styles.filterRow}>
          {(['all', 'mine'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.chip, filter === item && styles.chipOn]}
              onPress={() => setFilter(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, filter === item && styles.chipOnText]}>
                {item === 'all' ? t('eduAi.groups.allGroups') : t('eduAi.groups.title')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.stateBox} color={tk.text.tertiary} />
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{error}</Text>
          {onRefresh ? (
            <TouchableOpacity onPress={() => void onRefresh()} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.stateBox}>
          <Users size={28} color={tk.text.tertiary} />
          <Text style={styles.muted}>{t('eduAi.groups.empty')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((group) => {
            const expanded = expandedId === group.id
            const busy = busyId === group.id
            const adding = addingId === group.id
            return (
              <View
                key={group.id}
                style={[styles.cell, columns > 1 ? styles.cellMulti : null]}
              >
                <View style={styles.card}>
                  <View style={styles.itemHead}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{(group.name || '?').slice(0, 1)}</Text>
                    </View>
                    <View style={styles.itemMain}>
                      <View style={styles.titleRow}>
                        <Text style={styles.itemName} numberOfLines={1}>
                          {group.name}
                        </Text>
                        <Text
                          style={[styles.badge, group.type === 'custom' ? styles.badgeMuted : styles.badgeBrand]}
                        >
                          {group.type === 'custom' ? t('eduAi.groups.custom') : group.type}
                        </Text>
                      </View>
                      {group.description ? (
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {group.description}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <Users size={14} color={tk.text.tertiary} />
                    <Text style={styles.meta}>
                      {t('eduAi.groups.members')}: {group.memberCount}
                    </Text>
                    <UsersRound size={14} color={tk.text.tertiary} />
                    <Text style={styles.meta}>
                      {t('eduAi.groups.createdAt')}: {formatDate(group.createdAt)}
                    </Text>
                  </View>

                  {expanded ? (
                    <View style={styles.panel}>
                      <View style={styles.panelMetaRow}>
                        <Shield size={14} color={tk.text.tertiary} />
                        <Text style={styles.meta} numberOfLines={1}>
                          {t('eduAi.groups.owner')}: {group.ownerId ?? '-'}
                        </Text>
                        <Text style={styles.meta}>
                          {t('eduAi.groups.members')}: {group.memberCount}
                        </Text>
                      </View>
                      <Text style={styles.hint}>{t('eduAi.groups.membersUnavailable')}</Text>
                      {memberError ? <Text style={styles.errorText}>{memberError}</Text> : null}
                      <View style={styles.memberRow}>
                        <TextField
                          colorScheme={colorScheme}
                          value={memberId}
                          onChangeText={setMemberId}
                          placeholder={t('eduAi.groups.userId')}
                          style={styles.memberInput}
                        />
                        <TouchableOpacity
                          style={[styles.smallButton, (adding || !memberId.trim()) && styles.buttonDisabled]}
                          onPress={() => void handleAddMember(group)}
                          disabled={adding || !memberId.trim()}
                          activeOpacity={0.7}
                        >
                          <UserPlus size={14} color={tk.text.primary} />
                          <Text style={styles.smallButtonText}>{t('eduAi.groups.addMember')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}

                  {rowError && rowError.id === group.id ? (
                    <Text style={styles.errorText}>{rowError.message}</Text>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.secondaryButton, styles.actionGrow]}
                      onPress={() => togglePanel(group)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.secondaryButtonText}>{t('eduAi.groups.memberList')}</Text>
                      {expanded ? (
                        <ChevronUp size={14} color={tk.text.primary} />
                      ) : (
                        <ChevronDown size={14} color={tk.text.primary} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => startEdit(group)}
                      activeOpacity={0.7}
                    >
                      <Pencil size={14} color={tk.text.primary} />
                      <Text style={styles.secondaryButtonText}>{t('eduAi.groups.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, busy && styles.buttonDisabled]}
                      onPress={() => void handleDelete(group)}
                      disabled={busy}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={14} color={tk.danger.DEFAULT} />
                      <Text style={styles.dangerText}>{t('eduAi.groups.delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    body: { padding: rnSpacing.md, gap: rnSpacing['sm-loose'], paddingBottom: rnSpacing['3xl'] },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    cardSubtitle: { fontSize: rnType.label.size, color: tk.text.tertiary },
    input: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      color: tk.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tk.surface.bg,
    },
    button: {
      height: 44,
      flexDirection: 'row',
      gap: rnSpacing['xs-loose'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.brand.ctaForeground },
    secondaryButton: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    secondaryButtonText: { fontSize: rnType.label.size, color: tk.text.primary },
    actionGrow: { flexGrow: 1 },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: rnSpacing.sm,
      alignItems: 'center',
    },
    dangerText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.danger.DEFAULT },
    filterRow: { flexDirection: 'row', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      height: 30,
      justifyContent: 'center',
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    chipOn: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipOnText: { color: tk.brand.ctaForeground, fontWeight: '600' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.md },
    cell: { width: '100%' },
    cellMulti: { flexGrow: 1, flexBasis: '46%', width: undefined },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing['sm-loose'] },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.lg,
      backgroundColor: tk.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: rnType.title.size, fontWeight: '700', color: tk.text.secondary },
    itemMain: { flex: 1, gap: rnSpacing['2xs'] },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    itemName: { flexShrink: 1, fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      fontSize: rnType.badge.size,
      overflow: 'hidden',
    },
    badgeMuted: { backgroundColor: tk.surface.muted, color: tk.text.secondary },
    badgeBrand: { backgroundColor: tk.brandAccent.light, color: tk.brandAccent.foreground },
    itemDesc: { fontSize: rnType.label.size, color: tk.text.secondary, lineHeight: 17 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: rnSpacing.xs },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    panel: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
    },
    panelMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      justifyContent: 'space-between',
    },
    hint: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    memberRow: { flexDirection: 'row', gap: rnSpacing.sm, alignItems: 'center' },
    memberInput: {
      flex: 1,
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      color: tk.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tk.surface.bg,
    },
    smallButton: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    smallButtonText: { fontSize: rnType.label.size, color: tk.text.primary },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    muted: { fontSize: rnType.bodySm.size, color: tk.text.secondary, lineHeight: 19 },
    errorText: { fontSize: rnType.bodySm.size, color: tk.danger.DEFAULT },
    retry: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
