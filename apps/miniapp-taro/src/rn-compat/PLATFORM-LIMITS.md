<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# rn-compat 平台硬限制（Taro 侧）

本文件记录 **Taro/小程序能力面决定的上限**，不是 bug。原语层已经做到能做到的最大程度，
以下是"再改原语也消不掉"的部分；遇到相关现状请先读这里，不要当回归反复返工。

## 1. onLayout 不是布局观察器

- 实现：`useLayoutBridge`（`primitives.tsx`）用 `Taro.createSelectorQuery().select('#rn-layout-N').boundingClientRect()`，
  在渲染后的 `nextTick` 做一次测量，再合成 RN 形状的 `{ nativeEvent: { layout: { x, y, width, height } } }`。
- 限制：**只报首帧**。容器尺寸变化、滚动、键盘弹起都不会自动重报；RN 的 `onLayout` 是原生布局回调，
  这里没有等价观察器。
- 坐标：`boundingClientRect` 的 `left/top` 是**可视区坐标**，RN 的 `x/y` 是**父容器相对坐标**。
  两者在贴顶且无滚动的布局里数值相同，滚动或存在祖先偏移时**不相等**。
- 降级：需要持续观察的场景，业务侧显式重触发测量，或该屏保留 RN 端实现。

## 2. Modal 依赖 RootPortal，且基础库有门槛

- 实现：`Modal` 用 Taro `RootPortal`（`root-portal` 原生节点）把覆盖层挂到页面根，避免被祖先 `transform/overflow` 裁剪。
- 限制：weapp 需基础库 ≥ 2.19.4；低于该版本或不支持 `RootPortal` 的平台**回退为 `position: fixed` 覆盖层**
  （仍可能被祖先裁剪）。
- 无等价物：RN Modal 的 `animationType`、`presentationStyle`、`onShow`、`onDismiss` 在 Taro 侧**不派发**。
- 降级：动画由共享屏自己的 Animated 承担；关闭时机由业务侧显式回调。**不要把这些能力塞进共享屏**。

## 3. ScrollView 需要确定的父级高度

- 实现：`flex:1` / `flexGrow:1` 且轴向无显式尺寸时，原语外包一层 `flex:1; minHeight:0; minWidth:0` 的 `View`，
  内层 `ScrollView` 给 `height:100%`（竖）/ `width:100%`（横），让 `flex:1` 在 Taro 下有真实边界。
- 限制：包装层只能**填充已有边界**。若页面根链路上没有任何确定高度，`flex:1` 依旧会坍缩到 0——
  小程序没有网页端那种"视口自动撑满"的默认高度链。
- 降级：页面根容器必须自己给高度（沿用 `conversation-import` 那类页面 `h-screen` 的既有做法）；
  显式 `height/width` 的调用方原语不包层，盒模型原样透传。

## 4. numberOfLines 只有尾部省略

- 实现：`numberOfLines ≥ 2` 归一为样式键，由 `style.ts` 的 `clampFrom` 生成
  `display:-webkit-box; -webkit-line-clamp:N; -webkit-box-orient:vertical; overflow:hidden`；
  `numberOfLines === 1` 用 `white-space: nowrap`。
- 限制：line-clamp 依赖 `-webkit-box`，部分 Android webview 上表现为**裁切而非省略**；
  RN 的 `ellipsizeMode`（`middle` / `head`）**无等价物**，微信/小程序侧只有尾部省略。
- 降级：需要中部省略时，由业务侧自行截断字符串，原语不提供该能力。

## 5. 按压生命周期：已桥接，但不是同一条原生通道

- 历史：`onPressIn` / `onPressOut` 曾在 `RNCompatProps` 里**声明了却从不派发**（compat View 只接
  `onClick` / `onLongPress`，Taro 的 View 也没有这两个事件）。断掉的不是一处样式，而是三件事：
  ① `ui-native` 的 `Tappable`（现读 361 个调用点）靠这对事件改内部 `pressed` ⇒ 小程序端按压反馈为 0；
  ② 共享层"按住说话"（`ChatVoiceTurn` / `ChatComposer` / `SearchInput`）靠同一对事件起停录音 ⇒
  按下去不开始、松手不结束；③ 函数形态 `style` / `children` 只能按 `{pressed:false}` 求值一次。
- 现状（2026-11-14 起）：`press-handlers.ts` 把 Taro 的 `onTouchStart` / `onTouchEnd` / `onTouchCancel`
  翻译成 `onPressIn` / `onPressOut`，并由 compat `Pressable` 的 state 驱动函数形态求值；
  只有真需要按压态的元素才绑触点（否则 weapp 每个可点节点白多两个 `bindtouch*`）。
- 与 RN 的差异（不假装全等）：手指按下后**滑出**元素时，小程序仍在该节点收到 `touchend`/`touchcancel`
  ⇒ 会补一次 `onPressOut`；多指只认第一个触点；`disabled` 时整条链路不响应。
- 回归护栏：`src/rn-compat/press-handlers.test.ts` 既测状态机行为，也做源码级接线断言
  （只测纯函数的话，接线被人删掉照样全绿）。

## 6. 以下属性在小程序端**不生效**（平台面缺失，不是漏实现）

现读数量均为 2026-11-14 在 `packages/app/src` + `packages/ui-native/src` 的实际调用点。

- **`hitSlop`（134 处）**：weapp 没有"命中区外扩"机制，补量只能是 RN 腿的福利。
  ⇒ 目标真尺寸必须自己够大；门 290 用「较小边 + 2×hitSlop ≥ 36」判 RN 腿，
  小程序腿按真实盒子算，只靠 hitSlop 才达标的 11 处已进普查（不判红，因为改法是调设计尺寸而非改判据）。
- **`pointerEvents`（5 处）**：weapp 没有 `box-none` 语义。`none` 可用"不渲染该层"替代；
  `box-none` 只能改成透明承接层 + 显式尺寸，不能靠属性穿透。
- **`accessibilityRole` / `Label` / `Hint` / `State`**：小程序侧没有可映射的 ARIA 面。
  声明位保留，只为让共享层写得出类型；读屏能力在 weapp 上缺失，不要据此判"实现了无障碍"。
- **`testID`（64 处）**：weapp 无 E2E 定位需求，不落到节点上（`id` 位已被 `onLayout` 的探针占用）。
- **`delayLongPress`（9 处）**：weapp 长按阈值由基础库决定（约 350ms），不能逐点调；
  需要精确时长就自行用 touch 计时，别指望这个 prop。
- **responder 族**（`onStartShouldSetResponder` / `onResponder*`，3 处）：不派发，
  代码注释已点名（`RNCompatProps` 那一格即为此写）。需要拖拽请用共享层的 PanResponder 降级方案。
- **`textAlignVertical`（31 处，其中 30 处是 TextInput 的 prop）**：Android-only 的纵向文字对齐，
  CSS 无对应属性。`'top'` 恰好是多行输入框的默认态，所以现在不产生可见差异；
  但 `'center'` 这类值在 weapp 上会被无视 —— 需要垂直居中请用外层容器 `alignItems`。
- **`includeFontPadding`（3 处）**：Android 专有的行高补白开关，CSS 无对应。丢弃后可忽略，
  它的唯一作用是让 RN 的文本基线更贴近 Android 原生，小程序侧本就没有那层 padding。
- **`keyboardShouldPersistTaps`（65 处）**：weapp 里点击非输入区**本来就不会**收起键盘
  （键盘收起只由显式 `Taro.hideKeyboard` 或输入框 blur 触发），所以 `'handled'` / `'always'` / `'never'`
  三档在小程序端**没有可映射的行为差**。RN 端那条"点空白先收键盘再吞掉这一次点击"的二分语义
  （`never` 会吞第一下）在小程序端不存在，不要照着 RN 的坑去调这里。
- **`autoCapitalize`（42 处）/ `autoCorrect`（22 处）**：weapp 的 `input` 只有 `type` / `password` /
  `confirm-type`，没有大小写与自动纠错开关；iOS 系统键盘侧也不接受小程序控制。声明位保留只为让共享层
  类型闭合，实际不生效。需要"强制小写"的场景请自行 `toLowerCase()`，别指望这个 prop。
- **`measure()` 的父相对坐标（`x` / `y`）**：weapp 选择器只提供 `boundingClientRect`
  （**可视区**坐标），没有父节点相对定位 API，节点树也不可从 JS 侧上行遍历。
  ⇒ 本层 `measure` 的 `x/y` **如实退化为可视区坐标**；`pageX/pageY` 走
  `selectViewport().scrollOffset()` 补偿后是真页面坐标。`measureInWindow` 的语义本来就是窗口坐标，
  与 `boundingClientRect` 一致，**它没有退化**（见 §7）。零调用点现状：共享层只有
  `CategoryDropdown:118` 与 `ui-native/tooltip.tsx:79` 两处，都只用 `measureInWindow`。
- **`setNativeProps`**：weapp 无命令式改样式的通道（只能重渲染），本层给空实现并如实注释，
  不假装生效。共享层现读 **0 处调用**，保留签名只为类型闭合。

## 7. 已在本层补掉的转译缺口（别再报成"平台缺失"）

- **轴向简写 `paddingHorizontal` / `paddingVertical` / `marginHorizontal` / `marginVertical`**：
  这**不是**平台缺失，而是转译缺口 —— CSS 根本没有 `padding-horizontal` 这种键（轴向后缀不存在）。
  2026-11-14 前逐键原样透传，weapp 的 webview 遇到未知属性整条丢弃 ⇒ 共享屏在小程序端的
  轴向内/外边距**静默归零**（不报错、`tsc` 也抓不到，因为 RN 侧那四个键是合法的 `ViewStyle`）。
  现由 `style.ts` 的 `RN_AXIS_SHORTHAND` 摊成 `paddingLeft/Right`、`paddingTop/Bottom`，
  并在 `tests/rn-compat-style.test.ts` 里锁了 7 条语义（含"后写的显式边覆盖简写"的顺序语义）。
  现读用量：paddingHorizontal 1602、paddingVertical 1392、marginHorizontal 106、marginVertical 19。
  **改法只有一处**（`toTaroStyle`），不要为了这四键去改 402 个共享屏的写法。

### 7.1 `View` 的 ref 与 `measureInWindow`（原「只有类型、没有实现」，2026-11-14 已补）

- 此前 `ViewInstance.measureInWindow` **只在类型位存在**，且 `View` 是普通函数组件 ⇒
  共享层 `useRef<View>(null)` 在小程序端**恒为 null**，`r.current?.measureInWindow(cb)` 整条链静默失效
  （`components/category/CategoryDropdown.tsx:118` 的下拉锚点、`ui-native/tooltip.tsx:79` 的浮层定位都靠它）。
- 现 `View` 已是 `forwardRef`，`ref` 拿到的是本层实现的三枚方法：
  `measureInWindow`（真：`boundingClientRect` 即窗口坐标）、`measure`（`x/y` 退化为可视区坐标，
  `pageX/pageY` 真算，理由见 §6）、`setNativeProps`（空实现）。
- 取不到 rect 时**不回调**（与 `onLayout` 同一纪律：不派发 0 尺寸假数据）。调用方按
  "回调可能不来" 设计兜底，不要假设必经。
- 与之相关但**仍未成立**的能力：`Animated.View` 等 `createAnimatedComponent` 的包装组件
  不透传 `ref`（RN 里 `Animated.View` 的 ref 指向宿主节点）。共享层现读 **0 处**这样用，需要时再补。

<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
