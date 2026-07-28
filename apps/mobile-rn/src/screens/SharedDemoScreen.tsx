import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import {
  AboutScreen,
  ProfileScreen,
  SettingsScreen,
  VipCard,
  UserInfoCard,
  BusinessCard,
  AgentCard,
  CourseCard,
  tokens,
} from '@ihui/rn-app'
import type {
  SharedMenuSection,
  SharedLocaleOption,
  SharedThemeOption,
  SharedMenuItem,
} from '@ihui/rn-app'
import { getProfile, getUserStatistics, type AuthUser, type UserStatistics } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'

type Tab = 'about' | 'profile' | 'settings' | 'cards'

/**
 * SharedDemoScreen — RN 端共享组件集成验证页。
 * 引用 packages/app 的 3 个生产级共享组件 + 5 个跨端卡片组件,注入 t 函数 + 真实 API 数据 + 回调。
 * cards tab 的卡片组件演示数据保留(组件长相展示,非业务 mock)。
 */
export function SharedDemoScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [tab, setTab] = useState<Tab>('about')
  const [locale, setLocale] = useState('zh-CN')
  const [theme, setTheme] = useState('system')
  const [notifications, setNotifications] = useState({ push: true, message: true, email: false })
  const [user, setUser] = useState<AuthUser | null>(null)
  const [stats, setStats] = useState<UserStatistics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!__DEV__) return
    let cancelled = false
    setLoading(true)
    Promise.all([getProfile(), getUserStatistics()])
      .then(([profileRes, statsRes]) => {
        if (cancelled) return
        if (profileRes.success) setUser(profileRes.data)
        if (statsRes.success) setStats(statsRes.data)
      })
      .catch(() => {
        // 静默处理:loading 置 false,user/stats 仍为 null,UI 走"加载失败"分支
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!__DEV__) return null

  const menuSections: SharedMenuSection[] = [
    {
      title: t('profile.myCourses'),
      items: [{ key: 'courses', label: t('profile.myCourses'), icon: '📚' }],
    },
    {
      title: t('profile.myFavorites'),
      items: [{ key: 'favorites', label: t('profile.myFavorites'), icon: '⭐' }],
    },
  ]
  const localeOptions: SharedLocaleOption[] = [
    { value: 'zh-CN', label: t('settings.language') },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'zh-TW', label: '繁體中文' },
  ]
  const themeOptions: SharedThemeOption[] = [
    { value: 'light', label: t('settings.theme') },
    { value: 'dark', label: t('settings.theme') },
    { value: 'system', label: t('settings.theme') },
  ]
  const menuItems: SharedMenuItem[] = [
    { key: 'about', label: t('settings.about') },
    { key: 'feedback', label: t('profile.feedback') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'about' && styles.tabActive]}
          onPress={() => setTab('about')}
        >
          <Text style={styles.tabText}>{t('settings.about')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'profile' && styles.tabActive]}
          onPress={() => setTab('profile')}
        >
          <Text style={styles.tabText}>{t('profile.title')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'settings' && styles.tabActive]}
          onPress={() => setTab('settings')}
        >
          <Text style={styles.tabText}>{t('settings.title')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'cards' && styles.tabActive]}
          onPress={() => setTab('cards')}
        >
          <Text style={styles.tabText}>Cards</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <Text style={styles.statusText}>加载中...</Text>
      ) : !user ? (
        <Text style={styles.statusText}>加载失败</Text>
      ) : null}
      {tab === 'about' && <AboutScreen t={t} onBack={() => setTab('profile')} />}
      {tab === 'profile' && (
        <ProfileScreen
          t={t}
          user={user ?? undefined}
          stats={stats ?? undefined}
          orderCount={5}
          colorScheme={resolvedTheme}
          menuSections={menuSections}
          onNavigate={(key) => console.info('nav:', key)}
          onLogout={() => console.info('logout')}
          onBack={() => setTab('about')}
        />
      )}
      {tab === 'settings' && (
        <SettingsScreen
          t={t}
          user={user ?? undefined}
          locale={locale}
          localeOptions={localeOptions}
          onSelectLocale={(l) => setLocale(l)}
          theme={theme}
          themeOptions={themeOptions}
          onSelectTheme={(th) => setTheme(th)}
          colorScheme={resolvedTheme}
          notifications={notifications}
          onToggleNotification={(k, v) => setNotifications((prev) => ({ ...prev, [k]: v }))}
          onChangePassword={async (o, n) => {
            console.info('pwd:', o, n)
            return true
          }}
          onAlert={(title, msg) => console.info('alert:', title, msg)}
          onConfirm={(_title, _msg, onOk) => onOk()}
          onLogout={() => console.info('logout')}
          menuItems={menuItems}
          onMenuPress={(key) => console.info('menu:', key)}
          appVersion="1.0.0"
          onBack={() => setTab('about')}
        />
      )}
      {tab === 'cards' && (
        <ScrollView style={styles.cardsScroll} contentContainerStyle={styles.cardsContent}>
          <Text style={styles.sectionTitle}>VIP 卡片(带购买入口)</Text>
          <VipCard
            level={3}
            levelName="黄金会员"
            expireDate="2027-07-25T00:00:00.000Z"
            daysRemaining={365}
            benefits={['专属客服', '每日双倍积分', '课程 8 折', '会员专享', '生日礼遇']}
            price={29900}
            colorScheme={resolvedTheme}
            onPurchasePress={() => console.info('vip:purchase')}
            onPress={() => console.info('vip:press')}
          />

          <Text style={styles.sectionTitle}>用户信息卡片</Text>
          <UserInfoCard
            avatar="https://file.aizhs.top/sys-mini/daixaodiming.png"
            nickname="李思涵"
            bio="AI 产品经理 · 智能体创作者"
            followingCount={56}
            fansCount={1280}
            isFollowing={false}
            email="lisihan@ihui.ai"
            phone="186****9808"
            colorScheme={resolvedTheme}
            onFollowPress={() => console.info('user:follow')}
            onPress={() => console.info('user:press')}
          />

          <Text style={styles.sectionTitle}>商务名片</Text>
          <BusinessCard
            avatar="https://file.aizhs.top/sys-mini/daixaodiming.png"
            name="张明"
            title="技术总监"
            company="智汇科技"
            phone="13800138000"
            email="zhangming@ihui.ai"
            wechat="zm_ai_pro"
            location="深圳·南山"
            bio="专注 AI 智能体与企业智能化解决方案"
            colorScheme={resolvedTheme}
            onContactPress={() => console.info('biz:contact')}
            onPress={() => console.info('biz:press')}
          />

          <Text style={styles.sectionTitle}>Agent 卡片</Text>
          <AgentCard
            icon="🤖"
            name="文案润色助手"
            description="AI 自动优化文案,支持多语气多风格"
            usageCount={1280}
            creator="智汇官方"
            tags={['文案', '营销', '高效']}
            rating={4.8}
            isFree={false}
            price={9900}
            colorScheme={resolvedTheme}
            onPress={() => console.info('agent:press')}
          />

          <Text style={styles.sectionTitle}>课程卡片</Text>
          <CourseCard
            cover="https://file.aizhs.top/sys-mini/daixaodiming.png"
            title="AI 智能体开发实战"
            lecturer="王老师"
            price={19900}
            enrollCount={3420}
            description="从 0 到 1 构建企业级 AI Agent"
            level="intermediate"
            isFree={false}
            rating={4.9}
            tags={['LangGraph', 'MCP', '实战']}
            colorScheme={resolvedTheme}
            onPress={() => console.info('course:press')}
          />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: 'row', padding: 8, gap: 8 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: tokens.surface.card,
  },
  tabActive: { backgroundColor: tokens.brand.DEFAULT },
  tabText: { fontSize: 13, fontWeight: '500', color: tokens.text.medium },
  statusText: {
    padding: 12,
    fontSize: 13,
    color: tokens.text.tertiary,
    textAlign: 'center',
  },
  cardsScroll: { flex: 1 },
  cardsContent: { padding: 16, gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.text.primary,
    marginTop: 12,
    marginBottom: 4,
  },
})
