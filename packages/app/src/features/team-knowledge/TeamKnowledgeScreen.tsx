// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TeamKnowledge 团队知识共享屏(RN / web 同源渲染)。
 *
 * 宿主职责:数据编排(list / members / items / create / status)、平台件
 * (NavBar / NavChrome / appAlert / AsyncStorage / localStorage / 登录态门),
 * 以及 **web 独有的富交互面板**(成员授权/撤权、关键词/状态筛选、条目编辑、
 * 版本历史)。这些能力留在 web 宿主子组件,通过 `renderMembers` / `renderItems`
 * 整段注入,不进共享屏、不造单端死 prop。
 *
 * 共享屏职责:团队输入 + 搜索、新建空间表单、空间列表、默认成员列表、
 * 默认条目列表(类型筛选 / 新建 / 发布与归档二次确认)。
 * 内部零平台判断(无 Platform.OS / window / navigator / Clipboard / 原生弹窗)。
 */
import { useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Archive, Plus, Search, Send } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { TextField } from '../../components/TextField'

export type TeamKnowledgeRole = 'viewer' | 'editor' | 'owner'
export type TeamKnowledgeKind = 'memory' | 'wiki' | 'card'
export type TeamKnowledgeStatus = 'draft' | 'published' | 'archived'
export type TeamKnowledgeVisibility = 'team' | 'restricted'

/** 共享屏只渲染这些字段;宿主持有完整 DTO,按需注入富交互面板 */
export interface TeamKnowledgeSpaceView {
  id: string
  name: string
  myRole: TeamKnowledgeRole
  visibility: string
}

export interface TeamKnowledgeMemberView {
  userId: string
  role: TeamKnowledgeRole
}

export interface TeamKnowledgeItemView {
  id: string
  kind: TeamKnowledgeKind
  title: string
  plainText: string
  status: TeamKnowledgeStatus
  revision: number
  tags?: string[]
}

export interface TeamKnowledgeCreateSpaceValues {
  name: string
  visibility: TeamKnowledgeVisibility
}

export interface TeamKnowledgeCreateItemValues {
  title: string
  text: string
}

export interface TeamKnowledgeConfirmOptions {
  title: string
  message: string
  destructive?: boolean
}

export interface TeamKnowledgeScreenProps {
  /** 宿主注入的翻译函数(键族统一为 teamKnowledge.*) */
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 受控团队 ID(RN 宿主负责 AsyncStorage 回填/落盘,web 宿主负责 localStorage) */
  teamId: string
  onChangeTeamId: (value: string) => void
  spaces: TeamKnowledgeSpaceView[]
  selectedSpaceId: string
  onSelectSpace: (id: string) => void
  /** 默认成员面板数据(RN 宿主注入;web 用 renderMembers 覆盖时可不传) */
  members?: TeamKnowledgeMemberView[]
  /** 默认条目面板数据(RN 宿主注入;web 用 renderItems 覆盖时可不传) */
  items?: TeamKnowledgeItemView[]
  /** 默认条目类型筛选(RN 宿主注入) */
  kind?: TeamKnowledgeKind | ''
  onSelectKind?: (kind: TeamKnowledgeKind | '') => void
  loading: boolean
  error?: string | null
  onSearch: () => void | Promise<void>
  /** 下拉刷新只有 RN 有语义;web 不传则不渲染 RefreshControl */
  onRefresh?: () => void | Promise<void>
  onCreateSpace: (values: TeamKnowledgeCreateSpaceValues) => Promise<void>
  /** 默认条目区的新建能力(RN 宿主注入;web 用 renderItems 覆盖时可不传) */
  onCreateItem?: (values: TeamKnowledgeCreateItemValues) => Promise<void>
  /** 默认条目区的发布/归档能力(RN 宿主注入) */
  onSetItemStatus?: (
    item: TeamKnowledgeItemView,
    status: 'published' | 'archived',
  ) => Promise<void>
  /** 危险动作二次确认(默认条目区的发布/归档用;web 富面板自带确认) */
  onConfirm?: (options: TeamKnowledgeConfirmOptions) => Promise<boolean>
  /** web 独有成员面板(授权/撤权)整段注入;RN 走默认只读列表 */
  renderMembers?: (spaceId: string) => ReactNode
  /** web 独有条目面板(筛选/编辑/历史)整段注入;RN 走默认列表 */
  renderItems?: (spaceId: string) => ReactNode
}

const KINDS: Array<TeamKnowledgeKind | ''> = ['', 'memory', 'wiki', 'card']

function roleLabel(t: TFunction, role: TeamKnowledgeRole): string {
  if (role === 'owner') return t('teamKnowledge.role.owner')
  if (role === 'editor') return t('teamKnowledge.role.editor')
  return t('teamKnowledge.role.viewer')
}

function kindLabel(t: TFunction, kind: TeamKnowledgeKind): string {
  if (kind === 'wiki') return t('teamKnowledge.kind.wiki')
  if (kind === 'card') return t('teamKnowledge.kind.card')
  return t('teamKnowledge.kind.memory')
}

function statusLabel(t: TFunction, status: TeamKnowledgeStatus): string {
  if (status === 'published') return t('teamKnowledge.status.published')
  if (status === 'archived') return t('teamKnowledge.status.archived')
  return t('teamKnowledge.status.draft')
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

export function TeamKnowledgeScreen({
  t,
  colorScheme,
  teamId,
  onChangeTeamId,
  spaces,
  selectedSpaceId,
  onSelectSpace,
  members,
  items,
  kind = '',
  onSelectKind,
  loading,
  error,
  onSearch,
  onRefresh,
  onCreateSpace,
  onCreateItem,
  onSetItemStatus,
  onConfirm,
  renderMembers,
  renderItems,
}: TeamKnowledgeScreenProps) {
  const mode = colorScheme ?? 'light'
  const tk = getTokens(mode)
  const styles = createStyles(tk)

  const [spaceForm, setSpaceForm] = useState(false)
  const [spaceName, setSpaceName] = useState('')
  const [restricted, setRestricted] = useState(false)
  const [savingSpace, setSavingSpace] = useState(false)
  const [spaceError, setSpaceError] = useState<string | null>(null)

  const [itemForm, setItemForm] = useState(false)
  const [itemTitle, setItemTitle] = useState('')
  const [itemText, setItemText] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const selected = spaces.find((space) => space.id === selectedSpaceId) ?? null
  const memberList = members ?? []
  const itemList = items ?? []
  const canEdit = Boolean(selected && selected.myRole !== 'viewer')
  const canOperate = Boolean(teamId.trim()) && !loading
  const shownError = error ?? actionError

  const handleSearch = async () => {
    if (!teamId.trim()) {
      setActionError(t('teamKnowledge.needTeam'))
      return
    }
    setActionError(null)
    try {
      await onSearch()
    } catch (e) {
      setActionError(errorMessage(e, t('common.loadFailed')))
    }
  }

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return
    setRefreshing(true)
    try {
      await onRefresh()
    } catch (e) {
      setActionError(errorMessage(e, t('teamKnowledge.saveFailed')))
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreateSpace = async () => {
    if (!spaceName.trim()) {
      setSpaceError(t('teamKnowledge.needSpaceName'))
      return
    }
    setSavingSpace(true)
    setSpaceError(null)
    try {
      await onCreateSpace({
        name: spaceName.trim(),
        visibility: restricted ? 'restricted' : 'team',
      })
      setSpaceForm(false)
      setSpaceName('')
      setRestricted(false)
    } catch (e) {
      setSpaceError(errorMessage(e, t('teamKnowledge.saveFailed')))
    } finally {
      setSavingSpace(false)
    }
  }

  const handleCreateItem = async () => {
    if (!onCreateItem) return
    if (!itemTitle.trim()) {
      setItemError(t('teamKnowledge.needTitle'))
      return
    }
    setSavingItem(true)
    setItemError(null)
    try {
      await onCreateItem({ title: itemTitle.trim(), text: itemText })
      setItemForm(false)
      setItemTitle('')
      setItemText('')
    } catch (e) {
      setItemError(errorMessage(e, t('teamKnowledge.saveFailed')))
    } finally {
      setSavingItem(false)
    }
  }

  const handleStatus = async (
    item: TeamKnowledgeItemView,
    status: 'published' | 'archived',
  ) => {
    if (!onSetItemStatus || !onConfirm) return
    const ok = await onConfirm({
      title:
        status === 'published'
          ? t('teamKnowledge.publishBtn')
          : t('teamKnowledge.archiveBtn'),
      message: item.title,
      destructive: status === 'archived',
    })
    if (!ok) return
    setBusyId(item.id)
    setActionError(null)
    try {
      await onSetItemStatus(item, status)
    } catch (e) {
      setActionError(errorMessage(e, t('teamKnowledge.saveFailed')))
    } finally {
      setBusyId('')
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void handleRefresh()
              }}
              tintColor={tk.text.tertiary}
            />
          ) : undefined
        }
      >
        <Text style={styles.muted}>{t('teamKnowledge.description')}</Text>

        <View style={styles.searchRow}>
          <TextField
            colorScheme={mode}
            value={teamId}
            onChangeText={onChangeTeamId}
            placeholder={t('teamKnowledge.teamPlaceholder')}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, !canOperate && styles.disabled]}
            disabled={!canOperate}
            onPress={() => {
              void handleSearch()
            }}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
            ) : (
              <Search size={14} color={tk.brand.ctaForeground} />
            )}
            <Text style={styles.primaryBtnText}>{t('teamKnowledge.searchBtn')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.outlineBtn, styles.selfStart, !canOperate && styles.disabled]}
          disabled={!canOperate}
          onPress={() => setSpaceForm((open) => !open)}
          activeOpacity={0.7}
        >
          <Plus size={14} color={tk.text.primary} />
          <Text style={styles.outlineBtnText}>{t('teamKnowledge.newSpaceBtn')}</Text>
        </TouchableOpacity>

        {shownError ? <Text style={styles.error}>{shownError}</Text> : null}
        {!teamId.trim() ? (
          <Text style={styles.muted}>{t('teamKnowledge.needTeam')}</Text>
        ) : null}

        {spaceForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('teamKnowledge.newSpaceTitle')}</Text>
            <TextField
              colorScheme={mode}
              value={spaceName}
              onChangeText={setSpaceName}
              placeholder={t('teamKnowledge.spaceNamePlaceholder')}
              style={styles.input}
            />
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggle, !restricted && styles.toggleActive]}
                onPress={() => setRestricted(false)}
                activeOpacity={0.7}
              >
                <Text style={!restricted ? styles.toggleTextActive : styles.toggleText}>
                  {t('teamKnowledge.teamVisible')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggle, restricted && styles.toggleActive]}
                onPress={() => setRestricted(true)}
                activeOpacity={0.7}
              >
                <Text style={restricted ? styles.toggleTextActive : styles.toggleText}>
                  {t('teamKnowledge.restricted')}
                </Text>
              </TouchableOpacity>
            </View>
            {spaceError ? <Text style={styles.error}>{spaceError}</Text> : null}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryBtn, (savingSpace || !spaceName.trim()) && styles.disabled]}
                disabled={savingSpace || !spaceName.trim()}
                onPress={() => {
                  void handleCreateSpace()
                }}
                activeOpacity={0.7}
              >
                {savingSpace ? (
                  <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
                ) : null}
                <Text style={styles.primaryBtnText}>{t('teamKnowledge.saveBtn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineBtn, savingSpace && styles.disabled]}
                disabled={savingSpace}
                onPress={() => {
                  setSpaceForm(false)
                  setSpaceError(null)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.outlineBtnText}>{t('teamKnowledge.cancelBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {teamId.trim() ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('teamKnowledge.spaceListTitle')}</Text>
              {loading ? <ActivityIndicator size="small" color={tk.text.tertiary} /> : null}
            </View>

            {loading && spaces.length === 0 ? (
              <Text style={styles.muted}>{t('common.loading')}</Text>
            ) : spaces.length === 0 ? (
              <Text style={styles.muted}>{t('teamKnowledge.emptySpaces')}</Text>
            ) : (
              spaces.map((space) => (
                <TouchableOpacity
                  key={space.id}
                  style={[styles.card, selectedSpaceId === space.id && styles.cardActive]}
                  onPress={() => onSelectSpace(space.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowHead}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {space.name}
                    </Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{roleLabel(t, space.myRole)}</Text>
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {space.visibility === 'restricted'
                      ? t('teamKnowledge.restricted')
                      : t('teamKnowledge.teamVisible')}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : null}

        {selected ? (
          <>
            {renderMembers ? (
              renderMembers(selected.id)
            ) : (
              <>
                <Text style={styles.sectionTitle}>{t('teamKnowledge.membersTitle')}</Text>
                {memberList.length === 0 ? (
                  <Text style={styles.muted}>{t('teamKnowledge.emptyMembers')}</Text>
                ) : (
                  <View style={styles.chips}>
                    {memberList.map((member) => (
                      <View key={member.userId} style={styles.chip}>
                        <Text style={styles.chipText}>{member.userId.slice(0, 8)}</Text>
                        <Text style={styles.chipRole}>{roleLabel(t, member.role)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            {renderItems ? (
              renderItems(selected.id)
            ) : (
              <>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionTitle}>{t('teamKnowledge.itemsTitle')}</Text>
                  {onCreateItem ? (
                    <TouchableOpacity
                      style={[
                        styles.outlineBtn,
                        (!canEdit || loading) && styles.disabled,
                      ]}
                      disabled={!canEdit || loading}
                      onPress={() => setItemForm((open) => !open)}
                      activeOpacity={0.7}
                    >
                      <Plus size={14} color={tk.text.primary} />
                      <Text style={styles.outlineBtnText}>{t('teamKnowledge.newItemBtn')}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {itemForm && onCreateItem ? (
                  <View style={styles.formCard}>
                    <TextField
                      colorScheme={mode}
                      value={itemTitle}
                      onChangeText={setItemTitle}
                      placeholder={t('teamKnowledge.titlePlaceholder')}
                      style={styles.input}
                    />
                    <TextField
                      colorScheme={mode}
                      value={itemText}
                      onChangeText={setItemText}
                      placeholder={t('teamKnowledge.contentPlaceholder')}
                      style={[styles.input, styles.textarea]}
                      multiline
                      textAlignVertical="top"
                    />
                    {itemError ? <Text style={styles.error}>{itemError}</Text> : null}
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[
                          styles.primaryBtn,
                          (savingItem || !itemTitle.trim()) && styles.disabled,
                        ]}
                        disabled={savingItem || !itemTitle.trim()}
                        onPress={() => {
                          void handleCreateItem()
                        }}
                        activeOpacity={0.7}
                      >
                        {savingItem ? (
                          <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
                        ) : null}
                        <Text style={styles.primaryBtnText}>{t('teamKnowledge.saveBtn')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.outlineBtn, savingItem && styles.disabled]}
                        disabled={savingItem}
                        onPress={() => {
                          setItemForm(false)
                          setItemError(null)
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.outlineBtnText}>
                          {t('teamKnowledge.cancelBtn')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {onSelectKind ? (
                  <View style={styles.toggleRow}>
                    {KINDS.map((value) => (
                      <TouchableOpacity
                        key={value || 'all'}
                        style={[styles.toggle, kind === value && styles.toggleActive]}
                        onPress={() => onSelectKind(value)}
                        activeOpacity={0.7}
                      >
                        <Text style={kind === value ? styles.toggleTextActive : styles.toggleText}>
                          {value ? kindLabel(t, value) : t('teamKnowledge.kindAll')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {loading && itemList.length === 0 ? (
                  <Text style={styles.muted}>{t('common.loading')}</Text>
                ) : itemList.length === 0 ? (
                  <Text style={styles.muted}>{t('teamKnowledge.emptyItems')}</Text>
                ) : (
                  itemList.map((item) => (
                    <View key={item.id} style={styles.card}>
                      <View style={styles.rowHead}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>
                            {statusLabel(t, item.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.meta}>
                        {kindLabel(t, item.kind)} · rev {item.revision}
                      </Text>
                      {item.plainText ? (
                        <Text style={styles.itemBody} numberOfLines={3}>
                          {item.plainText}
                        </Text>
                      ) : null}
                      {item.tags && item.tags.length > 0 ? (
                        <View style={styles.chips}>
                          {item.tags.map((tag) => (
                            <View key={tag} style={styles.chip}>
                              <Text style={styles.chipText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {onSetItemStatus && onConfirm ? (
                        <View style={styles.actions}>
                          <TouchableOpacity
                            style={[
                              styles.primaryBtn,
                              (busyId === item.id || !canEdit) && styles.disabled,
                            ]}
                            disabled={busyId === item.id || !canEdit}
                            onPress={() => {
                              void handleStatus(item, 'published')
                            }}
                            activeOpacity={0.7}
                          >
                            {busyId === item.id ? (
                              <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
                            ) : (
                              <Send size={14} color={tk.brand.ctaForeground} />
                            )}
                            <Text style={styles.primaryBtnText}>
                              {t('teamKnowledge.publishBtn')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.outlineBtn,
                              (busyId === item.id || !canEdit) && styles.disabled,
                            ]}
                            disabled={busyId === item.id || !canEdit}
                            onPress={() => {
                              void handleStatus(item, 'archived')
                            }}
                            activeOpacity={0.7}
                          >
                            <Archive size={14} color={tk.danger.DEFAULT} />
                            <Text style={styles.dangerText}>
                              {t('teamKnowledge.archiveBtn')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    scroll: { flex: 1 },
    body: {
      padding: rnSpacing.md,
      gap: rnSpacing.md,
      paddingBottom: rnSpacing['3xl'],
    },
    muted: { fontSize: rnType.bodySm.size, color: tk.text.secondary, lineHeight: 19 },
    error: { fontSize: rnType.bodySm.size, color: tk.danger.DEFAULT },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    input: {
      flex: 1,
      height: 42,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      color: tk.text.primary,
      fontSize: rnType.strong.size,
      backgroundColor: tk.surface.card,
    },
    textarea: { height: 96, paddingTop: rnSpacing.sm, paddingBottom: rnSpacing.sm },
    primaryBtn: {
      height: 38,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      backgroundColor: tk.brand.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    primaryBtnText: {
      fontSize: rnType.bodySm.size,
      fontWeight: '600',
      color: tk.brand.ctaForeground,
    },
    outlineBtn: {
      height: 38,
      paddingHorizontal: rnSpacing.lg,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
    },
    outlineBtnText: { fontSize: rnType.bodySm.size, color: tk.text.primary },
    dangerText: { fontSize: rnType.bodySm.size, fontWeight: '600', color: tk.danger.DEFAULT },
    selfStart: { alignSelf: 'flex-start' },
    disabled: { opacity: 0.5 },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
    sectionTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.xs,
    },
    cardActive: { borderColor: tk.brand.DEFAULT },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    itemTitle: {
      flexShrink: 1,
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tk.text.primary,
    },
    badge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    badgeText: { fontSize: rnType.badge.size, color: tk.text.secondary },
    meta: { fontSize: rnType.caption.size, color: tk.text.tertiary },
    itemBody: { fontSize: rnType.bodySm.size, color: tk.text.primary, lineHeight: 21 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing['2xs'],
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing['2xs'],
      borderRadius: rnRadius.sm,
      backgroundColor: tk.surface.muted,
    },
    chipText: { fontSize: rnType.badge.size, color: tk.text.secondary },
    chipRole: { fontSize: rnType.badge.size, color: tk.text.tertiary },
    toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    toggle: {
      height: 32,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toggleActive: {
      borderColor: tk.brand.DEFAULT,
      backgroundColor: tk.surface.muted,
    },
    toggleText: { fontSize: rnType.badge.size, color: tk.text.secondary },
    toggleTextActive: { fontSize: rnType.badge.size, color: tk.text.primary, fontWeight: '600' },
    formCard: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
      gap: rnSpacing.sm,
    },
    formTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tk.text.primary },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.sm,
      marginTop: rnSpacing.xs,
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
