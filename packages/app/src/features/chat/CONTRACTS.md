<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

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

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
