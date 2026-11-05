# ShareCreatorScreen 单源改造 — Spec

- 状态：**待批准**（Spec Mode）
- 分支 / 工作树：`feat/share-creator-screen` @ `D:/IHUI-AI-wt-sharecreator`（基于 main `d7e80b1954`，干净树）
- 依据：`docs/engineering/share-creator-screen-checklist.md`
- 主树 `d:/IHUI-AI` 有其他线未提交改动，本批**不碰主树**

---

## 1. 目标

1. **先做台账改账（小活，不挡主任务）**：`pkg-learn/subscription/contracts/index` 撤掉错挂的
   `SubscriptionsScreen` 镜像声明，判「非镜像」，门 299 复制页读数 87 → 86，台账仍 93 行。
2. **建 `ShareCreatorScreen`**：把 `apps/miniapp-taro/src/pages/share/index.tsx`（913 行）的
   320 行渲染块收敛成共享屏单源；平台能力全部走注入回调，共享屏内零平台 API。
3. **双端真消费**：RN 与 web 各自接入共享屏（web 经 `@ihui/rn-app/pilot`）。
4. 小程序分享页改薄壳，并给出三条硬标读数。

## 2. 非目标

- 不 push、不改主树、不动 `learn-develop`（保留现状，报告写明判桶②、上端属产品新增待立项）。
- 不在 RN / web **新造** B1（tab）/ B5（排行榜）/ B6（兴趣赛道）的数据源；这三段按缺段协议记录待裁决。
- 不新建 web「分享创作流」路由（`apps/web/app/(main)/share/page.tsx` 是 `redirect('/')`）。
- 不引入新依赖、不改门脚本判定口径。

---

## 3. 台账改账（①）

### 3.1 改动点

| 文件 | 位置 | 改动 |
| --- | --- | --- |
| `scripts/data/miniapp-shell-copy-ledger.jsonl` | 第 71 行 | `mapStatus` `"declaration"` → `"none"`；删除 `declaredSpecs` 键；`loc` 195 与其余字段不动；**文件总行数保持 93** |
| `apps/miniapp-taro/src/pkg-learn/subscription/contracts/index.tsx` | 第 107 行 | 现注释「对齐 RN SubscriptionsScreen 视觉语言…」命中门 299 声明识别器的**形 4（对齐动词 + 裸屏名）**，必须替换为不含 `对齐`+`XxxScreen` 组合的表述（例：`// 注：RN 侧无同名对应屏（SubscriptionsScreen 是单条解约动作），本页为独立列表，不做镜像参考`） |

说明：门 299 的 `mapStatus` 由**页面正文声明**（`check-cross-end-screen-coverage.mjs` 四形识别器）
机械推导，台账字段只是记账。因此**只改台账不改页面注释 ⇒ 计算值仍是 `declaration`**；两处必须同改。

### 3.2 预期读数

- `node scripts/check-miniapp-shell-form.mjs --worktree`（提交前，工作树面）
- 提交后再跑默认 HEAD 面，两次贴原文。
- 预期：复制页 **87 → 86**；`pkg-learn/subscription/contracts/index` 由 copy 桶转入 `plain`
  （不进 copy 统计），台账行保留 → 新增 1 条 S2 advisory「存量复制页已收敛」；台账 **93 行不变**。

### 3.3 提交说明（单枚）

```
fix(miniapp): contracts 页撤掉错挂的 SubscriptionsScreen 镜像声明

原映射按名字相近错挂，概念不同（RN 只有单条解约动作）。台账行保留、mapStatus 记 none。
```

---

## 4. 共享屏（②）

### 4.1 新增文件

| 文件 | 内容 |
| --- | --- |
| `packages/app/src/features/share-creator/types.ts` | `ShareCreatorScreenProps` 及条目类型（契约见 §4.2） |
| `packages/app/src/features/share-creator/ShareCreatorScreen.tsx` | 共享屏本体，预估 450–500 行 |
| `packages/app/src/features/share-creator/__tests__/ShareCreatorScreen.test.tsx` | 每块一条 + 阴性对照 |
| `apps/miniapp-taro/src/pages/share/__tests__/index.test.tsx` | 壳页一条（渲染共享屏 + props 逐个到达） |

### 4.2 Props 契约

以清单 §2 为准，落地时补充两点：

- `items` 采用清单字段集（`id/title/summary/coverUri/authorName/likeCount/createdAt`）；
  壳侧负责把现有接口字段映射进来，**共享屏不感知接口形态**。
- 新增可选 `contentBottomPadding?: number`（与 `PlazaScreen` 同名同义，供 RN 悬浮 TabBar 预留）。

### 4.3 八块归属与消费端判定

| # | 块 | 页内现状 | 预估行 | RN 对应实现 | web 对应实现 | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | 顶部 tab（最新/热门/关注） | 页内 tab JSX | 35–45 | 无（`NewsScreen` 无 tab 控件） | 无 | **缺段·待裁决** |
| B2 | 分类横条 / 赛道 | `CategoryBar` 用法 | 30–40 | `SquareScreen` 分类条 | `news/PageClient.tsx` 分类 | 迁移 |
| B3 | 搜索区 | `SearchBar` 用法 | 25–35 | `SquareScreen` 搜索 | `news/PageClient.tsx` 搜索 | 迁移 |
| B4 | 信息流列表 + 空/加载/错误态 | feed JSX | 90–120 | `SquareScreen` 列表/状态 | `news/PageClient.tsx` 列表 | 迁移（核心） |
| B5 | 排行榜抽屉 | `Ranking` + `DrawerComponent` | 45–60 | 无 | 无 | **缺段·待裁决** |
| B6 | 兴趣赛道弹窗 | `InterestTrackModal` | 40–55 | 无 | 无 | **缺段·待裁决** |
| B7 | 分享卡（canvas 专属） | `ShareCard` | 30–40 | 壳注入 `renderShareCard` | 壳注入（不渲染） | 注入 |
| B8 | 返回 / 分享动作 | 页内接线 | 10 | `onBack` / `onShare` | 同 | 迁移（端口） |

**实施取舍（需批准点）**：8 块**全部**在共享屏实现（否则小程序页不能成为真薄壳、且块会双份）；
其中 B1/B5/B6 由小程序壳传 props 驱动，RN/web 不传 → 这三段**只有小程序消费**。
按缺段协议记录并报裁决；若裁决为「不保留」，移除这三段后共享屏约减 120–160 行，
小程序页需退回对应渲染（届时重跑三条硬标）。

页内渲染行**起止行号**在施工第一步用 `rg` 定位并回填到本文件（当前只知总量 320 行）。

### 4.4 平台能力边界（硬约束）

共享屏内**禁止**出现 `@tarojs/taro`、`Taro.*`、`Platform.*`、`Share.*`、文件系统 / 相簿 / 剪贴板调用。

| 能力 | 入口 |
| --- | --- |
| 分享 | `onShare()` |
| 保存相册 / 图片选择 / 剪贴板 | 本期不新增（清单契约无此端口）；若施工中发现分享卡需要保存，**新增 `onSaveImage?: () => void`** 并只在小程序壳注入，禁止屏内直接调用 |
| 分享卡渲染 | `renderShareCard?: () => ReactNode` |
| 导航 / 提示 | `onNavigate(target)`、`onToast(message, opts)` |
| 返回 | `onBack?()` |

### 4.5 消费端

| 端 | 文件 | 做法 |
| --- | --- | --- |
| 共享层入口 | `packages/app/src/pilot.ts:16` 后追加 `export { ShareCreatorScreen } from './features/share-creator/ShareCreatorScreen'` | 与既有试点同形，不绕包根 |
| RN | `apps/mobile-rn/src/screens/NewsScreen.tsx`（现 `SharedSquareScreen` 消费点 `:449-482`） | 渲染层换成 `ShareCreatorScreen`；**数据层与 mapper 不动**，只做字段适配；不新增路由、不新增请求 |
| web | `apps/web/app/(main)/news/PageClient.tsx` | 经 `@ihui/rn-app/pilot` 引入；列表/分类/搜索段交给共享屏；数据层不动 |
| 小程序 | `apps/miniapp-taro/src/pages/share/index.tsx` | 改薄壳：保留取数、分页、缓存、鉴权、canvas、平台 API；渲染块全交共享屏 |

若 web 引入后在 `react-native-web` 下出现共享屏不支持的样式/组件，按「接不上」处理：
报告写清缺的原语与 `file:line`，web 侧**回退保持现状**，不硬改共享屏迁就 web。

### 4.6 单测清单

| 用例 | 断言 |
| --- | --- |
| B1 | 点击「热门」触发 `onSelectTab('hot')`，当前 tab 高亮 |
| B2 | 传入 categories / activeCategory，点击触发 `onSelectCategory` |
| B3 | 输入触发 `onKeywordChange`，placeholder 落到输入框 |
| B4 | 有数据渲染条目并触发 `onPressItem`；`loading`/`error`/空态三态各渲染对应节点 |
| B5 | `ranking.visible=true` 渲染抽屉，`onClose` 可触发 |
| B6 | `interestTracks.visible=true` 渲染弹窗，`onToggle(id)` 可触发 |
| B7 | `renderShareCard` 返回节点被渲染（默认不渲染） |
| B8 | `onBack` / `onShare` 各触发一次 |
| 壳页 | 渲染的是共享屏；抽 3 个 props（tab / keyword / items）断言逐个到达 |
| 阴性对照 | 摘掉 `onShare` → 分享按钮用例**必红**；摘掉 `onSave`（若存在该端口）→ 保存用例必红 |

### 4.7 三条硬标

1. 页内 JSX/渲染行：**320 → 实测值**（目标 ≤180，按 §4.3 取舍可能落在 180±）。
2. 与共享屏重复 UI 段：**0**（B2/B3/B4/B8 已单源；B7 仅注入）。
3. 消费点：RN `apps/mobile-rn/src/screens/NewsScreen.tsx:<行>`、web `apps/web/app/(main)/news/PageClient.tsx:<行>`。

---

## 5. 验证（干净树，四项并行）

```
pnpm --filter @ihui/rn-app        exec tsc --noEmit
pnpm --filter @ihui/web           exec tsc --noEmit
pnpm --filter @ihui/mobile-rn     exec tsc --noEmit
pnpm --filter @ihui/miniapp-taro  exec tsc --noEmit
node scripts/check-miniapp-shell-form.mjs
node scripts/check-miniapp-generated.mjs --group ui-routes
pnpm --filter @ihui/rn-app        exec vitest run --environment jsdom src/features/share-creator
pnpm --filter @ihui/miniapp-taro  exec vitest run src/pages/share
```

- 前置：`pnpm install --frozen-lockfile --prefer-offline`；`pnpm --filter "./packages/*" run build`。
- 禁止：`IHUI_LAND_SKIP_AFFECTED_GATES=1`、`--no-verify`。钩子照跑；仅**存量无关红**才
  `--allow-skip-hooks` 并在报告点名原因。
- 贴原文读数（不转述）。

## 6. 提交策略

按域拆枚（沿用 scope 门 R2/R3 互斥的既有处置）：

1. `fix(miniapp): …` — 台账 + contracts 注释（3.3）
2. `feat(i18n): …` — `packages/i18n/messages/**` 新键（若新增文案）
3. `feat(multi): …` — 共享屏 + pilot + RN + web + 小程序壳 + 测试

提交消息文件必须 **LF** 换行。收尾：`git worktree remove --force`（合入/交付后），**不 push**。

## 7. 待批准 / 待裁决

1. **B1/B5/B6 是否保留在共享屏**（决定共享屏行数与小程序页硬标 1），见 §4.3。
2. web 若 `react-native-web` 承载失败，是否接受「web 侧不接入、只记录缺口」。
3. 台账行保留在文件内（产生 1 条常驻 S2 advisory）是否符合预期——按用户「行数仍为 93」执行。
