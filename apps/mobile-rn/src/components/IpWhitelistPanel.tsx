// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { fetchApi } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { ShieldCheck } from 'lucide-react-native'
import { rnRadius } from '@ihui/design-tokens'
import { TextField } from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { rpx } from '../utils/rpx'

/**
 * 账号级 IP 白名单管理面 —— 对齐 web `src/components/settings/IpWhitelist.tsx`。
 *
 * 三条腿都是已注册的真端点(apps/api/src/routes/user/security-config-routes.ts):
 *   GET    /api/user/ip-whitelist      → string[]
 *   POST   /api/user/ip-whitelist {ip} → string[](幂等追加)
 *   DELETE /api/user/ip-whitelist?ip=  → string[](摘到空即删行)
 *
 * 不在端内做 IP 语法校验:文法由服务端判(它同时是生效链的判源),这里只把它的 400
 * 翻成本地化提示 —— 抄一份校验规则就是第二把尺子,两把尺子必然漂移。
 */
export function IpWhitelistPanel() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [ips, setIps] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchApi<string[]>('/api/user/ip-whitelist')
      if (!res.success) setLoadError(res.error)
      else setIps(Array.isArray(res.data) ? res.data : [])
    } catch {
      setLoadError(t('securityCenter.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (req: () => Promise<ApiResult<string[]>>) => {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      const res = await req()
      if (!res.success) {
        setActionError(
          res.status === 400 ? t('securityCenter.ipInvalid') : t('securityCenter.actionFailed'),
        )
        return
      }
      setIps(Array.isArray(res.data) ? res.data : [])
    } catch {
      setActionError(t('securityCenter.actionFailed'))
    } finally {
      setBusy(false)
    }
  }

  const onAdd = () => {
    const ip = draft.trim()
    if (!ip || busy) return
    void run(async () => {
      const res = await fetchApi<string[]>('/api/user/ip-whitelist', {
        method: 'POST',
        body: JSON.stringify({ ip }),
      })
      if (res.success) setDraft('')
      return res
    })
  }

  const onRemove = (ip: string) => {
    void run(() =>
      fetchApi<string[]>(`/api/user/ip-whitelist?ip=${encodeURIComponent(ip)}`, {
        method: 'DELETE',
      }),
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <ShieldCheck size={rpx(30)} color={tokens.brandAccent.deep} strokeWidth={2} />
        <Text style={styles.title}>{t('securityCenter.ipTitle')}</Text>
      </View>
      <Text style={styles.hint}>{t('securityCenter.ipHint')}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={tokens.text.tertiary} />
        </View>
      ) : loadError ? (
        <TouchableOpacity onPress={() => void load()} accessibilityRole="button">
          <Text style={styles.errorText}>{loadError}</Text>
        </TouchableOpacity>
      ) : ips.length === 0 ? (
        <Text style={styles.empty}>{t('securityCenter.ipEmpty')}</Text>
      ) : (
        <View style={styles.list}>
          {ips.map((ip) => (
            <View key={ip} style={styles.row}>
              <Text style={styles.ip} numberOfLines={1}>
                {ip}
              </Text>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => onRemove(ip)}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
              >
                <Text style={styles.removeText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.addRow}>
        <TextField
          colorScheme={resolvedTheme}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('securityCenter.ipPlaceholder')}
          style={styles.input}
          editable={!busy}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={busy ? [styles.addBtn, styles.addBtnBusy] : styles.addBtn}
          onPress={onAdd}
          disabled={busy || draft.trim() === ''}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('securityCenter.ipAdd')}
        >
          <Text style={styles.addText}>{t('securityCenter.ipAdd')}</Text>
        </TouchableOpacity>
      </View>
      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.lg,
    padding: rpx(24),
    gap: rpx(16),
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: rpx(12) },
  title: { fontSize: rpx(30), fontWeight: '600', color: tokens.text.primary },
  hint: { fontSize: rpx(22), lineHeight: rpx(34), color: tokens.text.secondary },
  center: { alignItems: 'center', paddingVertical: rpx(24) },
  empty: {
    fontSize: rpx(24),
    color: tokens.text.tertiary,
    textAlign: 'center',
    paddingVertical: rpx(16),
  },
  list: { gap: rpx(8) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rpx(16),
    paddingVertical: rpx(12),
    paddingHorizontal: rpx(16),
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.light,
  },
  ip: { flex: 1, fontSize: rpx(26), color: tokens.text.primary, fontFamily: 'monospace' },
  removeBtn: { paddingHorizontal: rpx(12), paddingVertical: rpx(6) },
  removeText: { fontSize: rpx(24), color: tokens.danger.DEFAULT },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: rpx(12) },
  input: { flex: 1 },
  addBtn: {
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(14),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
  },
  addBtnBusy: { opacity: 0.6 },
  addText: { fontSize: rpx(26), fontWeight: '600', color: tokens.brand.ctaForeground },
  errorText: { fontSize: rpx(22), color: tokens.danger.DEFAULT },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
