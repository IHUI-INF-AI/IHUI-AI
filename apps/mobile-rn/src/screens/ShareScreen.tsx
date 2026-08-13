/**
 * ShareScreen 分享页(mobile-rn 端)
 *
 * 对齐历史项目 pages/table/share/index.vue(AI 资讯 / 分享入口):
 * - Uniapp 原始页面是 AI 资讯内容页(NavigationBars + TitleSwitch + DrawerComponent + float-box)
 * - RN 复刻:从 Loading 占位跳转升级为完整分享页,接入 4 个"写了但没用"组件:
 *   ① AgentRuntimePanel — 展示 AI Agent 运行时内容(可分享的 AI 生成结果)
 *   ② VoiceInput — 语音输入分享描述(expo-audio 录音 + ai-service STT 转文字)
 *   ③ PrivacyPolicyModal — 分享前隐私政策弹窗(用户同意后才执行分享)
 *   ④ FloatBox — 分享结果悬浮提示(success / error / info)
 * - NavBar(标题「分享」+ 返回)
 * - 浅色优雅风,getRnTokens 支持暗色模式;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { AgentRuntimePanel } from '../components/AgentRuntimePanel'
import { VoiceInput } from '../components/VoiceInput'
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface FloatBoxState {
  visible: boolean
  type: FloatBoxType
  message: string
}

const FLOAT_BOX_DEFAULT: FloatBoxState = { visible: false, type: 'info', message: '' }

export function ShareScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [showPrivacy, setShowPrivacy] = useState(false)
  const [floatBox, setFloatBox] = useState<FloatBoxState>(FLOAT_BOX_DEFAULT)
  const [voiceText, setVoiceText] = useState('')

  const handleShare = (): void => {
    setShowPrivacy(true)
  }

  const handleAgreePrivacy = (): void => {
    setShowPrivacy(false)
    setFloatBox({ visible: true, type: 'success', message: '分享成功' })
  }

  const handleVoiceComplete = (text: string): void => {
    setVoiceText(text)
    if (text) {
      setFloatBox({ visible: true, type: 'info', message: '语音输入完成' })
    }
  }

  const handleFloatBoxHide = (): void => {
    setFloatBox((prev) => ({ ...prev, visible: false }))
  }

  return (
    <View style={styles.container}>
      <NavBar title={t('share.title')} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* AgentRuntimePanel — AI Agent 运行时内容(可分享的 AI 生成结果) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('share.aiContent')}</Text>
          <AgentRuntimePanel />
        </View>

        {/* VoiceInput — 语音输入分享描述 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('share.voiceInput')}</Text>
          <VoiceInput
            onComplete={handleVoiceComplete}
            onChange={setVoiceText}
            placeholder={t('share.voicePlaceholder')}
          />
          {voiceText ? (
            <Text style={styles.voiceText} numberOfLines={3}>
              {voiceText}
            </Text>
          ) : null}
        </View>

        {/* 分享按钮 — 点击后弹出隐私政策弹窗 */}
        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed ? styles.shareBtnPressed : null]}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={t('share.submit')}
        >
          <Text style={styles.shareBtnText}>{t('share.submit')}</Text>
        </Pressable>
      </ScrollView>

      {/* PrivacyPolicyModal — 分享前隐私政策弹窗 */}
      <PrivacyPolicyModal visible={showPrivacy} onAgree={handleAgreePrivacy} />

      {/* FloatBox — 分享结果悬浮提示 */}
      <FloatBox
        visible={floatBox.visible}
        type={floatBox.type}
        message={floatBox.message}
        onHide={handleFloatBoxHide}
      />
    </View>
  )
}

function createStyles(tk: RnThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    scroll: {
      flex: 1,
    } as ViewStyle,
    scrollContent: {
      padding: 16,
      gap: 16,
      paddingBottom: 48,
    } as ViewStyle,
    section: {
      backgroundColor: tk.surface.card,
      borderRadius: 12,
      padding: 12,
      gap: 8,
    } as ViewStyle,
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.text.primary,
    } as TextStyle,
    voiceText: {
      fontSize: 14,
      color: tk.text.secondary,
      lineHeight: 20,
      marginTop: 4,
    } as TextStyle,
    shareBtn: {
      height: 46,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    } as ViewStyle,
    shareBtnPressed: {
      opacity: 0.85,
    } as ViewStyle,
    shareBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: tk.surface.light,
    } as TextStyle,
  })
}

export default ShareScreen
