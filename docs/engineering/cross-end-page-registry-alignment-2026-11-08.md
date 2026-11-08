<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 跨端「页面与登记表」欠账收口（2026-11-08）

工作树 `D:/IHUI-AI-wt-align-page`，分支 `feat/align-page-registry-1108`，基线 `origin/main = 6030e87763`。
本支范围收窄为两项：门 301、`/member/favorites` 合一。原第 2 项（门 290 `pkg-shop/vip` 空端口）与原第 4 项（22 条缺 RN 行）已移交另外两条线，本支**不含**其代码、派生声明与登记表数据改动。
门读数均在本工作树单独执行；当时本工作树无其它线并发跑门（主工作树仅有 `git-guardian`、`check-commit-loss-guard` 两个常驻守卫进程）。

| # | 欠账 | 结论 | 是否落地 |
| --- | --- | --- | --- |
| 1 | 门 301「未映射 4 屏」 | **票作废**：不可复现，已由 `e3e33190c0`、`a744c37ec7` 收敛；真实缺口是 3 个零消费共享屏，只列清单、不补映射、不删屏，另案 | 文档 |
| 3 | `/member/favorites` 重复收藏页 | 前提/基线需校正：`/favorites` 在基线上是 web 本地实现，上游 `a21c6430` 才改为共享屏 6 档；已合一，保留两条 URL、只留一份实现，`doc` 档不丢、未新增五语词条 | 代码 |

---

## 0. 门读数值前提与并发假红重试留痕

### 0.1 并发前提

本文所有门读数均在本工作树（`D:/IHUI-AI-wt-align-page`）单独执行、串行跑；当时主工作树另有 `git-guardian.mjs` 与 `check-commit-loss-guard.mjs --filter-stash --list-unbacked --list-out-of-window` 两个常驻进程，属基础设施守卫，不是其它线的门套。门 301 两次读数分别为 1865ms（改写前）与 2983ms（改写后），两次均无并发跑门。

### 0.2 重试留痕（本笔唯一一次并发假红）

| 项 | 现场证据 |
| --- | --- |
| 哪条门 | `[30a]` Commit 丢失防护（blocking，`scripts/check-commit-loss-guard.mjs`） |
| 红在什么位置 | 首次提交的 pre-commit 批次第 1/38 项，该门单独 167042ms；红在「未备份悬空 commit」档（综合判定段只列悬空分档，未见 reset 告警） |
| 红的原文 | `↳ 悬空分档:已备份 0 / 同内容副本 0 / 等价残留 0 / 待处置 2`；`↳ 未备份:201b051e570a fix(cross-end): 侧栏宽度守门补齐「五面载体 + 取面纪律」,小程序抽屉菜单改竖排`；同 subject 的 `e20cdc6e7189`；`❌ commit 丢失风险,阻塞 commit` |
| 凭什么判 `not-ours`（本次现场，不引用旧例） | ① 被点的两枚 commit subject 是另一条线（侧栏宽度守门 / 小程序抽屉）的改动，与本笔 5 个文件零路径交集；② 本笔暂存集仅为 `README.md`、`README.en.md`、`apps/web/app/(main)/member/favorites/page.tsx`、`apps/web/src/lib/ui-routes.generated.ts`、本文档；③ 本席未对这两枚做任何动作（本笔唯一的 `git reset --mixed origin/main` 只回退本席自己那枚未推送提交，参数不是 `HEAD~`）；④ 该门判据面是仓级 refs/objects，不是暂存内容 |
| 为什么第二次转绿（现场物证） | 同一工作树现查 `git tag --points-at 201b051e570a` / `e20cdc6e7189`，两枚均已带 `lost-commit/*` 备份 tag（后者为 `lost-commit/e20cdc6e7189a4a25fa7d25ca59b657b4c351cea`）；即两次尝试之间阻塞条件（未备份悬空）被外部守护补齐，第二次读数时该门 `ok:true` |
| 重试几次 / 最终读数出自第几次 | **1 次**（脚本退避 3s 后重发带钩子的普通提交）；最终读数为第 **2** 次（`guardian-timing.json` 中 `30a` `ok:true`，166051ms） |
| 是否跳门 | **无**。未使用 `--no-verify` / `*_ALLOW_*` / `HUSKY_SKIP_*` / `git add -A` |

### 0.3 本树「靠重试变绿」的门清单

- 仅 `[30a]` 一例（见 0.2）。其余 37 项首轮即绿；首轮的 `[19]` 是 warn-only 预警，不计红，也不构成重试理由。
- 另记：本次改写前的旧提交 `36e2df42a2` 首轮被门 173（DN5 `trackedFiles` 清单不变式）阻塞，属**真实内容红**，处置是跑 `scripts/sync-readme-numbers.mjs` 同步后重交，不是"重试变绿"；该提交已被 `cbb5759b19` 取代。

### 0.4 纪律（本席自守）

- 同一条门**连续两次红即停**，不再重试，附两次原始输出上报。
- 每次因并发假红重试，必须留下本次现场证据（门号、红的位置与原文、`not-ours` 依据、重试次数、最终读数出自第几次）。
- 不以"上次也是这样"作为归因依据。

---

## 1. 门 301：未映射 4 屏 —— 票作废

### 1.1 读数（原文）

`node scripts/check-web-mp-route-carriers.mjs`（face=head，单独跑，2983ms，exit 0）：

```
gateId: TBD-web-mp-route-carriers
共享屏: 275   承载: 252   台账: 275 行   声明错配剔除: 0
mp 缺承载: 0 / 承载路由在配置里不存在: 0 / 未判定(映射缺失): 0 / 合法差异: 23
```

主工作树 `D:/IHUI-AI`（HEAD `a0d7b042f1`）与 `--worktree` 面读数相同；台账 275 行里 `verdict=undetermined` 恒为 0。

### 1.2 判定：票作废（不是待补欠账）

- 「未映射 4 屏」在任何现有提交/分支上都不复现：三桶（共享屏 275 / 承载 252 / 台账 275 行）配平，`未判定(映射缺失)` 恒为 0。
- 11-06 已两枚提交收口：`e3e33190c0`（未判定 5→3）、`a744c37ec7`（3→0）；此后台账无 `undetermined` 行。
- 故按**作废**处理，不留待办。若机主手持 4 屏旧快照，应以 1.1 现读数为准。
- 附注：该门 `gateId` 仍是占位串 `TBD-web-mp-route-carriers`（`scripts/check-web-mp-route-carriers.mjs:685`），门号未落到脚本里；改判据面本席只记录不擅改。

### 1.3 真实近义缺口：3 个零消费共享屏（只列清单，另案）

`node scripts/check-cross-end-screen-coverage.mjs` → `共享屏被 RN 消费 272/275`。未被消费 3 屏：

| 共享屏 | RN 引用 | web | miniapp | 处置 |
| --- | --- | --- | --- | --- |
| `packages/app/src/features/finance/FinanceScreen.tsx` | 0（`EduFinanceScreen` 是教育财务，非同屏） | 无 `/finance` 路由，edu 财务页各自实现 | 0 | 另案 |
| `packages/app/src/features/following/FollowingScreen.tsx` | 0（RN 端内自有 `apps/mobile-rn/src/screens/FollowScreen.tsx`） | `/following` 自实现 | 0 | 另案 |
| `packages/app/src/features/help-detail/HelpDetailScreen.tsx` | 0（RN 用 `HelpScreen` 列表内联展开） | `/help`、`/member/help` 自实现 | 0 | 另案 |

**不补映射、不删屏**：补壳属于「为账面造承载」；删屏牵动 `packages/app` 导出与覆盖门分母，另立一案再动。本支只给清单与证据。

---

## 2. `/member/favorites` 与 `/favorites` 合一

### 2.1 基线事实（`origin/main = 6030e87763`）

两条路由都是 **web 本地实现**，`/favorites` 在基线上**尚未**接共享屏，两份互为分叉：

| 维度 | `/favorites` | `/member/favorites`（改前） |
| --- | --- | --- |
| 国际化 | `useTranslations('favorites')`（page.tsx:9,51） | 全硬编码中文 |
| 错误态 | 有 `error` 分支（page.tsx:59 起） | `.catch` 吞错成空列表 |
| 页签 | all / project / file | all / project / file / **doc** |
| 布局 | `max-w-3xl` + Tooltip + `break-words` | 无宽度约束 + `truncate` |
| 图标 | Star | Heart |

### 2.2 上游已落、尚未进 main 的 `a21c6430`（已核实，不是能力损失）

`a21c6430`（`fix(i18n): 撤五个单端 prop——Coupon 券码/金额下沉共享层,Favorites 档位对齐后端枚举并恢复副标题`）位于 `feat/rn-shared-screen-20261107`，**不是** `origin/main` 的祖先（`merge-base --is-ancestor` 返回 1）。该枚上：

- `apps/web/app/(main)/favorites/page.tsx` 已改为渲染共享屏 `@ihui/rn-app/features/favorite/FavoriteScreen`，web 不再注入档位（页头注释原文：「tab 档位由共享屏自渲染(后端合法 resourceType 6 档),web 不再注入档位」）；
- 共享屏 `packages/app/src/features/favorite/FavoriteScreen.tsx` 的档位常量 `TABS = ['all','project','file','doc','post','comment']`，与后端 `FAVORITE_RESOURCE_TYPES` 一一对应；
- `packages/types/src/app-engagement.ts` 的 `FavoriteFilterTab` 增补 `doc`、`comment`；
- 4 枚 shared 词条 × 5 语言由该枚自带。

**结论**：合入后 `/favorites` 的档位集合是 **6 档（all/project/file/doc/post/comment）**，本支别名页 `export { default } from '../../favorites/page'` 直接继承 6 档 ⇒ **`doc` 不丢**。基线下只见 3 档，是尚未合入 `a21c6430` 的暂态。本支**未新增任何 5 语言词条**。

### 2.3 合一结论

- **保留的路由**：`/favorites`（实现本体）与 `/member/favorites`（别名路由）。侧栏指向 `/member/favorites`，资料卡指向 `/favorites`，删任一即断链。
- **删掉的实现**：`apps/web/app/(main)/member/favorites/page.tsx` 的整份本地实现删除（159 行 → 7 行），改为一行再导出；沿用仓内既有别名页写法（`apps/web/app/(main)/publish/page.tsx` 同款），不用 `redirect()`，避免 RSC 请求被 abort。文件头/尾水印按字节保留。
- **生成物**：`node apps/web/scripts/generate-ui-routes.mjs` 重建 `apps/web/src/lib/ui-routes.generated.ts`（`/(main)/member/favorites/page` 输入摘要更新）。

验证：`pnpm --filter @ihui/web exec vitest run tests/ui-route-index.test.ts` → 7 passed；`node scripts/check-miniapp-generated.mjs --worktree` → exit 0；`node scripts/check-watermark-coverage.mjs --worktree` → exit 0。

---

## 3. 本席之外、未处置（`origin/main` 存量红，供机主排期）

| 门/检查 | 读数（单独跑） | 位置 |
| --- | --- | --- |
| miniapp `tsc --noEmit` | 3 error | `pkg-ai/dev-enter/n8n-model/list-view.tsx:8` 引用已在 `2c2f5d8e8b` 删除的 `workflow-card`；`utils/streaming-recognizer.ts` 重复实现 ×2 |
| web `tsc --noEmit` | 4 error | 均非收藏相关文件（本支改动文件不在其中） |
| 门 288（跨端 props 配对） | 红：映射表体检 3 处（重复项） | 见 `check-cross-end-component-props-parity.mjs` 输出 |

## 4. 门读数汇总（本工作树、无并发）

| 命令 | 结果 |
| --- | --- |
| `node scripts/check-web-mp-route-carriers.mjs` | exit 0，共享屏 275 / 承载 252 / 未判定 0 / 合法差异 23（2983ms） |
| `node scripts/check-miniapp-generated.mjs --worktree` | exit 0 |
| `node scripts/check-watermark-coverage.mjs --worktree` | exit 0 |
| `pnpm --filter @ihui/web exec vitest run tests/ui-route-index.test.ts` | 7 passed |
| `pnpm --filter @ihui/web typecheck` | 4 个存量 error（见 §3，均非本支文件） |
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
