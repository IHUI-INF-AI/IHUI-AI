// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Link2, Link2Off } from 'lucide-react-native'
import { fetchApi } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { WEB_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
/**
 * 对齐 web `/settings/connected-accounts`（apps/web/app/(main)/settings/connected-accounts/page.tsx）。
 *
 * 端点按 apps/api/src/routes/auth-extended.ts 现读：
 *  - GET    /api/auth/bindings      → { items: userThirdPartyAccounts[] }（id/platform/createdAt…）
 *  - DELETE /api/auth/bindings/:id  → { deleted: boolean }（where 带 userId 归属过滤）
 *
 * 绑定入口**有意不在 App 内发起**：web 的 `window.location.href = /api/auth/${platform}`
 * 在该 API 里没有对应 GET 路由（只有 `/auth/:platform/callback`），现网这一跳即 404。
 * 因此本屏按钮改为打开 web 的已连接账号页，由用户在那里走真实可用的授权流程。
 */
interface Binding {
  id: string
  platform: string
  createdAt: string
}
const KNOWN_PLATFORMS = ['wechat', 'github', 'google'] as const
function fmt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}
export default function ConnectedAccountsScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [bindings, setBindings] = useState<Binding[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [unbinding, setUnbinding] = useState<string | null>(null)
  const styles = makeStyles()
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchApi<{ items?: Binding[] }>('/auth/bindings')
      if (!res.success) {
        setLoadError(res.error || t('connectedAccounts.loadFailed'))
        return
      }
      setBindings(Array.isArray(res.data.items) ? res.data.items : [])
    } catch {
      setLoadError(t('connectedAccounts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])
  useEffect(() => {
    void load()
  }, [load])
  const platformLabel = (platform: string): string => {
    if (platform === 'wechat') return t('connectedAccounts.platformWechat')
    if (platform === 'github') return t('connectedAccounts.platformGithub')
    if (platform === 'google') return t('connectedAccounts.platformGoogle')
    return platform
  }
  const doUnbind = async (binding: Binding) => {
    setUnbinding(binding.id)
    try {
      const res = await fetchApi<{ deleted: boolean }>(
        `/auth/bindings/${encodeURIComponent(binding.id)}`,
        { method: 'DELETE' },
      )
      if (!res.success) {
        appAlert(t('common.error'), res.error || t('connectedAccounts.unbindFailed'))
        return
      }
      if (!res.data.deleted) {
        appAlert(t('common.error'), t('connectedAccounts.unbindFailed'))
        return
      }
      void load()
    } catch {
      appAlert(t('common.error'), t('connectedAccounts.unbindFailed'))
    } finally {
      setUnbinding(null)
    }
  }
  const askUnbind = (binding: Binding) => {
    appAlert(
      t('connectedAccounts.unbindTitle'),
      t('connectedAccounts.unbindConfirm', { platform: platformLabel(binding.platform) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('connectedAccounts.unbind'),
          style: 'destructive',
          onPress: () => {
            void doUnbind(binding)
          },
        },
      ],
    )
  }
  const openWebBinding = async () => {
    const url = `${WEB_BASE_URL}/settings/connected-accounts`
    try {
      const ok = await Linking.canOpenURL(url)
      if (!ok) {
        appAlert(t('common.error'), t('connectedAccounts.openBrowserFailed'))
        return
      }
      await Linking.openURL(url)
    } catch {
      appAlert(t('common.error'), t('connectedAccounts.openBrowserFailed'))
    }
  }
  const extraBindings = bindings.filter((b) => !KNOWN_PLATFORMS.some((p) => p === b.platform))
  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('connectedAccounts.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Link2 size={16} color={tokens.text.secondary} />
            <Text style={styles.cardTitle}>{t('connectedAccounts.title')}</Text>
            <TouchableOpacity
              style={styles.refresh}
              onPress={() => {
                void load()
              }}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.link}>{t('connectedAccounts.refresh')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.muted}>{t('connectedAccounts.subtitle')}</Text>
          {loading ? (
            <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
          ) : loadError ? (
            <View style={styles.centerBox}>
              <Text style={styles.error}>{loadError}</Text>
              <TouchableOpacity
                style={styles.outlineButton}
                onPress={() => {
                  void load()
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.outlineText}>{t('connectedAccounts.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {KNOWN_PLATFORMS.map((platform) => {
                const binding = bindings.find((b) => b.platform === platform)
                return (
                  <View key={platform} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.platformName}>{platformLabel(platform)}</Text>
                      <Text style={styles.meta}>
                        {binding
                          ? `${t('connectedAccounts.boundAt')}: ${fmt(binding.createdAt, locale)}`
                          : t('connectedAccounts.unbound')}
                      </Text>
                    </View>
                    {binding ? (
                      <TouchableOpacity
                        style={styles.outlineButtonSmall}
                        onPress={() => askUnbind(binding)}
                        disabled={unbinding === binding.id}
                        activeOpacity={0.7}
                      >
                        <Link2Off size={13} color={tokens.danger.DEFAULT} />
                        <Text style={styles.dangerLink}>{t('connectedAccounts.unbind')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => {
                          void openWebBinding()
                        }}
                        activeOpacity={0.7}
                      >
                        <Link2 size={13} color={tokens.brand.ctaForeground} />
                        <Text style={styles.buttonText}>{t('connectedAccounts.bindOnWeb')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })}
              {extraBindings.map((binding) => (
                <View key={binding.id} style={styles.row}>
                  <View style={styles.rowMain}>
                    <Text style={styles.platformName}>{platformLabel(binding.platform)}</Text>
                    <Text style={styles.meta}>
                      {t('connectedAccounts.boundAt')}: {fmt(binding.createdAt, locale)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.outlineButtonSmall}
                    onPress={() => askUnbind(binding)}
                    disabled={unbinding === binding.id}
                    activeOpacity={0.7}
                  >
                    <Link2Off size={13} color={tokens.danger.DEFAULT} />
                    <Text style={styles.dangerLink}>{t('connectedAccounts.unbind')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={styles.hint}>{t('connectedAccounts.webBindHint')}</Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tokens.surface.bg },
    body: { padding: 12, gap: 12, paddingBottom: 32 },
    card: {
      padding: 16,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tokens.border.light,
      backgroundColor: tokens.surface.card,
      gap: 10,
    },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: tokens.text.primary },
    refresh: { paddingVertical: 2, paddingHorizontal: 4 },
    link: { fontSize: 13, fontWeight: '600', color: tokens.text.primary },
    muted: { fontSize: 13, color: tokens.text.secondary, lineHeight: 19 },
    hint: { fontSize: 12, color: tokens.text.tertiary, lineHeight: 17, marginTop: 2 },
    error: { fontSize: 13, color: tokens.danger.DEFAULT },
    loading: { paddingVertical: 16 },
    centerBox: { alignItems: 'center', gap: 8, paddingVertical: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.surface.bg,
    },
    rowMain: { flex: 1, gap: 2 },
    platformName: { fontSize: 15, fontWeight: '600', color: tokens.text.primary },
    meta: { fontSize: 12, color: tokens.text.tertiary },
    button: {
      height: 32,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      backgroundColor: tokens.brand.cta,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    buttonText: { fontSize: 12, fontWeight: '600', color: tokens.brand.ctaForeground },
    outlineButtonSmall: {
      height: 32,
      paddingHorizontal: 10,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.danger.DEFAULT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    dangerLink: { fontSize: 12, fontWeight: '600', color: tokens.danger.DEFAULT },
    outlineButton: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tokens.border.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    outlineText: { fontSize: 14, color: tokens.text.primary },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
