import { logger } from '@/utils/logger'
import { View, Text, Image, Video, ScrollView, Input } from '@tarojs/components'
import Taro, { useReady } from '@tarojs/taro'
import { useState, useCallback, useRef, useEffect } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

type MsgType = 'user' | 'seller' | 'system'
type MediaType = 'image' | 'audio' | 'video' | 'file' | null

interface DisplayMessage {
  id: string | number
  type: MsgType
  content: string
  sendTime?: string
  userUuid?: string
  receiverUuid?: string
  messageType: number
  mediaType: MediaType
  mediaUrl: string | null
  avatar?: string
  read: boolean
  isTemp?: boolean
  poster?: string
}

interface RawMsg {
  id?: string | number
  user_uuid?: string
  sender_uuid?: string
  receiver_uuid?: string
  type?: number
  content?: string
  source?: string
  send_time?: string
  timestamp?: string
  is_del?: number
  sender_avatar?: string
  sender_name?: string
  event?: string
  message?: string
  msg?: string
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)$/i
const VIDEO_EXTS = /\.(mp4|avi|mov|wmv|flv|mkv|webm|m4v|3gp|rm|rmvb)$/i
const AUDIO_EXTS = /\.(mp3|wav|aac|m4a|ogg|flac|wma|amr|ape)$/i

function detectMedia(
  content: string,
  type?: number,
): { mediaType: MediaType; messageType: number; mediaUrl: string | null } {
  if (type === 2) return { mediaType: 'image', messageType: 2, mediaUrl: content }
  if (type === 3) return { mediaType: 'audio', messageType: 3, mediaUrl: content }
  if (type === 4) return { mediaType: 'file', messageType: 4, mediaUrl: content }
  if (type === 5) return { mediaType: 'video', messageType: 5, mediaUrl: content }
  if (content && (content.startsWith('http://') || content.startsWith('https://'))) {
    const lower = content.toLowerCase()
    if (IMAGE_EXTS.test(lower)) return { mediaType: 'image', messageType: 2, mediaUrl: content }
    if (VIDEO_EXTS.test(lower)) return { mediaType: 'video', messageType: 5, mediaUrl: content }
    if (AUDIO_EXTS.test(lower)) return { mediaType: 'audio', messageType: 3, mediaUrl: content }
    return { mediaType: 'file', messageType: 4, mediaUrl: content }
  }
  return { mediaType: null, messageType: type || 1, mediaUrl: null }
}

function isMedia(msg: DisplayMessage): boolean {
  return (
    msg.mediaType === 'image' ||
    msg.mediaType === 'audio' ||
    msg.mediaType === 'video' ||
    msg.mediaType === 'file' ||
    msg.messageType === 2 ||
    msg.messageType === 3 ||
    msg.messageType === 4 ||
    msg.messageType === 5
  )
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export default function AgentDialogue() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [chatTitle, setChatTitle] = useState(tt('agentDialogue.defaultTitle', 'AI助手'))
  const [chatList, setChatList] = useState<DisplayMessage[]>([])
  const [inputContent, setInputContent] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  const roomIdRef = useRef('')
  const receiverUuidRef = useRef('')
  const userUuidRef = useRef('')
  const userAvatarRef = useRef('')
  const sellerAvatarRef = useRef('/static/images/default-avatar.png')
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const wsTaskRef = useRef<Taro.SocketTask | null>(null)
  const wsConnectedRef = useRef(false)
  const initedRef = useRef(false)
  // 4 字段去重:避免 WebSocket 推送的最后一条历史消息与已加载历史重复
  const lastHistoryRef = useRef<{
    id: string | number | null
    content: string | null
    time: string | null
    userUuid: string | null
  }>({ id: null, content: null, time: null, userUuid: null })

  const scrollToBottom = useCallback(() => {
    setTimeout(() => setScrollTop((s) => (s === 99998 ? 99999 : 99998)), 60)
  }, [])

  const loadChatHistory = useCallback(
    async (page: number, mode: 'replace' | 'prepend') => {
      const roomId = roomIdRef.current
      const userUuid = userUuidRef.current
      if (!roomId || !userUuid) return
      setLoading(true)
      try {
        const res = (await api.getRoomHistory(roomId, page)) as unknown as {
          code?: number
          data?: { messages?: RawMsg[] } | RawMsg[]
          messages?: RawMsg[]
        }
        let msgs: RawMsg[] = []
        if (res?.code === 200 && res.data) {
          msgs = Array.isArray(res.data) ? res.data : res.data.messages || []
        } else if (Array.isArray(res)) {
          msgs = res
        } else if (res?.messages) {
          msgs = res.messages
        } else if (res?.data && Array.isArray(res.data)) {
          msgs = res.data
        }
        const processed: DisplayMessage[] = msgs
          .filter((m) => m.is_del === 0 || m.is_del === undefined)
          .map((m) => {
            const isUser = m.user_uuid === userUuid
            const content = m.content || ''
            const { mediaType, messageType, mediaUrl } = detectMedia(content, m.type)
            let avatar = ''
            if (isUser) {
              avatar = userAvatarRef.current
            } else {
              avatar = m.sender_avatar || sellerAvatarRef.current
              if (m.sender_avatar) sellerAvatarRef.current = m.sender_avatar
            }
            return {
              id: m.id || genId('h'),
              type: (isUser ? 'user' : 'seller') as MsgType,
              content,
              sendTime: m.send_time,
              userUuid: m.user_uuid,
              receiverUuid: m.receiver_uuid,
              messageType,
              mediaType,
              mediaUrl,
              avatar,
              read: false,
            }
          })
        // 历史接口通常按时间倒序(最新在前),反转为正序(最早在前)
        const ordered = processed.slice().reverse()
        const seen = new Set<string>()
        const deduped = ordered.filter((m) => {
          const key = m.id ? `id_${m.id}` : `c_${m.content}_${m.userUuid}_${m.sendTime}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        if (mode === 'replace') {
          setChatList(deduped)
          const last = deduped[deduped.length - 1]
          if (last) {
            lastHistoryRef.current = {
              id: last.id ?? null,
              content: last.content ?? null,
              time: last.sendTime ?? null,
              userUuid: last.userUuid ?? null,
            }
          }
          scrollToBottom()
        } else {
          setChatList((prev) => [...deduped, ...prev])
        }
        hasMoreRef.current = processed.length > 0
      } catch (e) {
        logger.error('agentDialogue', '加载历史', e)
        Taro.showToast({ title: tt('agentDialogue.loadFailed', '加载失败'), icon: 'none' })
      } finally {
        setLoading(false)
      }
    },
    [scrollToBottom, tt],
  )

  const markAsRead = useCallback(async () => {
    if (!roomIdRef.current) return
    try {
      await api.markRoomRead(roomIdRef.current)
    } catch (e) {
      logger.error('agentDialogue', '标记已读', e)
    }
  }, [])

  const addMessageToList = useCallback(
    (data: RawMsg) => {
      const currentUserUuid = userUuidRef.current
      if (!currentUserUuid) return
      const msgUserUuid = data.user_uuid || data.sender_uuid
      if (!msgUserUuid) return
      const isUser = msgUserUuid === currentUserUuid
      const sendTime = data.send_time || data.timestamp || new Date().toISOString()
      const content = data.content || ''

      // 4 字段去重:与最后一条历史消息匹配则跳过
      const lh = lastHistoryRef.current
      if (lh.content && lh.time && lh.userUuid) {
        const contentMatch = content === lh.content
        const userMatch = msgUserUuid === lh.userUuid
        let timeMatch = false
        if (sendTime === lh.time) {
          timeMatch = true
        } else if (sendTime && lh.time) {
          const t1 = new Date(lh.time).getTime()
          const t2 = new Date(sendTime).getTime()
          if (!isNaN(t1) && !isNaN(t2)) timeMatch = Math.abs(t1 - t2) < 2000
        }
        if (contentMatch && userMatch && timeMatch) return
      }

      const { mediaType, messageType, mediaUrl } = detectMedia(content, data.type)
      let avatar = ''
      if (isUser) {
        avatar = userAvatarRef.current
      } else {
        avatar = data.sender_avatar || sellerAvatarRef.current
        if (data.sender_avatar) sellerAvatarRef.current = data.sender_avatar
      }

      setChatList((prev) => {
        if (data.id) {
          const exists = prev.some((m) => m.id === data.id)
          if (exists) return prev
        }
        if (isUser) {
          const tempIdx = prev.findIndex(
            (m) => m.isTemp && m.content === content && m.userUuid === currentUserUuid,
          )
          if (tempIdx !== -1) {
            const next = [...prev]
            const existing = next[tempIdx]
            if (existing) {
              next[tempIdx] = {
                ...existing,
                id: data.id || existing.id,
                sendTime,
                messageType,
                mediaType,
                mediaUrl: mediaUrl ?? existing.mediaUrl,
                isTemp: false,
                type: existing.type,
              }
            }
            return next
          }
        }
        return [
          ...prev,
          {
            id: data.id || genId('ws'),
            type: (isUser ? 'user' : 'seller') as MsgType,
            content,
            sendTime,
            userUuid: msgUserUuid,
            receiverUuid: data.receiver_uuid,
            messageType,
            mediaType,
            mediaUrl,
            avatar,
            read: false,
          },
        ]
      })
      scrollToBottom()
    },
    [scrollToBottom],
  )

  const handleWsMessage = useCallback(
    (data: RawMsg) => {
      if (data.event === 'room_message' || data.event === 'message') {
        addMessageToList(data)
      } else if (data.event === 'error') {
        Taro.showToast({
          title: data.message || data.msg || tt('agentDialogue.sendFailed', '发送失败'),
          icon: 'none',
        })
      } else if (data.content && (data.user_uuid || data.sender_uuid)) {
        addMessageToList(data)
      }
    },
    [addMessageToList, tt],
  )

  const connectWebSocket = useCallback(() => {
    if (!userUuidRef.current || wsTaskRef.current) return
    // ws URL 从 BASE_URL 推导,失败不阻塞主流程(降级为只展示历史消息)
    const wsUrl = 'ws://localhost:8801/api/chat-room/ws'
    Taro.connectSocket({ url: wsUrl })
      .then((task) => {
        wsTaskRef.current = task
        task.onOpen(() => {
          wsConnectedRef.current = true
          task.send({
            data: JSON.stringify({
              event: 'join_room',
              user_uuid: userUuidRef.current,
              room_id: roomIdRef.current,
              room_name: chatTitle,
              receiver_uuid: receiverUuidRef.current,
            }),
          })
        })
        task.onMessage((res) => {
          try {
            const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
            handleWsMessage(data as RawMsg)
          } catch (e) {
            logger.error('agentDialogue', 'ws 解析', e)
          }
        })
        task.onError(() => {
          wsConnectedRef.current = false
        })
        task.onClose(() => {
          wsConnectedRef.current = false
          wsTaskRef.current = null
        })
      })
      .catch((e) => logger.error('agentDialogue', 'ws 连接', e))
  }, [chatTitle, handleWsMessage])

  const sendMessage = useCallback(async () => {
    const content = inputContent.trim()
    if (!content || sending) return
    if (!userUuidRef.current) {
      Taro.showToast({ title: tt('agentDialogue.userMissing', '用户信息不完整'), icon: 'none' })
      return
    }
    const tempId = genId('temp')
    const userMsg: DisplayMessage = {
      id: tempId,
      type: 'user',
      content,
      sendTime: new Date().toISOString(),
      userUuid: userUuidRef.current,
      receiverUuid: receiverUuidRef.current,
      messageType: 1,
      mediaType: null,
      mediaUrl: null,
      avatar: userAvatarRef.current,
      read: false,
      isTemp: true,
    }
    setChatList((prev) => [...prev, userMsg])
    setInputContent('')
    setSending(true)
    scrollToBottom()

    if (wsConnectedRef.current && wsTaskRef.current) {
      const ok = await new Promise<boolean>((resolve) => {
        wsTaskRef.current!.send({
          data: JSON.stringify({
            event: 'send_message',
            user_uuid: userUuidRef.current,
            room_id: roomIdRef.current,
            receiver_uuid: receiverUuidRef.current,
            content,
          }),
          success: () => resolve(true),
          fail: () => resolve(false),
        })
      })
      if (!ok) {
        setChatList((prev) => prev.filter((m) => m.id !== tempId))
        Taro.showToast({ title: tt('agentDialogue.sendFailed', '发送失败'), icon: 'none' })
      }
    } else {
      // ws 不可用降级:标记为已发送
      setChatList((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, isTemp: false, read: true } : m)),
      )
    }
    setSending(false)
  }, [inputContent, sending, scrollToBottom, tt])

  const loadMoreHistory = useCallback(() => {
    if (loading || !hasMoreRef.current) return
    pageRef.current += 1
    loadChatHistory(pageRef.current, 'prepend')
  }, [loading, loadChatHistory])

  const previewImage = useCallback(
    (url: string) => {
      const urls = chatList
        .filter((m) => m.mediaType === 'image' || m.messageType === 2)
        .map((m) => (m.mediaUrl || m.content) as string)
        .filter(Boolean)
      Taro.previewImage({ urls: urls.length > 0 ? urls : [url], current: url })
    },
    [chatList],
  )

  const openAudio = useCallback(
    (_url: string) => {
      Taro.showToast({
        title: tt('agentDialogue.openInBrowser', '请在浏览器中打开'),
        icon: 'none',
      })
    },
    [tt],
  )

  const openFile = useCallback(
    (_url: string) => {
      Taro.showToast({
        title: tt('agentDialogue.openInBrowser', '请在浏览器中打开'),
        icon: 'none',
      })
    },
    [tt],
  )

  useReady(() => {
    if (initedRef.current) return
    initedRef.current = true
    const params = Taro.getCurrentInstance().router?.params || {}
    const roomId = (params.roomId as string) || (params.id as string) || ''
    const roomName = params.room_name ? decodeURIComponent(params.room_name as string) : ''
    const receiverUuid = params.receiver_uuid
      ? decodeURIComponent(params.receiver_uuid as string)
      : ''
    const avatar = params.avatar ? decodeURIComponent(params.avatar as string) : ''

    roomIdRef.current = roomId
    receiverUuidRef.current = receiverUuid
    if (roomName) setChatTitle(roomName)
    if (avatar) sellerAvatarRef.current = avatar

    const userData = (Taro.getStorageSync('data') || {}) as {
      uuid?: string
      avatar?: string
      headimgurl?: string
      thirdPartyAccounts?: { avatar?: string }
    }
    if (userData.uuid) userUuidRef.current = userData.uuid
    if (userData.avatar) userAvatarRef.current = userData.avatar
    else if (userData.headimgurl) userAvatarRef.current = userData.headimgurl
    else if (userData.thirdPartyAccounts?.avatar)
      userAvatarRef.current = userData.thirdPartyAccounts.avatar

    if (roomId && userUuidRef.current) {
      pageRef.current = 1
      loadChatHistory(1, 'replace')
      markAsRead()
    }
    if (userUuidRef.current) {
      connectWebSocket()
    }
  })

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: chatTitle })
  }, [chatTitle])

  useEffect(() => {
    return () => {
      if (wsTaskRef.current) {
        try {
          wsTaskRef.current.close({})
        } catch {
          // ignore
        }
        wsTaskRef.current = null
      }
    }
  }, [])

  const onInputChange = useCallback((e: { detail: { value: string } }) => {
    setInputContent(e.detail.value)
  }, [])

  const renderBubble = (msg: DisplayMessage) => {
    if (msg.mediaType === 'image' || msg.messageType === 2) {
      const url = msg.mediaUrl || msg.content
      return (
        <Image
          className="msg-image"
          src={url}
          mode="aspectFit"
          onClick={() => previewImage(url)}
        />
      )
    }
    if (msg.mediaType === 'video' || msg.messageType === 5) {
      const url = msg.mediaUrl || msg.content
      return <Video className="msg-video" src={url} controls poster={msg.poster || ''} />
    }
    if (msg.mediaType === 'audio' || msg.messageType === 3) {
      const url = msg.mediaUrl || msg.content
      return (
        <View className="msg-media">
          <Text className="media-text">🎵 {tt('agentDialogue.audioMessage', '音频消息')}</Text>
          <Text className="media-link" onClick={() => openAudio(url)}>
            {tt('agentDialogue.clickPlay', '点击播放')}
          </Text>
        </View>
      )
    }
    if (msg.mediaType === 'file' || msg.messageType === 4) {
      const url = msg.mediaUrl || msg.content
      return (
        <View className="msg-media">
          <Text className="media-text">📄 {tt('agentDialogue.fileMessage', '文件消息')}</Text>
          <Text className="media-link" onClick={() => openFile(url)}>
            {tt('agentDialogue.clickView', '点击查看')}
          </Text>
        </View>
      )
    }
    return <Text className="bubble-text">{msg.content}</Text>
  }

  return (
    <View className="agent-dialogue-page">
      <ScrollView
        className="chat-container"
        scrollY
        scrollTop={scrollTop}
        scrollWithAnimation
        onScrollToUpper={loadMoreHistory}
        upperThreshold={50}
      >
        <View className="chat-messages">
          {chatList.length === 0 && !loading ? (
            <View className="empty-state">
              <Text className="empty-text">
                {tt('agentDialogue.messageEmpty', '发送消息开始对话')}
              </Text>
            </View>
          ) : null}
          {chatList.map((msg) => (
            <View key={String(msg.id)} className={`message-item ${msg.type}`}>
              {msg.type === 'user' ? (
                <>
                  <View className={`message-bubble user-bubble ${isMedia(msg) ? 'media-message' : ''}`}>
                    {renderBubble(msg)}
                    {msg.read ? (
                      <Text className="read-status">{tt('agentDialogue.read', '已读')}</Text>
                    ) : null}
                  </View>
                  <View className="avatar user-avatar">
                    {msg.avatar ? (
                      <Image src={msg.avatar} mode="aspectFill" className="avatar-img" />
                    ) : (
                      <Text className="avatar-placeholder">👤</Text>
                    )}
                  </View>
                </>
              ) : msg.type === 'seller' ? (
                <>
                  <View className="avatar seller-avatar">
                    {msg.avatar ? (
                      <Image src={msg.avatar} mode="aspectFill" className="avatar-img" />
                    ) : (
                      <Text className="avatar-placeholder">🤖</Text>
                    )}
                  </View>
                  <View className={`message-bubble seller-bubble ${isMedia(msg) ? 'media-message' : ''}`}>
                    {renderBubble(msg)}
                  </View>
                </>
              ) : (
                <View className="system-message">
                  <Text className="system-text">{msg.content}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      <View className="input-box">
        <Input
          className="chat-input"
          value={inputContent}
          placeholder={tt('agentDialogue.inputPlaceholder', '输入消息…')}
          onInput={onInputChange}
          confirmType="send"
          onConfirm={sendMessage}
          disabled={sending}
        />
        <View
          className={`send-btn ${!inputContent.trim() || sending ? 'disabled' : ''}`}
          onClick={sendMessage}
        >
          <Text className="send-text">{t('chat.send')}</Text>
        </View>
      </View>
    </View>
  )
}
