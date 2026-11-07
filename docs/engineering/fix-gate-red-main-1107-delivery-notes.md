<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# `fix/gate-red-main-1107` 交付说明：HEAD 面两条阻断门

分支：`fix/gate-red-main-1107`（基于 `origin/main = 935575c841`）
提交：`0ff26f9a4a fix(gates): 修复 HEAD 面两条阻断门(对话流锚点过期 + ui-routes 自述钉陈旧)`
改动面：2 文件 / +6 −6（`scripts/data/chat-flow-elements.json` 两处 `file`、
`apps/miniapp-taro/src/constants/ui-routes.generated.ts` 自述钉）。

推送状态：**未推成功**。两次都被 pre-push 拦下：第一次 `[T1]` 在并发安装下报
`apps/mobile-rn` 的 `tsc exit 1` 且解析不到报错文件（单独复跑 exit 0 零输出，属环境）；
第二次在安装域冻结指令下由本席主动终止。**「未判定 ≠ 通过」**，本条须在解冻后重推。

## 1. `[57]` chat-element-coverage：修前红 / 修后绿

### 修前红（`origin/main = 2524351cb8` 实测）

```
❌ [chat-element-coverage] 2 处违规(清单 164 条 = 台账 0 + 归档件补回 124、锚点 167 条、审面归档件 50 份):
  anchor-missing-marker :: error-retry-action :: apps/miniapp-taro/src/pkg-ai/ai/ChatMessageItem.tsx 内找不到「ai.chatMessageItem.errorCardTitle」
  anchor-missing-marker :: stage-label-five-ends :: apps/miniapp-taro/src/pkg-ai/ai/chat.tsx 内找不到「<TaskStatusBar」
EXIT=1
```

### 修后绿（本分支 HEAD 实测）

```
✅ [chat-element-coverage] 清单 164 条(G-ID 124 = 台账 0 + 归档件补回 124、已实现锚点 40;审面归档件 50 份)、锚点 167 条、planned 任务 0 行,锚点存续性/代码面/契约均一致
EXIT=0
```

### 判定：代码没少，是锚点指在重构前的旧宿主

证据链（均为 HEAD 面现读）：

- `packages/app/src/features/chat/ChatMessageItem.tsx:284` —— `{t('ai.chatMessageItem.errorCardTitle')}` 仍在渲染；
- `apps/miniapp-taro/src/pkg-ai/ai/ChatMessageItem.tsx:19` —— 本端已改成
  `import { ChatMessageItemView } from '@ihui/rn-app/features/chat/ChatMessageItem'`，第 159 行渲染 adapter；
- `apps/miniapp-taro/src/pkg-ai/ai/chat.tsx:87` / `:2046` —— 已收敛薄壳，
  `buildChatShellProps(shellCtx)` → `<SharedChatScreen ... />`；
- `apps/miniapp-taro/src/pkg-ai/ai/chat-shell-extras.tsx:330` —— `<TaskStatusBar cards={lastAssistantCards} isStreaming={thinking} />`。

来源提交：`8fedf1d129`（迁出可视结构，831 行删除）、`f0325cf3a7`（chat.tsx 收敛薄壳）。
处置：只把两条锚点的 `file` 从重构前宿主指到现宿主，**条目数 164 / 锚点数 167 均未变**，
未调基线、未删断言、未改阈值。

## 2. `[105]` ui-routes 自述钉：修前红 / 修后绿

### 修前红（`origin/main = 935575c841` 实测）

```
四端 ui-routes 自述钉(G-816040) apps/miniapp-taro/src/constants/ui-routes.generated.ts: 陈旧
  inputsSha256 钉=e0845121e55d… vs 现算=f001b06d3bf1…
  不一致的输入: apps/miniapp-taro/src/pages/member/index.tsx
    钉=37bdfce66308… vs 面=head 9082e6f1f817…
```

### 修后绿（本分支 HEAD 实测）

```
📌 四端 ui-routes 自述钉(G-816040) apps/miniapp-taro/src/constants/ui-routes.generated.ts: matched —— f001b06d3bf1…(commit 935575c8416f5c64c4a03355e396a8fdecad2eeb)
EXIT=0
```

### 重跑与 diff 审查

`node apps/miniapp-taro/scripts/generate-ui-routes.mjs` 输出：page 329 = 主包 5 + 19 分包
root 合计 324；tabBar 5；带标题配置 123；query 传参 35；`[watermark:inject] → injected`。

生成的 diff **只有 4 行 pin 块**：`sourceCommit 1ea88441→935575c841`、
`inputsSha256 e0845121→f001b06d`、`pages/member/index.tsx 37bdfce6→9082e6f1`、
`generatedAt`。**页面清单零变化**，无任何别人的路由被顺带改写。

### 与当前 `origin/main` 的关系（如实记录）

- 最新 `origin/main = 2524351cb8` 上 `[105]` **已由别的会话修好**，其 pin 与本分支一致
  （`f001b06d…` / `member 9082e6f1…` / `sourceCommit 935575c841`）；本分支这笔属**重复改动**，
  差异仅 `generatedAt` 一行时间戳。合并时以 main 为准即可，冲突可忽略。
- `[57]` 在 `2524351cb8` 上**仍然红**，是本分支真实需要的改动。

### 一处与原始描述的偏差（必须写明）

原始描述称「`65d0d535…` vs `b1378be7…`、`primitives.tsx` 与 `props-resolution.ts` 改后没重跑」。
这两个哈希在仓库中 `git grep` 查无；实测唯一陈旧输入是 `apps/miniapp-taro/src/pages/member/index.tsx`。
本分支按实测事实修复，未按原始归因改动任何生成器输入。

## 3. 复现命令

```powershell
# [57] 判 HEAD 面（在任意 worktree，HEAD = 待判分支）
node scripts/check-chat-element-coverage.mjs

# [105] 判四端自述钉
node scripts/check-miniapp-generated.mjs --group ui-routes

# [105] 重跑生成器（仅 miniapp-taro 一路）
node apps/miniapp-taro/scripts/generate-ui-routes.mjs
```

## 4. `302p` 基线刷新：`aligned 293→292`

### 4.1 为什么 `aligned` 从 293 变成 292

少的是**同键同屏的重复登记行**，不是一条对齐关系：

- 台账文件 `scripts/data/web-rn-screen-map.jsonl` 里，`web:knowledge-planet`
  与 `rn:apps/mobile-rn/src/screens/KnowledgePlanetScreen.tsx` 曾经有两行同键同屏的
  `status:"aligned"` 登记；提交 `a67379e71f`（2026-11-07 10:48:53 +0800）把它们折叠成一行。
- 两行里被删的是带 `retiredAt/retiredReason` 的那条副本；保留的一行把 `data.evidence`
  更新为 `GET /api/knowledge-planet/news?page=1&pageSize=20` + `GET /api/knowledge-planet/info`。
- 因此：`aligned`（按行计数）293→292；**承载面 `alignedUnique` 在基线生成时（`935575c841`）
  本来就是 292，现在仍是 292**；`duplicateWebKeys` 1→0。web 页面与 RN 屏都还在，
  `mapRot=0`、`unmapped=0`，没有任何指向不存在文件或未映射页面的行。

行数轨迹（逐提交实测 `"status":"aligned"` 行数）：

```
935575c841  293  ← 基线（generatedAt 2026-11-06T23:30:58Z）
e20af7a824  292
49ee3f48da  293
9ff496b2fb  293
a67379e71f  292  ← 净少发生在这里（折叠 knowledge-planet 双行）
a41e6ff7f2  292
bf19e6174a  292
```

### 4.2 为什么这不是放宽判据

- 判据脚本 `scripts/check-cross-end-parity-drift.mjs` **一行未改**；`GATE_DIRECTIONS`、
  阈值、门禁档位全部原样。
- 只按基线文件自带的 `refreshProcedure` 重算：在每个既有 dim 上写入现读值，并重签
  `generatedAt` / `face` / `why`。没有新增白名单、没有加豁免、没有改 `advisoryDims`。
- 关键区别：这次下降维少的是**重复记账凭证**，不是**覆盖承诺**——`alignedUnique` 未变、
  `duplicateWebKeys` 归零，覆盖关系反而更干净。若真有对齐关系断线，`alignedUnique`
  会同步下降、`mapRot` 会冒红，届时刷新基线就是错的，必须修回来。

### 4.3 另外四个维度为什么是改善

同一轮刷新一并重算了四个**改善**维，必须写清，否则下一个人只看到 `-1` 会误判基线在退步：

| 维度 | 旧值 | 新值 | 为什么算改善 |
| --- | --- | --- | --- |
| `fidelityHosted` | 238 | 239 | 有 1 条 hosted 路由从「未承载」补到承载，计数上升 |
| `fidelityPackAbsent` | 1 | 0 | 最后 1 条「包内缺件」被补齐，清零 |
| `fidelityRetractionRot` | 3 | 0 | 3 条过期撤除台账的腐烂项被清掉，清零 |
| `duplicateWebKeys` | 1 | 0 | knowledge-planet 同键双行折叠，重复键清零 |

（前三项由 `a67379e71f` 的「清 3 条 hosted 路由过期撤除台账」与其后的 carrier 补齐带来；
第四项与 §4.1 的折叠同源。）

### 4.4 勘误：`a67379e71f` 的归因写错了

2026-11-07 勘误：`a67379e71f` 自述归因有误，真实原因为同提交折叠了 `knowledge-planet`
的同键同屏重复登记行——不是 `settings/activity` 合法剔除（`9ff496b2fb` 对该行做的是
`pending→excluded`，pending 本就不计入 `aligned`）。

**不改历史、不 amend**：错误归因保留在 `a67379e71f` 的提交信息里，原因是该提交已经在
`origin/main` 上，改写历史会污染其他人的引用与已生成的 attest 留痕；因此以勘误形式记在
本文件 + 本次 302p 提交信息里，供后来者按 `a67379e71f` 搜索时能看到正确前因后果。

刷新基线时必须**同时报出改善维**（见 §4.3），不能只贴一个下降维。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
