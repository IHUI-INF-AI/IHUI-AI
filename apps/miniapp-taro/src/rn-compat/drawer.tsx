// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `apps/mobile-rn/src/components/Drawer` 在小程序端的承载。
 *
 * RN 版 Drawer 依赖 Modal / PanResponder / Animated 手势链，小程序端没有等价物。
 * 这里不是再写一份侧栏，而是复用端内已有的 Taro DrawerComponent（side='left'），
 * 把 RN Drawer 的 props 面翻译成 Taro 侧栏能消费的菜单/会话/用户数据：
 *  - 菜单键仍使用 `home / ai / square / share / mine`，点击后回调 RN 调用方的 onNavigate；
 *  - 会话列表按模型/日期分组，点击/删除分别回调 onSelectConversation / onDeleteConversation；
 *  - 一人公司 / 领取资料 / 创建新对话 / 设置 / 消息 走原回调；
 *  - 关闭态不挂树，打开态才挂 Taro 侧栏。
 *
 * 平台特有：Taro 组件与 i18n / LineIcon 只能在本层使用，不进共享包。
 */
import { useMemo, type ReactNode } from 'react'
import DrawerComponent, {
  type DrawerChatItem,
  type DrawerMenuItem,
  type DrawerModelGroup,
} from '@/components/DrawerComponent'
import { useTt } from '@/i18n'

export type DrawerTab = 'home' | 'ai' | 'square' | 'share' | 'mine'
export type DrawerExtraMenu = 'tools' | 'aigc' | 'learn' | 'modelPlaza' | 'company' | 'assistant'
export type DrawerUserLevel = 'vip' | 'normal'

export interface DrawerModelConfig {
  id: string
  name: string
  icon?: string
}

export interface DrawerConversationItem {
  id: string
  title: string
  modelConfig?: DrawerModelConfig
  createdAt: number
  favorited?: boolean
  source?: string | null
}

export interface DrawerUser {
  avatar?: string
  nickname?: string
  level?: DrawerUserLevel
}

export interface DrawerProps {
  visible?: boolean
  onClose?: () => void
  children?: ReactNode
  /** RN 调用方传入的当前 tab（保留签名，Taro 侧栏不依赖它决定显隐） */
  activeTab?: DrawerTab
  user?: DrawerUser
  conversations?: readonly DrawerConversationItem[]
  onNavigate?: (tab: DrawerTab) => void
  onNavigateExtra?: (menu: DrawerExtraMenu) => void
  onNavigateCompany?: () => void
  onClaimFree?: () => void
  onCreateNewChat?: () => void
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
  onOpenSettings?: () => void
  onOpenMessages?: () => void
  onGoHome?: () => void
}

/**
 * 会话 → Taro Drawer 的「模型 + 日期」两层分组。
 * RN 的会话对象只带 createdAt；日期标签用本地日期短格式，避免把时间轴写成硬编码。
 */
function groupConversations(conversations: readonly DrawerConversationItem[]): DrawerModelGroup[] {
  const modelMap = new Map<string, DrawerModelGroup>()
  for (const conv of conversations) {
    const modelName = conv.modelConfig?.name || '对话'
    const dateLabel = new Date(conv.createdAt || Date.now()).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    })
    let model = modelMap.get(modelName)
    if (!model) {
      model = { modelName, dateGroups: [] }
      modelMap.set(modelName, model)
    }
    let dateGroup = model.dateGroups.find((group) => group.date === dateLabel)
    if (!dateGroup) {
      dateGroup = { date: dateLabel, chats: [] }
      model.dateGroups.push(dateGroup)
    }
    const chat: DrawerChatItem = {
      id: conv.id,
      title: conv.title || '未命名对话',
      date: dateLabel,
    }
    dateGroup.chats.push(chat)
  }
  return Array.from(modelMap.values())
}

const MENU_KEYS: readonly DrawerTab[] = ['home', 'ai', 'square', 'share', 'mine']

export function Drawer(props: DrawerProps) {
  const {
    visible = false,
    onClose,
    user,
    conversations = [],
    onNavigate,
    onNavigateCompany,
    onClaimFree,
    onCreateNewChat,
    onSelectConversation,
    onDeleteConversation,
    onOpenSettings,
    onOpenMessages,
    onGoHome,
  } = props
  const tt = useTt()

  const menuItems = useMemo<DrawerMenuItem[]>(
    () => [
      { key: 'home', label: tt('DrawerComponent.home', '首页'), icon: 'home' },
      { key: 'ai', label: tt('DrawerComponent.ai', 'AI 应用商店'), icon: 'shopping-cart' },
      { key: 'square', label: tt('DrawerComponent.square', '广场'), icon: 'users' },
      { key: 'share', label: tt('DrawerComponent.share', '分享'), icon: 'share-2' },
      { key: 'mine', label: tt('DrawerComponent.mine', '我的'), icon: 'user' },
    ],
    [tt],
  )

  const labelItems = useMemo<DrawerMenuItem[]>(
    () => [
      { key: 'company', label: tt('DrawerComponent.d3', '我的一人公司'), icon: 'handshake' },
      { key: 'freebie', label: tt('DrawerComponent.d4', '领取免费资料'), icon: 'gift' },
      { key: 'newChat', label: tt('DrawerComponent.d5', '创建新对话'), icon: 'message-square' },
      { key: 'messages', label: tt('DrawerComponent.messages', '消息'), icon: 'bell' },
      { key: 'settings', label: tt('DrawerComponent.settings', '设置'), icon: 'settings' },
    ],
    [tt],
  )

  const groups = useMemo(() => groupConversations(conversations), [conversations])

  if (!visible) return null

  return (
    <DrawerComponent
      visible
      side="left"
      onClose={onClose}
      menuItems={menuItems}
      labelItems={labelItems}
      groupedData={groups}
      userinfo={{ avatar: user?.avatar, nickname: user?.nickname }}
      onMenuItemClick={(item) => {
        if (MENU_KEYS.includes(item.key as DrawerTab)) {
          onNavigate?.(item.key as DrawerTab)
        } else if (item.key === 'home') {
          onGoHome?.()
        }
      }}
      onLabelItemClick={(item) => {
        if (item.key === 'company') onNavigateCompany?.()
        else if (item.key === 'freebie') onClaimFree?.()
        else if (item.key === 'newChat') onCreateNewChat?.()
        else if (item.key === 'messages') onOpenMessages?.()
        else if (item.key === 'settings') onOpenSettings?.()
      }}
      onChatItemClick={(chat) => onSelectConversation?.(String(chat.id))}
      onRemoveChat={
        onDeleteConversation ? (chat) => onDeleteConversation(String(chat.id)) : undefined
      }
      onCreateChat={onCreateNewChat}
    />
  )
}

// 兼容两种取用形:HomeScreen 等取 `{ Drawer }`,AgentScreen/ShareScreen 取 default。
// 缺 default 会让后者的 JSX 拿到 undefined(React #130 整屏白),两端都需同一导出面。
export default Drawer
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
