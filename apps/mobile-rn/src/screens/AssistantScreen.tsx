// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AssistantScreen — IM 聊天室 (mobile-rn 端)
 *
 * 1:1 对齐历史 Uniapp pagesA/assistant/index.vue(聊天室详情)+ pagesA/message/index.vue(房间列表)。
 * 历史为"聊天室列表 → 聊天室详情"两级页面,RN 单屏以 mode: 'list' | 'chat' 状态切换。
 *
 * 聊天态(assistant/index.vue)对齐点:
 * - NavBar 标题 = 路由参数 room_name(默认 'AI助手'),返回回房间列表(对齐 navigation-bars + roomId/room_name 参数)
 * - 消息流:user 右(金泡 #FFD700 → tokens.vip.gold,头像在右 margin 16rpx)、seller 左
 *   (灰泡 #f0f0f0 → tokens.surface.muted,头像在左 16rpx)、system 居中灰字;
 *   气泡圆角 12rpx + 对应顶角 4rpx,max-width 480rpx,user 消息已读显示"已读"
 * - 媒体消息:type 2 图片 / 3 音频 / 4 文件 / 5 视频 + URL 扩展名推断(对齐 processMessages);
 *   图片点击全屏预览(对应 uni.previewImage),音频/文件点击 Linking 打开(对应 openAudio/openFile)
 * - 底部输入栏复用 BottomActionBar 聊天输入模式(历史页面即引用同一组件;
 *   历史 :showModel="false" :showModelSelect="false" 对应不传 modelName/onShowModelList 不渲染模型条;
 *   function-handle → onPlusToggle 展开 icon-click 图标组:相机/相册/文件/微信文件)
 * - 发送:先 push isTemp 临时消息再发送、失败移除(对齐 handleSendMessage 顺序)
 *
 * 数据接口:历史经 service/message.js(base3)+ utils/websocket.js 调 /cozeZhsApi/chat-room/*,
 * @ihui/api-client 无对应封装 → 本端先用 MOCK + 本地 echo,均以注释标明待接后端:
 * - 房间列表   GET  /cozeZhsApi/chat-room/users/{userUuid}/rooms            (getUserRooms)
 * - 房间历史   GET  /cozeZhsApi/chat-room/history?user_uuid=&room_id=      (getRoomHistory)
 * - 标记已读   PUT  /cozeZhsApi/chat-room/messages/mark-read?user_uuid=&room_id= (markRoomAsRead)
 * - 收发通道   WS   wss://<baseUrl3>/cozeZhsApi/chat-room/ws,event: join_room / send_message / room_message
 *
 * 平台独占:仅 mobile-rn 端。
 */
import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { FileText, Music, Video, X } from 'lucide-react-native'
import { NavBar } from '../components/NavBar'
import { BottomActionBar, type BottomActionBarIconType } from '../components/BottomActionBar'
import { useAuth } from '../context/AuthContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { rpx } from '../utils/rpx'

type Nav = NativeStackNavigationProp<RootStackParamList, 'Assistant'>
type AssistantRoute = RouteProp<RootStackParamList, 'Assistant'>

// ── 类型定义(强类型,禁用 any) ──

/** 媒体消息类型(对齐历史 mediaType 推断) */
type ChatMediaType = 'image' | 'audio' | 'video' | 'file' | null

/** 聊天消息(对齐历史 processMessages/addMessageToList 产物结构) */
interface ChatMessageItem {
  id: string
  /** user: 我方发送(右侧),seller: 对方(左侧),system: 系统提示(居中) */
  type: 'user' | 'seller' | 'system'
  content: string
  sendTime: string
  messageType: number
  mediaType: ChatMediaType
  mediaUrl: string | null
  avatar: string
  read: boolean
  /** 临时消息(已 push 未收到服务端确认,对齐历史 isTemp) */
  isTemp: boolean
}

/** 聊天室列表项(对齐 message/index.vue chatItem) */
interface ChatRoomItem {
  id: string
  name: string
  avatar: string
  lastMessage: string
  time: string
  unreadCount: number
  receiverUuid: string
}

// ── MOCK 数据(待接后端:GET /cozeZhsApi/chat-room/users/{userUuid}/rooms) ──

const MOCK_ROOMS: ChatRoomItem[] = [
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
function buildMockHistory(roomName: string): ChatMessageItem[] {
  const raw: ChatMessageItem[] = [
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
    const { mediaType, mediaUrl } = detectMediaType(m.messageType, m.content)
    return { ...m, mediaType, mediaUrl }
  })
}

// ── 工具:媒体类型推断(对齐历史 processMessages 的 type/URL 扩展名判定) ──

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i
const VIDEO_EXT = /\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|rm|rmvb)$/i
const AUDIO_EXT = /\.(mp3|wav|aac|m4a|ogg|flac|wma|amr|ape)$/i

function detectMediaType(messageType: number, content: string): { mediaType: ChatMediaType; mediaUrl: string | null } {
  if (messageType === 2) return { mediaType: 'image', mediaUrl: content }
  if (messageType === 3) return { mediaType: 'audio', mediaUrl: content }
  if (messageType === 4) return { mediaType: 'file', mediaUrl: content }
  if (messageType === 5) return { mediaType: 'video', mediaUrl: content }
  if (content.startsWith('http://') || content.startsWith('https://')) {
    if (IMAGE_EXT.test(content)) return { mediaType: 'image', mediaUrl: content }
    if (VIDEO_EXT.test(content)) return { mediaType: 'video', mediaUrl: content }
    if (AUDIO_EXT.test(content)) return { mediaType: 'audio', mediaUrl: content }
    return { mediaType: 'file', mediaUrl: content }
  }
  return { mediaType: null, mediaUrl: null }
}

// ── 子组件:圆头像(历史 avatar 80rpx 圆形;rounded-full 禁用,用具体数值) ──

function Avatar({ uri, name, size }: { uri: string; name: string; size: number }) {
  const initial = (name || '友').trim().charAt(0) || '友'
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }
  return (
    <View
      style={[
        styles.avatarFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarFallbackText, { fontSize: size / 2.4 }]}>{initial}</Text>
    </View>
  )
}

// ── 主组件 ──

export default function AssistantScreen() {
  const navigation = useNavigation<Nav>()
  const route = useRoute<AssistantRoute>()
  const { user } = useAuth()

  const params = route.params
  // 支持路由参数直达聊天室(对齐历史 onLoad options:roomId/room_name/receiver_uuid/avatar)
  const [mode, setMode] = useState<'list' | 'chat'>(params?.roomId ? 'chat' : 'list')
  const [rooms, setRooms] = useState<ChatRoomItem[]>(MOCK_ROOMS)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeRoom, setActiveRoom] = useState<ChatRoomItem | null>(
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
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [inputContent, setInputContent] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const userUuid = user?.id ?? ''
  const userAvatar = user?.avatar ?? ''
  const userNickname = user?.nickname ?? '我'

  /** 按关键词过滤房间列表(对齐 message/index.vue 搜索栏) */
  const filteredRooms = useMemo(() => {
    const kw = searchKeyword.trim()
    if (!kw) return rooms
    return rooms.filter((r) => r.name.includes(kw) || r.lastMessage.includes(kw))
  }, [rooms, searchKeyword])

  /** MOCK 房间历史;待接后端:GET /cozeZhsApi/chat-room/history?user_uuid=&room_id=,
   *  响应 { code:200, data:{ messages:[{ id,user_uuid,type,content,send_time,is_del,sender_avatar }] } },
   *  再按 processMessages 反序+去重后填充。 */
  const loadChatHistory = useCallback((room: ChatRoomItem) => {
    setMessages(buildMockHistory(room.name))
  }, [])

  /** MOCK 标记已读;待接后端:PUT /cozeZhsApi/chat-room/messages/mark-read?user_uuid=&room_id= */
  const markAsRead = useCallback((_room: ChatRoomItem) => {}, [])

  /** 进入聊天室:清零未读 + 拉历史 + 标已读(对齐历史 onLoad → loadChatHistory + markAsRead) */
  const openRoom = useCallback(
    (room: ChatRoomItem) => {
      setActiveRoom(room)
      setMode('chat')
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, unreadCount: 0 } : r)))
      loadChatHistory(room)
      markAsRead(room)
    },
    [loadChatHistory, markAsRead],
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
    const userMessage: ChatMessageItem = {
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
  const handleIconClick = useCallback((type: BottomActionBarIconType) => {
    setShowAttach(false)
    if (type === 'wxfile') {
      Alert.alert('仅微信小程序支持')
      return
    }
    Alert.alert('附件发送待接后端', `将支持:${type === 'camera' ? '拍照' : type === 'album' ? '相册图片' : '文件'}上传后经 WS 发送`)
  }, [])

  /** 音频/文件/视频打开(对齐历史 openAudio/openFile:APP 内 openURL) */
  const openUrl = useCallback((url: string | null) => {
    if (!url) return
    void Linking.openURL(url).catch(() => Alert.alert('无法打开链接'))
  }, [])

  // ── 聊天态渲染 ──

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageItem }) => {
      if (item.type === 'system') {
        return (
          <View style={styles.systemRow}>
            <Text style={styles.systemText}>{item.content}</Text>
          </View>
        )
      }
      const isUser = item.type === 'user'
      const media = item.mediaType
      return (
        <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowSeller]}>
          {!isUser && <Avatar uri={item.avatar} name={activeRoom?.name ?? '友'} size={rpx(80)} />}
          <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleSeller, media && styles.bubbleMedia]}>
            {media === 'image' && item.mediaUrl ? (
              <TouchableOpacity onPress={() => setPreviewUrl(item.mediaUrl)} activeOpacity={0.9}>
                <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
              </TouchableOpacity>
            ) : media === 'video' && item.mediaUrl ? (
              <TouchableOpacity style={styles.mediaRow} onPress={() => openUrl(item.mediaUrl)} activeOpacity={0.7}>
                <Video size={rpx(32)} color={tokens.text.secondary} />
                <Text style={styles.mediaLink}>视频消息,点击播放</Text>
              </TouchableOpacity>
            ) : media === 'audio' && item.mediaUrl ? (
              <TouchableOpacity style={styles.mediaRow} onPress={() => openUrl(item.mediaUrl)} activeOpacity={0.7}>
                <Music size={rpx(32)} color={tokens.text.secondary} />
                <Text style={styles.mediaLink}>音频消息,点击播放</Text>
              </TouchableOpacity>
            ) : media === 'file' && item.mediaUrl ? (
              <TouchableOpacity style={styles.mediaRow} onPress={() => openUrl(item.mediaUrl)} activeOpacity={0.7}>
                <FileText size={rpx(32)} color={tokens.text.secondary} />
                <Text style={styles.mediaLink}>文件消息,点击查看</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.bubbleText}>{item.content}</Text>
            )}
            {isUser && item.read && !media ? <Text style={styles.readStatus}>已读</Text> : null}
          </View>
          {isUser && <Avatar uri={item.avatar} name={userNickname} size={rpx(80)} />}
        </View>
      )
    },
    [activeRoom, openUrl, userNickname],
  )

  // ── 列表态渲染(hook 须在 early return 之前声明,react-hooks/rules-of-hooks) ──

  const renderRoom = useCallback(
    ({ item }: { item: ChatRoomItem }) => (
      <TouchableOpacity style={styles.roomItem} onPress={() => openRoom(item)} activeOpacity={0.7}>
        <Avatar uri={item.avatar} name={item.name} size={rpx(88)} />
        <View style={styles.roomContent}>
          <View style={styles.roomHeader}>
            <Text style={styles.roomName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            ) : null}
            <Text style={styles.roomTime}>{item.time}</Text>
          </View>
          <Text style={styles.roomPreview} numberOfLines={1}>
            {item.lastMessage || '暂无消息'}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [openRoom],
  )

  if (mode === 'chat' && activeRoom) {
    return (
      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <NavBar title={activeRoom.name} onBack={() => setMode('list')} />
        <FlatList
          style={styles.chatList}
          contentContainerStyle={styles.chatListContent}
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
        />
        <BottomActionBar
          prompt={inputContent}
          onPromptChange={setInputContent}
          onSend={handleSend}
          onPlusToggle={handlePlusToggle}
          plusActive={showAttach}
          isShowIcon={showAttach}
          onIconClick={handleIconClick}
        />
        {/* 图片全屏预览(对应 uni.previewImage;历史支持整组滑动预览,RN 端先单张) */}
        <Modal visible={previewUrl !== null} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
          <View style={styles.previewOverlay}>
            <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewUrl(null)} activeOpacity={0.8}>
              <X size={rpx(40)} color={tokens.surface.light} />
            </TouchableOpacity>
            {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    )
  }

  // ── 列表态(对齐 message/index.vue:搜索栏 + 聊天列表 + 未读徽章) ──

  return (
    <View style={styles.shell}>
      <NavBar title="消息" onBack={() => navigation.goBack()} />
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          placeholder="搜索聊天记录/联系人/服务号"
          placeholderTextColor={tokens.text.tertiary}
          returnKeyType="search"
        />
      </View>
      <FlatList
        style={styles.roomList}
        data={filteredRooms}
        keyExtractor={(item) => item.id}
        renderItem={renderRoom}
        ListEmptyComponent={<Text style={styles.emptyText}>未找到相关结果</Text>}
      />
    </View>
  )
}

// ── 样式(rpx 对齐历史 750 设计稿) ──

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: tokens.surface.light, // 历史 .container background #fff
  },
  // 聊天态
  chatList: {
    flex: 1,
  },
  chatListContent: {
    padding: rpx(20), // 历史 .chat-messages padding 20rpx
    paddingBottom: rpx(60),
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: rpx(24), // 历史 .message-item margin-bottom 24rpx
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowSeller: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: rpx(480), // 历史 .message-bubble max-width 480rpx
    paddingVertical: rpx(20),
    paddingHorizontal: rpx(24),
    borderRadius: rpx(12),
  },
  bubbleUser: {
    backgroundColor: tokens.vip.gold, // 历史 #FFD700
    borderTopRightRadius: rpx(4),
    marginHorizontal: rpx(16), // 历史 avatar margin 16rpx
  },
  bubbleSeller: {
    backgroundColor: tokens.surface.muted, // 历史 #f0f0f0
    borderTopLeftRadius: rpx(4),
    marginHorizontal: rpx(16),
  },
  bubbleMedia: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    marginHorizontal: 0,
  },
  bubbleText: {
    fontSize: rpx(28), // 历史 28rpx
    lineHeight: rpx(42),
    color: tokens.text.medium, // 历史 #333
  },
  readStatus: {
    fontSize: rpx(20),
    color: tokens.text.tertiary, // 历史 #999
    marginTop: rpx(8),
    textAlign: 'right',
  },
  messageImage: {
    width: rpx(320),
    height: rpx(320),
    minWidth: rpx(200),
    minHeight: rpx(200),
    borderRadius: rpx(8), // 历史 8rpx
    backgroundColor: tokens.gray[100],
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(8),
    paddingVertical: rpx(8),
  },
  mediaLink: {
    fontSize: rpx(24),
    color: tokens.brandAccent.DEFAULT, // 历史 #1890ff 链接色(indigo 已被全项目统一强调色 brandAccent 取代)
    textDecorationLine: 'underline',
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: rpx(24),
  },
  systemText: {
    fontSize: rpx(24),
    color: tokens.text.tertiary, // 历史 #999
  },
  avatarFallback: {
    backgroundColor: tokens.surface.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: tokens.text.secondary,
  },
  // 图片预览
  previewOverlay: {
    flex: 1,
    backgroundColor: tokens.gray.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },
  previewClose: {
    position: 'absolute',
    top: rpx(100),
    right: rpx(40),
    zIndex: 10,
    padding: rpx(12),
  },
  // 列表态
  searchBar: {
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(16),
  },
  searchInput: {
    height: rpx(64),
    borderRadius: rpx(32), // 历史 rounded 搜索框
    backgroundColor: tokens.surface.inputBg,
    paddingHorizontal: rpx(24),
    fontSize: rpx(28),
    color: tokens.text.primary,
  },
  roomList: {
    flex: 1,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rpx(20),
    paddingVertical: rpx(20),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.border.light, // 历史 #f0f0f0 分隔线
  },
  roomContent: {
    flex: 1,
    marginLeft: rpx(20),
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomName: {
    fontSize: rpx(30),
    fontWeight: '600',
    color: tokens.text.primary,
    maxWidth: rpx(300),
  },
  unreadBadge: {
    minWidth: rpx(32),
    height: rpx(32),
    borderRadius: rpx(16),
    backgroundColor: tokens.danger.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rpx(8),
    marginLeft: rpx(12),
  },
  unreadText: {
    fontSize: rpx(20),
    color: tokens.surface.light,
  },
  roomTime: {
    marginLeft: 'auto',
    fontSize: rpx(22),
    color: tokens.text.tertiary,
  },
  roomPreview: {
    fontSize: rpx(26),
    color: tokens.text.secondary,
    marginTop: rpx(8),
  },
  emptyText: {
    textAlign: 'center',
    marginTop: rpx(120),
    fontSize: rpx(26),
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
