/**
 * 跨端组件共享类型(mobile-rn + miniapp-taro 同名组件)
 *
 * 设计原则:
 * - 只提取两端完全相同或语义相同的类型
 * - 字段名不同的 Props 不统一(保留两端各自定义),仅统一 Item 类型
 * - 命名采用组件前缀避免冲突(如 TitleSwitchOverlapItem 而非 TitleSwitchItem)
 * - 差异大的组件对提取 Minimal Props(只含两端公共语义字段),各端本地 Props 可 extends
 *
 * 字段名映射说明(两端语义相同但命名不同,未提取统一 Props):
 * - Carousel: mobile-rn 用 banner/autoplayInterval/onItemPress,
 *             miniapp-taro 用 items/autoplay/interval/onItemClick/className
 * - Menu: mobile-rn 用 onPress,miniapp-taro 用 onItemClick/className
 * - VideoPlayer: mobile-rn 用 url(必选)/onProgress/onComplete/startPosition/VideoComponent,
 *                miniapp-taro 用 src(可选)/onTimeUpdate/onEnded/poster/autoplay/controls/className
 *                (字段名不同,提取 VideoPlayerMinimalProps 仅含公共语义字段,以 mobile-rn 命名为准)
 * - UserInfoCard: mobile-rn 用 `userInfo: UserInfo` 对象结构 + 登录/编辑/充值回调,
 *                 miniapp-taro 用扁平 props(avatar/nickname/level/levelTitle/isVip/vipTitle/desc/className)
 *                 (结构完全不同,提取 UserInfo 数据类型 + UserInfoCardMinimalProps 扁平公共字段)
 * - AiModelCard: mobile-rn 用 `data: AiModelData` 对象结构 + type('view'|'buy') + onBuyPress,
 *                miniapp-taro 用扁平 props(name/description/extra/className)
 *                (结构不同,提取 AiModelData/AiModelUserType 数据类型 + AiModelCardMinimalProps 扁平公共字段)
 * - VoiceInput: mobile-rn 额外有 aiServiceUrl/language,miniapp-taro 额外有 onError
 *               (公共字段提取为 VoiceInputMinimalProps,各端 extends)
 */

// ===== Carousel =====
/** 轮播图单项数据(两端完全相同) */
export interface CarouselItem {
  img: string
  link?: string
  /** 可选标题(轮播图内显示) */
  title?: string
  /** 可选副标题 */
  subtitle?: string
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
export type ModelConfigType = 'text' | 'image' | 'video' | 'audio' | 'multimodal' | 'aigc'

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
  /** 'multi' = 多选(默认,'tab' 行为);'single' = 单选(对齐 'single' 行为) */
  mode?: 'multi' | 'single'
  /** single 模式下当前选中 id(受控) */
  value?: string
  /** 父组件注入的标签列表(不传则用默认 DEFAULT_TABS) */
  mainList?: TitleSwitchTypeBarItem[]
  onChange?: (ids: string[]) => void
}

// ===== UserInfoCard =====
/**
 * 用户信息数据类型(mobile-rn UserInfoCard 使用;miniapp-taro 用扁平 props,暂不直接使用)
 *
 * 字段说明:
 * - isVip 为 number(0/1),mobile-rn 通过 `isVip === 1` 判断;
 *   miniapp-taro 用 boolean,如需桥接可在调用处 `Boolean(userInfo.isVip)`
 * - tokenQuantity 支持 number | string,兼容后端返回的字符串数字
 */
export interface UserInfo {
  uuid?: string
  username?: string
  avatarUrl?: string
  isVip?: number
  identityType?: number
  tokenQuantity?: number | string
  [key: string]: unknown
}

/**
 * UserInfoCard Minimal Props(两端扁平公共字段)
 *
 * 各端本地 Props 与 Minimal 的关系:
 * - mobile-rn: 用 `userInfo: UserInfo` 对象结构,本地 UserInfoCardProps 不 extends Minimal
 *   (结构完全不同,仅引用共享 UserInfo 数据类型)
 * - miniapp-taro: 扁平 props,本地 UserInfoCardProps extends UserInfoCardMinimalProps
 *   并追加 level/levelTitle/className
 */
export interface UserInfoCardMinimalProps {
  /** 用户头像 URL */
  avatar?: string
  /** 用户昵称 */
  nickname?: string
  /** 是否为 VIP */
  isVip?: boolean
  /** VIP 标题(如"VIP"、"会员") */
  vipTitle?: string
  /** 描述信息 */
  desc?: string
  /** 点击回调 */
  onClick?: () => void
}

// ===== VideoPlayer =====
/**
 * VideoPlayer Minimal Props(两端公共语义字段,字段名以 mobile-rn 为准)
 *
 * 字段名映射:
 * - url: mobile-rn=url(必选), miniapp-taro=src(可选)
 * - onProgress: mobile-rn=onProgress, miniapp-taro=onTimeUpdate
 * - onComplete: mobile-rn=onComplete, miniapp-taro=onEnded
 * - onError: 两端字段名相同
 *
 * 各端本地 Props 与 Minimal 的关系:
 * - mobile-rn: 本地 VideoPlayerProps 不直接 extends(url 必选 + 额外字段 title/startPosition/VideoComponent)
 * - miniapp-taro: 本地 VideoPlayerProps 字段名不同(src/onTimeUpdate/onEnded),不 extends
 *   (Minimal 仅作语义参考,各端保留本地定义)
 */
export interface VideoPlayerMinimalProps {
  /** 视频 URL(mobile-rn=url, miniapp-taro=src) */
  url?: string
  /** 错误回调 */
  onError?: (error: string) => void
  /** 时间更新回调(mobile-rn=onProgress, miniapp-taro=onTimeUpdate) */
  onProgress?: (currentTime: number, duration: number) => void
  /** 播放结束回调(mobile-rn=onComplete, miniapp-taro=onEnded) */
  onComplete?: () => void
}

// ===== AiModelCard =====
/**
 * AI 模型用户类型枚举(mobile-rn AiModelCard 使用;miniapp-taro 暂未使用)
 * - freevip: 会员免费
 * - freeuse: 免费使用
 * - freetime: 限时免费
 * - hasbuy: 已购买
 * - buymonth: 包月
 * - none: 无(默认)
 */
export type AiModelUserType =
  | 'freevip'
  | 'freeuse'
  | 'freetime'
  | 'hasbuy'
  | 'buymonth'
  | 'none'

/**
 * AI 模型数据类型(mobile-rn AiModelCard 使用;miniapp-taro 用扁平 props)
 *
 * 字段说明:
 * - mumber: 模型编号/序号(legacy 命名,保持兼容)
 * - userType: 用户对该模型的权限类型,映射到标签文案
 */
export interface AiModelData {
  name: string
  subname?: string
  icon?: string
  mumber?: number | string
  userType?: AiModelUserType
  tags?: string[]
  [key: string]: unknown
}

/**
 * AiModelCard Minimal Props(两端扁平公共字段)
 *
 * 各端本地 Props 与 Minimal 的关系:
 * - mobile-rn: 用 `data: AiModelData` 对象结构,本地 AiModelCardProps 不 extends Minimal
 *   (结构不同,仅引用共享 AiModelData/AiModelUserType 数据类型)
 * - miniapp-taro: 扁平 props,本地 AiModelCardProps extends AiModelCardMinimalProps
 *   并追加 description/extra/className
 */
export interface AiModelCardMinimalProps {
  /** 模型名称 */
  name: string
  /** 模型图标 URL */
  icon?: string
  /** 标签列表 */
  tags?: string[]
  /** 点击回调 */
  onClick?: () => void
}

// ===== VoiceInput =====
/**
 * VoiceInput Minimal Props(两端公共字段)
 *
 * 各端本地 Props 与 Minimal 的关系:
 * - mobile-rn: VoiceInputProps extends VoiceInputMinimalProps,追加 aiServiceUrl/language
 * - miniapp-taro: VoiceInputProps 完全匹配 Minimal,可直接用 type alias
 */
export interface VoiceInputMinimalProps {
  /** 是否禁用 */
  disabled?: boolean
  /** 占位提示文字 */
  placeholder?: string
  /** 实时识别回调(部分结果) */
  onChange?: (text: string) => void
  /** 录音完成回调(最终结果) */
  onComplete?: (text: string) => void
  /** 错误回调 */
  onError?: (message: string) => void
}
