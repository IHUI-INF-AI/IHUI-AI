/**
 * AiAssistantN8nScreen AI 助手对话(mobile-rn 端,流式版)
 *
 * 对齐历史 Uniapp pages/tools/ai_assistant_n8n.vue 的对话核心:
 * - NavBar「AI 助手」+ 返回 + 菜单入口(打开 Drawer)
 *   (对齐 Uniapp page_title:路由 title/modelName 参数优先,缺省 i18n;
 *    对齐 Uniapp onLoad options.agentId / modelNamea)
 * - 消息列表:FlatList 渲染气泡(user 右 / assistant 左)
 * - 输入区:InputArea(共享组件)+ 发送/停止按钮(对齐 Uniapp BottomActionBar 输入部分)
 * - 流式输出:复用 streamChat(@ihui/api-client)SSE 端点 + agentId 绑定 N8n 工作流;
 *   onDelta 累积实时更新最后一条 assistant 消息(对齐 Uniapp onMessage 累积 data.content)
 * - 模型选择器:ModelList(共享组件)底部弹出,单选切换模型(对齐 Uniapp ModelList + pitchHandle);
 *   InputArea 上方 modelBar 展示当前模型名,点击展开选择器;
 *   路由参数 modelId 优先初始化选中模型(对齐 Uniapp onLoad options.modelNamea)
 * - 图片预览:assistant 回复中提取图片 URL(对齐 Uniapp processContent + imgUrlList),
 *   渲染缩略图,点击 ImagePreviewModal 全屏预览(对齐 Uniapp previewImage)
 * - 无 agentId → 模拟响应 + Alert(对齐 Uniapp onLoad 无 agentId 不调 processN8nAgent)
 * - Drawer 集成:历史对话入口(对齐任务要求"Drawer 集成:历史对话入口"),
 *   复用 @ihui/rn-app Drawer 组件 + listConversations/getMessages/deleteConversation API;
 *   NavBar 右侧菜单按钮打开 Drawer,Drawer 内选择历史对话 → 加载消息,
 *   创建新对话 → 清空当前消息(对齐 ChatScreen Drawer 集成模式)
 * - 路由参数:{ agentId?: string; title?: string; conversationId?: string; modelName?: string; modelId?: string }
 *   (对齐 Uniapp onLoad options: agentId / modelNamea / pitcha / type)
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
  type ListRenderItem,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { mainScreenForTab } from '../navigation/RootNavigator'
import {
  deleteConversation,
  formatSSEError,
  getMessages,
  listConversations,
  streamChat,
  type ConversationDetail,
} from '@ihui/api-client'
import { FALLBACK_MODELS } from '@ihui/shared'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { NavBar } from '../components/NavBar'
import { InputArea } from '../components/InputArea'
import ModelList, { type ModelListGroup } from '../components/ModelList'
import ImagePreviewModal from '../components/ImagePreviewModal'
import Drawer, {
  type DrawerConversationItem,
  type DrawerExtraMenu,
  type DrawerTab,
} from '../components/Drawer'
import Empty from '../components/common/Empty'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { MainTabKey, RootStackParamList } from '../navigation/RootNavigator'

type LocalParamList = RootStackParamList & {
  AiAssistantN8n: {
    agentId?: string
    title?: string
    conversationId?: string
    modelName?: string
    modelId?: string
  }
}
type N8nRouteProp = RouteProp<LocalParamList, 'AiAssistantN8n'>
type NavigationProp = NativeStackNavigationProp<LocalParamList>
type RootNav = NativeStackNavigationProp<RootStackParamList>

interface N8nMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** assistant 回复中提取的图片 URL 列表(对齐 Uniapp imgUrlList) */
  images?: string[]
}

// ── 图片 URL 提取(对齐 Uniapp processContent + isValidImageUrl)──

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i

function isValidImageUrl(url: string): boolean {
  if (!/^https?:\/\/.+/.test(url)) return false
  // noUncheckedIndexedAccess:数组下标访问需兜底
  const path = (url.split('#')[0] ?? '').split('?')[0] ?? ''
  return IMAGE_EXT_RE.test(path) || /volces\.com|fyshark\.com|tos-cn-beijing/i.test(url)
}

/** 从文本内容提取图片 URL(markdown ![](url) + 裸 URL,对齐 Uniapp processContent) */
function extractImageUrls(content: string): string[] {
  if (!content) return []
  const urls = new Set<string>()
  // 1. Markdown 图片:![alt](url)
  const mdRe = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = mdRe.exec(content)) !== null) {
    const u = m[1]
    if (u && isValidImageUrl(u)) urls.add(u)
  }
  // 2. 裸 URL(带图片扩展名)
  const urlRe = /https?:\/\/[^\s)<>]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)(?:\?[^\s)]*)?/gi
  while ((m = urlRe.exec(content)) !== null) {
    const u = m[0]
    if (u && isValidImageUrl(u)) urls.add(u)
  }
  return Array.from(urls)
}

/** 把 API 返回的 ConversationDetail 映射为 DrawerConversationItem(对齐 ChatScreen) */
function mapConversationToDrawer(c: ConversationDetail): DrawerConversationItem {
  const tsStr = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  const createdAt = tsStr ? new Date(tsStr).getTime() : Date.now()
  const mdl = c.model ?? ''
  return {
    id: c.id,
    title: c.title?.trim() || '未命名对话',
    modelConfig: mdl ? { id: mdl, name: mdl, icon: undefined } : undefined,
    createdAt,
  }
}

interface MessageBubbleProps {
  message: N8nMessage
  onPreviewImage: (url: string) => void
}

function MessageBubble({ message, onPreviewImage }: MessageBubbleProps): React.JSX.Element {
  const isUser = message.role === 'user'
  const hasImages = !isUser && message.images && message.images.length > 0
  return (
    <View style={[bubbleStyles.row, isUser ? bubbleStyles.rowUser : bubbleStyles.rowAi]}>
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.bubbleUser : bubbleStyles.bubbleAi]}>
        {message.content ? (
          <Text style={[bubbleStyles.text, isUser ? bubbleStyles.textUser : bubbleStyles.textAi]}>
            {message.content}
          </Text>
        ) : null}
        {hasImages ? (
          <View style={bubbleStyles.imageGrid}>
            {message.images!.map((url, i) => (
              <TouchableOpacity
                key={`${url}-${i}`}
                activeOpacity={0.85}
                onPress={() => onPreviewImage(url)}
              >
                <Image source={{ uri: url }} style={bubbleStyles.chatImage} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default function AiAssistantN8nScreen() {
  const { t } = useI18n()
  const { user: authUser } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const rootNav = navigation.getParent<RootNav>()
  const route = useRoute<N8nRouteProp>()
  const agentId = route.params?.agentId
  // 路由 title 参数优先(对齐 Uniapp page_title:matchedAgent.agentName / modelNamea)
  const navTitle = route.params?.title ?? route.params?.modelName ?? t('aiAssistantN8n.title')
  const routeConversationId = route.params?.conversationId

  const listRef = useRef<FlatList<N8nMessage> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const idCounter = useRef(0)
  const nextId = (): string => `n8n-${++idCounter.current}`

  const [messages, setMessages] = useState<N8nMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // 当前对话 ID(从路由传入或后续选择历史对话时更新,用于 streamChat metadata)
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(
    routeConversationId,
  )

  // 模型选择器(对齐 Uniapp modelList + pitch + pitchHandle)
  // 路由参数 modelId 优先初始化(对齐 Uniapp onLoad options.modelNamea)
  const [selectedModelId, setSelectedModelId] = useState<string>(
    route.params?.modelId ?? FALLBACK_MODELS[0]?.value ?? 'stepfun/step-router-v1',
  )
  const [showModelPicker, setShowModelPicker] = useState(false)

  // 图片预览(对齐 Uniapp previewImage)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // FloatBox 浮层提示状态(替代单按钮 Alert.alert 的非阻塞反馈,对齐 ChatScreen showToast 模式)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastType, setToastType] = useState<FloatBoxType>('info')
  const [toastMessage, setToastMessage] = useState('')
  const showToast = useCallback((type: FloatBoxType, message: string): void => {
    setToastType(type)
    setToastMessage(message)
    setToastVisible(true)
  }, [])
  const hideToast = useCallback((): void => setToastVisible(false), [])

  // Drawer 历史对话(对齐任务要求"Drawer 集成:历史对话入口")
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerConversations, setDrawerConversations] = useState<DrawerConversationItem[]>([])
  const [drawerConversationsLoaded, setDrawerConversationsLoaded] = useState(false)

  // ModelList 分组数据(单 vendor 分组,FALLBACK_MODELS → ModelListItem)
  const modelGroups: ModelListGroup[] = useMemo(
    () => [
      {
        vendor: t('chat.modelLabel'),
        models: FALLBACK_MODELS.map((m) => ({
          id: m.value,
          name: m.label,
          description: m.vendor,
          icon: '🤖',
          isFree: (m.pointsMultiplier ?? 1) === 0,
        })),
      },
    ],
    [t],
  )

  const selectedModelLabel = useMemo(() => {
    const m = FALLBACK_MODELS.find((item) => item.value === selectedModelId)
    return m?.label ?? selectedModelId
  }, [selectedModelId])

  const previewSource: ImageSourcePropType | null = previewImage ? { uri: previewImage } : null

  const scrollToEnd = (): void => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true })
    })
  }

  // ── Drawer 历史对话加载(懒加载,首次打开 Drawer 时拉取) ──
  const loadDrawerConversations = useCallback(async (): Promise<void> => {
    const res = await listConversations({ page: 1, pageSize: 50 })
    if (res.success) {
      setDrawerConversations(res.data.conversations.map(mapConversationToDrawer))
    } else {
      setDrawerConversations([])
    }
    setDrawerConversationsLoaded(true)
  }, [])

  useEffect(() => {
    if (drawerVisible && !drawerConversationsLoaded && authUser) {
      void loadDrawerConversations()
    }
  }, [drawerVisible, drawerConversationsLoaded, authUser, loadDrawerConversations])

  // ── 加载历史对话消息(对齐 ChatScreen loadConversationMessages) ──
  const loadConversationMessages = useCallback(async (id: string): Promise<void> => {
    const res = await getMessages(id, { page: 1, pageSize: 100 })
    if (res.success) {
      const loaded: N8nMessage[] = res.data.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m, idx) => ({
          id: `${m.id}-${idx}`,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      setMessages(loaded)
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true })
      })
    }
  }, [])

  // 从路由 conversationId 加载历史对话(对齐 Uniapp onLoad 有 agentId 时拉取历史)
  useEffect(() => {
    if (routeConversationId) {
      void loadConversationMessages(routeConversationId)
    }
  }, [routeConversationId, loadConversationMessages])

  const onSend = async (text: string): Promise<void> => {
    if (!text || sending) return
    setInput('')
    const userMsg: N8nMessage = { id: nextId(), role: 'user', content: text }
    const aiMsg: N8nMessage = { id: nextId(), role: 'assistant', content: '' }
    setMessages((prev) => [...prev, userMsg, aiMsg])
    setSending(true)
    scrollToEnd()

    // 无 agentId:模拟响应(对齐 Uniapp onLoad 无 agentId 不调 processN8nAgent)
    if (!agentId) {
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          next[next.length - 1] = { ...last, content: t('aiAssistantN8n.mockResponse') }
        }
        return next
      })
      setSending(false)
      // 对齐 Uniapp uni.showToast + 任务要求 #2(toast 用 FloatBox);保留 info 类型避免阻塞
      showToast('info', t('aiAssistantN8n.mockResponse'))
      return
    }

    // 有 agentId:复用 streamChat SSE 流式(对齐 Uniapp connectSocket + onMessage 累积)
    const controller = new AbortController()
    abortRef.current = controller

    await streamChat({
      model: selectedModelId,
      messages: [{ role: 'user', content: text }],
      agentId,
      signal: controller.signal,
      metadata: currentConversationId ? { conversationId: currentConversationId } : undefined,
      onDelta: (delta) => {
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + delta }
          }
          return next
        })
        scrollToEnd()
      },
      onError: (err) => {
        const formatted = formatSSEError(new Error(err))
        setSending(false)
        abortRef.current = null
        // 空回复时填充错误提示
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant' && !last.content) {
            next[next.length - 1] = { ...last, content: t('aiAssistantN8n.callFailed') }
          }
          return next
        })
        // 对齐 Uniapp uni.showToast + 任务要求 #2(error toast 用 FloatBox 替代 Alert.alert)
        const errMsg = formatted.message
          ? `${formatted.title}: ${formatted.message}`
          : formatted.title
        showToast('error', errMsg)
      },
      onDone: () => {
        setSending(false)
        abortRef.current = null
        // 流结束后提取回复中的图片 URL(对齐 Uniapp imgUrlList + processContent)
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            const imgs = extractImageUrls(last.content)
            if (imgs.length > 0) {
              next[next.length - 1] = { ...last, images: imgs }
            }
          }
          return next
        })
      },
    })
  }

  const onStop = (): void => {
    abortRef.current?.abort()
    abortRef.current = null
    setSending(false)
  }

  // 模型切换(对齐 Uniapp pitchHandle:index → modelName)
  const handleModelSelect = (ids: string[]): void => {
    const id = ids[0]
    if (id) {
      setSelectedModelId(id)
    }
    setShowModelPicker(false)
  }

  const handlePreviewImage = (url: string): void => {
    setPreviewImage(url)
  }

  // ── Drawer 回调(对齐 ChatScreen Drawer 集成模式) ──
  const closeDrawer = (): void => setDrawerVisible(false)
  const handleDrawerNavigate = (tab: DrawerTab): void => {
    if (tab === 'square') {
      navigation.navigate('Square')
      return
    }
    if (tab === 'share') {
      navigation.navigate('Share')
      return
    }
    const rnTab: MainTabKey = tab as MainTabKey
    rootNav?.navigate('Main', { screen: mainScreenForTab(rnTab) })
  }
  const handleDrawerNavigateCompany = (): void => {
    navigation.navigate('Distribution')
  }
  const handleDrawerClaimFree = (): void => {
    // 占位:领取免费资料(对齐 ChatScreen,后续接入真实链接)
  }
  const handleDrawerCreateNewChat = (): void => {
    setMessages([])
    setInput('')
    setCurrentConversationId(undefined)
  }
  const handleDrawerSelectConversation = (id: string): void => {
    setDrawerVisible(false)
    setCurrentConversationId(id)
    void loadConversationMessages(id)
  }
  const handleDrawerDeleteConversation = (id: string): void => {
    Alert.alert('删除对话', '确认删除此对话?', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认',
        style: 'destructive',
        onPress: () => {
          const snapshot = drawerConversations
          setDrawerConversations((prev) => prev.filter((c) => c.id !== id))
          void (async () => {
            const res = await deleteConversation(id)
            if (!res.success) {
              setDrawerConversations(snapshot)
            }
          })()
        },
      },
    ])
  }
  const handleDrawerOpenSettings = (): void => {
    navigation.navigate('Settings')
  }
  const handleDrawerOpenMessages = (): void => {
    navigation.navigate('MessageCenter')
  }
  const handleDrawerGoHome = (): void => {
    navigation.navigate('Main', { screen: 'HomeMain' })
  }
  const handleNavigateExtra = (menu: DrawerExtraMenu): void => {
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
      case 'tools':
        navigation.navigate('AiAssistant')
        break
      case 'company':
        navigation.navigate('Distribution')
        break
    }
  }

  // Drawer user 映射(AuthUser → Drawer user)
  const drawerUser = {
    avatar: authUser?.avatar,
    nickname: authUser?.nickname ?? authUser?.username ?? '未登录',
    level: (authUser?.isVip === 1 ? 'vip' : 'normal') as 'vip' | 'normal',
  }

  const renderItem: ListRenderItem<N8nMessage> = ({ item }) => (
    <MessageBubble message={item} onPreviewImage={handlePreviewImage} />
  )

  return (
    <View style={styles.root}>
      <NavBar
        title={navTitle}
        onBack={() => navigation.goBack()}
        rightActions={[
          { icon: '≡', label: '', onPress: () => setDrawerVisible(true) },
        ]}
      />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToEnd}
          onLayout={scrollToEnd}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Empty text={agentId ? t('aiAssistantN8n.empty') : t('aiAssistantN8n.emptyNoAgent')} />
          }
        />
        {/* 模型选择条(对齐 Uniapp ModelList + modelName 展示,位于输入区上方) */}
        <TouchableOpacity
          style={styles.modelBar}
          onPress={() => setShowModelPicker(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('chat.selectModel')}
        >
          <Text style={styles.modelBarLabel} numberOfLines={1}>
            {t('chat.modelLabel')}: {selectedModelLabel}
          </Text>
          <Text style={styles.modelBarArrow}>{'›'}</Text>
        </TouchableOpacity>
        <InputArea
          value={input}
          onChangeText={setInput}
          placeholder={t('aiAssistantN8n.placeholder')}
          maxLength={2000}
          onSubmit={(text) => void onSend(text)}
          disabled={sending}
          loading={sending}
          onStop={onStop}
          stopLabel={t('chat.stop')}
        />
        {sending ? (
          <View style={styles.streamingBar}>
            <ActivityIndicator color={tokens.brand.DEFAULT} size="small" />
            <Text style={styles.streamingText}>{t('aiAssistantN8n.streaming')}</Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {/* 模型选择器底部弹层(对齐 Uniapp ModelList sourceIs 弹出) */}
      <Modal
        visible={showModelPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModelPicker(false)}
      >
        <View style={pickerStyles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowModelPicker(false)} />
          <View style={pickerStyles.sheet}>
            <View style={pickerStyles.header}>
              <Text style={pickerStyles.title}>{t('chat.selectModel')}</Text>
              <TouchableOpacity
                onPress={() => setShowModelPicker(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="关闭"
              >
                <Text style={pickerStyles.close}>{'×'}</Text>
              </TouchableOpacity>
            </View>
            <View style={pickerStyles.listWrap}>
              <ModelList
                groups={modelGroups}
                selectionMode="single"
                selectedIds={selectedModelId ? [selectedModelId] : []}
                onSelectChange={handleModelSelect}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 图片全屏预览(对齐 Uniapp previewImage,使用共享 ImagePreviewModal) */}
      <ImagePreviewModal
        visible={previewImage !== null}
        source={previewSource}
        onClose={() => setPreviewImage(null)}
      />

      {/* Drawer 历史对话入口(对齐任务要求"Drawer 集成:历史对话入口") */}
      <Drawer
        visible={drawerVisible}
        onClose={closeDrawer}
        user={drawerUser}
        conversations={drawerConversations}
        onNavigate={handleDrawerNavigate}
        onNavigateCompany={handleDrawerNavigateCompany}
        onClaimFree={handleDrawerClaimFree}
        onCreateNewChat={handleDrawerCreateNewChat}
        onSelectConversation={handleDrawerSelectConversation}
        onDeleteConversation={handleDrawerDeleteConversation}
        onOpenSettings={handleDrawerOpenSettings}
        onOpenMessages={handleDrawerOpenMessages}
        onGoHome={handleDrawerGoHome}
        onNavigateExtra={handleNavigateExtra}
      />

      {/* FloatBox 浮层提示(对齐 Uniapp uni.showToast + 任务要求 #2) */}
      <FloatBox
        visible={toastVisible}
        type={toastType}
        message={toastMessage}
        onHide={hideToast}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 16 },
  // 模型选择条(对齐 Uniapp ModelList 位置:输入区上方)
  modelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: tokens.surface.card,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  modelBarLabel: {
    flex: 1,
    fontSize: 13,
    color: tokens.text.secondary,
  },
  modelBarArrow: {
    fontSize: 18,
    color: tokens.text.tertiary,
    marginLeft: 8,
  },
  streamingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: tokens.surface.card,
  },
  streamingText: { fontSize: 12, color: tokens.text.tertiary },
})

const bubbleStyles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 4 },
  rowUser: { justifyContent: 'flex-end' },
  rowAi: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bubbleUser: { backgroundColor: tokens.brand.DEFAULT },
  bubbleAi: { backgroundColor: tokens.surface.card },
  text: { fontSize: 14, lineHeight: 20 },
  textUser: { color: tokens.surface.light },
  textAi: { color: tokens.text.primary },
  // 回复内图片网格(对齐 Uniapp agent-content-item-img)
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chatImage: {
    width: 120,
    height: 120,
    borderRadius: 6,
    backgroundColor: tokens.surface.muted,
  },
})

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: tokens.surface.light,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    minHeight: '40%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tokens.border.light,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  close: {
    fontSize: 24,
    color: tokens.text.tertiary,
    lineHeight: 26,
  },
  listWrap: {
    height: 360,
  },
})
