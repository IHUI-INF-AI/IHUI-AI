// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「ai」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { TFunction } from './app-shared.js'


/** 批次 9:Agent/问答/证书/提现/VIP 对比/分享(2026-07-29) */

/** Agent 详情(平台注入,字段对齐 mobile-rn AgentDetailScreen) */
export interface AgentDetailItem {
  id: string
  name: string
  description: string
  avatar?: string
  uses: number
  rating: number
  category: string
  creator: string
  isFree: boolean
  price: number
}

/** AgentDetailScreen props */
export interface AgentDetailScreenProps {
  t: TFunction
  item: AgentDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  /** 开始对话回调(平台注入导航跳转 AgentChat) */
  onStartChat?: (agentId: string, name: string) => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 14(2026-07-29 P3-3.3 实际迁移批次 10):Agent 市场/Agent 评价/活动/收藏/签到 */

/** Agent 市场项(平台注入,字段对齐 mobile-rn AgentMarketScreen Agent) */
export interface AgentMarketItem {
  id: string
  name: string
  description: string
  category: string
  uses: number
  rating: number
  isFree: boolean
}

/** AgentMarketScreen props */
export interface AgentMarketScreenProps {
  t: TFunction
  items: AgentMarketItem[]
  keyword: string
  loading: boolean
  error: string
  onKeywordChange: (text: string) => void
  onSearch: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Agent 评价项(平台注入,字段对齐 mobile-rn AgentReviewListScreen Item) */
export interface AgentReviewListItem {
  id: string
  agentName: string
  author: string
  rating: number
  content: string
  createdAt: string
}

/** AgentReviewListScreen props */
export interface AgentReviewListScreenProps {
  t: TFunction
  items: AgentReviewListItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 18(2026-07-29):模型/AIGC 屏(模型广场/n8n 模型管理/模型编辑/AIGC 作品列表) */

/** 模型类型(对齐 mobile-rn ModelPlazaScreen ModelType) */
export type ModelPlazaModelType = 'text' | 'image' | 'av'
export type ModelPlazaTypeFilter = 'all' | ModelPlazaModelType

/** 模型广场供应商(对齐 mobile-rn ModelPlazaScreen Provider) */
export interface ModelPlazaProvider {
  id: string
  name: string
  total: number
  desc: string
}

/** 模型广场列表项(对齐 mobile-rn ModelPlazaScreen Model) */
export interface ModelPlazaItem {
  id: string
  providerId: string
  name: string
  type: ModelPlazaModelType
  inputPrice: number | null
  outputPrice: number | null
  desc: string
  tags: string[]
  payMode: string
}

/** ModelPlazaScreen props — 注入式(状态由 wrapper 管理,纯 UI 渲染) */
export interface ModelPlazaScreenProps {
  t: TFunction
  items: ModelPlazaItem[]
  providers: ModelPlazaProvider[]
  providerId: string
  typeFilter: ModelPlazaTypeFilter
  loading: boolean
  refreshing: boolean
  error: string
  onSelectProvider: (id: string) => void
  onSelectType: (filter: ModelPlazaTypeFilter) => void
  onRefresh: () => void
  onPressCompare: () => void
  onPressItem: (item: ModelPlazaItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** n8n 工作流状态(对齐 mobile-rn N8nModelScreen Status) */
export type N8nModelStatus = 'running' | 'stopped'
export type N8nModelTab = 'all' | 'running' | 'stopped'

/** n8n 模型列表项(对齐 mobile-rn N8nModelScreen N8nModel) */
export interface N8nModelItem {
  id: string
  name: string
  desc: string
  url: string
  status: N8nModelStatus
  calls: number
  updatedAt: string
  paramsIn: number
  paramsOut: number
}

/** N8nModelScreen props — 注入式 */
export interface N8nModelScreenProps {
  t: TFunction
  items: N8nModelItem[]
  tab: N8nModelTab
  keyword: string
  loading: boolean
  refreshing: boolean
  error: string
  onSelectTab: (tab: N8nModelTab) => void
  onKeywordChange: (kw: string) => void
  onRefresh: () => void
  onRetry: () => void
  onToggle: (item: N8nModelItem) => void
  onEdit: (item: N8nModelItem) => void
  onCreate: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 模型编辑售卖方式(对齐 mobile-rn ModelEditScreen SaleType) */
export type ModelEditSaleType = 'free' | 'limited' | 'paid'
/** 模型编辑收费周期(对齐 mobile-rn ModelEditScreen PayCycle) */
export type ModelEditPayCycle = 'month' | 'year' | 'permanent'
/** 模型编辑面向群体(对齐 mobile-rn ModelEditScreen Audience) */
export type ModelEditAudience = 'all' | 'member'

/** 模型编辑选项(类别/部门/折扣等通用 chip 选项) */
export interface ModelEditOption {
  id: string
  label: string
}

/** 模型编辑基础信息(头像+名称+开场白) */
export interface ModelEditBaseInfo {
  name: string
  prologue: string
}

/** 模型编辑表单字段值(由 wrapper 持有,onChange 回写) */
export interface ModelEditFieldValues {
  categories: string[]
  dept: string
  saleType: ModelEditSaleType
  cycle: ModelEditPayCycle
  price: string
  freeDur: string
  audience: ModelEditAudience
  discount: string
}

/** ModelEditScreen props — 表单型注入式 */
export interface ModelEditScreenProps {
  t: TFunction
  baseInfo: ModelEditBaseInfo
  fields: ModelEditFieldValues
  categoryOptions: ModelEditOption[]
  deptOptions: ModelEditOption[]
  freeDurations: string[]
  discountOptions: ModelEditOption[]
  submitting: boolean
  onChange: <K extends keyof ModelEditFieldValues>(key: K, value: ModelEditFieldValues[K]) => void
  onToggleCategory: (id: string) => void
  onSave: () => void
  onCancel: () => void
  colorScheme?: 'light' | 'dark'
}

/** AIGC 作品文件类型(对齐 mobile-rn AigcListScreen FileType:0=图片/1=视频/3=音频/4=文案) */
export type AigcFileType = 0 | 1 | 3 | 4
export type AigcCategory = 'all' | 'image' | 'video' | 'audio' | 'text'

/** AIGC 作品列表项(对齐 mobile-rn AigcListScreen AigcWork) */
export interface AigcListItem {
  id: string
  title: string
  subtitle?: string
  prompt?: string
  content?: string
  fileUrl?: string
  coverUrl?: string
  audioUrl?: string
  duration?: string
  fileType: AigcFileType
  createdAt: string
}

/** AIGC 分类选项(对齐 mobile-rn AigcListScreen CATEGORIES) */
export interface AigcCategoryOption {
  key: AigcCategory
  label: string
  fileType?: AigcFileType
}

/** AigcListScreen props — 注入式 */
export interface AigcListScreenProps {
  t: TFunction
  items: AigcListItem[]
  categories: AigcCategoryOption[]
  category: AigcCategory
  loading: boolean
  refreshing: boolean
  error: string
  onSelectCategory: (c: AigcCategory) => void
  onRefresh: () => void
  onPressItem: (item: AigcListItem) => void
  onPublish: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
  /** 上拉触底加载下一页(注入式,由平台层提供 loadMore 实现) */
  onLoadMore?: () => void
}

/** 批次 20(2026-07-29):AI/聊天屏(助手管理/AI 群组/AIGC 封面/AIGC 发布,4 屏迁移自 mobile-rn) */

/** 助手状态 */
export type AssistantStatus = 'draft' | 'reviewing' | 'published' | 'rejected' | 'offline'

/** 助手主标签页 */
export type AssistantTab = 'draft' | 'reviewing' | 'published'

/** 助子子标签页(draft 下细分) */
export type AssistantSubTab = 'all' | 'rejected' | 'offline'

/** 助手项 */
export interface AssistantItem {
  id: string
  name: string
  prologue: string
  status: AssistantStatus
  /** 已格式化的类别文本(平台注入) */
  category?: string
  /** 售卖价格(分) */
  price?: number
  /** 售卖周期文本(平台注入,如 "月"/"年",为空表示永久) */
  cycle?: string
  /** 已格式化的受众文本(平台注入,如 "会员"/"全部用户") */
  audience?: string
  /** 已格式化的上架时间文本(平台注入) */
  publishTime?: string
}

/** AssistantScreen props */
export interface AssistantScreenProps {
  t: TFunction
  items: AssistantItem[]
  tab: AssistantTab
  subTab: AssistantSubTab
  keyword: string
  loading: boolean
  refreshing: boolean
  error: string
  onTabChange: (tab: AssistantTab) => void
  onSubTabChange: (subTab: AssistantSubTab) => void
  onKeywordChange: (keyword: string) => void
  onRefresh: () => void
  onEdit: (item: AssistantItem) => void
  onOffline: (item: AssistantItem) => void
  colorScheme?: 'light' | 'dark'
}

/** AI 群组标签页 */
export type AiGroupTab = 'mine' | 'discover'

/** AI 群组成员 */
export interface AiGroupMember {
  id: string
  name: string
  role: string
}

/** AI 群组项 */
export interface AiGroupItem {
  id: string
  name: string
  desc: string
  tag: string
  members: AiGroupMember[]
  messages: number
  /** 已格式化的最近活跃时间文本(平台注入) */
  lastActive: string
}

/** AiGroupScreen props */
export interface AiGroupScreenProps {
  t: TFunction
  items: AiGroupItem[]
  tab: AiGroupTab
  /** 当前选中的群组(平台注入,控制详情视图显隐) */
  selectedItem: AiGroupItem | null
  loading: boolean
  refreshing: boolean
  error: string
  onTabChange: (tab: AiGroupTab) => void
  onPressItem: (item: AiGroupItem) => void
  onBackToList: () => void
  onEnterChat: (item: AiGroupItem) => void
  onRefresh: () => void
  onRetry: () => void
  /** 搜索关键词(对齐 Uniapp ai_group/index.vue InputArea「搜索AI助手」;不传则隐藏搜索框) */
  keyword?: string
  /** 搜索关键词变更回调(由 wrapper 注入 state) */
  onKeywordChange?: (keyword: string) => void
  colorScheme?: 'light' | 'dark'
}

/** AIGC 封面过滤器 */
export type AigcCoverFilter = 'all' | 'work' | 'ai'

/** AIGC 封面选项 */
export interface AigcCoverOption {
  id: string
  url: string
  label: string
  source: 'work' | 'ai'
}

/** AigcCoverScreen props */
export interface AigcCoverScreenProps {
  t: TFunction
  workTitle: string
  covers: AigcCoverOption[]
  selectedId: string | null
  filter: AigcCoverFilter
  loading: boolean
  error: string
  onSelectCover: (id: string) => void
  onFilterChange: (filter: AigcCoverFilter) => void
  onConfirm: (cover: AigcCoverOption) => void
  onGenerateAi: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** AIGC 发布作品类型 */
export type AigcPublishWorkType = 'image' | 'video' | 'audio' | 'text'

/** AIGC 发布素材文件 */
export interface AigcPublishFile {
  id: string
  url: string
}

/** AigcPublishScreen props */
export interface AigcPublishScreenProps {
  t: TFunction
  workType: AigcPublishWorkType
  files: AigcPublishFile[]
  textContent: string
  title: string
  description: string
  prompt: string
  urlInput: string
  saving: boolean
  uploading: boolean
  error: string
  onWorkTypeChange: (type: AigcPublishWorkType) => void
  onTextContentChange: (text: string) => void
  onTitleChange: (title: string) => void
  onDescriptionChange: (desc: string) => void
  onPromptChange: (prompt: string) => void
  onUrlInputChange: (url: string) => void
  onAddFileByUrl: () => void
  onPickImage: () => void
  onRemoveFile: (id: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 22(2026-07-29):AI 相关屏(Agent 列表/AI 助手/AI 职业规划/AI 多模态,4 屏迁移自 mobile-rn) */

/** Agent 列表项 */
export interface AgentScreenItem {
  id: string
  name: string
  avatar?: string
  description: string
  isVipExclusive?: boolean
  useCount?: number
  rating?: number
}

/** AgentScreen props */
export interface AgentScreenProps {
  t: TFunction
  items: AgentScreenItem[]
  loading: boolean
  refreshing: boolean
  error: string | null
  onRefresh: () => void
  onPressItem: (id: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
  /**
   * 嵌套模式(2026-09-22 立):宿主把本屏渲染进外层 ScrollView 时传 true,
   * 内部改用普通 View + map 渲染,避免 FlatList(VirtualizedList)嵌套在
   * ScrollView 内触发 "VirtualizedLists should never be nested" + 缺 key 两条
   * console.error;此模式下拉刷新由外层 ScrollView 的 RefreshControl 负责。
   */
  nestedInScrollView?: boolean
}

/** AI 助手分类 */
export interface AiAssistantCategory {
  id: string
  label: string
}

/** AI 助手项 */
export interface AiAssistantItem {
  id: string
  name: string
  description: string
  tags: string[]
  useCount: number
  favoriteCount: number
}

/** AiAssistantScreen props */
export interface AiAssistantScreenProps {
  t: TFunction
  items: AiAssistantItem[]
  categories: AiAssistantCategory[]
  category: string
  keyword: string
  loading: boolean
  refreshing: boolean
  error: string | null
  onCategoryChange: (id: string) => void
  onKeywordChange: (kw: string) => void
  onRefresh: () => void
  onPressItem: (item: AiAssistantItem) => void
  /** 点击"更多分类"按钮跳转分类详情页(可选,不传则不显示"更多"按钮) */
  onPressCategory?: (categoryId: string, title: string) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** AI 生涯指导 — 孩子学业问卷表单字段(对齐原 Uniapp 页 pagesA/ai_career 的 formData) */
export interface AiCareerFormData {
  school: string
  classLevel: string
  scoreRange: string
  languageDifficulty: string
  scienceCharacteristics: string
  learningObstacle: string
  hobbies: string
  personality: string
  extraTime: string
  pressureTolerance: string
  learningGoal: string
  personalityTest1: string
  personalityTest2: string
  personalityTest3: string
  personalityTest4: string
  personalityTest5: string
}

/** 问卷字段名(约束选项/输入回调的 key) */
export type AiCareerFieldKey = keyof AiCareerFormData

/** 问卷区块:基础信息 / 性格测试 */
export type AiCareerSection = 'basic' | 'personality'

/** 题目控件类型:单选 / 单行输入 / 多行输入 / 1-5 评分行 */
export type AiCareerQuestionType = 'choice' | 'input' | 'textarea' | 'score'

/** 单选题选项(label 与 value 同文案,对齐原项目 selectOption(field, value)) */
export interface AiCareerChoiceOption {
  label: string
  value: string
}

/** 问卷题目定义 */
export interface AiCareerQuestion {
  key: AiCareerFieldKey
  title: string
  required: boolean
  type: AiCareerQuestionType
  options?: AiCareerChoiceOption[]
  placeholder?: string
  maxLength?: number
  section: AiCareerSection
}

/** AiCareerScreen(孩子学业问卷)props */
export interface AiCareerScreenProps {
  t: TFunction
  questions: AiCareerQuestion[]
  formData: AiCareerFormData
  error: string | null
  submitting: boolean
  onSelectOption: (key: AiCareerFieldKey, value: string) => void
  onInputChange: (key: AiCareerFieldKey, value: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** AI 多模态模式 */
export type AiMultimodalMode = 'text' | 'image' | 'audio'

/** AI 多模态消息 */
export interface AiMultimodalMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/** AIMultimodalScreen props */
export interface AIMultimodalScreenProps {
  t: TFunction
  userName: string
  mode: AiMultimodalMode
  models: string[]
  model: string
  messages: AiMultimodalMessage[]
  input: string
  loading: boolean
  error: string | null
  onModeChange: (mode: AiMultimodalMode) => void
  onModelChange: (model: string) => void
  onInputChange: (text: string) => void
  onSend: () => void
  onClear: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Agent 评价详情数据 */
export interface AgentReviewDetailItem {
  id: string
  agentName: string
  author: string
  rating: number
  content: string
  createdAt: string
}

/** AgentReviewDetailScreen props */
export interface AgentReviewDetailScreenProps {
  t: TFunction
  item: AgentReviewDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 23(2026-07-29):Agent 系深屏(统计/设置/创建/聊天)+ 课程系深屏(列表/详情/筛选/评论) */

/** Agent 统计数据 */
export interface AgentStatData {
  conversations: number
  messages: number
  tokens: number
  avgRating: number
}

/** AgentStatScreen props */
export interface AgentStatScreenProps {
  t: TFunction
  stat: AgentStatData | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Agent 设置数据 */
export interface AgentSettingData {
  name: string
  model: string
  temperature: number
  enabled: boolean
}

/** AgentSettingScreen props */
export interface AgentSettingScreenProps {
  t: TFunction
  setting: AgentSettingData | null
  loading: boolean
  saving: boolean
  error: string
  toast: string
  onChange: (patch: Partial<AgentSettingData>) => void
  onSave: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** AgentCreateScreen props */
export interface AgentCreateScreenProps {
  t: TFunction
  name: string
  description: string
  systemPrompt: string
  category: string
  isPublic: boolean
  saving: boolean
  error: string
  onNameChange: (v: string) => void
  onDescriptionChange: (v: string) => void
  onSystemPromptChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onTogglePublic: () => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Agent 聊天消息 */
export interface AgentChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/** AgentChatScreen props */
export interface AgentChatScreenProps {
  t: TFunction
  title: string
  messages: AgentChatMessage[]
  loading: boolean
  error: string
  input: string
  sending: boolean
  onInputChange: (v: string) => void
  onSend: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 17(2026-07-29):混合类屏(API 设置/创客名片/课程附件/课程问答/课程资源/客服/讲师详情/笔记/订阅/任务中心,10 屏迁移自 mobile-rn) */

/** Coze API 配置(ApiSettingsScreen) */
export interface ApiSettingsConfig {
  token: string
  baseUrl: string
  botId: string
  timeout: number
}

/** 连通性测试状态 */
export type ApiSettingsTestState = 'idle' | 'testing' | 'success' | 'failed'

/** ApiSettingsScreen props */
export interface ApiSettingsScreenProps {
  t: TFunction
  config: ApiSettingsConfig
  showToken: boolean
  saving: boolean
  testing: ApiSettingsTestState
  testMsg: string
  toast: string
  loading: boolean
  defaultBaseUrl: string
  defaultTimeout: number
  onConfigChange: (patch: Partial<ApiSettingsConfig>) => void
  onToggleShowToken: () => void
  onSave: () => void
  onReset: () => void
  onTest: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 创客资料(CarteScreen) */
export interface CarteCreator {
  name: string
  title: string
  bio: string
  projects: number
  skills: number
  rating: number
}

/** 创客作品 */
export interface CarteWork {
  id: string
  title: string
  category: string
  desc: string
  tags: string[]
  likes: number
}

/** CarteScreen props */
export interface CarteScreenProps {
  t: TFunction
  creator: CarteCreator | null
  works: CarteWork[]
  skills: string[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onRetry: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export interface ModelRecordScreenProps {
  t: TFunction
  onBack: () => void
  title?: string
  images: (number | { uri: string })[]
  previewIndex: number
  onPreviewIndexChange: (index: number) => void
  colorScheme?: 'light' | 'dark'
}

// ============ 批次 39(2026-08-15):AI 助手 N8n(1 屏迁移自 mobile-rn) ============

/** N8n 消息项 */
export interface N8nMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** assistant 回复中提取的图片 URL 列表(对齐 Uniapp imgUrlList) */
  images?: string[]
}

/** AiAssistantN8nScreen props(wrapper 注入数据+回调) */
export interface AiAssistantN8nScreenProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  messages: N8nMessage[]
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  error: string
  search: string
  searchInput: string
  showSearch: boolean
  selectedModelLabel: string
  showModelPicker: boolean
  modelConfigVisible: boolean
  modelConfig: {
    temperature: number
    maxTokens: number
    topP: number
    systemPrompt: string
  }
  previewImage: string | null
  toastVisible: boolean
  toastType: 'info' | 'error' | 'success' | 'warning'
  toastMessage: string
  drawerVisible: boolean
  drawerConversations: Array<{
    id: string
    title: string
    modelConfig?: {
      id: string
      name: string
      icon?: string
    }
    createdAt: number
  }>
  drawerConversationsLoaded: boolean
  drawerUser: {
    avatar?: string
    nickname: string
    level: 'vip' | 'normal'
  }
  quickSuggestions: readonly string[]
  sending: boolean
  onRefresh: () => void
  onEndReached: () => void
  onSubmitSearch: () => void
  onSearchInputChange: (v: string) => void
  onSend: (text: string) => void
  onStop: () => void
  onModelPress: () => void
  onModelConfigPress: () => void
  onPreviewImage: (url: string) => void
  onClosePreview: () => void
  onCloseModelPicker: () => void
  onCloseModelConfig: () => void
  onCloseDrawer: () => void
  onDrawerNavigate: (tab: string) => void
  onDrawerNavigateCompany: () => void
  onDrawerClaimFree: () => void
  onDrawerCreateNewChat: () => void
  onDrawerSelectConversation: (id: string) => void
  onDrawerDeleteConversation: (id: string) => void
  onDrawerOpenSettings: () => void
  onDrawerOpenMessages: () => void
  onDrawerGoHome: () => void
  onDrawerNavigateExtra: (menu: string) => void
  onHideToast: () => void
  retryText: string
  emptyText: string
  noMoreText: string
  loadingText: string
  loadingMoreText: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
