// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BackChevron, TextField } from '@ihui/rn-app'
import { rnRadius, rnType } from '@ihui/design-tokens'
import {
  BadgeCheck,
  BookOpen,
  Bot,
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Crown,
  Gem,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  Receipt,
  Search,
  SearchX,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { NavChrome } from '../components/NavChrome'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { MENU_SECTIONS, type MenuSection } from './profileMenuData'

type RootNav = NativeStackNavigationProp<RootStackParamList>
type MenuItemView = MenuSection['items'][number] & { label: string }

interface VisibleSection {
  titleKey: string
  title: string
  items: MenuItemView[]
}

/** 分组视觉图标只属于本页呈现层,菜单全集仍由 profileMenuData 单一提供 */
const SECTION_ICONS: Record<string, LucideIcon> = {
  'menu.sectionOrder': Receipt,
  'menu.sectionWallet': Wallet,
  'menu.sectionVip': Crown,
  'menu.sectionPoints': Gem,
  'menu.sectionPromote': Megaphone,
  'menu.sectionStudy': BookOpen,
  'menu.sectionExam': ClipboardCheck,
  'menu.sectionAi': Bot,
  'menu.sectionSocial': Users,
  'menu.sectionAuth': BadgeCheck,
  'menu.sectionAgent': Boxes,
  'menu.sectionCommunity': MessageCircle,
  'menu.sectionSettings': Settings,
}

/**
 * 「全部功能」—— 我的页的长尾入口收口页。
 *
 * 立因:首页曾把 13 组菜单整段铺在创作内容之后,订单/钱包要翻几屏才找得到。
 * 首页现在只留九宫格高频入口,低频功能在这里按分组折叠 + 搜索直达;
 * 不另造一套菜单数据,判据仍只读 `profileMenuData.ts`。
 */
export function ProfileAllFunctionsScreen(): React.JSX.Element {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<RootNav>()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const normalizedQuery = query.trim().toLowerCase()

  const visibleSections = useMemo<VisibleSection[]>(() => {
    return MENU_SECTIONS.map((section) => {
      const title = t(section.titleKey)
      const allItems = section.items.map((item) => ({ ...item, label: t(item.labelKey) }))
      const titleHit = normalizedQuery.length > 0 && title.toLowerCase().includes(normalizedQuery)
      const items = normalizedQuery
        ? allItems.filter((item) => titleHit || item.label.toLowerCase().includes(normalizedQuery))
        : allItems
      return { titleKey: section.titleKey, title, items }
    }).filter((section) => section.items.length > 0)
  }, [normalizedQuery, t])

  const openItem = (key: string) => {
    if (key === 'WebViewPortal') {
      navigation.navigate('WebView', { url: 'https://aizhs.top', title: t('menu.webPortal') })
      return
    }
    // 178+ 路由联合类型在 React Navigation v6 下无法被 navigate 重载收窄,
    // 这里与 ProfileScreen 的 navigateRoot 同一条边界:只在 helper 内断言。
    navigation.navigate(key as never)
  }

  return (
    <View style={styles.screen}>
      <NavChrome>
        <View style={styles.header}>
          <BackChevron
            onPress={() => navigation.goBack()}
            label={t('common.back')}
            colorScheme={resolvedTheme}
          />
          <Text style={styles.headerTitle}>{t('profile.allFunctions')}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </NavChrome>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchWrap}>
          <View pointerEvents="none" style={styles.searchIcon}>
            <Search size={16} color={tokens.text.medium} strokeWidth={1.8} />
          </View>
          <TextField
            colorScheme={resolvedTheme}
            value={query}
            onChangeText={setQuery}
            placeholder={t('profile.searchFunctions')}
            placeholderTextColor={tokens.text.medium}
            style={[styles.searchField, styles.searchFieldWithIcon]}
            returnKeyType="search"
            accessibilityLabel={t('profile.searchFunctions')}
          />
        </View>

        {visibleSections.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <SearchX size={26} color={tokens.text.medium} strokeWidth={1.7} />
            </View>
            <Text style={styles.emptyText}>{t('profile.noFunctionsFound')}</Text>
          </View>
        ) : (
          visibleSections.map((section) => {
            const isOpen = normalizedQuery.length > 0 || expanded[section.titleKey] === true
            const SectionIcon = SECTION_ICONS[section.titleKey] ?? LayoutGrid
            return (
              <View key={section.titleKey} style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (normalizedQuery) return
                    setExpanded((prev) => ({ ...prev, [section.titleKey]: !isOpen }))
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={section.title}
                  accessibilityState={{ disabled: normalizedQuery.length > 0 }}
                >
                  <View style={styles.sectionIcon}>
                    <SectionIcon size={18} color={tokens.text.primary} strokeWidth={1.7} />
                  </View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <View style={styles.sectionMeta}>
                    <View style={styles.sectionCountPill}>
                      <Text style={styles.sectionCount}>{section.items.length}</Text>
                    </View>
                    <View style={[styles.chevronBox, isOpen ? styles.chevronOpen : undefined]}>
                      <ChevronDown size={18} color={tokens.text.secondary} />
                    </View>
                  </View>
                </TouchableOpacity>
                {isOpen ? (
                  <View style={styles.card}>
                    {section.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={styles.menuRow}
                          activeOpacity={0.7}
                          onPress={() => openItem(item.key)}
                          accessibilityRole="button"
                          accessibilityLabel={item.label}
                        >
                          {typeof Icon === 'string' ? (
                            <Text style={styles.menuIconText}>{Icon}</Text>
                          ) : (
                            <Icon size={19} color={tokens.text.primary} />
                          )}
                          <Text style={styles.menuLabel} numberOfLines={1}>
                            {item.label}
                          </Text>
                          <ChevronRight size={16} color={tokens.text.medium} />
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                ) : null}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: rnType.title.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  searchWrap: {
    height: 44,
  },
  searchIcon: {
    position: 'absolute',
    left: 14,
    top: 14,
    zIndex: 1,
  },
  searchField: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    backgroundColor: tokens.surface.light,
    fontSize: rnType.body.size,
    color: tokens.text.primary,
  },
  searchFieldWithIcon: {
    paddingLeft: 38,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: rnRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  sectionTitle: {
    flex: 1,
    fontSize: rnType.strong.size,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  sectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCountPill: {
    minWidth: 24,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: rnRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  sectionCount: {
    fontSize: rnType.label.size,
    color: tokens.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  chevronBox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.light,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  menuIconText: {
    width: 20,
    textAlign: 'center',
    fontSize: rnType.title.size,
  },
  menuLabel: {
    flex: 1,
    fontSize: rnType.body.size,
    color: tokens.text.primary,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: rnRadius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.muted,
  },
  emptyText: {
    fontSize: rnType.body.size,
    color: tokens.text.secondary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
