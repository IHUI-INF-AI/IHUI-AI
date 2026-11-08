<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 跨端生产线总账与自动化增量(2026-11-08)

> 目标不是再抽一屏,而是把「RN 自动同步 web、小程序对齐 RN、全程自动化、最大化减少开发量」变成一条**可复算、可复跑**的生产线。
>
> 本报告的全部数字由脚本从 **HEAD blob** 复算,不是肉眼清点。取材面 = `origin/main` @ `895027a9`(2026-11-08 fetch 后现读)。
> 逐页清单见附录 [cross-end-pipeline-inventory-2026-11-08.pages.md](./cross-end-pipeline-inventory-2026-11-08.pages.md)。
>
> 复跑:
>
> ```bash
> node scripts/cross-end-pipeline-inventory.mjs                # 人读总账(约 5-10 分钟,git batch I/O)
> node scripts/cross-end-pipeline-inventory.mjs --list         # 四类逐页
> node scripts/cross-end-pipeline-inventory.mjs --candidates   # 候选排序
> node scripts/cross-end-pipeline-inventory.mjs --json         # 机读
> node scripts/cross-end-pipeline-inventory.mjs --pages-md=docs/engineering/xxx.pages.md
> node scripts/check-shared-platform-limits.mjs [--gate|--json]
> ```
>
> 两个脚本默认读 HEAD;`--worktree` 是人工逃生舱;两面旗同给一律 exit 2(§0.4)。脚本对取不到判定面(路由集/登记表/源码)统一 exit 2「未判定」,不折成空集冒绿(§0.3)。

---

## 一、总账:web 页面按「是否已共享屏」分四类

### 1.1 口径(机器判定,逐条可复算)

| 类别 | 判定依据 |
| --- | --- |
| **已共享** | web 页面族(同目录 `page.tsx` + 伴生 `PageClient/Client/*` 及本地 `./`、`@/` import 两层)里 import 了 `@ihui/rn-app*` 或 `packages/app/src`,且被导入的某个 `*Screen` 以 JSX 渲染。只 import 小组件(如 `CategoryHeader`)记「局部共享」,不冒充满屏共享。 |
| **端侧各自实现** | 登记表 `scripts/data/web-rn-screen-map.jsonl` 判 `aligned`/`pending`,且 web 未接共享屏。再读 RN 屏正文分三档:① 登记表 `rn` 直接指向 `packages/app/src/features/*Screen.tsx`;② 指向 `apps/mobile-rn/src/screens/*.tsx`,但该壳 import 且渲染了共享屏(`shared-adapter`);③ 壳没有渲染共享屏,且无同名共享屏(`rn-native`,真重复);④ 有同名共享屏但壳没接(`shared-orphan`)。 |
| **只存在于一端** | web 侧:登记表 `gap`(判过确缺)或整段未登记(**未判定**,不折成缺口)。RN 侧:`apps/mobile-rn/src/screens/*Screen.tsx` 未被任何 aligned 行引用,且排除「同名共享屏」与「该壳渲染了被引用的共享屏」两种消歧(启发式,需人复核)。 |
| **无法共享** | 登记表 `excluded`(平台特有,必须带豁免键/reason)与 `portal`(WebView 门户承载)。portal 不是重复开发,是按设计复用 web 实现,单列以免读成待办。 |

归属互斥,按「已共享 → excluded → portal → aligned → gap → 未登记」顺序落档;找不到归属一律进**未判定**,不猜。

### 1.2 数量(分母:897 条 web 路由 = `collectWebRoutes` 排除语言镜像后的 page.tsx)

| 四类 | 子档 | 数量 |
| --- | --- | ---: |
| **一、已共享** | 整屏(渲染了 `*Screen`) | **2** |
| | 仅局部共享组件 | **3** |
| | **小计** | **5** |
| **二、端侧各自实现** | RN 已接共享屏(登记表直指共享屏) | **103** |
| | RN 壳已委托共享屏(登记表指向端内壳,壳 import/渲染共享屏) | **124** |
| | 共享屏已存在但 RN 未接(orphan) | **1** |
| | 两端都自实现(RN 端内真重复) | **60** |
| | **小计** | **288** |
| **三、只存在于一端** | web 确有、RN 无(`gap`) | **0** |
| | web 侧未判定(`pending`/未登记) | **1** |
| | RN 独有(启发式,含端内二级屏) | **111**(非 web 分母) |
| **四、无法共享** | 平台特有(`excluded`) | **514** |
| | WebView 门户承载(`portal`) | **88** |
| **内部工具页(不计入分母)** | `shared-pilot` 展示页 | **1** |

合面自检:`2+3+288+0+1+514+88+1 = 897`,与 `collectWebRoutes` 读数一致;登记表坏行 0、登记腐烂(aligned 指向不存在的屏)0。

`excluded` 的 514 条全部有段级豁免键,头部分组:`admin/**` 318、`compare/**` 37、`developer/**` 17、`use-cases/**` 16、`docs/**` 14、`sso/**` 8,其余约 104 条为逐条/其他段。**这不是工作量**,是平台特有面。

### 1.3 这张账暴露的真问题

1. **瓶颈不在「抽屏」,在「web 接屏」。** RN 层已经基本完成:288 条端侧各自里 **227 条**的 RN 侧已经委托共享屏(103 直指 + 124 壳委托),真正两端都重写的只剩 **60 条**。而 web 侧只接了 **2 整屏 + 3 局部组件**。也就是说 `packages/app` 的共享屏大多已被 RN 证明可用,web 才是最后一块没接的。
2. **登记表在「层」上失真。** 登记表只记 `rn` 路径;124 条指向 `apps/mobile-rn/src/screens/*.tsx` 的壳,实际这些壳已经 `import { SharedXxxScreen } from '@ihui/rn-app'` 并渲染。按登记表字面读会把它们误算成「RN 自实现」。本次总账改为**读壳正文**判定,才拆出 124/60。建议补一条 drift 判据(见 §三 P1-1)。
3. **`articles` 是唯一未判定。** 登记表 `pending`:RN 有 `ArticleListScreen`,但没人验证过它和 web `articles` 的承载关系。不是缺口,是欠一次判定。
4. **RN 独有 111 条是候选,不是缺口。** 其中大量是端内二级屏(`AgentChatScreen`、`ArtifactPreviewScreen` 等),web 本来就不该有对应路由;需人复核后再收窄。报告不把它们折成「web 缺失」。

> ⚠️ 口径偏差声明:本次基线是 `origin/main`。你提到「五屏已完整下沉(`ApiKeys`/`Patrol`/`Groups`/`RepoWiki`/`TeamKnowledge`)」,但 `git cat-file -e origin/main:packages/app/src/features/patrol/PatrolScreen.tsx` **不存在**,该工作还没进 `origin/main`。因此本账按未下沉计数。若它已在别的分支落地,请在该树上用 `--worktree` 复跑,数字会变。
>
> ⚠️ 你提到的 `apps/miniapp-taro/PLATFORM-LIMITS.md` 实际路径是 `apps/miniapp-taro/src/rn-compat/PLATFORM-LIMITS.md`,内容为四条硬限制(onLayout / Modal / ScrollView / numberOfLines)。

---

## 二、流程里还需要人工的每一处(只列真实的)

先把「已有自动化」与「靠人」分开。下表左列是**读过脚本正文**确认它真的在做这件事,不是愿望清单。

| # | 环节 | 现状 | 证据/形态 |
| --- | --- | --- | --- |
| 1 | 枚举 web 路由 / RN 屏 / 共享屏 | **自动** | `collectWebRoutes` / `collectRn` / `collectShared`(被多个门复用) |
| 2 | web→RN 映射登记 | **半自动** | `auto-register-cross-end.mjs` 按机械证据(shared spec / 渲染证据 / 同名消歧)自动登记 aligned/portal;`gap` 档仍要「判过零承载 + 证据」,属人判 |
| 3 | web↔RN 覆盖对账 | **自动(门)** | `check-web-rn-screen-parity.mjs`;ratchet 只报数,存量不阻塞 |
| 4 | web↔RN 样式/结构对账 | **自动(门)** | `check-web-rn-screen-style-parity` 系列 + `check-cross-end-tokens`(93) |
| 5 | web↔RN 文案对账 | **自动(门)** | `check-web-rn-copy-parity`(291);B1 阻塞,B2 走豁免台账 |
| 6 | 共享层重复 / 平台纯度 | **自动(门)** | `check-shared-layer-duplication --platform-purity` |
| 7 | 共享屏 props 跨端对账 | **自动(门)** | `check-cross-end-props-parity`(288,台账 `component-props-equivalence.json`) |
| 8 | 小程序薄壳形态 | **自动(门)** | `check-miniapp-shell-form`(299)+ `miniapp-shell-copy-ledger.jsonl`(93 行) |
| 9 | 小程序镜像保真 / Taro 样式对齐 | **自动(门)** | `check-miniapp-mirror-fidelity` / `check-miniapp-taro-style-parity` |
| 10 | rn-compat 覆盖 | **自动(门)** | `check-rn-compat-coverage`(251) |
| 11 | RN 壳类型声明 | **自动(生成器+校验)** | `gen-rn-shell-types.mjs` + 生成物一致性校验 |
| 12 | i18n 压缩词包产物 | **自动(生成器+校验)** | `gen-i18n-compressed.mjs` + 生成物 staleness 检查 |
| 13 | 缺页自动造壳 + 落地 | **自动(preview/apply)** | `land-cross-end-shell-pages.mjs`(给「页面不存在」造薄壳,不是给存量复制页改造) |
| 14 | 路由承载对账 | **自动(门)** | `check-web-mp-route-carriers`(301) |
| 15 | **决定抽/接哪一屏** | **靠人判断** | 过去只有 size/LOC 直觉;本报告补机器候选排序(§三.3) |
| 16 | **写共享屏本体(JSX/状态/交互搬迁)** | **靠人** | 无 codemod;`.trae/documents/抽屏检查单.md` 12 节逐项打勾 |
| 17 | **web 端接入共享屏(改 PageClient / 注入 props)** | **靠人** | 无生成器;`shared-pilot` 只提供人工预览 |
| 18 | **小程序存量复制页改薄壳** | **靠人** | `land-cross-end-shell-pages` 只造「缺页」,不改「已有复制页」 |
| 19 | **平台能力注入点设计(保存/分享/选择器/登录)** | **靠人判断** | 必须由壳注入;无自动判定「该不该注入」 |
| 20 | **i18n 跨端同语言复制** | **靠人逐字搬** | 无生成器;只有对账门 291 与 zh-CN 扫描 |
| 21 | **平台限制符约束(PLATFORM-LIMITS)** | **过去无判据** | 本报告新增 `check-shared-platform-limits.mjs`(§三.2) |
| 22 | **登记表层漂移(壳已委托共享屏但表记壳)** | **靠人发现** | 无判据;本次总账用正文读出 124 条 |
| 23 | **旧实现删除 / 死码清理** | **靠人判断** | Knip 只报;**CI 干净树结论才算真值** |
| 24 | **等价性/降级判定(抽屏检查单 §2)** | **靠人判断** | 「看起来一样」不算,需要截图/像素/交互对照 |
| 25 | **行数账/净减行核对(检查单 §4)** | **靠人算** | 无生成器;本报告只给页面族有效行,不等于交付口径 |
| 26 | **提交组合与门读数处置** | **半自动** | safe-commit + hooks 自动;红了怎么处置仍靠人 |

**结论**:流程不是「没有自动化」,而是自动化集中在**事后对账**(15/26 个环节有门或生成器),**事前生成**几乎空白(抽屏、接屏、薄壳化、i18n 复制全靠人)。且现有门有一个盲区:**只看登记表/路径,不读壳正文**,所以 124 条已被共享屏接管的 RN 壳在账上仍算「自实现」。

---

## 三、最小可执行的自动化增量(按性价比排序)

排序原则:先做**零写盘/零误改**的读数,再做**只增不改**的生成器,最后才碰**改写源码**的 codemod。改动规模按「新增文件行数 + 需要触碰的既有文件数」估。

### P0(已完成,本报告交付)

| # | 增量 | 解决环节 | 形态 | 规模 | 风险 |
| --- | --- | --- | --- | --- | --- |
| P0-1 | `cross-end-pipeline-inventory.mjs` | §二.15 决策、§一总账 | 只读脚本 | 新增 ~470 行,0 既改 | 零写盘;只读 HEAD;慢(5-10 min),**不得挂 pre-commit** |
| P0-2 | `check-shared-platform-limits.mjs` | §二.21 平台限制符 | 只读脚本 + `--gate` | 新增 ~300 行,0 既改 | 当前 unsafe=0,挂门即绿;noop/review 只报数 |

### P1(建议做,按性价比)

| # | 增量 | 解决环节 | 形态 | 规模 | 风险/边界 |
| --- | --- | --- | --- | --- | --- |
| P1-1 | **登记表层漂移判据**:读 aligned 行指向的 RN 壳正文,若壳 import+渲染了共享屏,则要求登记台账标 `layer: shared-adapter`(或至少输出 advisory 清单) | §二.22 | 门/脚本(先 advisory ratchet) | ~150 行 + 台账可选加列 | 低。不读正文就永远把 124 条误算成「RN 自实现」;先只报数不阻塞 |
| P1-2 | **web 接屏脚手架(只出 diff,不自动落盘)**:给定 adopt 候选,生成「PageClient 改为渲染 `<SharedXScreen {...契约}/>`」的补丁预览 + props 缺口清单,复用 288 的 props 对账 | §二.17 | 生成器(preview-only) | ~200 行;需读共享屏 props 面 | 中。web 平台差异(下载/上传/富文本/SEO)必须显式列缺口;自动改写会误伤,**先只预览** |
| P1-3 | **i18n 跨端同语言复制生成器(只增不改)** | §二.20 | 生成器(dry-run 默认) | ~250 行 + 自检 | 中低。规则见 §三.1;绝不覆盖既有键,冲突只出清单 |
| P1-4 | **小程序存量复制页→薄壳生成器**:按台账 declaredSpecs 生成最小壳 + 平台注入骨架,先 dry-run 出 diff | §二.18/19 | 生成器(preview-only) | ~200 行 | 中。必须保留原平台行为;无法自动判断注入闭包时拒绝生成并点名 |

### P2(明确做不了 / 不该现在做)

| 增量 | 卡在哪 |
| --- | --- |
| **全自动「抽屏」codemod**(把 web/RN 的 JSX+状态抽成共享屏) | 做不了。抽屏是语义重构:状态归属、props 契约、平台注入、样式等价都要人判;自动改写会制造「编译过、行为变」的假绿。剩余真重复只有 60 条,人工成本可控 |
| **自动平台分叉裁决** | 做不了。是否「真平台差异」需要产品语义与真机证据;能自动的只有「把候选列出来 + 强制 owner/expires」 |
| **自动删除旧实现 / 死码** | 做不了(安全地)。只能 Knip 报数 + 人删;自动删会误伤动态引用 |
| **把 total inventory 挂成 commit 门** | 不该。单次 5-10 分钟,且它是报表不是判据;应挂 push/夜间任务,或只挂「数量不回退」的轻量快照 |

### 3.1 专题一:i18n 跨端同语言复制,能不能变成生成器?

**能,但必须限定作用域,不能「全量补齐」。** 先看真实盘面(HEAD,把词包拍平成点分键):

| 语言 | web | mobile-rn | miniapp-taro | web→RN 缺 | RN→小程序 缺 | RN↔小程序 同键不同值 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| zh-CN | 25102 | 6466 | 5799 | 23267 | 3313 | 32 |
| en | 25102 | 6466 | 5799 | 23267 | 3313 | 78 |
| ja | 25102 | 6466 | 5799 | 23267 | 3313 | 87 |
| ko | 25102 | 6466 | 5799 | 23267 | 3313 | 93 |
| zh-TW | 25102 | 6466 | 5799 | 23267 | 3313 | 60 |

两个事实:

1. **键命名空间并未对齐**。web 有 25102 键,RN/小程序约 6k;`web→RN 缺 23267` 里绝大多数是 web 独有域(admin/营销/长尾)。**全量复制 = 把 2.3 万条 web 键灌进 RN,必然灾难**。
2. **真正的冗余在 RN→小程序**:3313 条缺失、同键不同值 32-93 条。而共享屏消费的键只是其中一小部分。

**生成器规则(建议)**

- **作用域**:只处理「被共享屏源码 `t('...')` 引用、且目标端确实消费该共享屏」的键。扫描 `packages/app/src` 的静态字面量 `t()` 调用;动态键(``t(`x.${y}`)``)一律跳过并计入「未判定」。
- **映射规则**:同一条键路径**逐字同名**,不做命名空间重写、不合并前缀、不猜近义键。缺哪条补哪条,语言逐语言独立处理。
- **源/目标**:RN→小程序为第一优先(RN 是共享屏的已验证消费端);web→RN 只在「该键确由共享屏引用」时做。
- **只增不改**:目标键已存在就**跳过**;值不同就写进冲突台账,**绝不覆盖**。这直接回答「会不会把某端独有的键覆盖掉」:不会,生成器没有覆盖路径。
- **译文纪律**:同语言逐字相同(尤其 zh-CN);补完必须跑 291 与五语言键集合一致性检查,冲突条目交 E 组/人裁。
- **落盘**:默认 dry-run 打印 diff;`--write` 才写;写完必须重跑 `check-i18n-parity`、291、`gen-i18n-compressed` 并逐字节校验生成物。

**做不了的部分**:同键不同义(32-93 条)不能自动合并;动态键与运行时拼键无法静态覆盖;端内独有域(admin 等)不该复制。这些必须保留为人审清单。

### 3.2 专题二:PLATFORM-LIMITS → 共享屏禁用符号表

先给**清单 vs 实际使用**的真实对照(判定面 `packages/app/src` 372 个共享屏源码,已排除测试与注释):

| PLATFORM-LIMITS 条目 | 文档要求 | HEAD 实际使用 | 判定 |
| --- | --- | ---: | --- |
| Modal `presentationStyle` | 无等价物 | **0** | unsafe(应禁,当前干净) |
| Modal `onShow` | 不派发 | **0** | unsafe(应禁,当前干净) |
| Modal `onDismiss` | 不派发 | **0** | unsafe(应禁,当前干净) |
| Modal `animationType` | 不要塞进共享屏 | **31 处 / 29 文件** | **noop**:不崩,但 Taro 侧动画静默失效。文档是愿望,代码已普遍违反 |
| `ellipsizeMode="middle"/"head"` | 小程序只有尾部省略 | **0** | unsafe(应禁,当前干净) |
| `ellipsizeMode="tail"/"clip"` | 与默认等价 | 3 文件 | ok,放行 |
| `onLayout` 持续观察 / 父容器相对坐标 | 只报首帧、坐标是可视区 | **2 行 / 1 文件(BannerCarousel)** | **review**:轮播测高属于真实降级风险,需人判是否改 `onLayout`+重测 |
| Modal `RootPortal` | 无等价物 | 不是「符号」 | 无法用符号表判 |
| ScrollView 需确定父高 | 布局约束 | 不是「符号」 | 无法用符号表判 |

**写成门还是 lint 规则?结论:写成门(独立脚本),不写成 eslint 规则。** 理由:

1. **lint 的归属面不对**:`packages/app` 的同一份源码被 web/RN/小程序三套构建消费,各 app 的 eslint 配置并不统一覆盖共享层;把规则塞进某个 app 的 lint,另两端不受约束。
2. **规则需要「符号 + 取值」语义**:`ellipsizeMode` 只有 `middle/head` 危险,`tail/clip` 合法;`animationType` 是 no-op 不是崩溃。一刀切禁用会制造 31 条假阻塞。
3. **仓里既有判据全是「独立脚本 + HEAD 面 + self-test + exit 2 未判定」**,门比 lint 更符合现有取证与复算纪律;lint 只能作为编辑器内的快速反馈,不能当 CI 真值。

**已交付的行为**:`check-shared-platform-limits.mjs` 把 unsafe(当前 0)做成 `--gate` 可阻塞;noop/review 只报数,**不造恒红**。这就是 §12e 的做法:先让判据可跑、读数干净,再谈挂门;挂门必须另走门号登记,不在本任务里偷偷塞进钩子。

### 3.3 专题三:抽屏候选排序(下一个最划算)

评分是机器分:`score = 可减行数 − 平台分叉×20 + 既有测试×40`。但**分数最高 ≠ 最该做**:`checkin` 分数 5621,可是平台分叉 33 处、无测试,是陷阱;`chat` 是最大 adopt(2779 行),但域复杂、风险高。按「改一次同时减两端 + 分叉少 + 测试容易写」重排:

| 推荐序 | 屏 | 形态 | web 行 / RN 行 | 分叉 | 既有测试 | 判断 |
| --- | --- | --- | ---: | ---: | --- | --- |
| **1** | `settings/import` | **adopt**(RN 已委托共享屏) | 1185 / 402 | **0** | **有** | 最稳:表面小、无平台分叉、RN 已证明共享屏可用;web 接上即减 1185 行,且不用新写共享屏 |
| **2** | `edu/edu-management/attendance` | **extract** | 1331 / 584 | **0** | **有** | 真两端重复里最大且零分叉;抽出后两端同时减约 1900 行,测试可复用 |
| **3** | `settings/devices` | **extract** | 561 / 554 | **0** | **有** | 表面最小、两端行数接近,最适合做「抽屏流水线」的第一个样板 |
| 备选 | `edu/edu-management/finance` | adopt | 2317 / 125 | **0** | 无 | 减行最多,但要补测试;适合做第二条 |
| 不推荐 | `checkin` | extract | 5908 / 373 | 33 | 无 | 高行数来自平台分叉,抽屏会把分叉带进共享层 |

**但更重要的判断是:下一个最划算的不是某一屏,而是「web 接现成共享屏」这条腿。** 226 条 adopt 候选的共享屏已被 RN 使用,web 每接一条就减一份重复;这比从 60 条里再抽一屏的杠杆大一个量级。建议先用 P1-2 的 preview 脚手架在 `settings/import` 上跑通,形成可复制的接屏流水线,再批量推进。

---

## 四、已动手的两件(交付物与验证读数)

### 4.1 总账脚本

- 文件:`scripts/cross-end-pipeline-inventory.mjs`(只读,零写盘)
- 复用既有判据:`collectWebRoutes` / `loadMap` / `prefixScopeOf` / `routeInScope` / `collectShared` / `collectRn` / `effectiveLines`,不新造一套路由枚举。
- 能力:`四类总账` / `--list` 逐页 / `--candidates` 排序 / `--json` / `--pages-md=` / `--worktree` / `--self-test`
- 自检读数:

```text
✅ 自检通过:shared/partial/none 三态 + 逐条优先/段级/本地解析 全部可构造
```

- 全量读数(HEAD):`web 路由 897 / 登记表 484 行(坏行 0)/ 共享屏 275 / RN 端内屏 344 / 三端登记三元组 256`
- 四类:`已共享 2+3`、`端侧各自 103+124+1+60`、`只存在一端 web 0+1 / RN 独有 111`、`无法共享 514+88`、`内部工具 1`。

### 4.2 平台限制判据

- 文件:`scripts/check-shared-platform-limits.mjs`(只读;`--gate` 只拦 unsafe)
- 规则表直接对位 `apps/miniapp-taro/src/rn-compat/PLATFORM-LIMITS.md` 的四节;三档 `unsafe/noop/review` 分离,避免把 31 处 `animationType` 变成假阻塞。
- 自检读数:

```text
✅ 自检通过:11 组夹具(含注释/onShowToast 阴性对照)全部按规则表落档
```

- 全量读数(HEAD,372 个共享屏源码):

```text
unsafe = 0
noop   = 31(animationType,29 文件)
review = 2(onLayout,BannerCarousel 1 文件)
--gate exit 0
```

---

## 五、边界与没做的事

- **没改任何业务源码**:`packages/app`、`apps/mobile-rn`、`apps/miniapp-taro` 的既有文件零改动;只新增两个脚本 + 两份文档。
- **没挂任何门**:两个脚本都还是「可复跑判据」,没有登记门号、没有改 guardian/husky。平台限制判据要挂门,必须另走门号登记与存量清零流程(§12e);总账脚本太慢,不适合 commit 钩子。
- **没提交**?本次交付在独立 worktree `D:/IHUI-AI-wt-pipeline`(基于 `origin/main`),提交将按显式路径单独进行,不 push。
- **五屏未在基线内**:`origin/main` 上不存在 `features/patrol` 等,报告按未下沉计数;你的「已完成五屏」若在别的分支,请在那棵树复跑。
- **RN 独有 111 条需要人复核**:启发式只能消歧同名/渲染共享屏,不能判断「该不该有 web 路由」;报告不把它们折成缺口。
- **i18n 数字是键级拍平读数**,不是「该复制条数」;真正的复制面要按「共享屏引用键 ∩ 目标端缺失」再收窄。

---

## 六、附录

- 逐页清单(机器生成):[cross-end-pipeline-inventory-2026-11-08.pages.md](./cross-end-pipeline-inventory-2026-11-08.pages.md)
- 既有可行性判定:[miniapp-shared-screen-consumption-2026-11-07.md](./miniapp-shared-screen-consumption-2026-11-07.md)
- 抽屏人工检查单:`.trae/documents/抽屏检查单.md`(gitignore,仅本地)
- 平台限制原文:`apps/miniapp-taro/src/rn-compat/PLATFORM-LIMITS.md`
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
