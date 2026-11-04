<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# C2 — CLI 启动工程三件套（预热 + 启动画像 + 低内存档）· 执行席状态

- HEAD（开工现读）：`923546ffec8e145a90c551f8c9c035eca9bc42f4`
- 取证：`docs/benchmark-evidence/2026-11/qoder-trae-workbuddy-rea-20261105/W1-workbuddy-main.md` 缺口表 ⑪ 行（现读复跑：`apps/cli/src/` 内 `prewarm|startup.?profil|lazy.?chunk|max-semi-space` grep 0 命中）
- 在飞现场（开工 `git status --porcelain` 记录）：`D  apps/cli/src/skills/packaging/index.ts`（他席暂存删除，`src/commands/skill-package.ts` 仍 import ⇒ `tsx src/index.ts` 全局 ERR_MODULE_NOT_FOUND）。**不代修**；验证一律走 vitest 直接 import。
- 本票文件：`apps/cli/src/startup/profile.ts`、`apps/cli/src/startup/prewarm.ts`、`apps/cli/src/index.ts`（接线）、`apps/cli/tests/startup-profile-prewarm.test.ts`

## 计划
1. profile.ts：纯判据 + 注入时钟，里程碑 entry/commandParsed/firstAwait/exit；三态 measured / unjudged（点名缺失，绝不以 0ms 冒充）；结论行单行 ASCII。
2. prewarm.ts：具名状态件（schema 版本 + 预热时刻 + 指纹），落点走 `getIhuiRoot()`；读侧 hit / miss / unjudged，进程被换与指纹不符必判 miss 并点名。
3. index.ts：direct-run 块内一次画像登记 + 一次预热命中读数（opt-in：`IHUI_STARTUP_PROFILE=1`，未开启零 I/O，对标对方 startup-profile.cjs 的零副作用档）。
4. 测试：三态成对、0ms 不出现、指纹不符必未命中、形状锁（profile 不碰 fs / prewarm 不 import 网络件）。
5. 水印 inject → prettier → 再 inject → verify 整行；vitest + tsc 现读贴末行。

## 进展
- [x] 取证复跑 + 在飞现场确认（index.ts 本席动手时未被别席改脏）
- [x] 四文件落地 + 验证

## 决策与依据
- 对方 `cbc-prewarm` 起常驻进程 + 带外管道；本仓按票面**不起常驻进程**，只把「预热是否真被复用」做成可断言读数（hit 需指纹相符 ∧ 记录 pid 仍存活 ∧ 时刻不倒挂；任一取不到 ⇒ unjudged，不冒 hit/miss）。超越点：三态诚实读数 + 画像行永不以 0ms 冒充未量到。
- 画像必填里程碑 = entry/commandParsed/exit（入口可真实观察的三枚）；firstAwait 为受支持里程碑但默认不必需 —— 入口接不到它就标不了，标了才进 delta，不做假里程碑。

## 验证（末行现读）
- `cd apps/cli && npx vitest run tests/startup-profile-prewarm.test.ts` ⇒ `Tests 12 passed (12)`，Duration 255ms（prettier+二次 inject 之后跑的）。
- `npx tsc --noEmit -p apps/cli/tsconfig.json` ⇒ 共 9 错，`src/startup/*` 与 `src/index.ts` **0 错**；9 条全落他席在飞面：`commands/skill-package.ts`（他席暂存删 packaging/index.ts 连锁）、`server/client-claims.ts`（他席未跟踪新文件，缺 `@ihui/shared/local-registry` 构建面）。未代修。
- 水印：inject → prettier → 再 inject（skip-done，载荷存活）→ verify 四文件逐枚「纳入口径的文件均已携带完整溯源水印」，覆盖 1/1、残迹 0、载荷损坏 0、仅隐写 0。
- 入口全局冒烟受在飞删除阻塞（票面已记），接线正确性由 tsc 触及面 0 错 + vitest 直 import 钉住。
- 行数：profile 152 / prewarm 164 / test 216（均 <250）；接线 +29 行进 index.ts direct-run 块，命令注册与既有判据零改动。
- 按票面边界：**未 commit / 未 push / 未动 PROJECT_PLAN.md / AGENTS.md / scripts\\*\\***。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
