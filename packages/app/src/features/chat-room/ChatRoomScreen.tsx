// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { ChevronLeft, FileText, Music, Video, X } from 'lucide-react-native'
import { SearchInput } from '../../components/SearchInput'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'

import { rnRadius } from '@ihui/design-tokens'

// ── 类型定义(强类型,禁用 any;内联定义对齐 MessageChatScreen 模式) ──

/** 媒体消息类型(对齐历史 mediaType 推断) */
export type ChatRoomMediaType = 'image' | 'audio' | 'video' | 'file' | null

/** 图标按钮组点击来源(对齐历史 handleIconClick(type):camera/album/file/wxfile) */
export type ChatRoomIconType = 'camera' | 'album' | 'file' | 'wxfile'

/** 聊天消息(对齐历史 processMessages/addMessageToList 产物结构) */
export interface ChatRoomMessageItem {
  id: string
  /** user: 我方发送(右侧),seller: 对方(左侧),system: 系统提示(居中) */
  type: 'user' | 'seller' | 'system'
  content: string
  sendTime: string
  messageType: number
  mediaType: ChatRoomMediaType
  mediaUrl: string | null
  avatar: string
  read: boolean
  /** 临时消息(已 push 未收到服务端确认,对齐历史 isTemp) */
  isTemp: boolean
}

/** 聊天室列表项(对齐历史 message/index.vue chatItem) */
export interface ChatRoomItem {
  id: string
  name: string
  avatar: string
  lastMessage: string
  time: string
  unreadCount: number
}

/**
 * ChatRoomScreen props(props 注入式)
 *
 * 状态归属:mode/rooms/activeRoom/messages 在 wrapper(数据层);
 * searchKeyword/previewUrl 为本组件纯 UI 态。
 * 输入栏经 bottomBar 节点整体注入(RN 端为 BottomActionBar 聊天输入模式,
 * 输入态与发送/附件回调由平台输入栏自行接线),本组件仅负责渲染位置。
 */
export interface ChatRoomScreenProps {
  /** 'list' 房间列表 | 'chat' 聊天室(路由参数直达聊天时 wrapper 置 'chat') */
  mode: 'list' | 'chat'
  rooms: ChatRoomItem[]
  activeRoom: ChatRoomItem | null
  messages: ChatRoomMessageItem[]
  /** 本机用户头像/昵称(消息流头像展示) */
  userAvatar: string
  userNickname: string
  /** 平台注入输入栏(RN 端 BottomActionBar 聊天输入模式) */
  bottomBar?: ReactNode
  onExit: () => void
  onOpenRoom: (room: ChatRoomItem) => void
  /** 聊天态返回房间列表 */
  onCloseChat: () => void
  /** 音频/文件/视频打开(wrapper 注入 Linking.openURL,对齐历史 openAudio/openFile) */
  onOpenUrl: (url: string) => void
  colorScheme?: 'light' | 'dark'
}

// ── 工具:媒体类型推断(对齐历史 processMessages 的 type/URL 扩展名判定;wrapper 组装 mock 消息同走此逻辑) ──

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i
const VIDEO_EXT = /\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|rm|rmvb)$/i
const AUDIO_EXT = /\.(mp3|wav|aac|m4a|ogg|flac|wma|amr|ape)$/i

export function detectChatRoomMediaType(
  messageType: number,
  content: string,
): { mediaType: ChatRoomMediaType; mediaUrl: string | null } {
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

/**
 * ChatRoomScreen — IM 聊天室(共享层)
 *
 * 2026-09-14 承接 mobile-rn AssistantScreen 1:1 迁移,对齐历史 Uniapp
 * pagesA/assistant/index.vue(聊天室详情)+ pagesA/message/index.vue(房间列表):
 * - 聊天态:消息流(user 右金泡/seller 左灰泡/system 居中)、媒体消息(图片全屏预览、
 *   音频/文件/视频经 onOpenUrl)、已读标记、inverted 列表
 * - 列表态:搜索栏(本组件内部态)+ 聊天列表 + 未读徽章
 * - 平台特定:数据(mock/WS 待接后端)、BottomActionBar、Linking 留 wrapper
 * - 文案沿用原实现硬编码中文(mock 屏待接后端后随 i18n 一起补)
 */
export function ChatRoomScreen({
  mode,
  rooms,
  activeRoom,
  messages,
  userAvatar,
  userNickname,
  bottomBar,
  onExit,
  onOpenRoom,
  onCloseChat,
  onOpenUrl,
  colorScheme = 'light',
}: ChatRoomScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])

  const [searchKeyword, setSearchKeyword] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  /** 按关键词过滤房间列表(对齐历史 message/index.vue 搜索栏) */
  const filteredRooms = useMemo(() => {
    const kw = searchKeyword.trim()
    if (!kw) return rooms
    return rooms.filter((r) => r.name.includes(kw) || r.lastMessage.includes(kw))
  }, [rooms, searchKeyword])

  // ── 聊天态渲染 ──

  const renderMessage = useCallback(
    ({ item }: { item: ChatRoomMessageItem }) => {
      if (item.type === 'system') {
        return (
          <View style={styles.systemRow}>
            <Text style={styles.systemText}>{item.content}</Text>
          </View>
        )
      }
      const isUser = item.type === 'user'
      const media = item.mediaType
      // const 局部变量:条件窄化可进入回调闭包(TS 对属性访问窄化不进回调)
      const mediaUrl = item.mediaUrl
      return (
        <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowSeller]}>
          {!isUser && (
            <Avatar uri={item.avatar} name={activeRoom?.name ?? '友'} size={40} styles={styles} />
          )}
          <View
            style={[
              styles.bubble,
              isUser ? styles.bubbleUser : styles.bubbleSeller,
              media && styles.bubbleMedia,
            ]}
          >
            {media === 'image' && mediaUrl ? (
              <TouchableOpacity onPress={() => setPreviewUrl(mediaUrl)} activeOpacity={0.9}>
                <Image source={{ uri: mediaUrl }} style={styles.messageImage} />
              </TouchableOpacity>
            ) : media === 'video' && mediaUrl ? (
              <TouchableOpacity
                style={styles.mediaRow}
                onPress={() => onOpenUrl(mediaUrl)}
                activeOpacity={0.7}
              >
                <Video size={16} color={tk.text.secondary} />
                <Text style={styles.mediaLink}>视频消息,点击播放</Text>
              </TouchableOpacity>
            ) : media === 'audio' && mediaUrl ? (
              <TouchableOpacity
                style={styles.mediaRow}
                onPress={() => onOpenUrl(mediaUrl)}
                activeOpacity={0.7}
              >
                <Music size={16} color={tk.text.secondary} />
                <Text style={styles.mediaLink}>音频消息,点击播放</Text>
              </TouchableOpacity>
            ) : media === 'file' && mediaUrl ? (
              <TouchableOpacity
                style={styles.mediaRow}
                onPress={() => onOpenUrl(mediaUrl)}
                activeOpacity={0.7}
              >
                <FileText size={16} color={tk.text.secondary} />
                <Text style={styles.mediaLink}>文件消息,点击查看</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.bubbleText}>{item.content}</Text>
            )}
            {isUser && item.read && !media ? <Text style={styles.readStatus}>已读</Text> : null}
          </View>
          {isUser && <Avatar uri={userAvatar} name={userNickname} size={40} styles={styles} />}
        </View>
      )
    },
    [activeRoom, onOpenUrl, userAvatar, userNickname, tk, styles],
  )

  if (mode === 'chat' && activeRoom) {
    return (
      <View style={styles.shell}>
        <Header title={activeRoom.name} onBack={onCloseChat} styles={styles} />
        <FlatList
          style={styles.chatList}
          contentContainerStyle={styles.chatListContent}
          data={messages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
        />
        {bottomBar}
        {/* 图片全屏预览(对应 uni.previewImage;历史支持整组滑动预览,先单张) */}
        <Modal
          visible={previewUrl !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewUrl(null)}
        >
          <View style={styles.previewOverlay}>
            <TouchableOpacity
              style={styles.previewClose}
              onPress={() => setPreviewUrl(null)}
              activeOpacity={0.8}
            >
              <X size={20} color={tk.surface.light} />
            </TouchableOpacity>
            {previewUrl ? (
              <Image
                source={{ uri: previewUrl }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </Modal>
      </View>
    )
  }

  // ── 列表态(对齐 message/index.vue:搜索栏 + 聊天列表 + 未读徽章) ──

  return (
    <View style={styles.shell}>
      <Header title="消息" onBack={onExit} styles={styles} />
      <View style={styles.searchBar}>
        <SearchInput
          value={searchKeyword}
          onChangeText={setSearchKeyword}
          placeholder="搜索聊天记录/联系人/服务号"
          colorScheme={colorScheme}
        />
      </View>
      <FlatList
        style={styles.roomList}
        data={filteredRooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.roomItem}
            onPress={() => onOpenRoom(item)}
            activeOpacity={0.7}
          >
            <Avatar uri={item.avatar} name={item.name} size={44} styles={styles} />
            <View style={styles.roomContent}>
              <View style={styles.roomHeader}>
                <Text style={styles.roomName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {item.unreadCount > 99 ? '99+' : item.unreadCount}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.roomTime}>{item.time}</Text>
              </View>
              <Text style={styles.roomPreview} numberOfLines={1}>
                {item.lastMessage || '暂无消息'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>未找到相关结果</Text>}
      />
    </View>
  )
}

// ── 私有:顶部导航行(返回箭头 + 标题,替代 RN 端 NavBar) ──

function Header({
  title,
  onBack,
  styles,
}: {
  title: string
  onBack: () => void
  styles: ReturnType<typeof createStyles>
}) {
  return (
    <View style={styles.headerBar}>
      <TouchableOpacity style={styles.headerBackBtn} onPress={onBack} activeOpacity={0.7}>
        <ChevronLeft size={22} color={styles.headerIcon.color} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerSidePlaceholder} />
    </View>
  )
}

// ── 私有:圆头像(历史 avatar 80rpx 圆形;rounded-full 禁用,用具体数值) ──

function Avatar({
  uri,
  name,
  size,
  styles,
}: {
  uri: string
  name: string
  size: number
  styles: ReturnType<typeof createStyles>
}) {
  const initial = (name || '友').trim().charAt(0) || '友'
  if (uri) {
    // radius-exempt: 成员头像正圆=直径一半(几何圆表达式,size/2 已是同源写法)
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }
  return (
    // radius-exempt: 头像兜底正圆=直径一半(几何圆表达式,与上方 Image 同规格)
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarFallbackText, { fontSize: size / 2.4 }]}>{initial}</Text>
    </View>
  )
}

/**
 * 样式:750 设计稿 rpx 值 / 2 转 dp(共享层惯例);全部颜色走 AppThemeTokens
 * 语义 token,零 hex,支持深浅主题(原 mobile-rn 版为固定 light tokens)。
 */
function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    shell: {
      flex: 1,
      backgroundColor: tk.surface.bg, // 历史 .container background #fff → 主题化
    },
    // 顶部导航行
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 44,
      paddingHorizontal: 10,
      backgroundColor: tk.surface.bg,
    },
    headerBackBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: {
      color: tk.brand.DEFAULT,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: tk.brand.DEFAULT,
      textAlign: 'center',
    },
    headerSidePlaceholder: {
      width: 32,
    },
    // 聊天态
    chatList: {
      flex: 1,
    },
    chatListContent: {
      padding: 10, // 历史 .chat-messages padding 20rpx
      paddingBottom: 30, // rpx(60)
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 12, // 历史 .message-item margin-bottom 24rpx
    },
    rowUser: {
      justifyContent: 'flex-end',
    },
    rowSeller: {
      justifyContent: 'flex-start',
    },
    bubble: {
      maxWidth: 240, // 历史 .message-bubble max-width 480rpx
      paddingVertical: 10, // rpx(20)
      paddingHorizontal: 12, // rpx(24)
      borderRadius: rnRadius.md, // rpx(12)
    },
    bubbleUser: {
      backgroundColor: tk.vip.gold, // 历史 #FFD700
      borderTopRightRadius: rnRadius.xs, // rpx(4)
      marginHorizontal: 8, // 历史 avatar margin 16rpx
    },
    bubbleSeller: {
      backgroundColor: tk.surface.muted, // 历史 #f0f0f0
      borderTopLeftRadius: rnRadius.xs, // rpx(4)
      marginHorizontal: 8, // 历史 avatar margin 16rpx
    },
    bubbleMedia: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      backgroundColor: 'transparent',
      marginHorizontal: 0,
    },
    bubbleText: {
      fontSize: 14, // 历史 28rpx
      lineHeight: 21, // rpx(42)
      color: tk.text.medium, // 历史 #333
    },
    readStatus: {
      fontSize: 10, // rpx(20)
      color: tk.text.tertiary, // 历史 #999
      marginTop: 4, // rpx(8)
      textAlign: 'right',
    },
    messageImage: {
      width: 160, // rpx(320)
      height: 160, // rpx(320)
      minWidth: 100, // rpx(200)
      minHeight: 100, // rpx(200)
      borderRadius: rnRadius.sm, // 历史 8rpx
      backgroundColor: tk.gray[100],
    },
    mediaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4, // rpx(8)
      paddingVertical: 4, // rpx(8)
    },
    mediaLink: {
      fontSize: 12, // rpx(24)
      color: tk.brandAccent.deep, // 历史链接色(全项目统一强调色 brandAccent)
      textDecorationLine: 'underline',
    },
    systemRow: {
      alignItems: 'center',
      marginVertical: 12, // rpx(24)
    },
    systemText: {
      fontSize: 12, // rpx(24)
      color: tk.text.tertiary, // 历史 #999
    },
    avatarFallback: {
      backgroundColor: tk.surface.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFallbackText: {
      color: tk.text.secondary,
    },
    // 图片预览
    previewOverlay: {
      flex: 1,
      backgroundColor: tk.gray.black,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewImage: {
      width: '100%',
      height: '80%',
    },
    previewClose: {
      position: 'absolute',
      top: 50, // rpx(100)
      right: 20, // rpx(40)
      zIndex: 10,
      padding: 6, // rpx(12)
    },
    // 列表态
    searchBar: {
      paddingHorizontal: 10, // rpx(20)
      paddingVertical: 8, // rpx(16)
    },
    searchInput: {
      height: 32, // rpx(64)
      borderRadius: rnRadius['2xl'], // 历史 rounded 搜索框
      backgroundColor: tk.surface.inputBg,
      paddingHorizontal: 12, // rpx(24)
      fontSize: 14, // rpx(28)
      color: tk.text.primary,
    },
    roomList: {
      flex: 1,
    },
    roomItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10, // rpx(20)
      paddingVertical: 10, // rpx(20)
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tk.border.light, // 历史 #f0f0f0 分隔线
    },
    roomContent: {
      flex: 1,
      marginLeft: 10, // rpx(20)
    },
    roomHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    roomName: {
      fontSize: 15, // rpx(30)
      fontWeight: '600',
      color: tk.text.primary,
      maxWidth: 150, // rpx(300)
    },
    unreadBadge: {
      minWidth: 16, // rpx(32)
      height: 16, // rpx(32)
      borderRadius: rnRadius.lg, // rpx(16)
      backgroundColor: tk.danger.DEFAULT,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4, // rpx(8)
      marginLeft: 6, // rpx(12)
    },
    unreadText: {
      fontSize: 10, // rpx(20)
      color: tk.surface.light,
    },
    roomTime: {
      marginLeft: 'auto',
      fontSize: 11, // rpx(22)
      color: tk.text.tertiary,
    },
    roomPreview: {
      fontSize: 13, // rpx(26)
      color: tk.text.secondary,
      marginTop: 4, // rpx(8)
    },
    emptyText: {
      textAlign: 'center',
      marginTop: 60, // rpx(120)
      fontSize: 13, // rpx(26)
      color: tk.text.tertiary,
    },
  } satisfies Record<string, ViewStyle | TextStyle | ImageStyle>)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
