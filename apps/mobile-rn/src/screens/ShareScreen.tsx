/**
 * ShareScreen 分享页(mobile-rn 端)
 *
 * 对齐历史项目 pages/table/share/index.vue(AI 资讯 / 分享入口):
 * - Uniapp 原始页面是 AI 资讯内容页(NavigationBars + TitleSwitch + DrawerComponent + float-box)
 * - RN 复刻:从 Loading 占位跳转升级为完整分享页,接入 5 个"写了但没用"组件:
 *   ① AgentRuntimePanel — 展示 AI Agent 运行时内容(可分享的 AI 生成结果)
 *   ② VoiceInput — 语音输入分享描述(expo-audio 录音 + ai-service STT 转文字)
 *   ③ PrivacyPolicyModal — 分享前隐私政策弹窗(用户同意后才执行分享)
 *   ④ FloatBox — 分享结果悬浮提示(success / error / info)
 *   ⑤ Drawer — 侧滑抽屉(对齐 Uniapp share/index.vue DrawerComponentall,NavBar 菜单按钮触发)
 * - 分享功能:接 RN Share API(首次需同意隐私政策,同意后直接分享)
 * - 素材选择:expo-image-picker 选图作为分享素材
 * - NavBar(标题「分享」+ 返回)
 * - 浅色优雅风,getRnTokens 支持暗色模式;圆角守门(无 rounded-full);无分割线(gap 间距)
 */
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import Clipboard from '@react-native-clipboard/clipboard'
import { getRnTokens, type RnThemeTokens } from '@ihui/design-tokens'
import { ShareScreen as SharedShareScreen } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { AgentRuntimePanel } from '../components/AgentRuntimePanel'
import { VoiceInput } from '../components/VoiceInput'
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { mainScreenForTab, type MainTabKey } from '../navigation/tab-utils'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface FloatBoxState {
  visible: boolean
  type: FloatBoxType
  message: string
}

const FLOAT_BOX_DEFAULT: FloatBoxState = { visible: false, type: 'info', message: '' }

/** Drawer 5 主菜单 → RN Tab 路由映射(对齐 Uniapp share/index.vue 行 5 DrawerComponentall 主菜单跳转) */
const DRAWER_TAB_TO_RN_TAB: Record<DrawerTab, MainTabKey> = {
  home: 'HomeMain',
  ai: 'AiMain',
  square: 'HomeMain',
  share: 'HomeMain',
  mine: 'ProfileMain',
}

/** 飞书免费资料链接(对齐 Uniapp lingqu → 复制链接) */
const FREE_RESOURCE_URL = 'https://ihui.feishu.cn/wiki/'

export function ShareScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const tk = getRnTokens(resolvedTheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [showPrivacy, setShowPrivacy] = useState(false)
  const [agreedPrivacy, setAgreedPrivacy] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [imageUri, setImageUri] = useState('')
  const [floatBox, setFloatBox] = useState<FloatBoxState>(FLOAT_BOX_DEFAULT)
  const [voiceText, setVoiceText] = useState('')
  // Drawer 侧滑抽屉(对齐 Uniapp share/index.vue 行 5 DrawerComponentall,
  // 由 NavBar 菜单按钮触发;历史对话列表待 API 接入,先传空数组占位,对齐 AgentScreen 做法)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations] = useState<DrawerConversationItem[]>([])

  // ── Drawer 回调(对齐 AgentScreen 接入惯例) ──
  const closeDrawer = (): void => setDrawerVisible(false)
  const handleDrawerNavigate = (tab: DrawerTab): void => {
    setDrawerVisible(false)
    if (tab === 'square') {
      navigation.navigate('Square')
      return
    }
    if (tab === 'share') return // 已在分享页,仅收起抽屉
    navigation.navigate('Main', { screen: mainScreenForTab(DRAWER_TAB_TO_RN_TAB[tab]) })
  }
  const handleDrawerNavigateCompany = (): void => {
    setDrawerVisible(false)
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = (): void => {
    setDrawerVisible(false)
    try {
      Clipboard.setString(FREE_RESOURCE_URL)
      setFloatBox({ visible: true, type: 'success', message: '链接已复制到剪贴板' })
    } catch {
      setFloatBox({ visible: true, type: 'error', message: '复制失败,请重试' })
    }
  }
  const handleDrawerCreateNewChat = (): void => {
    setDrawerVisible(false)
    navigation.navigate('AiAssistant')
  }
  const handleDrawerSelectConversation = (id: string): void => {
    setDrawerVisible(false)
    const conv = drawerConversations.find((c) => c.id === id)
    navigation.navigate('AiAssistant', { agentId: id, title: conv?.title })
  }
  const handleDrawerDeleteConversation = (): void => {
    Alert.alert('删除对话', '确认删除此对话?', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => setFloatBox({ visible: true, type: 'info', message: '删除功能待 API 接入' }),
      },
    ])
  }
  const handleDrawerOpenSettings = (): void => {
    setDrawerVisible(false)
    navigation.navigate('Settings')
  }
  const handleDrawerOpenMessages = (): void => {
    setDrawerVisible(false)
    navigation.navigate('MessageCenter')
  }
  const handleDrawerGoHome = (): void => {
    setDrawerVisible(false)
    navigation.navigate('Main', { screen: 'HomeMain' })
  }
  const handleNavigateExtra = (menu: DrawerExtraMenu): void => {
    setDrawerVisible(false)
    switch (menu) {
      case 'aigc':
        navigation.navigate('AigcList')
        break
      case 'learn':
        navigation.navigate('Learn')
        break
      case 'modelPlaza':
        navigation.navigate('ModelPlaza')
        break
      case 'company':
        navigation.navigate('Distribution')
        break
      case 'tools':
        navigation.navigate('Settings')
        break
    }
  }

  const drawerUser = {
    avatar: user?.avatar,
    nickname: user?.nickname ?? user?.username ?? '未登录',
    level: (user?.isVip === 1 ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  const doShare = async (): Promise<void> => {
    const lines = [voiceText, imageUri].filter(Boolean)
    const message = lines.length > 0 ? lines.join('\n') : '来看看这个 AI 内容'
    setSharing(true)
    try {
      const result = await Share.share({ title: '分享', message })
      if (result.action === Share.sharedAction) {
        setFloatBox({ visible: true, type: 'success', message: '分享成功' })
      } else {
        setFloatBox({ visible: true, type: 'info', message: '已取消分享' })
      }
    } catch (err) {
      setFloatBox({
        visible: true,
        type: 'error',
        message: err instanceof Error ? err.message : '分享失败',
      })
    } finally {
      setSharing(false)
    }
  }

  const handleShare = (): void => {
    if (sharing) return
    if (!agreedPrivacy) {
      setShowPrivacy(true)
      return
    }
    void doShare()
  }

  const handleAgreePrivacy = (): void => {
    setAgreedPrivacy(true)
    setShowPrivacy(false)
    void doShare()
  }

  const pickImage = async (): Promise<void> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('提示', '需要相册权限才能选择图片')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })
    if (!result.canceled) {
      const asset = result.assets[0]
      if (asset?.uri) {
        setImageUri(asset.uri)
      }
    }
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
    <>
      <SharedShareScreen
        t={t}
        targetTitle=""
        remark=""
        result={null}
        loading={sharing}
        error=""
        onRemarkChange={() => {}}
        onCreate={() => {}}
        onShare={handleShare}
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
        containerStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
        renderHeader={() => (
          <NavBar
            title={t('share.title')}
            onBack={() => navigation.goBack()}
            leftActions={[{ icon: '☰', label: '菜单', onPress: () => setDrawerVisible(true) }]}
          />
        )}
        renderContent={() => (
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

            {/* 分享素材 — expo-image-picker 选图 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>分享素材</Text>
              {imageUri ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                  <Pressable
                    style={({ pressed }) => [
                      styles.clearBtn,
                      pressed ? styles.clearBtnPressed : null,
                    ]}
                    onPress={() => setImageUri('')}
                    accessibilityRole="button"
                    accessibilityLabel="删除图片"
                  >
                    <Text style={styles.clearText}>×</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerBox,
                    pressed ? styles.pickerBoxPressed : null,
                  ]}
                  onPress={pickImage}
                  accessibilityRole="button"
                  accessibilityLabel="选择图片"
                >
                  <Text style={styles.pickerIcon}>+</Text>
                  <Text style={styles.pickerHint}>点击选择图片</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        )}
        renderFooter={() => (
          <View style={styles.bottomBar}>
            <Pressable
              style={({ pressed }) => [styles.shareBtn, pressed ? styles.shareBtnPressed : null]}
              onPress={handleShare}
              disabled={sharing}
              accessibilityRole="button"
              accessibilityLabel={t('share.submit')}
            >
              {sharing ? (
                <ActivityIndicator color={tk.surface.light} />
              ) : (
                <Text style={styles.shareBtnText}>{t('share.submit')}</Text>
              )}
            </Pressable>
          </View>
        )}
      />

      {/* PrivacyPolicyModal — 分享前隐私政策弹窗 */}
      <PrivacyPolicyModal visible={showPrivacy} onAgree={handleAgreePrivacy} />

      {/* FloatBox — 分享结果悬浮提示 */}
      <FloatBox
        visible={floatBox.visible}
        type={floatBox.type}
        message={floatBox.message}
        onHide={handleFloatBoxHide}
      />

      {/* Drawer 侧滑抽屉(对齐 Uniapp share/index.vue 行 5 DrawerComponentall:
          主菜单导航/一人公司/领取资料/创建新对话/历史对话/设置/消息/回主页) */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        user={drawerUser}
        conversations={drawerConversations}
        onNavigate={handleDrawerNavigate}
        onNavigateExtra={handleNavigateExtra}
        onNavigateCompany={handleDrawerNavigateCompany}
        onClaimFree={handleDrawerClaimFree}
        onCreateNewChat={handleDrawerCreateNewChat}
        onSelectConversation={handleDrawerSelectConversation}
        onDeleteConversation={handleDrawerDeleteConversation}
        onOpenSettings={handleDrawerOpenSettings}
        onOpenMessages={handleDrawerOpenMessages}
        onGoHome={handleDrawerGoHome}
      />
    </>
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
      paddingBottom: 24,
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
    pickerBox: {
      height: 100,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    pickerBoxPressed: {
      opacity: 0.85,
    } as ViewStyle,
    pickerIcon: {
      fontSize: 28,
      color: tk.text.tertiary,
    } as TextStyle,
    pickerHint: {
      fontSize: 12,
      color: tk.text.tertiary,
    } as TextStyle,
    previewWrap: {
      position: 'relative',
      borderRadius: 8,
      overflow: 'hidden',
    } as ViewStyle,
    preview: {
      width: '100%',
      height: 160,
      borderRadius: 8,
    } as ImageStyle,
    clearBtn: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    clearBtnPressed: {
      opacity: 0.85,
    } as ViewStyle,
    clearText: {
      fontSize: 16,
      color: tk.surface.light,
      lineHeight: 18,
    } as TextStyle,
    bottomBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: tk.surface.bg,
    } as ViewStyle,
    shareBtn: {
      height: 46,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
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
