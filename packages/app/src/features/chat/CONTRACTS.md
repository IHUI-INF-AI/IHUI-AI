<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 块 3–6 抽取契约（A3 并行线专用）
# 块 3–6 抽取契约（A3 并行线专用）

> 契约版本：随本文件所在提交生效。两份并行会话**只许新增**下列文件与各自测试，**不得编辑任何既有文件**（尤其 `packages/app/src/features/chat/ChatScreen.tsx`、`apps/mobile-rn/src/screens/ChatScreen.tsx`、`packages/app/src/pilot.ts`、任何 barrel/index）。装配与接线由 A3 主会话完成。

## 0. 总则（违约即返工）

1. **零平台 API**：不得出现 `react-navigation`、`Linking`、`AsyncStorage`、`localStorage`、`fetch`/`axios`、`Taro`、`wx.`、`Alert.`、`Share`、权限/录音/TTS/剪贴板调用。导航、分享、存储、权限、录音、播报、剪贴板全部经 props 回调注入。
2. **依赖方向**：只许 import `packages/**` 与 `@ihui/*`；**禁止** import `apps/**`。
3. **AGENTS §3**：禁 `any`；未知配置用 `unknown`；共享层优先，不复制 RN 端业务逻辑。
4. **图标**：禁 `lucide-react-native`（node 测试会触发 Flow 解析错误）；用 `Text` 字形或现有 `@ihui/ui-native` 纯 RN 组件。
5. **允许的 RN 原语**：`View` / `Text` / `Image` / `TextInput` / `ScrollView` / `FlatList` / `Modal` / `Pressable` / `TouchableOpacity` / `RefreshControl` / `StyleSheet`。禁 `Animated`、`Keyboard`、`Linking`、`Dimensions`。
6. **样式**：`getTokens(colorScheme)` + `rnType`（`@ihui/design-tokens`）；不得硬编码 `#rrggbb`（token 无对应时须在注释写明理由）。`colorScheme` 默认 `'light'`。
7. **文件头**：原样复制 `packages/app/src/features/chat/ChatScreen.tsx` 前 3 行 provenance 水印。
8. **契约冻结**：导出名、props 名、字段名逐字一致；不得自创 API。确需新增字段，先回报 A3 主会话。
9. **测试**：每个新文件配 1 个测试文件，**只新增**，放 `apps/miniapp-taro/tests/chat-<文件名>-contract.test.tsx`；复用 `tests/stubs/react-native.ts` 别名。每个文件至少包含：
   - 正例：fixture 渲染，断言关键文案/顺序/可见性；
   - 阴性对照：未触发交互时回调 0 次；源码不含平台 API 字面（`Taro|fetch(|axios|localStorage|Alert.|react-navigation`）。
10. **验收命令**（各自本地跑）：
    - `cd apps/miniapp-taro && node node_modules/vitest/vitest.mjs run tests/chat-*-contract.test.tsx` → exit 0
    - `npx tsc -p packages/app/tsconfig.json --noEmit` → exit 0

---

## 1. 块 3：输入区

**目标文件**：`packages/app/src/features/chat/ChatComposer.tsx`

**导出**：`ChatComposer`、`ChatComposerProps`、`ChatComposerToggle`、`ChatComposerToggleKey`

```ts
import type { ReactNode } from 'react'
import type {
  ChatScreenModel,
  MessageInputAgentVariable,
  MessageInputFile,
  TFunction,
} from '@ihui/types'

export type ChatComposerToggleKey =
  'webSearch' | 'deepThink' | 'imageGen' | 'fileContext' | 'agentMode'

export interface ChatComposerToggle {
  key: ChatComposerToggleKey
  label: string
  active: boolean
  disabled?: boolean
}

export interface ChatComposerProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 输入值（受控） */
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  maxLength?: number
  disabled?: boolean
  loading?: boolean
  stopLabel?: string
  /** 附件列表（顺序即 UI 顺序，不排序） */
  files?: readonly MessageInputFile[]
  agentVariables?: readonly MessageInputAgentVariable[]
  models: readonly ChatScreenModel[]
  modelId: string
  modelPickerOpen?: boolean
  /** 功能开关组；顺序即渲染顺序 */
  toggles?: readonly ChatComposerToggle[]
  isFocused?: boolean
  isFullscreen?: boolean
  voiceMode?: boolean
  recording?: boolean
  error?: string
  /** 输入区上方的平台注入槽（如素材卡片）；不传不渲染 */
  headerSlot?: ReactNode

  onSubmit: () => void
  onStop: () => void
  onFocus?: () => void
  onBlur?: () => void
  /** 键盘高度(px,0=收起)；平台事件由 wrapper 注入，组件内不得监听 Keyboard */
  onKeyboardHeightChange?: (height: number) => void
  onFullscreenToggle?: () => void
  onVoiceToggle?: () => void
  onVoiceStart?: () => void
  onVoiceEnd?: () => void
  onAddImage?: () => void
  onAddFile?: () => void
  onRemoveFile?: (id: string) => void
  onClear?: () => void
  onPlusToggle?: () => void
  onToggle?: (key: ChatComposerToggleKey, next: boolean) => void
  onModelSelectOpen?: () => void
  onModelSelectClose?: () => void
  onModelChange?: (id: string) => void
  onModelConfigOpen?: () => void
  onAgentVariableTextChange?: (index: number, value: string) => void
  onAgentVariableImageChange?: (index: number) => void
}
```

**必须注入的回调**：`onChangeText`、`onSubmit`、`onStop`；其余可选，不传则对应 UI 不渲染（而非渲染死按钮）。

**RN 渲染等价要点**（源：`apps/mobile-rn/src/components/InputArea.tsx` 123–198 props、291–540 行为；`src/features/chat/ChatInputBar.tsx`）：

- 输入高度随内容自增，达上限后滚动；发送/停止二态互斥，`loading && onStop` 时只显示停止。
- 发送前 trim；空串不发；`disabled` 时按钮置灰且不触发。
- 附件按传入顺序渲染，删除回调携带 id；语音按住/松开用 `onLongPress`/`onPressOut`。
- 功能开关按 `toggles` 原序；点击回传 `key` 与取反后的 `next`。
- 全屏切换只切样式与标题，不清空输入；`headerSlot` 位于输入框上方。
- `error` 存在时错误条在输入框上方，不遮挡发送按钮。

**禁区**：不得直接调用 `Keyboard`、录音、相册、相机、文件选择；不得自带路由跳转。

---

## 2. 块 4：底部动作栏 + 功能/来源面板

### 2.1 `packages/app/src/features/chat/ChatActionBar.tsx`

**导出**：`ChatActionBar`、`ChatActionBarProps`、`ChatActionBarAction`、`ChatActionBarToggle`、`ChatActionBarIconType`、`ChatActionBarImage`

```ts
import type { TFunction } from '@ihui/types'

export type ChatActionBarIconType = 'camera' | 'album' | 'file' | 'wxfile'

export interface ChatActionBarAction {
  key: string
  label: string
  /** 纯文本字形（不传则只渲染 label） */
  glyph?: string
  visible?: boolean
  disabled?: boolean
  onPress: () => void
}

export interface ChatActionBarToggle {
  key: string
  label: string
  active: boolean
  disabled?: boolean
}

export interface ChatActionBarImage {
  id: string
  uri: string
}

export interface ChatActionBarProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  /** 顺序即渲染顺序；visible=false 不占位 */
  actions?: readonly ChatActionBarAction[]
  toggles?: readonly ChatActionBarToggle[]
  images?: readonly ChatActionBarImage[]
  /** 模型信息条文案；不传则整条不渲染 */
  modelLabel?: string
  compacting?: boolean

  onToggle?: (key: string) => void
  onImageRemove?: (index: number) => void
  onIconClick?: (type: ChatActionBarIconType) => void
  onFunctionHandle?: () => void
  onPlusToggle?: () => void
  onFangda?: () => void
  onCompactContext?: () => void
  onShowModelList?: () => void
  onShowModelConfig?: () => void
  onModelConfigChange?: (config: unknown) => void
  onShowMyCreation?: () => void
}
```

**等价要点**（源：`apps/mobile-rn/src/components/BottomActionBar.tsx` 118–205 props、渲染段）：按钮高 `44`、图标钮 `44×44`、外边距 `12`；`actions` 与 `toggles` 按传入顺序；`images` 在模型条下方横排；`compacting` 时显示压缩入口且不重复普通动作；任一回调不传则对应控件不渲染。

### 2.2 `packages/app/src/features/chat/ChatPanels.tsx`

**导出**：`ChatPanels`、`ChatPanelsProps`、`ChatPanelItem`、`ChatPanelMode`

```ts
export type ChatPanelMode = 'none' | 'functions' | 'source'

export interface ChatPanelItem {
  key: string
  label: string
  glyph?: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
}

export interface ChatPanelsProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  mode: ChatPanelMode
  title?: string
  items?: readonly ChatPanelItem[]
  /** 底部安全区高度；由 wrapper 注入，组件不读平台尺寸 */
  bottomInset?: number
  onClose: () => void
}
```

**等价要点**（源：`apps/mobile-rn/src/components/BottomPops.tsx` 481 行）：`mode='none'` 不渲染；打开时半透明遮罩点击 `onClose`；面板从底部推入但**不得使用 Animated**，用 `Modal` + 静态位移；`items` 三列网格、顺序不变；`bottomInset` 默认 0。

---

## 3. 块 5：模型 / Agent / 素材选择器 + 抽屉

### 3.1 `packages/app/src/features/chat/ChatPickers.tsx`

**导出**：`ChatPickers`、`ChatPickersProps`、`ChatPickerMode`、`ChatPickerModel`、`ChatPickerAgent`、`ChatPickerMaterial`、`ChatPickerCategory`

```ts
export type ChatPickerMode = 'none' | 'model' | 'agent' | 'material'

export interface ChatPickerModel {
  id: string
  name: string
  iconSrc?: string
  badge?: string
}

export interface ChatPickerAgent {
  id: string
  name: string
  description?: string
  iconSrc?: string
}

export interface ChatPickerMaterial {
  id: string
  title: string
  coverSrc?: string
  category: string
  meta?: string
}

export interface ChatPickerCategory {
  key: string
  label: string
}

export interface ChatPickersProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  mode: ChatPickerMode
  models?: readonly ChatPickerModel[]
  activeModelId?: string
  agents?: readonly ChatPickerAgent[]
  activeAgentId?: string
  materials?: readonly ChatPickerMaterial[]
  categories?: readonly ChatPickerCategory[]
  activeCategory?: string

  onClose: () => void
  onModelChange?: (id: string) => void
  onAgentChange?: (id: string) => void
  onCategoryChange?: (key: string) => void
  onMaterialOpen?: (id: string) => void
  onMaterialRemove?: (id: string) => void
}
```

**等价要点**（源：`screens/ChatScreen.tsx` 2364–2796 选择器/素材段；`components/MaterialList.tsx` 442 行）：模型按传入顺序、当前项高亮；Agent 选中项对勾；素材按 `activeCategory` 过滤但不过滤顺序；分类 tab 顺序不变；`onMaterialOpen` 只传 id，不取数。组件内**不得**请求素材/模型数据。

### 3.2 `packages/app/src/features/chat/ChatDrawer.tsx`

**导出**：`ChatDrawer`、`ChatDrawerProps`、`ChatDrawerConversation`、`ChatDrawerTab`

```ts
export interface ChatDrawerConversation {
  id: string
  title: string
  timeLabel: string
  pinned?: boolean
  favorited?: boolean
  modelName?: string
}

export interface ChatDrawerTab {
  key: string
  label: string
}

export interface ChatDrawerProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  open: boolean
  conversations?: readonly ChatDrawerConversation[]
  tabs?: readonly ChatDrawerTab[]
  activeTab?: string
  /** 顶栏是否显示"领取免费额度"入口 */
  showClaimFree?: boolean

  onClose: () => void
  onTabChange?: (key: string) => void
  onSelectConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
  onToggleFavorite?: (id: string, next: boolean) => void
  onCreateNewChat: () => void
  onOpenSettings?: () => void
  onOpenMessages?: () => void
  onGoHome?: () => void
  onClaimFree?: () => void
  onNavigateDomain?: (key: string) => void
}
```

**等价要点**（源：`components/Drawer.tsx` 119–152 props、229–432 行为）：`open=false` 不渲染；会话分组顺序：置顶→收藏→按日期桶（由传入 `timeLabel` 原样展示，组件不重排）；左滑删除手势用 `PanResponder`？——**禁止**，改为行内显式删除按钮 + `onDeleteConversation`；`onToggleFavorite` 回传取反值。

---

## 4. 块 6：实时语音回合

**目标文件**：`packages/app/src/features/chat/ChatVoiceTurn.tsx`

**导出**：`ChatVoiceTurn`、`ChatVoiceTurnProps`、`ChatVoicePhase`、`ChatVoicePanel`、`ChatVoicePanelProps`

```ts
export type ChatVoicePhase = 'idle' | 'listening' | 'processing' | 'speaking' | 'error'

export interface ChatVoiceTurnProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  phase: ChatVoicePhase
  /** 录音时长(ms)，仅展示 */
  elapsedMs?: number
  /** 0..1 音量，仅展示 */
  level?: number
  /** 识别文本；不传不渲染 */
  transcript?: string
  errorMessage?: string
  disabled?: boolean

  onPressIn: () => void
  onPressOut: () => void
  onCancel?: () => void
  onRetry?: () => void
  onClose?: () => void
}

export interface ChatVoicePanelProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  open: boolean
  /** 仅展示的选项文案，选择回传 key */
  tones?: readonly { key: string; label: string }[]
  activeTone?: string
  onToneChange?: (key: string) => void
  onConfirm: () => void
  onClose: () => void
}
```

**等价要点**（源：`screens/ChatScreen.tsx` 1590–1790 语音回合、4243–4276 样式；`components/VoiceInput.tsx` 42–262；`chat/VoiceBubble.tsx` 137 行）：`phase` 决定波形/计时/转写区显隐；`listening` 时按住态与 `elapsedMs` 展示；`processing` 时不可再次按下；`error` 时显示 `errorMessage` 与重试；`ChatVoicePanel` 的 `open=false` 不渲染；所有录音/TTS 动作只经 `onPressIn/onPressOut/onConfirm`。

**禁区**：不得申请麦克风权限、不得调 recorder/TTS/音频模块；不做 `PanResponder` 手势识别（取消用显式按钮）。

---

## 5. 交付清单（每份会话各自）

- 上述目标文件（只新增）；
- 对应 `apps/miniapp-taro/tests/chat-<文件名>-contract.test.tsx`（只新增）；
- 回报：文件路径、导出清单、测试命令与读数、`tsc -p packages/app` 读数、源文件中平台 API 扫描结果（应为 0 命中）；
- 不做：装配、改 ChatScreen、改 pilot、改 RN 文件、改 README、改台账。

---

## 6. A3 自产块 1/2 契约（与 §0 同一套硬约束，块 3–6 会话据此对齐）

> 本节由 A3 主会话产出并冻结；块 3–6 会话**不得**修改本节，只按其字段形状对齐命名/回调风格。

### 6.1 块 1：`packages/app/src/features/chat/ChatHeader.tsx`

**导出**：`ChatHeader`、`ChatHeaderProps`、`ChatHeaderNavItem`、`ChatCollapsibleCard`、`ChatCollapsibleCardProps`、`ChatCompactionBanner`、`ChatCompactionBannerProps`

```ts
export interface ChatHeaderNavItem {
  key: string
  label: string
  /** 端侧图标节点（RN 传 lucide 节点 / 小程序传 Image/LineIcon）；不传只渲 label */
  icon?: ReactNode
  onPress?: () => void
}

export interface ChatHeaderProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  title: string
  modelLabel?: string
  modelName?: string
  onModelPress?: () => void
  navItems?: readonly ChatHeaderNavItem[]
  agentName?: string
  onAgentPress?: () => void
  onHelpPress?: () => void
  onHistoryPress?: () => void
  onClearPress?: () => void
  clearLabel?: string
  showClear?: boolean
  rightSlot?: ReactNode
}

export interface ChatCollapsibleCardProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  expanded: boolean
  onToggle: () => void
  collapsedLabel: string
  expandedLabel: string
  title?: string
  body?: ReactNode
}

export interface ChatCompactionBannerProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  before: number
  after: number
  removed: number
}
```

**等价要点**：左段 `modelLabel:` + `modelName` + `⌄`；中段 `title` 单行截断；右段顺序 `agentName → ? → 历史 → 清除`，缺参零占位；`ChatCollapsibleCard` 通过 `expanded` 切文案与 body；`ChatCompactionBanner` 用 `chatAlert.compaction.title/message` 并带 `{before,after,removed}`。

### 6.2 块 2：`packages/app/src/features/chat/ChatMessageList.tsx`

**导出**：`ChatMessageList`、`ChatMessageListProps`、`ChatMessageBubble`、`ChatMessageBubbleProps`

```ts
export interface ChatMessageListProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  data: readonly ChatScreenMessage[]
  isStreaming?: boolean
  renderItem?: (item: ChatScreenMessage, index: number) => ReactNode
  renderItemTail?: (item: ChatScreenMessage, index: number) => ReactNode
  renderHeader?: () => ReactNode
  renderFooter?: () => ReactNode
  thinkingSlot?: ReactNode
  showThinkingPlaceholder?: boolean
  onLongPressMessage?: (item: ChatScreenMessage, index: number) => void
  onMessageRef?: (id: string, node: View | null) => void
  onListRef?: (ref: FlatListRef | null) => void
  onCopyText?: (text: string) => void
  itemSeparator?: ReactNode | null
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
}

export interface ChatMessageBubbleProps {
  t: TFunction
  colorScheme?: 'light' | 'dark'
  item: ChatScreenMessage
  isLastAi?: boolean
  onLongPress?: () => void
  onCopyText?: (text: string) => void
}
```

**冻结语义**：① `keyExtractor=(item)=>item.id`、`renderItem({item,index})`、不排序；② 流式末条 assistant 且正文为空才追加 thinking 占位；③ 默认气泡 `delayLongPress={500}`；④ 图片点击内置全屏 Modal；⑤ 三反引号代码块展开/复制（复制仅走 `onCopyText`）；⑥ `item.reasoning` 折叠，默认收起。

**消费面**：RN `apps/mobile-rn/src/screens/ChatScreen.tsx`（列表宿主 + `statusSlot`/`queueSlot` + 引导卡/压缩提示）与小程序 `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx`（列表宿主 + 顶栏）；`ChatMessageBubble` 供后续装配替换端内简易气泡。

---

## 7. ADDENDUM：块 5/6 歧义仲裁（冻结，2026-11-05）

> 适用范围：块 5 `ChatPickers.tsx` / 块 6 `ChatDrawer.tsx` / `ChatVoiceTurn.tsx`（交付提交 `e4d92936e6`）。
> 口径总则：**优先让已交付实现合法**，不为了对齐 RN 去改已交付文件；差异一律由装配期 wrapper 复现。
> 本节为追加裁决，**§0–§6 冻结原文一字未改**。

### A-1 抽屉分组

**裁决**：`ChatDrawer` **不分组、不排序**，严格按 `conversations` 传入顺序原样渲染。分组/日期桶由 wrapper 组装时排好序再传入。
**理由**：组件若内置分组就需要时间/时区/“今天”判定，属于平台与语言环境依赖，破坏 §0 零平台 API 与可测性；顺序的单一来源放在 wrapper 更利于两端一致。
**影响的装配点**：小程序 `chat.tsx` 抽屉数据源与 RN `ChatDrawer` 调用点必须在传入前完成分组与排序；组件内不得再补 `useMemo` 排序。

### A-2 选择后是否自动关闭

**裁决**：组件**只回调、不关闭**；`mode` 由 wrapper 持有，wrapper 在回调里置 `none`。
**理由**：组件不持状态（§0），关闭时机属于宿主交互编排；同一组件可被“选完即关”和“选完不关”两种宿主复用。
**已知差异**：RN 原行为是**选完即关**。装配时由 RN wrapper 在 `onSelect*` 回调里立即 `setPickerMode('none')` 复现，组件不动。
**影响的装配点**：RN 宿主三个 `onSelect` 必须在回调内同步关闭；小程序宿主同口径。

### A-3 素材分类 `all` 哨兵

**裁决**：`all` 哨兵由 wrapper 归一为 `activeCategory = undefined`；组件只做**非空等值过滤**（`activeCategory === undefined || item.category === activeCategory`）。
**理由**：哨兵值属于数据源约定，不应泄漏进展示组件；等值过滤无分支歧义。
**影响的装配点**：两端 wrapper 传参前把 `'all'` 转 `undefined`；组件内不得出现 `'all'` 字面量。

### A-4 `onNavigateDomain`

**裁决**：保留签名，**不渲染入口**（当前无数据源）。
**理由**：签名冻结可避免装配期二次改契约；不渲染入口避免假入口。
**影响的装配点**：wrapper 传回调即可，UI 不出现；等数据源接入时另开票补入口。

### A-5 语音 phase 显隐矩阵

**裁决**：按交付实现**固化**，不新增 phase；wrapper 只按 phase 切文案/禁用态，不改变显隐矩阵。
**影响的装配点**：`ChatVoiceTurn` 装配处除 phase 外不得有条件渲染分支。

### A-6 空列表文案 key

**裁决**：

- **抽屉**：用 `drawer.noHistory`（交付实现已内置）。
- **选择器**：交付实现**不渲染空态文案**（`categories.length === 0` 时零占位），因此**不指定 key**；若 wrapper 需要空态提示，必须在 wrapper 层渲染，组件不加空态节点。
  **影响的装配点**：选择器宿主不得给组件塞 `emptyLabel`；抽屉宿主不得覆盖 `drawer.noHistory`。

### A-7 音色数据形态

**裁决**：音色按 `{ key, label }` **只读**消费，组件不回写、不排序、不校验。
**影响的装配点**：两端 wrapper 负责数据源与默认值；组件只按 key 匹配当前值。

---

## 8. ADDENDUM：块 3/4 歧义仲裁（冻结，2026-11-05）

> 适用范围：块 3 `ChatComposer.tsx` / 块 4 `ChatActionBar.tsx` / `ChatPanels.tsx`（交付提交 `9f45fa11b6`）。
> 与 §7 同则：**只追加、不改 §0–§6**；优先让已交付实现合法，差异由 wrapper 复现。

### A-8 i18n：缺键不得回落裸 key

**裁决**：**a11y 标签改为 wrapper 注入**，共享组件不再直接 `t()` 这些仅 RN 有、web 缺的键；新增可选 `labels?: Partial<Record<'modelConfig' | 'compactButton' | 'imageDelete' | 'fnTitle' | 'myCreation', string>>`，组件缺省值只取两端**共有键**，未注入且无共有键时该 a11y 属性不渲染（`accessibilityLabel` 缺省）。
**理由**：① 不跑词包生成器、不改 HEAD、不引入 `bab.*` 等新键的跨端同步风险；② a11y 属宿主语言环境，与 §0「零平台依赖」一致；③ 保持「web 端绝不渲染裸 key」的硬线。
**影响的装配点**：装配时 RN / 小程序 wrapper 各传 `labels`（各自已有词条）；`bab.*`、`messageInput.compactButton`、`chat.imageDelete`、`chat.fnTitle`、`common.myCreation`、`bab.modelConfig` **不得**再出现在共享组件源码里，单测以「源码零命中」锁定。

### A-9 `maxLength` 默认值

**裁决**：固化 **500**（沿用 RN `InputArea`），组件不提供第二默认；wrapper 可显式覆盖。
**影响的装配点**：两端 wrapper 若需更短长度，必须显式传值，不得依赖组件默认变化。

### A-10 `ChatActionBar` 图标字形

**裁决**：**本批接受 `Text` 字形**（📷 / 🖼 / 📁 / 💬），不引入图标库；图标替换另立票据。
**理由**：图标库会破坏 §0（禁 `lucide-react-native`）或引入新依赖，并带来 web/node 下 Flow 解析与包体积风险；字形零依赖、可测、可替换。
**影响的装配点**：装配期不改图标实现；若产品要求图标化，走单独票替换全部四个入口。

### A-11 模型选择区最小语义

**裁决**：维持 **触发钮 + 打开态 Modal** 的最小语义（触发钮常隐；Modal 由 wrapper 控制 `open`）。不新增内联选择器。
**影响的装配点**：wrapper 负责 `open` 状态与关闭时机（按 A-2 口径：选择后由 wrapper 关闭）。

### A-12 `mode='source'`

**裁决**：本批**保留枚举但不启用**，装配不传 `'source'`；等来源面板数据源到位后另开票细化。
**影响的装配点**：wrapper 只传 `'none'`（或块 4 已定义的有效值），不得用 `'source'` 触发空面板。

### A-13 `compacting` 与 `actions` 并存优先级

**裁决**：**`compacting` 优先**——压缩态下渲染压缩提示并禁用发送/动作；`actions` 仅在非压缩态生效。
**影响的装配点**：装配时不得同时启用两者；状态由 wrapper 单点判定后传入。

---

## 9. ADDENDUM：块 1/2 实现期增量（冻结，2026-11-05）

### A-14 `ChatMessageListProps` 增补三个 rn-compat 透传字段

**裁决**：增补可选 `className?: string`、`scrollTop?: number`、`scrollWithAnimation?: boolean`，透传给列表宿主；RN 侧这些字段无对应属性，RN 传 `undefined` 时不产生行为差异。
**理由**：小程序原 `ScrollView` 靠 `className="msg-list"` 承载高度/滚动域、靠 `scrollTop` 驱动自动滚动；不增补这三个字段，迁入共享列表后会丢滚动语义。
**影响的装配点**：小程序页传 `className="msg-list"` + `scrollTop={scrollTop}` + `scrollWithAnimation`；RN 与 web 一律不传。

### A-15 气泡 reasoning 字段的取法

**裁决**：`ChatMessageBubble` 的 `item` 仍为冻结的 `ChatScreenMessage`，reasoning 以 `item as ChatScreenMessage & { reasoning?: string }` 只读取用；**不扩充** `ChatScreenMessage` 类型。
**理由**：不改共享类型契约（避免牵动 `@ihui/types` 的跨端消费），reasoning 只在本组件内部用于折叠展示。
**影响的装配点**：装配不依赖气泡内 reasoning；端内富内容仍由 `renderItem` 覆盖。

## 10. ADDENDUM：块 2 挂槽声明式化（冻结，2026-11-05）

### A-16 `renderItemTail` / `renderHeader` / `thinkingSlot` → 声明式数据槽

**裁决**：`ChatMessageListProps` 删除 `renderItemTail?: (item,index)=>ReactNode`、`renderHeader?: ()=>ReactNode`、`thinkingSlot?: ReactNode`；改为四个声明式槽位：

- `headerNode?: ReactNode`：共享层只负责挂载位置（`ListHeaderComponent`），内容不在共享层内构造；
- `tailNodes?: ReadonlyMap<string, ReactNode>`：按 `item.id` 锚定，一项只粘在对应行尾，不做业务判断；
- `orphanTailNode?: ReactNode`：锚不到任何行时由共享层落在列表尾（`renderFooter` 之前）；
- `thinkingNode?: ReactNode`：流式末条占位节点；不传时用内置 thinking 占位（`chat.thinking`）。

**理由**：页面只交数据/节点，不交渲染函数；锚定与挂载语义归共享层。端内视觉子件（Taro 原语 + 端内组件）按 §0 依赖方向不能进 `packages/app`，落 `apps/miniapp-taro/src/pkg-ai/ai/chat-list-extras.tsx`，由页面以节点/映射传入。
**影响的装配点**：块 1–6 装配时，RN `ChatScreen` 传 `headerNode={renderListHeader}`；小程序页传 `headerNode` / `tailNodes` / `orphanTailNode` / `thinkingNode`；`renderItem` 保留（依赖端内富内容组件，装配批再收）。
**阴性对照**：不传 `tailNodes` 时不渲染任何行尾；不在 `tailNodes` 中的 id 不渲染；不传 `thinkingNode` 且末条已有正文时不渲染占位。
