// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AssistantScreen — IM 聊天室 (mobile-rn 端 wrapper)
 *
 * 2026-09-14 迁移:UI(消息流/房间列表/媒体渲染/图片预览)已下沉共享层
 * @ihui/rn-app ChatRoomScreen(历史 Uniapp pagesA/assistant/index.vue +
 * pagesA/message/index.vue 对齐),本 wrapper 仅保留平台特定职责:
 * - 数据:MOCK 房间/历史 + 本地 echo(待接后端 cozeZhsApi,见下方端点注释)
 * - 输入栏:BottomActionBar 聊天输入模式,经 bottomBar 节点注入共享屏
 * - 平台:Linking.openURL、Alert、KeyboardAvoidingView
 *
 * 数据接口:历史经 service/message.js(base3)+ utils/websocket.js 调 /cozeZhsApi/chat-room/*,
 * @ihui/api-client 无对应封装 → 本端先用 MOCK + 本地 echo,均以注释标明待接后端:
 * - 房间列表   GET  /cozeZhsApi/chat-room/users/{userUuid}/rooms            (getUserRooms)
 * - 房间历史   GET  /cozeZhsApi/chat-room/history?user_uuid=&room_id=      (getRoomHistory)
 * - 标记已读   PUT  /cozeZhsApi/chat-room/messages/mark-read?user_uuid=&room_id= (markRoomAsRead)
 * - 收发通道   WS   wss://<baseUrl3>/cozeZhsApi/chat-room/ws,event: join_room / send_message / room_message
 *
 * 平台独占入口:仅 mobile-rn 端。
 */
import { useCallback, useState } from 'react'
import { Alert, KeyboardAvoidingView, Linking, Platform, StyleSheet, View } from 'react-native'
import {
  ChatRoomScreen,
  detectChatRoomMediaType,
  type ChatRoomIconType,
  type ChatRoomItem,
  type ChatRoomMessageItem,
} from '@ihui/rn-app'
import { BottomActionBar, type BottomActionBarIconType } from '../components/BottomActionBar'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Assistant'>
type AssistantRoute = RouteProp<RootStackParamList, 'Assistant'>

/** wrapper 数据层房间(共享 ChatRoomItem + 待接 WS 的 receiverUuid) */
interface WrapperRoom extends ChatRoomItem {
  receiverUuid: string
}

// ── MOCK 数据(待接后端:GET /cozeZhsApi/chat-room/users/{userUuid}/rooms) ──

const MOCK_ROOMS: WrapperRoom[] = [
  {
    id: 'room-ai-assistant',
    name: 'AI助手',
    avatar: '',
    lastMessage: '你好,我是 AI 助手,有什么可以帮你?',
    time: '昨天',
    unreadCount: 2,
    receiverUuid: 'uuid-assistant-bot',
  },
  {
    id: 'room-order-service',
    name: '订单客服',
    avatar: '',
    lastMessage: '您的退款申请已提交,请留意查收。',
    time: '周三',
    unreadCount: 0,
    receiverUuid: 'uuid-order-service',
  },
  {
    id: 'room-system-notice',
    name: '系统通知',
    avatar: '',
    lastMessage: '欢迎使用智汇AI,祝您使用愉快!',
    time: '09-01',
    unreadCount: 0,
    receiverUuid: '',
  },
]

/** MOCK 历史消息(待接后端:GET /cozeZhsApi/chat-room/history?user_uuid=&room_id=) */
function buildMockHistory(roomName: string): ChatRoomMessageItem[] {
  const raw: ChatRoomMessageItem[] = [
    {
      id: 'sys-1',
      type: 'system',
      content: `已进入「${roomName}」聊天室`,
      sendTime: '',
      messageType: 1,
      mediaType: null,
      mediaUrl: null,
      avatar: '',
      read: false,
      isTemp: false,
    },
    {
      id: 'seller-1',
      type: 'seller',
      content: '你好,我是 AI 助手,有什么可以帮你?',
      sendTime: '',
      messageType: 1,
      mediaType: null,
      mediaUrl: null,
      avatar: '',
      read: false,
      isTemp: false,
    },
  ]
  // 对齐历史 processMessages:媒体类型/媒体地址由 messageType 与 URL 扩展名统一推断(mock 同走一遍,接后端后逻辑一致)
  return raw.map((m) => {
    const { mediaType, mediaUrl } = detectChatRoomMediaType(m.messageType, m.content)
    return { ...m, mediaType, mediaUrl }
  })
}

/** BottomActionBarIconType → 共享 ChatRoomIconType(枚举值一致,直通) */
const toChatRoomIconType = (type: BottomActionBarIconType): ChatRoomIconType => type

export default function AssistantScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<AssistantRoute>()
  const { user } = useAuth()
  const { resolvedTheme } = useTheme()

  const params = route.params
  // 支持路由参数直达聊天室(对齐历史 onLoad options:roomId/room_name/receiver_uuid/avatar)
  const [mode, setMode] = useState<'list' | 'chat'>(params?.roomId ? 'chat' : 'list')
  const [rooms, setRooms] = useState<WrapperRoom[]>(MOCK_ROOMS)
  const [activeRoom, setActiveRoom] = useState<WrapperRoom | null>(
    params?.roomId
      ? {
          id: params.roomId,
          name: params.roomName ? decodeURIComponent(params.roomName) : 'AI助手',
          avatar: params.avatar ? decodeURIComponent(params.avatar) : '',
          lastMessage: '',
          time: '',
          unreadCount: 0,
          receiverUuid: params.receiverUuid ? decodeURIComponent(params.receiverUuid) : '',
        }
      : null,
  )
  const [messages, setMessages] = useState<ChatRoomMessageItem[]>([])
  const [inputContent, setInputContent] = useState('')
  const [showAttach, setShowAttach] = useState(false)

  const userUuid = user?.id ?? ''
  const userAvatar = user?.avatar ?? ''
  const userNickname = user?.nickname ?? '我'

  /** 进入聊天室:清零未读 + 拉历史(对齐历史 onLoad → loadChatHistory + markAsRead) */
  const openRoom = useCallback(
    (room: ChatRoomItem) => {
      // 按 id 还原 wrapper 数据层字段(receiverUuid:待接 WS send_message 用)
      const full = rooms.find((r) => r.id === room.id) ?? { ...room, receiverUuid: '' }
      setActiveRoom(full)
      setMode('chat')
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)))
      // MOCK 房间历史;待接后端:GET /cozeZhsApi/chat-room/history?user_uuid=&room_id=,
      // 响应 { code:200, data:{ messages:[{ id,user_uuid,type,content,send_time,is_del,sender_avatar }] } },
      // 再按 processMessages 反序+去重后填充。
      setMessages(buildMockHistory(full.name))
      // MOCK 标记已读;待接后端:PUT /cozeZhsApi/chat-room/messages/mark-read?user_uuid=&room_id=
    },
    [rooms],
  )

  /** 发送消息(对齐历史 handleSendMessage:先 push 临时消息,发送失败则移除)。
   *  待接后端:WebSocket wss://<baseUrl3>/cozeZhsApi/chat-room/ws,
   *  send({ event:'send_message', user_uuid, room_id, receiver_uuid, content }),
   *  服务端 room_message 回包后按 消息id / 内容+userUuid+sendTime 去重,
   *  将 isTemp 消息替换为正式消息(历史 addMessageToList);此处以本地 echo 模拟对方回复。 */
  const handleSend = useCallback(() => {
    const content = inputContent.trim()
    if (!content) return
    if (!userUuid) {
      Alert.alert('用户信息不完整')
      return
    }
    const tempId = `temp_${Date.now()}`
    const userMessage: ChatRoomMessageItem = {
      id: tempId,
      type: 'user',
      content,
      sendTime: new Date().toISOString(),
      messageType: 1,
      mediaType: null,
      mediaUrl: null,
      avatar: userAvatar,
      read: false,
      isTemp: true,
    }
    setMessages((prev) => [...prev, userMessage])
    setInputContent('')
    // MOCK 回执:将临时消息置为已确认(真实实现由服务端确认回包驱动)
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, isTemp: false, read: true } : m)),
      )
      // MOCK 对方回显,便于演示消息流布局
      setMessages((prev) => [
        ...prev,
        {
          id: `echo_${Date.now()}`,
          type: 'seller',
          content: `[模拟回复] 已收到:「${content}」(WebSocket 待接后端)`,
          sendTime: new Date().toISOString(),
          messageType: 1,
          mediaType: null,
          mediaUrl: null,
          avatar: activeRoom?.avatar ?? '',
          read: false,
          isTemp: false,
        },
      ])
    }, 600)
  }, [inputContent, userUuid, userAvatar, activeRoom])

  /** 附加按钮:展开/收起图标组(对齐历史 handleAddClick → isShowIcon 切换) */
  const handlePlusToggle = useCallback(() => setShowAttach((v) => !v), [])

  /** 图标组点击(对齐历史 handleIconClick(type))。
   *  待接后端:历史为 uni.chooseImage/chooseFile/chooseMessageFile → uploadBybase64 上传后
   *  以 messageType 2/3/4 走 WS send_message 发送 URL;RN 端先占位提示。 */
  const handleIconClick = useCallback((type: ChatRoomIconType) => {
    setShowAttach(false)
    if (type === 'wxfile') {
      Alert.alert('仅微信小程序支持')
      return
    }
    Alert.alert(
      '附件发送待接后端',
      `将支持:${type === 'camera' ? '拍照' : type === 'album' ? '相册图片' : '文件'}上传后经 WS 发送`,
    )
  }, [])

  /** 音频/文件/视频打开(对齐历史 openAudio/openFile:APP 内 openURL) */
  const handleOpenUrl = useCallback((url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert('无法打开链接'))
  }, [])

  const chat = mode === 'chat' && activeRoom !== null
  const content = (
    <ChatRoomScreen
      mode={mode}
      rooms={rooms}
      activeRoom={activeRoom}
      messages={messages}
      userAvatar={userAvatar}
      userNickname={userNickname}
      bottomBar={
        chat ? (
          <BottomActionBar
            prompt={inputContent}
            onPromptChange={setInputContent}
            onSend={handleSend}
            onPlusToggle={handlePlusToggle}
            plusActive={showAttach}
            isShowIcon={showAttach}
            onIconClick={(type) => handleIconClick(toChatRoomIconType(type))}
          />
        ) : undefined
      }
      onExit={() => navigation.goBack()}
      onOpenRoom={openRoom}
      onCloseChat={() => setMode('list')}
      onOpenUrl={handleOpenUrl}
      colorScheme={resolvedTheme}
    />
  )

  // 键盘避让仅聊天态需要(对齐原实现 iOS padding)
  if (chat) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    )
  }
  return <View style={styles.flex}>{content}</View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
