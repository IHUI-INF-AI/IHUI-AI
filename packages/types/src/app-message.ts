// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「message」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { TFunction } from './app-shared.js'


/** 消息中心 Tab key(可扩展为任意 string) */
export type MessageTab = 'system' | 'order' | 'course' | 'social' | (string & {})

/** 消息项(平台注入,字段对齐 mobile-rn MessageCenterScreen Message) */
export interface MessageCenterItem {
  id: string
  type: MessageTab
  title: string
  content: string
  /** 是否已读 */
  read: boolean
  createdAt: string
}

/** 消息中心会话列表项(对齐 Uniapp message 页聊天列表 chatList)
 * 字段对齐 mobile-rn MessageCenterScreen conversations */
export interface MessageConversationItem {
  id: string
  name: string
  avatar?: string
  /** 最后一条消息预览(对齐原 chat-item lastMessage) */
  lastMessage?: string
  /** 最后消息时间(对齐原 chat-item time) */
  time?: string
  /** 未读数(可选,>0 显示红点) */
  unread?: number
  /** 状态文案(可选,如「在线」) */
  status?: string
  /** 是否置顶(chat_conversations.pinned;服务端列表接口已按置顶优先排序返回) */
  pinned?: boolean
}

/** 消息中心共享屏 props */
export interface MessageCenterScreenProps {
  t: TFunction
  items: MessageCenterItem[]
  /** 当前激活 tab */
  activeTab: MessageTab
  /** tab 切换回调,平台注入重新拉取逻辑 */
  onSelectTab: (tab: MessageTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击消息卡片回调,可选 */
  onPressItem?: (item: MessageCenterItem) => void
  /** 会话列表(对齐 Uniapp message 页聊天列表;不传则不渲染该区块) */
  conversations?: MessageConversationItem[]
  /** 点击会话回调(对齐 Uniapp handleChatClick → 会话聊天页) */
  onPressConversation?: (item: MessageConversationItem) => void
  /** 置顶/取消置顶会话回调(可选;不传则会话行不渲染置顶按钮)。
   *  调用方一律经 @ihui/api-client setConversationPinned 发起,失败必须有可见反馈。 */
  onTogglePin?: (item: MessageConversationItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 批次 15(2026-07-29):消息/记录/关系类(私聊/群聊/系统/详情/积分/学习/收益/邀请/关注/收藏) */

/** 私信列表项(对齐 mobile-rn MessageDirectScreen Item) */
export interface MessageDirectItem {
  memberId: string
  nickname: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}
export interface MessageDirectScreenProps {
  t: TFunction
  items: MessageDirectItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: MessageDirectItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 群聊列表项(对齐 mobile-rn MessageGroupScreen Item) */
export interface MessageGroupItem {
  groupId: string
  groupName: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
}
export interface MessageGroupScreenProps {
  t: TFunction
  items: MessageGroupItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: MessageGroupItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 系统消息列表项(对齐 mobile-rn MessageSystemScreen Item) */
export interface MessageSystemItem {
  id: string
  title: string
  content: string
  time: string
  read: boolean
}
export interface MessageSystemScreenProps {
  t: TFunction
  items: MessageSystemItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onPressItem: (item: MessageSystemItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 消息详情(对齐 mobile-rn MessageDetailScreen Message) */
export interface MessageDetailData {
  id: string
  subject: string
  content: string
  fromUser: string
  createdAt: string
  read: boolean
}
export interface MessageDetailScreenProps {
  t: TFunction
  message: MessageDetailData | null
  loading: boolean
  error: string
  onReply: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 29(2026-07-29):AI 主聊天屏 + 开发者入口屏(2 屏迁移自 mobile-rn) */

/** AI 聊天消息(平台无关镜像,字段对齐 @ihui/shared ChatMessage) */
export interface ChatScreenMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** AI 模型选项(平台无关镜像,字段对齐 @ihui/api-client LlmModel) */
export interface ChatScreenModel {
  id: string
  name: string
  provider: string
  context_length: number
  input_price: number
}

/** 顶部导航条目(wrapper 注入,避免共享层依赖 react-navigation) */
export interface ChatScreenNavItem {
  key: string
  label: string
  onPress: () => void
}

/** 批次 30(2026-07-29):MessageInput 消息输入框共享组件(对标 D 盘 InputArea.vue 全量能力) */

/** 输入框附件类型(图片/文档/视频) */
export type MessageInputFileType = 'image' | 'document' | 'video'

/** 输入框附件条目 */
export interface MessageInputFile {
  id: string
  /** 远端 URL 或本地 uri */
  url: string
  /** 文件名(文档/视频场景使用) */
  filename?: string
  type: MessageInputFileType
}

/** 智能体变量条目(供 D 盘 Agent 变量填槽使用) */
export interface MessageInputAgentVariable {
  /** 变量名(空时显示描述) */
  name: string
  /** 变量类型(text/image) */
  type: 'text' | 'image'
  /** 描述(占位符) */
  description: string
  /** 当前值(text 时为字符串,image 时为 url) */
  value: string
}

/** MessageInput props(平台无关,wrapper 注入所有平台能力) */
export interface MessageInputProps {
  t: TFunction
  /** 当前输入文本 */
  text: string
  /** 占位符(可选,默认用 t('messageInput.placeholder')) */
  placeholder?: string
  /** 是否流式中(显示停止按钮) */
  isStreaming: boolean
  /** 加载中(发送按钮变 loading) */
  isSending: boolean
  /** 是否禁用输入 */
  disabled: boolean
  /** 附件列表 */
  files: MessageInputFile[]
  /** Agent 变量填槽(无则不显示) */
  agentVariables?: MessageInputAgentVariable[]
  /** 是否显示添加附件按钮 */
  showAddFileBtn: boolean
  /** 焦点状态(用于样式切换) */
  isFocused: boolean
  /** 全屏放大模式(独立全屏编辑区) */
  isFullscreen: boolean
  /** 是否处于语音输入模式 */
  isVoiceMode: boolean
  /** 语音录制中(显示波形) */
  isRecording: boolean
  /** 错误提示 */
  error: string

  onTextChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onFocus: () => void
  onBlur: () => void
  /** 切换全屏 */
  onFullscreenToggle: () => void
  /** 切换语音/键盘模式 */
  onVoiceToggle: () => void
  /** 添加图片(由 wrapper 实现相册/相机) */
  onAddImage: () => void
  /** 添加文件(由 wrapper 实现文档选择) */
  onAddFile: () => void
  /** 移除附件 */
  onRemoveFile: (id: string) => void
  /** 清空输入 */
  onClear: () => void
  /** 开始语音录制 */
  onVoiceStart: () => void
  /** 结束语音录制 */
  onVoiceEnd: () => void
  /** Agent 变量值变更(text) */
  onAgentVariableTextChange?: (index: number, value: string) => void
  /** Agent 变量值变更(image) */
  onAgentVariableImageChange?: (index: number) => void
  colorScheme?: 'light' | 'dark'
}

/** ChatScreen props(平台无关,wrapper 注入数据+SSE/截图/分享/导航回调) */
export interface ChatScreenProps {
  t: TFunction
  messages: ChatScreenMessage[]
  inputText: string
  isStreaming: boolean
  error: string
  models: ChatScreenModel[]
  model: string
  pickerOpen: boolean
  navItems: ChatScreenNavItem[]
  /** MessageInput 所需:wrapper 注入的附件列表 */
  inputFiles?: MessageInputFile[]
  /** MessageInput 所需:智能体变量填槽 */
  agentVariables?: MessageInputAgentVariable[]
  /** MessageInput 所需:输入框焦点 */
  isInputFocused?: boolean
  /** MessageInput 所需:全屏模式 */
  isInputFullscreen?: boolean
  /** MessageInput 所需:语音模式 */
  isVoiceMode?: boolean
  /** MessageInput 所需:语音录制中 */
  isRecording?: boolean
  /** MessageInput 所需:发送中(loading) */
  isSending?: boolean
  /** MessageInput 所需:输入错误 */
  inputError?: string
  onInputTextChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onModelChange: (id: string) => void
  onPickerOpenChange: (open: boolean) => void
  onLongPressMessage: (item: ChatScreenMessage) => void
  /** 消息气泡 ref 注册回调(wrapper 可用于截图等平台特定能力,共享层不依赖) */
  onMessageRef?: (id: string, el: unknown) => void
  /** MessageInput 事件:输入框焦点 */
  onInputFocus?: () => void
  /** MessageInput 事件:输入框失焦 */
  onInputBlur?: () => void
  /** MessageInput 事件:全屏切换 */
  onInputFullscreenToggle?: () => void
  /** MessageInput 事件:语音模式切换 */
  onInputVoiceToggle?: () => void
  /** MessageInput 事件:添加图片 */
  onInputAddImage?: () => void
  /** MessageInput 事件:添加文件 */
  onInputAddFile?: () => void
  /** MessageInput 事件:移除附件 */
  onInputRemoveFile?: (id: string) => void
  /** MessageInput 事件:清空输入 */
  onInputClear?: () => void
  /** MessageInput 事件:开始语音 */
  onInputVoiceStart?: () => void
  /** MessageInput 事件:结束语音 */
  onInputVoiceEnd?: () => void
  /** MessageInput 事件:Agent 变量文本变更 */
  onInputAgentVariableTextChange?: (index: number, value: string) => void
  /** MessageInput 事件:Agent 变量图片选择 */
  onInputAgentVariableImageChange?: (index: number) => void
  colorScheme?: 'light' | 'dark'
  /** 是否显示顶部标题栏(默认 true) */
  showHeader?: boolean
  /** 是否显示模型选择条(默认 true) */
  showModelBar?: boolean
  /** 是否显示输入栏(默认 true) */
  showInput?: boolean
  /** 自定义消息渲染(覆盖默认气泡) */
  renderMessage?: (item: ChatScreenMessage, index: number) => React.ReactNode
  /** 消息列表头部(wrapper 用于插入 Material 卡片、图片附件等) */
  renderListHeader?: React.ReactNode
  /** 消息列表尾部(wrapper 用于插入模型类型切换区等) */
  renderListFooter?: React.ReactNode
  /** 消息列表分隔符(wrapper 可传入 null 禁用默认间距) */
  itemSeparatorComponent?: React.ReactNode | null
  /** 根容器样式(wrapper 用于覆盖默认 flex:1,实现自定义布局) */
  containerStyle?: object
  /** 消息列表样式(wrapper 用于覆盖默认 flex:1) */
  flatListStyle?: object
  /** 消息列表 ref(wrapper 可用于加载历史后滚动到底部等平台特定能力) */
  onListRef?: (ref: unknown) => void
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
