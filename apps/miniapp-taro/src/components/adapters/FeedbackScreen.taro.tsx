// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 @tarojs/components 的 View/Text/Input/Textarea 组件,不适合共享层
import { useTt, type TtFn } from '@/i18n'
import { useCallback, useState } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import type { FeedbackScreenProps, FeedbackType, FeedbackSubmitPayload } from '@ihui/types'

/**
 * Taro 适配层:FeedbackScreen — 跨端共享「意见反馈」页。
 *
 * 复用 packages/app/src/features/feedback/FeedbackScreen 的 props 契约 + 状态机逻辑 +
 * 主题 token 注入,仅替换 RN 元素为 @tarojs/components 原语:
 * - View/Text → 对应 RN View/Text(直接复用,样式由 StyleSheet.create → CSSProperties 对象)
 * - TextInput(multiline)→ Taro `Textarea`
 * - TextInput(single-line)→ Taro `Input`
 * - TouchableOpacity → `View` + `onTap`
 * - placeholderTextColor(RN prop)→ `placeholderStyle`(Taro CSS 字符串)
 *
 * 配色:由 colorScheme prop 经 getRnTokens 解析为明/暗 token 集(与 packages/app/theme/tokens 同源,
 * mobile-rn 端 1:1 对齐)。
 *
 * i18n 三级降级:prop t(必传,FeedbackScreenProps.t)→ useTt()(I18nContext)→ FALLBACK_TEXT 硬编码中文。
 * i18n 键来源:@ihui/i18n/messages/shared/{zh-CN,en,ja,ko,zh-TW}.json 的 feedback 命名空间。
 */

/** 反馈类型清单(与源文件一致) */
const FEEDBACK_TYPES: FeedbackType[] = ['bug', 'suggestion', 'question', 'other']

/** i18n 键映射 — 消除 `t(`type_${var}`)` 动态拼接,与 shared i18n camelCase 键名对齐 */
const FEEDBACK_TYPE_KEYS: Record<FeedbackType, string> = {
  bug: 'feedback.typeBug',
  suggestion: 'feedback.typeSuggestion',
  question: 'feedback.typeQuestion',
  other: 'feedback.typeOther',
}

/** 硬编码中文 fallback(i18n 三级降级最末层,应对 prop t 与 I18nContext 均缺失翻译的场景) */
const FALLBACK_TEXT = (tt: TtFn): Record<string, string> => ({
  'common.back': tt('common.back', '返回'),
  'feedback.title': tt('setting.feedback', '意见反馈'),
  'feedback.type': tt('developer.index.typeLabel', '类型'),
  'feedback.typeBug': 'Bug',
  'feedback.typeSuggestion': tt('feedback.types.suggestion', '建议'),
  'feedback.typeQuestion': tt('ask.create.pageTitle', '提问'),
  'feedback.typeOther': tt('setting.other', '其他'),
  'feedback.content': tt('feedback.content', '内容'),
  'feedback.contentPlaceholder': tt('adaptersFeedbackScreentaro.d1', '请输入反馈内容...'),
  'feedback.contentRequired': tt('feedback.enterContent', '请输入反馈内容'),
  'feedback.contact': tt('adaptersFeedbackScreentaro.d2', '联系方式(可选)'),
  'feedback.contactPlaceholder': tt('about.help.phoneRequired', '请输入联系方式'),
  'feedback.submit': tt('common.submit', '提交'),
  'feedback.submitting': tt('about.help.submitting', '提交中...'),
  'feedback.success': tt('feedback.success', '提交成功,感谢您的反馈!'),
  'feedback.failed': tt('feedback.failed', '提交失败,请稍后重试'),
})

/** Taro `rpx` 单位换算(1px = 2rpx,750 设计稿基准) */
const toRpx = (px: number): string => `${px * 2}rpx`

// ============ 样式函数(独立函数返回 CSSProperties,避免联合类型) ============

const containerStyle = (tk: RnThemeTokens): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: tk.surface.bg,
})

const headerStyle = (): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  paddingTop: toRpx(12),
  paddingBottom: toRpx(12),
  paddingLeft: toRpx(16),
  paddingRight: toRpx(16),
})

const backBtnStyle = (): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: toRpx(12),
  cursor: 'pointer',
})

const backTextStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(14),
  color: tk.text.medium,
})

const titleStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(18),
  fontWeight: 600,
  color: tk.text.primary,
})

const bodyStyle = (): CSSProperties => ({
  padding: toRpx(16),
})

const cardStyle = (tk: RnThemeTokens): CSSProperties => ({
  padding: toRpx(16),
  borderRadius: toRpx(8),
  backgroundColor: tk.surface.card,
})

const labelStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(12),
  color: tk.text.secondary,
  marginTop: toRpx(8),
})

const typeRowStyle = (): CSSProperties => ({
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: toRpx(8),
  marginTop: toRpx(6),
})

const typeBtnStyle = (tk: RnThemeTokens, active: boolean): CSSProperties => ({
  paddingLeft: toRpx(12),
  paddingRight: toRpx(12),
  paddingTop: toRpx(6),
  paddingBottom: toRpx(6),
  borderRadius: toRpx(8),
  backgroundColor: active ? tk.brand.DEFAULT : tk.surface.muted,
})

const typeTextStyle = (tk: RnThemeTokens, active: boolean): CSSProperties => ({
  fontSize: toRpx(12),
  color: active ? tk.surface.light : tk.text.secondary,
})

const textareaStyle = (tk: RnThemeTokens): CSSProperties => ({
  marginTop: toRpx(4),
  minHeight: toRpx(80),
  padding: toRpx(8),
  borderRadius: toRpx(8),
  backgroundColor: tk.surface.muted,
  color: tk.text.primary,
  fontSize: toRpx(13),
})

const inputStyle = (tk: RnThemeTokens): CSSProperties => ({
  marginTop: toRpx(4),
  padding: toRpx(8),
  borderRadius: toRpx(8),
  backgroundColor: tk.surface.muted,
  color: tk.text.primary,
  fontSize: toRpx(13),
})

const errorTextStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(12),
  color: tk.danger.DEFAULT,
  marginTop: toRpx(8),
})

const successTextStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(12),
  color: tk.success.DEFAULT,
  marginTop: toRpx(8),
})

const submitBtnStyle = (tk: RnThemeTokens, disabled: boolean): CSSProperties => ({
  marginTop: toRpx(12),
  paddingTop: toRpx(10),
  paddingBottom: toRpx(10),
  borderRadius: toRpx(8),
  backgroundColor: tk.brand.DEFAULT,
  alignItems: 'center',
  opacity: disabled ? 0.6 : 1,
})

const submitTextStyle = (tk: RnThemeTokens): CSSProperties => ({
  fontSize: toRpx(13),
  fontWeight: 600,
  color: tk.surface.light,
})

// ============ 组件 ============

export function FeedbackScreen({
  t,
  onSubmit,
  onBack,
  colorScheme = 'light',
}: FeedbackScreenProps) {
  const [type, setType] = useState<FeedbackType>('bug')
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const tt = useTt()
  const tk = getRnTokens(colorScheme)

  /** i18n 三级降级:prop t → I18nContext(useTt)→ FALLBACK_TEXT(tt) 硬编码中文 */
  const tr = useCallback(
    (key: string): string => {
      const v = t(key)
      if (v && v !== key) return v
      return tt(key, FALLBACK_TEXT(tt)[key] ?? key)
    },
    [t, tt],
  )

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      setError(tr('feedback.contentRequired'))
      setSuccess('')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      const payload: FeedbackSubmitPayload = {
        type,
        content: content.trim(),
        contact: contact.trim(),
      }
      const ok = await onSubmit(payload)
      if (ok) {
        setSuccess(tr('feedback.success'))
        setContent('')
        setContact('')
      } else {
        setError(tr('feedback.failed'))
      }
    } catch {
      setError(tr('feedback.failed'))
    } finally {
      setSubmitting(false)
    }
  }, [content, contact, type, onSubmit, tr])

  return (
    <View style={containerStyle(tk)}>
      <View style={headerStyle()}>
        <View onTap={onBack} style={backBtnStyle()}>
          <Text style={backTextStyle(tk)}>{tr('common.back')}</Text>
        </View>
        <Text style={titleStyle(tk)}>{tr('feedback.title')}</Text>
      </View>

      <View style={bodyStyle()}>
        <View style={cardStyle(tk)}>
          <Text style={labelStyle(tk)}>{tr('feedback.type')}</Text>
          <View style={typeRowStyle()}>
            {FEEDBACK_TYPES.map((tp) => (
              <View key={tp} onTap={() => setType(tp)} style={typeBtnStyle(tk, type === tp)}>
                <Text style={typeTextStyle(tk, type === tp)}>{tr(FEEDBACK_TYPE_KEYS[tp])}</Text>
              </View>
            ))}
          </View>

          <Text style={labelStyle(tk)}>{tr('feedback.content')}</Text>
          <Textarea
            value={content}
            onInput={(e) => setContent(e.detail.value)}
            placeholder={tr('feedback.contentPlaceholder')}
            placeholderStyle={`color: ${tk.text.tertiary}`}
            maxlength={-1}
            style={textareaStyle(tk)}
          />

          <Text style={labelStyle(tk)}>{tr('feedback.contact')}</Text>
          <Input
            value={contact}
            onInput={(e) => setContact(e.detail.value)}
            placeholder={tr('feedback.contactPlaceholder')}
            placeholderStyle={`color: ${tk.text.tertiary}`}
            maxlength={-1}
            style={inputStyle(tk)}
          />

          {error ? <Text style={errorTextStyle(tk)}>{error}</Text> : null}
          {success ? <Text style={successTextStyle(tk)}>{success}</Text> : null}

          <View
            onTap={submitting ? undefined : handleSubmit}
            style={submitBtnStyle(tk, submitting)}
          >
            <Text style={submitTextStyle(tk)}>
              {submitting ? tr('feedback.submitting') : tr('feedback.submit')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export type { FeedbackScreenProps, FeedbackType, FeedbackSubmitPayload }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
