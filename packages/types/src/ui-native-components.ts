/**
 * 跨端组件共享类型(mobile-rn + miniapp-taro 同名组件)
 *
 * 设计原则:
 * - 只提取两端完全相同或语义相同的类型
 * - 字段名不同的 Props 不统一(保留两端各自定义),仅统一 Item 类型
 * - 命名采用组件前缀避免冲突(如 TitleSwitchOverlapItem 而非 TitleSwitchItem)
 *
 * 字段名映射说明(两端语义相同但命名不同,未提取统一 Props):
 * - Carousel: mobile-rn 用 banner/autoplayInterval/onItemPress,
 *             miniapp-taro 用 items/autoplay/interval/onItemClick/className
 * - Menu: mobile-rn 用 onPress,miniapp-taro 用 onItemClick/className
 * - VoiceInput: mobile-rn 额外有 aiServiceUrl/language,miniapp-taro 额外有 onError(差异大,不提取)
 * - UserInfoCard / VideoPlayer / AiModelCard: 两端设计完全不同,跳过
 */

// ===== Carousel =====
/** 轮播图单项数据(两端完全相同) */
export interface CarouselItem {
  img: string
  link?: string
  [key: string]: unknown
}

// ===== Menu =====
/**
 * 菜单单项数据(两端字段相同)
 * 统一为必选版(mobile-rn 原本必选;miniapp-taro 原本可选但代码已处理可选情况,
 * 改为必选不会破坏 miniapp-taro 代码:`item.id ?? index` 和 `item.icon ?` 仍合法)
 */
export interface MenuItem {
  id: number | string
  name: string
  icon: string
  [key: string]: unknown
}

// ===== AgentRuntimePanel =====
/** Agent 运行时状态(两端完全相同,对应各端本地 AgentStatus) */
export type AgentRuntimeStatus = 'idle' | 'running' | 'completed' | 'failed'

/** Agent 权限事件(两端完全相同,对应各端本地 PermissionEvent) */
export interface AgentRuntimePermissionEvent {
  mode: string
  toolName?: string
  dangerLevel?: string
  decision: string
}

/** AgentRuntimePanel Props(两端完全相同) */
export interface AgentRuntimePanelProps {
  sessionId?: string
}

// ===== ModelConfigDialog =====
/**
 * 模型配置类型(两端完全相同)
 * 注意:命名为 ModelConfigType 以避免与 legacy-migration.ts 的 ModelType(LLM 厂商)冲突
 */
export type ModelConfigType = 'text' | 'image' | 'video' | 'audio' | 'multimodal'

// ===== TitleSwitchOverlap =====
/** 重叠标题切换单项(两端语义相同,均只有 name) */
export interface TitleSwitchOverlapItem {
  name: string
}

/**
 * TitleSwitchOverlap Props(两端字段语义相同,miniapp-taro 多 defaultCurrent)
 * - mobile-rn 本地用 Props(无 defaultCurrent),可忽略该可选字段
 * - miniapp-taro 本地用 TitleSwitchOverlapProps(有 defaultCurrent)
 */
export interface TitleSwitchOverlapProps {
  mainList?: TitleSwitchOverlapItem[]
  defaultCurrent?: number
  onCurrentChange?: (index: number) => void
}

// ===== TitleSwitchScrollPicker =====
/** 滚轮选择器单项(两端语义相同,均只有 name) */
export interface TitleSwitchScrollPickerItem {
  name: string
}

/**
 * TitleSwitchScrollPicker Props(两端字段语义相同,miniapp-taro 多 defaultIndex)
 * - mobile-rn 本地用 Props(无 defaultIndex),可忽略该可选字段
 * - miniapp-taro 本地用 TitleSwitchScrollPickerProps(有 defaultIndex)
 */
export interface TitleSwitchScrollPickerProps {
  mainList?: TitleSwitchScrollPickerItem[]
  defaultIndex?: number
  onChange?: (index: number) => void
}

// ===== TitleSwitchScrollTitle =====
/** 滚动标题单项(支持嵌套 children,两端语义相同) */
export interface TitleSwitchScrollTitleItem {
  name: string
  children?: TitleSwitchScrollTitleItem[]
}

/**
 * TitleSwitchScrollTitle Props(两端字段语义相同,miniapp-taro 多 swiperMargin 字段)
 * - mobile-rn 本地用 Props(无 swiperMargin),可忽略可选字段
 * - miniapp-taro 本地用 TitleSwitchScrollTitleProps(有 mainSwiperMargin/subSwiperMargin)
 */
export interface TitleSwitchScrollTitleProps {
  mainList?: TitleSwitchScrollTitleItem[]
  mainSwiperMargin?: string
  subSwiperMargin?: string
  onChange?: (sub: TitleSwitchScrollTitleItem) => void
}

// ===== TitleSwitchTypeBar =====
/** 类型栏单项(两端字段相同,miniapp-taro 多 type? 可选) */
export interface TitleSwitchTypeBarItem {
  id: string
  name: string
  butUrl?: string
  field1?: string
  type?: string
}

/** TitleSwitchTypeBar Props(两端完全相同) */
export interface TitleSwitchTypeBarProps {
  showAll?: boolean
  customize?: boolean
  onChange?: (ids: string[]) => void
}
