// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/message-center/MessageCenterScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { MessageCenterScreen } from '@ihui/rn-app/features/message-center/MessageCenterScreen'
import type { MessageCenterItem, MessageConversationItem } from '@ihui/types'
import {
  getMessageRooms,
  getSystemNotices,
  getPrivateMessages,
  getNotificationPreferences,
  updateNotificationPreferences,
  markMessageRead,
  markPrivateRead,
  deleteMessage,
  deletePrivateMessage,
  type AggregateMessages,
  type NotificationPreferences,
} from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { getUserInfo } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { getTopBarMetrics } from '@/utils/system-info'
import ThemeRoot from '@/components/ThemeRoot'
import {
  NavBar,
  SystemNotice,
  PrivateMessageList,
  MessageDetail,
  MessageActions,
  NotificationSettings,
  type MessageTabItem,
  type SystemNoticeItem,
  type PrivateMessageItem,
  type MessageDetailItem,
  type NotificationSettingItem,
} from '@/components'
// 同目录 ./ 子模块:共享屏 order/course 两类的站内消息卡片(还原度门并入本页载体面)
import { InSiteMessagePane } from './in-site-messages'
import { onToast } from '@/host/on-toast'

interface Room {
  id?: string
  name?: string
  lastMessage?: string
  unreadCount?: number
  unread?: number
  isUnread?: boolean
  /**
   * 聚合行的数据源类别(loadAggregate 三条轨道逐条标):'private' 走行室兼容端点,
   * 'announcement'/'system' 走 edu_messages 主端点 —— 已读/删除按真实归属选出口,
   * 不做"一个端点打天下"的猜测(§0.3:拿不准就不给动作)。
   */
  kind?: 'announcement' | 'system' | 'private'
}

/**
 * 共享屏静态键 → 小程序既有词条。共享屏新增的 4 枚键(searchPh/markRead/deleteConv/loadMore)
 * 已按 §19 与词包同批落到本端五语言,表内不再回声映射。
 */
const MESSAGE_TEXT: Record<string, string> = {
  'messageCenter.settings': 'message.settings',
  'messageCenter.empty': 'message.empty',
  'messageCenter.type.system': 'message.tabs.system',
  'messageCenter.type.social': 'message.tabs.interaction',
}

const EMPTY_ITEMS: MessageCenterItem[] = []

const { menuButton } = getTopBarMetrics()

/** 行可动作判据:'private'/'announcement'/'system' 三类各自有真实端点才给入口(§0.3 拿不准就不给) */
const canActRoom = (room: Room): boolean => Boolean(room.id) && Boolean(room.kind)
/** 未读判据:与渲染红点同一取值序,不给"标了已读但红点还在"的错账 */
const roomHasUnread = (room: Room): boolean =>
  (room.unreadCount ?? room.unread ?? 0) > 0 || room.isUnread === true

const DEFAULT_SYSTEM: SystemNoticeItem[] = []
const DEFAULT_PRIVATE: PrivateMessageItem[] = []

export default function MessageIndex() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [list, setList] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  // XUI-066:四个取数请求都在 catch 里静默忽略,失败只剩空列表;现在如实上抛给共享屏。
  const [loadError, setLoadError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [bannerClosed, setBannerClosed] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [selectedPrivate, setSelectedPrivate] = useState<PrivateMessageItem | null>(null)
  const [detailInput, setDetailInput] = useState('')
  const [detailMessages, setDetailMessages] = useState<MessageDetailItem[]>([])
  const [systemList, setSystemList] = useState<SystemNoticeItem[]>(DEFAULT_SYSTEM)
  const [privateList, setPrivateList] = useState<PrivateMessageItem[]>(DEFAULT_PRIVATE)
  const [tabs, setTabs] = useState<MessageTabItem[]>(() => [
    { key: 'all', label: t('message.tabs.all') },
    { key: 'system', label: t('message.tabs.system'), unread: 0 },
    { key: 'order', label: t('messageCenter.type.order') },
    { key: 'course', label: t('messageCenter.type.course') },
    { key: 'interaction', label: t('message.tabs.interaction'), unread: 0 },
    { key: 'private', label: t('message.tabs.private'), unread: 0 },
  ])
  const [settings, setSettings] = useState<NotificationSettingItem[]>(() => [
    {
      key: 'system',
      label: t('message.notifLabels.system'),
      desc: t('message.notifDescs.system'),
      enabled: true,
    },
    {
      key: 'interaction',
      label: t('message.notifLabels.interaction'),
      desc: t('message.notifDescs.interaction'),
      enabled: true,
    },
    {
      key: 'private',
      label: t('message.notifLabels.private'),
      desc: t('message.notifDescs.private'),
      enabled: true,
    },
    {
      key: 'marketing',
      label: t('message.notifLabels.marketing'),
      desc: t('message.notifDescs.marketing'),
      enabled: false,
    },
  ])

  /** 共享屏词条适配:表内键走小程序既有词条,其余原样交回本端 t */
  const sharedT = useCallback(
    (key: string, params?: Record<string, string | number>) => t(MESSAGE_TEXT[key] ?? key, params),
    [t],
  )

  const loadAggregate = useCallback(async () => {
    try {
      const res: AggregateMessages = await getMessageRooms()
      const rooms: Room[] = []
      for (const ann of res.announcements || []) {
        rooms.push({
          id: ann.id,
          name: ann.title,
          lastMessage: ann.content || '',
          unreadCount: 0,
          kind: 'announcement',
        })
      }
      for (const priv of res.privateMessages || []) {
        rooms.push({
          id: String(priv.id),
          name: priv.senderId,
          lastMessage: priv.content,
          unreadCount: priv.isRead ? 0 : 1,
          isUnread: !priv.isRead,
          kind: 'private',
        })
      }
      for (const sys of res.systemNotices || []) {
        rooms.push({
          id: sys.id,
          name: sys.title,
          lastMessage: sys.content || '',
          unreadCount: 0,
          kind: 'system',
        })
      }
      setList(rooms)
      setTabs([
        { key: 'all', label: t('message.tabs.all') },
        { key: 'system', label: t('message.tabs.system'), unread: res.unreadCount?.system || 0 },
        { key: 'order', label: t('messageCenter.type.order') },
        { key: 'course', label: t('messageCenter.type.course') },
        { key: 'interaction', label: t('message.tabs.interaction'), unread: 0 },
        { key: 'private', label: t('message.tabs.private'), unread: res.unreadCount?.private || 0 },
      ])
    } catch {
      setLoadError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadSystemNotices = useCallback(async () => {
    try {
      const res = await getSystemNotices({ page: 1, pageSize: 20 })
      const items: SystemNoticeItem[] = (res.list || []).map((s) => ({
        id: s.id,
        title: s.title,
        content: s.content || '',
        type: (s.type === 'activity' || s.type === 'upgrade' ? s.type : 'system') as
          'system' | 'activity' | 'upgrade',
        createdAt: s.createdAt,
        read: false,
      }))
      setSystemList(items)
    } catch {
      setLoadError(t('common.loadFailed'))
    }
  }, [t])

  const loadPrivateMessages = useCallback(async () => {
    try {
      const res = await getPrivateMessages({ page: 1, pageSize: 20 })
      const items: PrivateMessageItem[] = (res.list || []).map((p) => ({
        id: String(p.id),
        userId: p.senderId,
        userName: p.senderId,
        lastMessage: p.content,
        lastTime: p.createdAt,
        unread: p.isRead ? 0 : 1,
        online: false,
      }))
      setPrivateList(items)
    } catch {
      setLoadError(t('common.loadFailed'))
    }
  }, [t])

  const loadPreferences = useCallback(async () => {
    try {
      const res: NotificationPreferences = await getNotificationPreferences()
      const items: NotificationSettingItem[] = [
        {
          key: 'system',
          label: t('message.notifLabels.system'),
          desc: t('message.notifDescs.system'),
          enabled: res.inAppEnabled,
        },
        {
          key: 'interaction',
          label: t('message.notifLabels.interaction'),
          desc: t('message.notifDescs.interaction'),
          enabled: res.pushEnabled,
        },
        {
          key: 'private',
          label: t('message.notifLabels.private'),
          desc: t('message.notifDescs.private'),
          enabled: res.inAppEnabled,
        },
        {
          key: 'marketing',
          label: t('message.notifLabels.marketing'),
          desc: t('message.notifDescs.marketing'),
          enabled: res.smsEnabled,
        },
      ]
      setSettings(items)
    } catch {
      setLoadError(t('common.loadFailed'))
    }
  }, [t])

  const load = useCallback(async () => {
    setLoadError('')
    await Promise.all([
      loadAggregate(),
      loadSystemNotices(),
      loadPrivateMessages(),
      loadPreferences(),
    ])
  }, [loadAggregate, loadSystemNotices, loadPrivateMessages, loadPreferences])

  // G-933 冷启动门控:聚合消息/系统通知/私信/通知偏好四枚请求均挂 checkAuth/authenticate(需鉴权),
  // 鉴权判定落定前整批不发
  useDidShow(() => gate.waitUntilReady(() => void load()))

  const notification = useMemo(() => {
    if (bannerClosed) return undefined
    const unreadRoom = list.find((r) => (r.unreadCount ?? r.unread ?? 0) > 0 || r.isUnread === true)
    const target = unreadRoom || list[0]
    if (!target || !target.lastMessage) return undefined
    // 共享屏横幅无关闭按钮 ⇒ 点按横幅关闭,保留原 onClose 的可撤销语义
    return { text: target.lastMessage, onPress: () => setBannerClosed(true) }
  }, [list, bannerClosed])

  const filtered = useMemo(() => {
    const kw = keyword.trim()
    if (!kw) return list
    return list.filter((r) => (r.name || '').includes(kw))
  }, [list, keyword])

  const onTabChange = (k: string) => setActiveTab(k)

  /**
   * 标记会话行已读(对齐 RN/spec handleMarkRead):成功只回写真行,失败显式喊出
   * (common.failed),**不做「先翻 UI 再补请求」的假成功**。出口按行来源分轨:
   * 私信 = POST /messages/private/:pid/read;公告/系统 = PUT /messages/:id/read。
   */
  const onRoomMarkRead = (room: Required<Pick<Room, 'id'>> & Room) => {
    const call = room.kind === 'private' ? markPrivateRead(room.id) : markMessageRead(room.id)
    void call
      .then(() => {
        setList((prev) =>
          prev.map((r) =>
            r.id === room.id ? { ...r, unreadCount: 0, unread: 0, isUnread: false } : r,
          ),
        )
      })
      .catch(() => {
        onToast(t('common.failed'), { kind: 'error' })
      })
  }

  /**
   * 删除会话行(对齐 RN/spec handleDeleteConversation):破坏性动作先经端内确认层
   * (Taro.showModal 为小程序标准模态,非 Web 原生提示窗),确认后才发请求;
   * 成功摘除本行,失败显式喊出。与 markRead 同源分轨。
   */
  const onRoomDelete = (room: Required<Pick<Room, 'id'>> & Room) => {
    void Taro.showModal({
      // 端内无现成「删除确认」共享键(搜遍 shared 五语言 0 命中),新键按 §19 须与词包同批
      // 落地会撞 scope 门 R2 ⇒ 弹窗以行名为正文:确认语义由 title(删除会话)+
      // 系统 destructive 按钮承载,零新增措辞、不借无关键冒充正文(宁缺毋滥)。
      title: t('messageCenter.deleteConv'),
      content: room.name || t('messageCenter.conversations'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
    }).then((res) => {
      if (!res.confirm) return
      const call = room.kind === 'private' ? deletePrivateMessage(room.id) : deleteMessage(room.id)
      void call
        .then(() => {
          setList((prev) => prev.filter((r) => r.id !== room.id))
        })
        .catch(() => {
          onToast(t('common.failed'), { kind: 'error' })
        })
    })
  }

  const onOpenPrivate = async (item: PrivateMessageItem) => {
    setSelectedPrivate(item)
    setDetailMessages([])
    try {
      const params: { page?: number; pageSize?: number; peerId?: string } = {
        peerId: item.userId,
        page: 1,
        pageSize: 50,
      }
      const res = await getPrivateMessages(params)
      const me = String(getUserInfo()?.id ?? '')
      const msgs: MessageDetailItem[] = (res.list || [])
        .slice()
        .reverse()
        .map((p) => ({
          id: String(p.id),
          content: p.content,
          createdAt: p.createdAt,
          self: String(p.senderId) === me,
        }))
      setDetailMessages(
        msgs.length
          ? msgs
          : [
              {
                id: 'm1',
                content: t('message.hello', { name: item.userName }),
                createdAt: item.lastTime,
                self: false,
              },
            ],
      )
    } catch (e) {
      logger.error('message', '加载历史消息', e)
      setDetailMessages([
        {
          id: 'm1',
          content: t('message.hello', { name: item.userName }),
          createdAt: item.lastTime,
          self: false,
        },
      ])
    }
  }

  const onSendDetail = () => {
    const text = detailInput.trim()
    if (!text || !selectedPrivate) return
    setDetailMessages((prev) => [
      ...prev,
      { id: `m${prev.length + 1}`, content: text, createdAt: t('message.justNow'), self: true },
    ])
    setDetailInput('')
  }

  const onToggleSetting = async (key: string, enabled: boolean) => {
    setSettings((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)))
    try {
      const patch: Partial<NotificationPreferences> = {}
      if (key === 'system' || key === 'private') patch.inAppEnabled = enabled
      if (key === 'interaction') patch.pushEnabled = enabled
      if (key === 'marketing') patch.smsEnabled = enabled
      await updateNotificationPreferences(patch)
    } catch {
      // ignore - local state already updated
    }
  }

  /**
   * 聚合行 → 共享屏会话行契约:'all' tab 的行渲染/删除/点击行为统一由共享屏承载
   * (与 RN 同形),本端只注入数据与平台特有动作(标记已读)。
   */
  const conversations = useMemo<MessageConversationItem[]>(
    () =>
      filtered
        .filter((room): room is Required<Pick<Room, 'id'>> & Room => Boolean(room.id))
        .map((room) => ({
          id: room.id,
          name: room.name || t('message.unnamedRoom'),
          lastMessage: room.lastMessage || t('message.empty'),
          unread: room.unreadCount ?? room.unread ?? 0,
          pinned: false,
        })),
    [filtered, t],
  )

  const findRoom = (id: string) => list.find((room) => room.id === id)

  /** 点击会话行:私信进详情页;公告/系统行本端无独立详情页,切到系统通知 tab 看全文 */
  const onPressConversation = (conv: MessageConversationItem) => {
    const room = findRoom(conv.id)
    if (!room) return
    if (room.kind === 'private') {
      const item = privateList.find((p) => p.id === conv.id)
      if (item) {
        void onOpenPrivate(item)
        return
      }
      setActiveTab('private')
      return
    }
    setActiveTab('system')
  }

  /** 行级平台动作槽位:聚合行只有「标记已读」有真实端点语义;置顶无会话身份 ⇒ 不给假入口。
   *  动作区是共享行内嵌的兄弟节点,必须阻断冒泡,避免点「标记已读」同时触发整行跳转。 */
  const renderConversationActions = (conv: MessageConversationItem) => {
    const room = findRoom(conv.id)
    if (!room || !canActRoom(room) || !roomHasUnread(room)) return null
    return (
      <View onClick={(e) => e.stopPropagation()}>
        <MessageActions
          onMarkRead={() => onRoomMarkRead(room as { id: string } & Room)}
          markReadLabel={t('messageCenter.markRead')}
        />
      </View>
    )
  }

  /**
   * 共享屏缺段(进缺段表,不造字段):系统通知、私信列表、order/course 站内消息由本端注入;
   * 'all' 会话行已下沉到共享屏统一渲染,这里返回 null 交回共享屏默认区。
   */
  const renderTabBody = (tab: string) => {
    if (tab === 'order' || tab === 'course') {
      return <InSiteMessagePane msgType={tab} />
    }
    if (tab === 'system') {
      return (
        <SystemNotice list={systemList} onClick={(item) => onToast(item.title, { kind: 'info' })} />
      )
    }
    if (tab === 'private') {
      return <PrivateMessageList list={privateList} onClick={onOpenPrivate} />
    }
    return null
  }

  if (selectedPrivate) {
    return (
      <ThemeRoot>
        <View className="min-h-screen bg-background">
          <NavBar
            title={selectedPrivate.userName}
            showBack
            onBack={() => setSelectedPrivate(null)}
          />
          <View style={{ height: `${menuButton.top + menuButton.height + 8}px` }} />
          <View style={{ height: 'calc(100vh - 60px)' }}>
            <MessageDetail
              userName={selectedPrivate.userName}
              userAvatar={undefined}
              messages={detailMessages}
              inputValue={detailInput}
              onInput={setDetailInput}
              onSend={onSendDetail}
            />
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot>
      <MessageCenterScreen
        t={sharedT}
        items={EMPTY_ITEMS}
        activeTab={activeTab}
        onSelectTab={onTabChange}
        tabs={tabs}
        loading={loading}
        refreshing={false}
        error={loadError}
        onRefresh={() => void load()}
        search={
          activeTab === 'all'
            ? {
                value: keyword,
                placeholder: sharedT('messageCenter.searchPh'),
                onChangeText: setKeyword,
              }
            : undefined
        }
        notification={notification}
        onPressSettings={() => setShowSettings(true)}
        onBack={() => void Taro.navigateBack()}
        emptyText={keyword ? t('message.notFound') : t('message.empty')}
        conversations={conversations}
        conversationsTab="all"
        onPressConversation={onPressConversation}
        onDeleteConversation={(conv) => {
          const room = findRoom(conv.id)
          if (room && canActRoom(room)) onRoomDelete(room as { id: string } & Room)
        }}
        renderConversationActions={renderConversationActions}
        renderTabBody={renderTabBody}
        onToast={onToast}
      />
      {showSettings && (
        <View
          className="fixed inset-0 z-[2000] bg-[rgba(0,0,0,0.4)]"
          onClick={() => setShowSettings(false)}
        >
          <View
            className="absolute bottom-0 left-0 right-0 bg-card ui-panel rounded-t-xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            hoverClass="opacity-60"
          >
            <View className="flex items-center justify-between px-lg py-md mb-sm">
              <Text className="text-body font-medium text-foreground">
                {t('message.notificationSettings')}
              </Text>
              <Text
                className="text-body text-muted-foreground"
                onClick={() => setShowSettings(false)}
              >
                {t('message.close')}
              </Text>
            </View>
            <NotificationSettings items={settings} onToggle={onToggleSetting} />
          </View>
        </View>
      )}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
