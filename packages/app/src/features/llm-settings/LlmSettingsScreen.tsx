// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Check, Wand2, X } from 'lucide-react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import { BackChevron } from '../../components/BackChevron'
import { EmptyState, ErrorState } from '../../components/ScreenStates'

/**
 * LLM 供应商设置(BYOK)共享屏 —— 渲染真相源(web 基准 = settings/llm:MVP 范围)。
 *
 * MVP = 供应商列表 + BYOK 四步向导(① 选厂商 → ② 填 Key → ③ 验证 → ④ 激活抽成);
 * 模型管理/分组/对比/批量导入(web 全家桶)排后续轮次扩展,不在本屏首版。
 *
 * 平台侧注入取数与副作用:GET /api/v2/user/llm-providers、POST /api/llm/verify-key、
 * POST /api/v2/user/llm-providers 全留在薄壳;本屏纯 UI + 四步状态机展示。
 * 厂商清单(10 家)由薄壳透传(web 基准 byok-wizard 的 PROVIDERS 常量)。
 */
export interface LlmProviderRowView {
  id: number | string
  name: string
  baseUrl: string
  enabled: boolean
  modelCount?: number
}

export interface ByokProviderOption {
  code: string
  name: string
  baseUrl: string
  defaultModelId: string
}

export type ByokVerifyState = 'idle' | 'verifying' | 'success' | 'failed' | 'unavailable'

export interface LlmSettingsScreenProps {
  t: (key: string, params?: Record<string, string | number>) => string
  colorScheme?: 'light' | 'dark'
  onBack: () => void
  loading: boolean
  error: string | null
  providers: LlmProviderRowView[]
  wizardProviders: ByokProviderOption[]
  wizardOpen: boolean
  wizardStep: 0 | 1 | 2 | 3
  selectedCode: string | null
  apiKey: string
  verifyState: ByokVerifyState
  verifyMsg: string
  actionPending: boolean
  onRetry: () => void
  onNext: () => void
  onWizardOpen: () => void
  onWizardClose: () => void
  onSelectProvider: (code: string) => void
  onApiKeyChange: (v: string) => void
  onVerify: () => void
  onActivate: () => void
}

export function LlmSettingsScreen({
  t,
  colorScheme = 'light',
  onBack,
  loading,
  error,
  providers,
  wizardProviders,
  wizardOpen,
  wizardStep,
  selectedCode,
  apiKey,
  verifyState,
  verifyMsg,
  actionPending,
  onRetry,
  onNext,
  onWizardOpen,
  onWizardClose,
  onSelectProvider,
  onApiKeyChange,
  onVerify,
  onActivate,
}: LlmSettingsScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const [keyVisible, setKeyVisible] = useState(false)
  const selected = wizardProviders.find((p) => p.code === selectedCode) ?? null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <Text style={styles.title}>{t('llmSettings.title')}</Text>
        <Pressable
          onPress={onWizardOpen}
          style={({ pressed }) => [styles.fab, pressed && styles.btnPressed]}
          accessibilityRole="button"
        >
          <Wand2 size={16} color={tk.brand.ctaForeground} />
          <Text style={styles.fabText}>{t('byok.fab')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tk.brand.cta} />
          </View>
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={onRetry}
            retryLabel={t('common.retry')}
            colorScheme={colorScheme}
          />
        ) : providers.length === 0 ? (
          <EmptyState
            glyph="⚿"
            title={t('llmSettings.empty')}
            desc={t('llmSettings.emptyDesc')}
            colorScheme={colorScheme}
          />
        ) : (
          <View style={styles.list}>
            {providers.map((p) => (
              <View key={String(p.id)} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardName}>{p.name}</Text>
                  <Text style={p.enabled ? styles.badgeOn : styles.badgeOff}>
                    {p.enabled ? t('llmSettings.enabled') : t('llmSettings.disabled')}
                  </Text>
                </View>
                <Text style={styles.cardUrl}>{p.baseUrl}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={wizardOpen} animationType="slide" onRequestClose={onWizardClose}>
        <View style={styles.wizardContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('byok.title')}</Text>
            <Pressable
              onPress={onWizardClose}
              style={({ pressed }) => [styles.minorBtn, pressed && styles.btnPressed]}
              accessibilityRole="button"
            >
              <X size={16} color={tk.text.primary} />
            </Pressable>
          </View>
          <View style={styles.stepRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.stepDot, i <= wizardStep && styles.stepDotOn]} />
            ))}
          </View>
          <ScrollView contentContainerStyle={styles.wizardBody}>
            <Text style={styles.stepTitle}>{t(`byok.step${wizardStep + 1}Title`)}</Text>

            {wizardStep === 0 ? (
              <View style={styles.chipWrap}>
                {wizardProviders.map((p) => (
                  <Pressable
                    key={p.code}
                    onPress={() => onSelectProvider(p.code)}
                    style={[styles.chip, selectedCode === p.code && styles.chipOn]}
                    accessibilityRole="button"
                  >
                    <Text style={selectedCode === p.code ? styles.chipTextOn : styles.chipText}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {wizardStep === 1 ? (
              <View style={styles.formCard}>
                {selected ? (
                  <Text style={styles.label}>
                    {selected.name} · {selected.baseUrl}
                  </Text>
                ) : null}
                <TextInput
                  value={apiKey}
                  onChangeText={onApiKeyChange}
                  placeholder={t('byok.keyPlaceholder')}
                  placeholderTextColor={tk.text.tertiary}
                  secureTextEntry={!keyVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  accessibilityLabel={t('byok.keyPlaceholder')}
                />
                <Pressable
                  onPress={() => setKeyVisible((v) => !v)}
                  style={styles.linkBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkText}>
                    {keyVisible ? t('byok.hideKey') : t('byok.showKey')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {wizardStep === 2 ? (
              <View style={styles.formCard}>
                {verifyState === 'idle' ? (
                  <Text style={styles.label}>{t('byok.verifyIdle')}</Text>
                ) : null}
                {verifyState === 'verifying' ? (
                  <View style={styles.centerRow}>
                    <ActivityIndicator size="small" color={tk.brand.cta} />
                    <Text style={styles.label}>{t('byok.verifying')}</Text>
                  </View>
                ) : null}
                {verifyState === 'success' ? (
                  <View style={styles.centerRow}>
                    <Check size={16} color={tk.success.DEFAULT} />
                    <Text style={[styles.label, { color: tk.success.DEFAULT }]}>
                      {t('byok.verifySuccess')}
                    </Text>
                  </View>
                ) : null}
                {verifyState === 'failed' || verifyState === 'unavailable' ? (
                  <View style={styles.centerRow}>
                    <X size={16} color={tk.danger.DEFAULT} />
                    <Text style={[styles.label, { color: tk.danger.DEFAULT }]}>
                      {verifyMsg || t('byok.verifyFailed')}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {wizardStep === 3 ? (
              <View style={styles.formCard}>
                <Check size={24} color={tk.success.DEFAULT} />
                <Text style={styles.cardName}>{t('byok.doneTitle')}</Text>
                <Text style={styles.label}>{t('byok.doneDesc')}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.wizardFooter}>
            <Pressable
              onPress={
                wizardStep === 3
                  ? onWizardClose
                  : wizardStep === 2
                    ? onActivate
                    : wizardStep === 1
                      ? onVerify
                      : onNext
              }
              disabled={
                actionPending ||
                (wizardStep === 0 && !selectedCode) ||
                (wizardStep === 1 && !apiKey.trim()) ||
                (wizardStep === 2 && !(verifyState === 'success' || verifyState === 'unavailable'))
              }
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.btnPressed,
                actionPending && styles.btnDisabled,
              ]}
              accessibilityRole="button"
            >
              {actionPending ? (
                <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {t(
                    wizardStep === 3
                      ? 'common.close'
                      : wizardStep === 2
                        ? 'byok.activate'
                        : wizardStep === 1
                          ? 'byok.verify'
                          : 'byok.next',
                  )}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: rnSpacing.lg,
      paddingVertical: rnSpacing.md,
      gap: rnSpacing.md,
    },
    title: { ...rnType.heading, color: tk.text.primary, flex: 1 },
    fab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      height: 32,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    fabText: { fontSize: rnType.body.size, color: tk.brand.ctaForeground, fontWeight: '600' },
    body: { padding: rnSpacing.lg },
    center: { alignItems: 'center', justifyContent: 'center', paddingVertical: rnSpacing['3xl'] },
    list: { gap: rnSpacing.md },
    card: {
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.light,
      padding: rnSpacing.lg,
      gap: rnSpacing.xs,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cardName: { ...rnType.title, color: tk.text.primary },
    cardUrl: { fontSize: rnType.label.size, color: tk.text.tertiary },
    badgeOn: { fontSize: rnType.label.size, color: tk.success.DEFAULT, fontWeight: '600' },
    badgeOff: { fontSize: rnType.label.size, color: tk.text.tertiary },
    wizardContainer: { flex: 1, backgroundColor: tk.surface.bg, paddingTop: rnSpacing.xl },
    stepRow: { flexDirection: 'row', gap: rnSpacing.sm, paddingHorizontal: rnSpacing.lg },
    stepDot: { flex: 1, height: 4, borderRadius: rnRadius.xs, backgroundColor: tk.surface.muted },
    stepDotOn: { backgroundColor: tk.brand.cta },
    wizardBody: { padding: rnSpacing.lg },
    stepTitle: { ...rnType.title, color: tk.text.primary, marginBottom: rnSpacing.md },
    formCard: { gap: rnSpacing.md },
    label: { ...rnType.body, color: tk.text.secondary },
    input: {
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: rnRadius.md,
      paddingHorizontal: rnSpacing.md,
      height: 44,
      backgroundColor: tk.surface.muted,
      fontSize: rnType.body.size,
      color: tk.text.primary,
    },
    linkBtn: { alignSelf: 'flex-end' },
    linkText: { fontSize: rnType.label.size, color: tk.brand.cta, fontWeight: '600' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.sm },
    chip: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    chipOn: { backgroundColor: tk.brand.cta, borderColor: tk.brand.cta },
    chipText: { fontSize: rnType.body.size, color: tk.text.secondary },
    chipTextOn: { fontSize: rnType.body.size, color: tk.brand.ctaForeground },
    centerRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    minorBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      height: 36,
      paddingHorizontal: rnSpacing.md,
      borderRadius: rnRadius.md,
      backgroundColor: tk.surface.muted,
      borderWidth: 1,
      borderColor: tk.border.light,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      height: 44,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    primaryBtnText: { ...rnType.body, color: tk.brand.ctaForeground, fontWeight: '600' },
    wizardFooter: { padding: rnSpacing.lg },
    btnDisabled: { opacity: 0.6 },
    btnPressed: { opacity: 0.8 },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
