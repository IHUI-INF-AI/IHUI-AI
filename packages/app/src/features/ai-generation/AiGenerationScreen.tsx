// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useMemo } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Box, Image as ImageIcon, Music4, Sparkles, Video, Wand2 } from 'lucide-react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { TFunction } from '../../types'
import { getTokens, type AppThemeMode, type AppThemeTokens } from '../../theme/tokens'
import { BackChevron } from '../../components/BackChevron'

const NS = 'aiGenerationPage'

/** 生成类型(与 web GenerationType 同名,vision 子面板未承载见文件尾注) */
export type AiGenerationType = 'auto' | 'image' | 'video' | '3d' | 'audio' | 'music'

export interface AiGenerationModeOption {
  value: string
  label: string
}

export interface AiGenerationResultView {
  kind: 'text' | 'media'
  value: string
}

export interface AiGenerationScreenProps {
  t: TFunction
  colorScheme: AppThemeMode
  onBack: () => void
  type: AiGenerationType
  onTypeChange: (value: AiGenerationType) => void
  /** 当前类型的子档 chips(薄壳按类型注入,空数组即不渲染 chips 行) */
  modes: AiGenerationModeOption[]
  mode: string
  onModeChange: (value: string) => void
  prompt: string
  onPromptChange: (value: string) => void
  promptPlaceholderKey: string
  generating: boolean
  error: string | null
  result: AiGenerationResultView | null
  onSubmit: () => void
  onClear: () => void
  /** 媒体结果(图片/视频/音频)点开:薄壳 Linking 唤起系统查看器 */
  onOpenMedia: (url: string) => void
  /** 非空即未登录门(生成接口均需登录,未登录不发注定 401 的请求) */
  loginRequiredText: string
}

const TYPE_TABS: Array<{ value: AiGenerationType; labelKey: string; icon: 'sparkles' | 'image' | 'video' | 'box' | 'voice' | 'music' }> = [
  { value: 'auto', labelKey: 'typeAuto', icon: 'sparkles' },
  { value: 'image', labelKey: 'typeImage', icon: 'image' },
  { value: 'video', labelKey: 'typeVideo', icon: 'video' },
  { value: '3d', labelKey: 'type3d', icon: 'box' },
  { value: 'audio', labelKey: 'typeVoice', icon: 'voice' },
  { value: 'music', labelKey: 'typeMusic', icon: 'music' },
]

/**
 * AI 内容生成共享屏 —— 承载 web /ai-generation。
 *
 * 后端契约现读(逐条证据在 packages/api-client/src/endpoints/ai-generation.ts 头注):
 * dashscope chat/image/video、doubao image、jimeng4 image、agnes image、audio speech、
 * suno generate、hunyuan3d submit、kling 提交+轮询,均 success(<厂商 data>) 信封。
 *
 * 承载范围与省略项(如实登记):
 *  - 已承载:类型切换(自动/图像/视频/3D/语音/音乐)+ 子档 chips + 提示词 + 生成 + 结果预览 + 清除。
 *  - 未承载:web 的 vision 类型(VisionAnalysis 自包含面板,PageClient 未给它任何生成回调,
 *    brief 的端点面也无 vision 端点)、以及 image 的 gemini/zhipu/ideogram/recraft/fal/freepik/edit、
 *    video 的 vidu/runway/luma/pixverse/zhipu/veo/one-click/sora2/agnes 等子面板
 *    (各自独立组件与端点,不在本席 12 端点面内),故不渲染这些 chips,避免死按钮。
 *  - 口径差:web 右侧 ResourceLibrary 资源库面板与内联 ImageViewer/VideoPlayer 改由
 *    RN 结果区「地址文本随手点开外部查看器」承载,不内嵌播放器。
 */
export function AiGenerationScreen({
  t,
  colorScheme,
  onBack,
  type,
  onTypeChange,
  modes,
  mode,
  onModeChange,
  prompt,
  onPromptChange,
  promptPlaceholderKey,
  generating,
  error,
  result,
  onSubmit,
  onClear,
  onOpenMedia,
  loginRequiredText,
}: AiGenerationScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackChevron onPress={onBack} label={t('common.back')} colorScheme={colorScheme} />
        <View style={styles.titleBox}>
          <View style={styles.titleRow}>
            <Sparkles size={20} color={tk.brand.DEFAULT} />
            <Text style={styles.title}>{t(`${NS}.pageTitle`)}</Text>
          </View>
          <Text style={styles.subtitle}>{t(`${NS}.pageSubtitle`)}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.chipRow}>
            {TYPE_TABS.map((tab) => {
              const active = tab.value === type
              return (
                <Pressable
                  key={tab.value}
                  style={[styles.chip, active ? styles.chipActive : null]}
                  onPress={() => onTypeChange(tab.value)}
                >
                  {tab.icon === 'image' ? (
                    <ImageIcon size={13} color={active ? tk.brand.DEFAULT : tk.text.secondary} />
                  ) : tab.icon === 'video' ? (
                    <Video size={13} color={active ? tk.brand.DEFAULT : tk.text.secondary} />
                  ) : tab.icon === 'box' ? (
                    <Box size={13} color={active ? tk.brand.DEFAULT : tk.text.secondary} />
                  ) : tab.icon === 'music' ? (
                    <Music4 size={13} color={active ? tk.brand.DEFAULT : tk.text.secondary} />
                  ) : tab.icon === 'voice' ? (
                    <Wand2 size={13} color={active ? tk.brand.DEFAULT : tk.text.secondary} />
                  ) : (
                    <Sparkles size={13} color={active ? tk.brand.DEFAULT : tk.text.secondary} />
                  )}
                  <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                    {t(`${NS}.${tab.labelKey}`)}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {modes.length > 0 ? (
            <View style={styles.chipRow}>
              {modes.map((m) => {
                const active = m.value === mode
                return (
                  <Pressable
                    key={m.value}
                    style={[styles.subChip, active ? styles.subChipActive : null]}
                    onPress={() => onModeChange(m.value)}
                  >
                    <Text style={[styles.subChipText, active ? styles.subChipTextActive : null]}>
                      {m.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          <TextInput
            style={styles.promptInput}
            placeholder={t(`${NS}.${promptPlaceholderKey}`)}
            placeholderTextColor={tk.text.tertiary}
            value={prompt}
            onChangeText={onPromptChange}
            multiline
          />

          <Pressable
            style={[styles.submitBtn, generating ? styles.submitBtnBusy : null]}
            onPress={onSubmit}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator size="small" color={tk.brand.ctaForeground} />
            ) : (
              <Sparkles size={16} color={tk.brand.ctaForeground} />
            )}
            <Text style={styles.submitText}>
              {generating ? t(`${NS}.generating`) : t(`${NS}.generate`)}
            </Text>
          </Pressable>

          {loginRequiredText ? <Text style={styles.muted}>{loginRequiredText}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.resultHead}>
            <Text style={styles.cardTitle}>{t(`${NS}.result`)}</Text>
            {result ? (
              <Pressable onPress={onClear}>
                <Text style={styles.clearText}>{t(`${NS}.clear`)}</Text>
              </Pressable>
            ) : null}
          </View>

          {generating ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="small" color={tk.brand.DEFAULT} />
              <Text style={styles.muted}>{t(`${NS}.generating`)}</Text>
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : result ? (
            result.kind === 'text' ? (
              <Text style={styles.resultText} selectable>
                {result.value}
              </Text>
            ) : (
              <Pressable onPress={() => onOpenMedia(result.value)}>
                <Text style={styles.mediaLink}>{result.value}</Text>
              </Pressable>
            )
          ) : (
            <Text style={styles.muted}>{t(`${NS}.noResult`)}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg, paddingHorizontal: rnSpacing.md },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.md,
      marginTop: rnSpacing.md,
    },
    titleBox: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: rnSpacing.sm },
    title: { fontSize: 20, fontWeight: '700', color: tk.text.primary },
    subtitle: { marginTop: 2, fontSize: rnType.label.size, color: tk.text.secondary },
    scroll: { flex: 1, marginTop: rnSpacing.md },
    scrollContent: { gap: rnSpacing.md, paddingBottom: rnSpacing['2xl'] },
    card: {
      gap: rnSpacing.sm,
      padding: rnSpacing.md,
      borderRadius: rnRadius.lg,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.card,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: rnSpacing.xs },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: rnSpacing.xs,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.xs,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.card,
    },
    chipActive: { borderColor: tk.brand.DEFAULT, backgroundColor: tk.surface.muted },
    chipText: { fontSize: rnType.label.size, color: tk.text.secondary },
    chipTextActive: { color: tk.text.primary, fontWeight: '600' },
    subChip: {
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: 2,
      borderRadius: rnRadius.sm,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.bg,
    },
    subChipActive: { borderColor: tk.brandAccent.deep, backgroundColor: tk.brandAccent.light },
    subChipText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    subChipTextActive: { color: tk.brandAccent.foreground, fontWeight: '600' },
    promptInput: {
      minHeight: 96,
      borderRadius: rnRadius.md,
      borderWidth: 1,
      borderColor: tk.border.medium,
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: rnSpacing.sm,
      paddingVertical: rnSpacing.sm,
      fontSize: rnType.body.size,
      color: tk.text.primary,
      textAlignVertical: 'top',
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.xs,
      alignSelf: 'flex-start',
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
      borderRadius: rnRadius.md,
      backgroundColor: tk.brand.cta,
    },
    submitBtnBusy: { opacity: 0.6 },
    submitText: { fontSize: rnType.label.size, fontWeight: '600', color: tk.brand.ctaForeground },
    resultHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: rnSpacing.sm,
    },
    cardTitle: { fontSize: rnType.body.size, fontWeight: '600', color: tk.text.primary },
    clearText: { fontSize: rnType.caption.size, color: tk.text.secondary },
    centerBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: rnSpacing.sm,
      paddingVertical: rnSpacing.xl,
    },
    muted: { fontSize: rnType.label.size, color: tk.text.secondary },
    error: { fontSize: rnType.label.size, color: tk.danger.DEFAULT },
    resultText: { fontSize: rnType.body.size, color: tk.text.primary },
    mediaLink: {
      fontSize: rnType.label.size,
      color: tk.brandAccent.deep,
      textDecorationLine: 'underline',
    },
  })
}
// vision 类型未承载:web 的 VisionAnalysis 是自包含面板(PageClient.tsx:151-152 无生成回调),
// brief 端点面亦无对应端点,故不在 TYPE_TABS 内——宁缺不造假入口。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
