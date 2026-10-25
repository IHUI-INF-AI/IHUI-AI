// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 智能体分类 —— 对齐 web `/agents/categories` 与 `/agents/categories/[id]`。
 *
 * 端点按 apps/api/src/routes/agents.ts 现读:
 *  - GET /api/categories/list?page=1&pageSize=100&status=1   ⇒ { list, total }
 *        (市场浏览公开面,游客可读)
 *  - GET /api/categories/:categoryId                        ⇒ Category(需登录)
 *  - GET /api/agents/list?categoryId=...&status=published&page=1&pageSize=100
 *        ⇒ { list, total }
 *
 * 分类详情 + 分类下智能体收进一个详情弹层(web 是独立路由,移动端不复制路由层级)。
 * 点智能体跳已注册的 AgentDetail 路由(参数 { id: agentId })。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
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
import { CreditCard, Sparkles, Tag, X } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius, rnRadiusFor, rnSpacing, rnType } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface Category {
  categoryId: string
  name: string
  description: string | null
  icon: string | null
  sort: number
  status: string
  isPaid: boolean
  createdAt: string
}

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  status: string
  price: number
  isFree: boolean
}

export default function AgentCategoriesScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [panel, setPanel] = useState<Category | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [agentsFailed, setAgentsFailed] = useState(false)
  const reqRef = useRef(0)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetchApi<{ list?: Category[] }>(
        '/api/categories/list?page=1&pageSize=100&status=1',
      )
      if (!res.success) throw new Error(res.error)
      setCategories(res.data?.list ?? [])
    } catch {
      setCategories([])
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openPanel = async (category: Category) => {
    const req = ++reqRef.current
    setPanel(category)
    setAgents([])
    setAgentsFailed(false)
    setAgentsLoading(true)
    try {
      const [detail, list] = await Promise.all([
        fetchApi<Category>(`/api/categories/${encodeURIComponent(category.categoryId)}`),
        fetchApi<{ list?: Agent[] }>(
          `/api/agents/list?categoryId=${encodeURIComponent(
            category.categoryId,
          )}&status=published&page=1&pageSize=100`,
        ),
      ])
      if (req !== reqRef.current) return
      if (detail.success && detail.data) setPanel(detail.data)
      if (list.success) setAgents(list.data?.list ?? [])
      else setAgentsFailed(true)
    } catch {
      if (req === reqRef.current) setAgentsFailed(true)
    } finally {
      if (req === reqRef.current) setAgentsLoading(false)
    }
  }

  const fmtDate = (iso: string): string => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  }

  const styles = makeStyles()

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('agentCategories.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.subtitle}>{t('agentCategories.subtitle')}</Text>

        {loading ? (
          <ActivityIndicator style={styles.stateBox} color={tokens.text.tertiary} />
        ) : failed ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{t('agentCategories.loadFailed')}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.7}>
              <Text style={styles.retry}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.stateBox}>
            <Tag size={28} color={tokens.text.tertiary} />
            <Text style={styles.muted}>{t('agentCategories.empty')}</Text>
            <Text style={styles.hint}>{t('agentCategories.emptyHint')}</Text>
          </View>
        ) : (
          categories.map((cat) => (
            <TouchableOpacity
              key={cat.categoryId}
              style={styles.card}
              onPress={() => void openPanel(cat)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHead}>
                <View style={styles.iconBox}>
                  {cat.icon && (cat.icon.startsWith('http') || cat.icon.startsWith('/')) ? (
                    <Image source={{ uri: cat.icon }} style={styles.iconImage} resizeMode="cover" />
                  ) : (
                    <Tag size={18} color={tokens.text.secondary} />
                  )}
                </View>
                <View style={styles.cardMain}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {cat.name}
                  </Text>
                  <View style={styles.badgeRow}>
                    {cat.isPaid ? (
                      <View style={styles.paidBadge}>
                        <CreditCard size={10} color={tokens.warning.amberText} />
                        <Text style={styles.paidText}>{t('agentCategories.paid')}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.meta}>{fmtDate(cat.createdAt)}</Text>
                  </View>
                </View>
              </View>
              {cat.description ? (
                <Text style={styles.desc} numberOfLines={2}>
                  {cat.description}
                </Text>
              ) : null}
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
              <ScrollView contentContainerStyle={styles.sheetBody}>
                <View style={styles.badgeRow}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {panel.status === '1'
                        ? t('agentCategories.statusEnabled')
                        : t('agentCategories.statusDisabled')}
                    </Text>
                  </View>
                  {panel.isPaid ? (
                    <View style={styles.paidBadge}>
                      <CreditCard size={10} color={tokens.warning.amberText} />
                      <Text style={styles.paidText}>{t('agentCategories.paid')}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.meta}>
                    {t('agentCategories.createdAt')}: {fmtDate(panel.createdAt)}
                  </Text>
                </View>
                {panel.description ? <Text style={styles.muted}>{panel.description}</Text> : null}

                <View style={styles.sectionHead}>
                  <Text style={styles.cardTitle}>{t('agentCategories.agentsTitle')}</Text>
                  <Text style={styles.meta}>
                    {t('agentCategories.agentTotal', { count: agents.length })}
                  </Text>
                </View>

                {agentsLoading ? (
                  <ActivityIndicator color={tokens.text.tertiary} />
                ) : agentsFailed ? (
                  <Text style={styles.errorText}>{t('agentCategories.agentsLoadFailed')}</Text>
                ) : agents.length === 0 ? (
                  <View style={styles.agentsEmpty}>
                    <Sparkles size={22} color={tokens.text.tertiary} />
                    <Text style={styles.hint}>{t('agentCategories.noAgents')}</Text>
                  </View>
                ) : (
                  agents.map((agent) => (
                    <TouchableOpacity
                      key={agent.agentId}
                      style={styles.agentRow}
                      onPress={() => {
                        setPanel(null)
                        navigation.navigate('AgentDetail', { id: agent.agentId })
                      }}
                      activeOpacity={0.7}
                    >
                      {agent.avatar ? (
                        <Image
                          source={{ uri: agent.avatar }}
                          style={styles.agentAvatar}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.agentAvatar}>
                          <Sparkles size={16} color={tokens.text.secondary} />
                        </View>
                      )}
                      <View style={styles.agentMain}>
                        <Text style={styles.agentName} numberOfLines={1}>
                          {agent.name}
                        </Text>
                        <Text style={styles.desc} numberOfLines={2}>
                          {agent.description || t('agentCategories.noDescription')}
                        </Text>
                      </View>
                      <Text style={[styles.price, agent.isFree && styles.free]}>
                        {agent.isFree
                          ? t('agentCategories.free')
                          : t('agentCategories.price', { price: agent.price })}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
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
      padding: 14,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: rnSpacing.sm,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: rnRadius.lg,
      backgroundColor: tokens.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    iconImage: { width: 40, height: 40 },
    cardMain: { flex: 1, gap: rnSpacing.xs },
    itemName: { fontSize: rnType.strong.size, fontWeight: '600', color: tokens.text.primary },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm, flexWrap: 'wrap' },
    paidBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tokens.warning.amberLight,
    },
    paidText: { fontSize: 10, fontWeight: '600', color: tokens.warning.amberText },
    desc: { fontSize: rnType.label.size, color: tokens.text.secondary, lineHeight: 17 },
    meta: { fontSize: rnType.caption.size, color: tokens.text.tertiary },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    hint: { fontSize: rnType.caption.size, color: tokens.text.tertiary, lineHeight: 16 },
    errorText: { fontSize: rnType.label.size, color: tokens.danger.DEFAULT },
    retry: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    stateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing['5xl'],
    },
    overlay: { flex: 1, justifyContent: 'flex-end' },
    mask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: tokens.overlay.modal,
    },
    sheet: {
      maxHeight: '85%',
      padding: rnSpacing.lg,
      gap: rnSpacing.sm,
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
    sheetBody: { gap: rnSpacing.sm, paddingBottom: rnSpacing.lg },
    statusBadge: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadiusFor.chip,
      backgroundColor: tokens.surface.muted,
    },
    statusText: { fontSize: 10, color: tokens.text.secondary },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tokens.text.primary },
    agentsEmpty: { alignItems: 'center', gap: 6, paddingVertical: rnSpacing.xl },
    agentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: rnSpacing.sm,
    },
    agentAvatar: {
      width: 36,
      height: 36,
      borderRadius: rnRadius.lg,
      backgroundColor: tokens.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    agentMain: { flex: 1, gap: 2 },
    agentName: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    price: { fontSize: rnType.label.size, fontWeight: '600', color: tokens.text.primary },
    free: { color: tokens.success.deep },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
