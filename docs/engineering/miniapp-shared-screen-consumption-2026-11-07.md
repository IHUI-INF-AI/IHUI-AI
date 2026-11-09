<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 小程序能否消费 packages/app 共享屏：结论与落地路径（2026-11-07）

> 只读结论。本文件不动 `packages/app`、`apps/mobile-rn`、`apps/miniapp-taro` 任何代码。

## 0. 结论

**A —— 可以直接接，而且不是新机制，是仓里已经跑起来的既有机制。**

判据不是推理，是现成规模：小程序端 `src/` 内 `from '@ihui/...'` **480 处**、`from '@rn-shells/...'` **203 处**、`from '@ihui/rn-app...'` **70 处**；275 张共享屏里 **246 张**已判为小程序薄壳（结构+入口双证 241 张）。详见 `docs/engineering/miniapp-shell-closure-2026-11-06.md`。

所以对五屏（`ApiKeys`/`Groups`/`Patrol`/`RepoWiki`/`TeamKnowledge`）而言，问题不是"能不能"，而是"页还没建 + 词包还没补"。三处缺口都在机械可自动化范围内（见 §4）。

## 1. 事实取证

### 1.1 接入机制（三端各一条，均已存在）

| 端 | 机制 | 证据 |
|---|---|---|
| web | `react-native` → `react-native-web`；`transpilePackages` 含 `packages/app` | `apps/web/next.config.ts#L108`（transpilePackages）、`#L132-L136`（turbopack resolveAlias）、`#L144`（webpack alias） |
| RN | 直接 import `@ihui/rn-app`（workspace 包） | `fw/packages/app` 直连 |
| 小程序 | 构建期别名替换：`react-native$`→`src/rn-compat/index.ts`、`@ihui/rn-app`→`packages/app/src`、`@rn-shells/*`→`apps/mobile-rn/src/screens/*`，另有 `lucide-react-native`、`@react-navigation/*`、`expo-*`、`react-native-svg` 等 20 余条同类别名 | `apps/miniapp-taro/config/index.ts#L158-L230`；TS 侧同构 `apps/miniapp-taro/tsconfig.json#L18-L31` |

**react-native-web 本身不能在 Taro 复用**（它的出口是 DOM），但**"按包名替换实现"的模式被完整复用**，承载实现是 Taro 原生组件 + `rn-compat` 适配层。也就是说 Taro（webpack5，已关闭 prebundle）走的是同一条结构，不是另一条路。

### 1.2 五屏用到的原语（逐屏实读，均在 `rn-compat` 有承载）

| 原语 | 小程序承载 | ApiKeys | Groups | Patrol | RepoWiki | TeamKnowledge |
|---|---|---|---|---|---|---|
| `View` | `rn-compat/primitives.tsx#L299`（Taro `View`） | ✓ | ✓ | ✓ | ✓ | ✓ |
| `Text` | `#L333`（`numberOfLines` 映射，无 middle 截断） | ✓ | ✓ | ✓ | ✓ | ✓ |
| `TouchableOpacity` | `#L352`（值位 = `View`） | ✓ | ✓ | ✓ | ✓ | ✓ |
| `StyleSheet.create` | `rn-compat/style.ts#L162`（原样返回，px 不转换） | ✓ | ✓ | ✓ | ✓ | ✓ |
| `ScrollView` | `#L624`（含 `refresherEnabled #L590`） | ✓ | ✓ | ✓ | ✓ | ✓ |
| `RefreshControl` | `#L634`（空渲染，由 `ScrollView` 消费为 `refresherEnabled`） | — | — | ✓ | ✓ | ✓ |
| `ActivityIndicator` | `#L917` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `useWindowDimensions` | `rn-compat/apis.ts#L34` | — | ✓ | — | — | — |
| `TextInput`（经共享 `TextField`） | `#L882` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `Modal`（仅 RN 壳层用） | `#L938`（`RootPortal`；无 `animationType`/`onShow`） | 壳 | 壳 | — | — | — |
| `Platform.OS` / `window` / `navigator` | `Platform` 恒 `'ios'`（`apis.ts#L45`） | **0** | **0** | **0** | **0** | **0** |

五屏文件内只有注释出现 `Platform.OS / window / navigator`（`Groups#L11`、`Patrol#L10`、`RepoWiki#L12`、`TeamKnowledge#L16`），代码零平台判断。

图标：五屏共 22 枚 lucide 图标（Archive/ChevronDown/ChevronUp/Copy/Eye/EyeOff/History/KeyRound/MessageSquare/Pause/Pencil/Play/Plus/RefreshCw/Search/Send/Shield/Trash2/UserPlus/Users/UsersRound/Zap），已**全部**存在于 `src/rn-compat/icons-generated.tsx`。

### 1.3 五屏当前真实状态（避免把"已写完"记成"已上线"）

- 五屏在分支 `feat/rn-shared-screen-20261107`（工作树 `D:/IHUI-AI-wt-rn-shared`），主树 HEAD **尚无**这五个目录。
- web 侧已真消费（如 `apps/web/app/(main)/groups/page.tsx#L19-L22` 直接 import `@ihui/rn-app/features/groups/GroupsScreen`）。
- RN 壳已委托渲染（`apps/mobile-rn/src/screens/GroupsScreen.tsx#L10`：`import { GroupsScreen as SharedGroupsScreen } from '@ihui/rn-app'`），壳只留数据/导航/宿主。
- 小程序侧**没有**这五屏的页面、路由、壳声明、词条（见 §4）。

## 2. 表 2：共享层边界（哪些共用、哪些必须各写）

| 层 | 归属 | 五屏现状 | 小程序接法 |
|---|---|---|---|
| 视图/样式（`View/Text/ScrollView/RefreshControl/Modal` 布局树） | `packages/app` | 100% 在共享屏 | 直接编译，经 `rn-compat` |
| 主题 token（`getTokens`、`rnRadius/rnSpacing/rnType`） | `packages/app/src/theme` + `@ihui/design-tokens` | 共享 | 直接编译（真源 `tokens.css`） |
| 类型契约（props/`TFunction`/`ApiKeyPermission`） | `packages/app` + `@ihui/types` | 共享 | 直接编译 |
| 文案键（`eduAi.groups.*` 等） | 各端词包 | RN 有、miniapp 缺 | 补 miniapp 词包（5 语言） |
| 数据获取/导航/宿主弹窗/剪贴板/权限 | 宿主（RN 壳、web page） | RN 壳已写、web page 已写 | **复用 RN 壳**（`@rn-shells/*`），不在小程序页重写 |
| 平台能力适配（Modal→RootPortal、剪贴板、图片选择等） | `apps/miniapp-taro/src/rn-compat` | 已实现，有 `PLATFORM-LIMITS.md` 记录降级 | 不新增，按限制表裁定 |

结论：小程序**不需要写视图层**，只需"薄壳页 + 词条 + 壳声明"。

## 3. 表 3：把"行为等价"做成自动化的路径

| 类别 | 对象 | 已有自动化 | 查不了的部分 |
|---|---|---|---|
| 机械同步 | i18n 词包（5 语言） | `gen-i18n-compressed.mjs` 生成 `zh-cn-pack.gen.ts`；门 105 B（生成件同步）；`check-i18n-cross-end-wording.mjs`（基线 `scripts/data/i18n-cross-end-wording-baseline.json`，commit advisory / push 恶化即红） | 同键不同义的"该拆键还是该对齐" |
| 机械同步 | design token | 真源 `packages/design-tokens/src/styles/tokens.css`；门 93 `check-cross-end-tokens.mjs`；`check-miniapp-taro-style-parity.mjs` | 真机观感像素级一致 |
| 机械同步 | 路由表 | 生成器 + 门 105 A；门 301 `check-web-mp-route-carriers.mjs` 承载对账 | 入口可达性/交互路径 |
| 机械同步 | 壳声明/TS | `scripts/gen-rn-shell-types.mjs --write` → `apps/miniapp-taro/types/rn-shells.generated.d.ts`；门 251 C9「声明件与引用不同步」 | — |
| 机械同步 | 图标 | `icons-generated.tsx` 生成器 | — |
| 机械同步 | 页面承载 | `land-cross-end-shell-pages.mjs`（造页 + 4 条接缝：app.config / 登记表 / 5 词包 / 类型，全按 HEAD blob 构造）；判据由 `plan-hand-mirror-conversion.mjs` 出 | 页面是否值得薄壳化 |
| 可判红 | 承载形制/词键覆盖/棘轮 | 门 299 `check-miniapp-shell-form.mjs`（hosted/broken/other/hand）；`check-miniapp-mirror-fidelity.mjs`；门 237 `check-cross-end-screen-coverage.mjs` | — |
| 可判红 | 交互卫生 | 门 290 `check-miniapp-interaction-hygiene.mjs`（假可点/空端口 blocking，Modal 误用 advisory） | Modal 语义是否可接受 |
| 可判红 | 共享层平台纯度 | `check-shared-layer-duplication.mjs --platform-purity` + `scripts/lib/shared-layer-purity.mjs` + `scripts/data/shared-layer-platform-purity.jsonl` | 适配层自身的降级 |
| 人工判定 | 平台语义差（Modal 无 `animationType/onShow`、`onLayout` 只首帧、`Platform.OS` 恒 `'ios'`） | 只能记录在 `PLATFORM-LIMITS.md` + 台账（owner/expires/证据 file:line） | 全部靠人 |
| 查不了 | 真机渲染、手势、键盘、剪贴板授权 | 无 | 只能真机 smoke |

**关于"再造一道 miniapp↔rn 门"**：价值有限。因为小程序消费的是同一份共享屏（同一文件、同一 props 面），渲染等价由构造保证；能漂移的只有 ①手写页冒充薄壳（门 299/`mirror-fidelity` 已判）、②适配层降级（门 290 + purity 台账）、③词条漂移（wording 尺已判）。真正缺的一格是**"共享屏只允许使用 rn-compat 已承载的 RN 面"**——现由 `check-shared-layer-duplication --platform-purity` + 台账承担，建议补一条：把 `PLATFORM-LIMITS.md` 的"无等价物清单"（`animationType/presentationStyle/onShow/onDismiss/onLayout 重报`）机器化为共享屏源码禁用符号表；这是唯一还没机读的边界。

## 4. 下一步最小试点：Groups（纯列表 + 一个 Modal）

前置：把 `feat/rn-shared-screen-20261107` 合入主干（五屏入库是这条线的前置，不是本任务范围）。

1. 预演造页：`node scripts/land-cross-end-shell-pages.mjs`（只读，报本轮会产哪几页、四缝是否全通）。
2. 补词条：`packages/i18n/messages/miniapp-taro/{5 语言}.json` 增加 `eduAi.groups.*`（**与 web 同键逐字一致**，不得同步损坏译文），然后 `node ../../scripts/gen-i18n-compressed.mjs`。
3. 落地：`node scripts/land-cross-end-shell-pages.mjs --cap=1 --apply`。
4. 派生声明：`node scripts/gen-rn-shell-types.mjs --write`。
5. 验证：`node scripts/check-miniapp-shell-form.mjs --worktree`、`check-miniapp-mirror-fidelity`、`check-cross-end-screen-coverage`、`check-miniapp-interaction-hygiene --gate`、`check-i18n-cross-end-wording --gate`、`check-miniapp-generated`、`check-web-mp-route-carriers`、`@ihui/miniapp-taro` typecheck。
6. 真机 smoke（Modal 为 RootPortal，重点看遮罩/滚动锁定/键盘）。

工作量：Groups 试点 **1–1.5 人天**（含 5 语言词条与门回归）；五屏全量 **3–4 人天**（Groups 之后每屏约 0.5 人天，词条是大头）。

## 5. 明确不建议

- 不要在小程序页里重写布局/样式（违反薄壳三标，且必然再漂移）。
- 不要把 `react-native-web` 塞进 Taro（出口是 DOM，与小程序运行时无关）。
- 不要为这五屏放宽门 299 / 237 / 290 / 词条尺。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
