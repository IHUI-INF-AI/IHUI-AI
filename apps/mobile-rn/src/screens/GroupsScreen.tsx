// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Plus, Trash2, UserPlus, Users, X } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnRadiusFor, rnSpacing, rnType, rnCssLight } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useAuthStore } from '../stores/auth-store'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type Filter = 'all' | 'mine'

/**
 * 我的群组 —— 对齐 web `/groups`(apps/web/app/(main)/groups)。
 *
 * 端点按 apps/api/src/routes/groups.ts 现读(前缀 /api/groups):
 *  - GET    /api/groups              ⇒ { list }(仅 status=active,支持 ?type=)
 *  - POST   /api/groups              ⇒ 201 { group }
 *  - PATCH  /api/groups/:id          ⇒ { group }(仅群主或 admin)
 *  - DELETE /api/groups/:id          ⇒ { ok }(仅群主或 admin)
 *  - POST   /api/groups/:id/members  ⇒ { member }(body: { userId })
 *
 * 契约缺口(不搬假能力):后端没有 GET /api/groups/:id 与 GET /api/groups/:id/members,
 * 成员列表读不回来 ⇒ 详情弹层展示列表行已有的群主/成员数,并只保留"按用户 ID 添加成员"这条真能力。
 */
interface Group {
  id: string
  name: string
  type: string
  description: string | null
  ownerId: string | null
  memberCount: number
  status: string
  createdAt: string
}

export default function GroupsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [panel, setPanel] = useState<Group | null>(null)
  const [memberId, setMemberId] = useState('')
  const [adding, setAdding] = useState(false)

  const fmtDate = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ list: Group[] }>('/api/groups')
      if (!res.success) throw new Error(res.error)
      setGroups(res.data?.list ?? [])
    } catch {
      setGroups([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async () => {
    if (!name.trim()) {
      appAlert(t('common.hint'), t('groups.groupNameRequired'))
      return
    }
    setCreating(true)
    try {
      const res = await fetchApi('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.success) throw new Error(res.error)
      setName('')
      await load()
    } catch {
      appAlert(t('common.error'), t('groups.saveFailed'))
    } finally {
      setCreating(false)
    }
  }

  const openPanel = (g: Group) => {
    setMemberId('')
    setPanel(g)
  }

  const onDelete = () => {
    if (!panel) return
    const target = panel
    appAlert(t('groups.deleteTitle'), t('groups.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const res = await fetchApi(`/api/groups/${target.id}`, { method: 'DELETE' })
              if (!res.success) throw new Error(res.error)
              setPanel(null)
              await load()
            } catch {
              appAlert(t('common.error'), t('groups.deleteFailed'))
            }
          })()
        },
      },
    ])
  }

  const onAddMember = async () => {
    if (!panel || !memberId.trim()) return
    setAdding(true)
    try {
      const res = await fetchApi(`/api/groups/${panel.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: memberId.trim() }),
      })
      if (!res.success) throw new Error(res.error)
      setMemberId('')
      setPanel({ ...panel, memberCount: panel.memberCount + 1 })
      appAlert(t('groups.addMember'), t('groups.memberAdded'))
      await load()
    } catch {
      appAlert(t('common.error'), t('groups.memberAddFailed'))
    } finally {
      setAdding(false)
    }
  }

  const visible =
    filter === 'mine' && currentUserId ? groups.filter((g) => g.ownerId === currentUserId) : groups
  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('groups.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('groups.subtitle')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('groups.createGroup')}</Text>
          <TextField
            colorScheme={resolvedTheme}
            value={name}
            onChangeText={setName}
            placeholder={t('groups.groupName')}
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.button, (creating || !name.trim()) && styles.buttonDisabled]}
            onPress={() => void onCreate()}
            disabled={creating || !name.trim()}
            activeOpacity={0.7}
          >
            <Plus size={16} color={tokens.brand.ctaForeground} />
            <Text style={styles.buttonText}>{t('groups.createGroup')}</Text>
          </TouchableOpacity>
        </View>

        {currentUserId ? (
          <View style={styles.filterRow}>
            {(['all', 'mine'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.chip, filter === f && styles.chipOn]}
                onPress={() => setFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, filter === f && styles.chipOnText]}>
                  {f === 'all' ? t('groups.allGroups') : t('groups.myGroups')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('groups.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : visible.length === 0 ? (
          <View style={styles.stateBox}>
            <Users size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('groups.empty')}</Text>
          </View>
        ) : (
          visible.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => openPanel(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemHead}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(item.name || '?').slice(0, 1)}</Text>
                </View>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text style={styles.itemDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.meta}>
                {t('groups.members')}: {item.memberCount}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal
        visible={panel !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPanel(null)}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.mask} onPress={() => setPanel(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {panel?.name}
              </Text>
              <Pressable onPress={() => setPanel(null)} hitSlop={8}>
                <X size={18} color={tokens.text.secondary} />
              </Pressable>
            </View>
            {panel ? (
              <>
                <Text style={styles.muted}>
                  {t('groups.owner')}: {panel.ownerId ?? '—'}
                </Text>
                <Text style={styles.muted}>
                  {t('groups.members')}: {panel.memberCount} · {t('groups.createdAt')}:{' '}
                  {fmtDate(panel.createdAt)}
                </Text>
                <Text style={styles.hint}>{t('groups.membersUnavailable')}</Text>
                <View style={styles.memberRow}>
                  <TextField
                    colorScheme={resolvedTheme}
                    value={memberId}
                    onChangeText={setMemberId}
                    placeholder={t('groups.userId')}
                    style={styles.memberInput}
                  />
                  <TouchableOpacity
                    style={[styles.smallBtn, (adding || !memberId.trim()) && styles.buttonDisabled]}
                    onPress={() => void onAddMember()}
                    disabled={adding || !memberId.trim()}
                    activeOpacity={0.7}
                  >
                    <UserPlus size={14} color={tokens.text.primary} />
                    <Text style={styles.smallBtnText}>{t('groups.addMember')}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.dangerBtn} onPress={onDelete} activeOpacity={0.7}>
                  <Trash2 size={14} color={tokens.danger.DEFAULT} />
                  <Text style={styles.dangerText}>{t('groups.delete')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: rnSpacing.md, gap: 10, paddingBottom: rnSpacing['3xl'] },
    subtitle: { fontSize: rnType.label.size, color: tokens.text.tertiary },
    card: {
      padding: rnSpacing.lg,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
    input: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tokens.surface.bg,
    },
    button: {
      height: 44,
      flexDirection: 'row',
      gap: 6,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      fontSize: rnType.strong.size,
      fontWeight: '600',
      color: tokens.brand.ctaForeground,
    },
    dangerBtn: {
      height: 40,
      flexDirection: 'row',
      gap: rnSpacing.xs,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerText: { fontSize: 13, fontWeight: '600', color: tokens.danger.DEFAULT },
    filterRow: { flexDirection: 'row', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      height: 30,
      justifyContent: 'center',
      borderRadius: rnRadiusFor.chip,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
    },
    chipOn: { backgroundColor: tokens.brand.cta, borderColor: tokens.brand.cta },
    chipText: { fontSize: rnType.label.size, color: tokens.text.secondary },
    chipOnText: { color: tokens.brand.ctaForeground, fontWeight: '600' },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.lg,
      backgroundColor: tokens.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: rnType.title.size, fontWeight: '700', color: tokens.text.secondary },
    itemMain: { flex: 1, gap: 2 },
    itemName: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
    itemDesc: { fontSize: rnType.label.size, color: tokens.text.secondary, lineHeight: 17 },
    meta: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    overlay: { flex: 1, justifyContent: 'flex-end' },
    mask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: rnCssLight.black50,
    },
    sheet: {
      maxHeight: '80%',
      padding: rnSpacing.lg,
      gap: 10,
      borderTopLeftRadius: rnRadius.xl,
      borderTopRightRadius: rnRadius.xl,
      backgroundColor: tokens.surface.card,
    },
    sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sheetTitle: {
      flex: 1,
      fontSize: rnType.title.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    hint: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    memberRow: { flexDirection: 'row', gap: rnSpacing.sm, alignItems: 'center' },
    memberInput: {
      flex: 1,
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      color: tokens.text.primary,
      fontSize: rnType.body.size,
      backgroundColor: tokens.surface.bg,
    },
    smallBtn: {
      height: 40,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
    },
    smallBtnText: { fontSize: rnType.label.size, color: tokens.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
