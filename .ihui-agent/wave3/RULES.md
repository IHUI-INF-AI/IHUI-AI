# Wave3 补屏统一纪律（所有席位必读，逐条遵守）

## 场地
独立 git worktree：`D:\IHUI-AI-wt\gap-screens`（HEAD = origin/main）。
所有读写只能在这里。**绝对不要碰 `D:\IHUI-AI` 主树**（别的会话在用）。

## 任务形态
台账 `scripts/data/web-rn-screen-map.jsonl` 记录 886 条 web 路由在 RN 端有无承载。
你分到的路由当前是 `gap`（判过「RN 零承载」）。要把它们做成 `aligned`：
每条 = 共享屏（`packages/app/src/features/<域>/`）+ RN 薄壳（`apps/mobile-rn/src/screens/`）
+ 必要时的端点封装（`packages/api-client/src/endpoints/`）+ 五语文案 + manifest 登记。

## 铁律（违反即整批不落）
1. **只新建文件**。以下共享文件一律不许改（集成方统一落，你改了会和另外 20 个席位撞车）：
   `apps/mobile-rn/src/navigation/RootNavigator.tsx`、`packages/app/src/index.ts`、
   `packages/api-client/src/index.ts`、`packages/i18n/messages/mobile-rn/*.json`、
   `scripts/data/web-rn-screen-map.jsonl`、`package.json`、`apps/api/**`、`apps/web/**`。
2. 薄壳 import 共享屏与类型一律从 `@ihui/rn-app` 取；端点从 `@ihui/api-client` 取
   （集成方会补 barrel 导出，所以「未注册导出」类报错在集成前是**正常的**，不要去消）。
3. **后端契约**：只接 `apps/api` 里真实注册的路由。先读后端路由文件确认
   路径 / 方法 / 响应信封形状（列表是裸数组还是 `{list,total}`、详情是 `{x}` 还是裸对象），
   并把证据（`文件:行`）写进端点文件头注与 ledger note。
   后端没实现的，与 web 同口径降级（空态/错误态），并在 ledger note 如实写「后端缺 X」，
   **不许造点了没反应的按钮**。
4. **文案**：一律走 `t()`。五语（en / zh-CN / zh-TW / ja / ko）全量给值，
   取值必须抄 `packages/i18n/messages/web/<lang>.json` 里同页面的现有文案
   （键名可扁平化，**值逐字照抄**），不许自造翻译、不许留空串、不许漏语种。
5. **颜色**一律 `getTokens(colorScheme)` 的 token（`tk.*`），零硬编码色值。
   确需固定语义色板时照 `packages/app/src/features/edu-ai/edu-ai-styles.ts` 头注先例
   （必须写明与 web tailwind 哪一档同源）。
6. 圆角用 `rnRadius`（`@ihui/design-tokens`）；图标用 `lucide-react-native`；
   返回键用 `packages/app/src/components/BackChevron.tsx` 且**必须传 `colorScheme`**。
7. 每屏三态齐：loading / error / empty。
8. **水印**：每个新建的 `.ts`/`.tsx` 写完必须跑
   `node scripts/watermark.mjs inject <file>`（在工作树根执行，幂等）。
9. **端点文件命名**：按域名取（`invitations.ts` / `search-history.ts` 这种），
   **严禁把批次号/wave 号写进文件名或导出符号名**（永久件里烙批次 = 未来腐烂锚点）。
   先 `ls packages/api-client/src/endpoints/` 查重，同名域就新建更细的域名件而不是塞进大类。
10. **不跑任何 git 写操作**（不 add / 不 commit / 不 stash / 不 push / 不 checkout）。
    不跑 `pnpm install`。不重建 dist。

## 崩溃安全（本仓实测：席位会在 150 轮处被掐断）
- **每做完一条路由就往 manifest 里追加一次**（ledger 行 + navigator 项 + indexExports + 该路由的 i18n 五语），
  不要攒到最后一次性写。你被掐断时，已完成的路由必须是**可集成的完整件**。
- 优先级：先做体量小、域边界清晰的；大页面（>50KB 页面族）先承载主路径，
  把省略的子面板写进 ledger note，不要为凑完整把一条拖死。
- manifest 路径 `.ihui-agent/wave3/<你的包名>.manifest.json`，形状照
  `.ihui-agent/wave2/tools.manifest.json`（`navigator` 用**数组形**：
  `[{"import":..., "param":..., "screen":...}]`）。
  ledger 行：`{"web":..., "rn":..., "status":"aligned", "note":"Wave3@2026-10-26: 承载证据=…", "at":"2026-10-26"}`。

## 自验（必须真跑，报告里贴末行读数）
- 水印自检：每个新文件第 1 行含 `© 2026 IHUI AI`、第 3 行含 `[IHUI-AI-PROVENANCE]`、末行含零宽字符。
- `pnpm exec eslint <你的文件>` → 0 error 0 warning。
- `node -e "JSON.parse(require('fs').readFileSync('.ihui-agent/wave3/<包名>.manifest.json','utf8'))"` 合法。
- 五语键数必须相等（用一小段 node 脚本核）。
- **不要**跑 `pnpm -F @ihui/mobile-rn exec tsc --noEmit`（集成前必有未注册导出类噪声）。
  要查类型只跑 `pnpm -F @ihui/rn-app exec tsc --noEmit`，并且只认**你自己文件路径**的报错
  （同期另有约 20 个席位在写别的域，别人的报错与你无关，不要去修别人的文件）。

## 交付报告（中文，≤600 字）
逐条：路由 → 判定（新建 / 接线复用 / 与 web 同口径降级）→ 承载文件 → 端点证据 `文件:行`；
再列「需集成方注意」（barrel 导出、i18n 命名空间、后端缺失项）。
如实写明哪几条没做完 —— 半成品冒充完成是本仓最高频失效型。

## 第二批追加纪律(第一批实测教训,必读)
11. **kit 优先**：`.ihui-agent/wave3/<包名>.kit.md` 已把三件最烧轮次的取证离线做完——
    页面族清单、端点证据(带 `文件:行`)、该页实际引用 i18n 键的**五语取值表**。
    第一批 8 个席位全因自己翻 6600 行语言包 + 全仓 grep 后端而 150 轮耗尽、**零产出**。
    所以：**先读 kit 再动手**；kit 里没有的才自己去查。禁止整份 Read
    `packages/i18n/messages/web/*.json`（6600+ 行），要取值就从 kit 的表里抄。
12. **写完自查破损**：席位产物实测出现过 `textAlign: 'right }` 这类**未闭合字符串**
    （文件语法直接坏掉，而 eslint 之前没人跑）。每写完一个文件立刻跑：
    `node -e "const s=require('fs').readFileSync('<file>','utf8');const bad=s.split('\n').map((l,i)=>[i+1,l.replace(/\/\/.*$/,'')]).filter(([,l])=>((l.match(/'/g)||[]).length%2===1));console.log(bad.length?bad:'平衡 OK')"`
    报奇数引号就是破损，当场修掉。
13. **轮次预算**：你的上限是 150 轮。按「读 kit → 写端点件 → 写共享屏 → 写薄壳 → 补水印 → 追加 manifest → 下一条」推进，
    **每条路由给自己 ≤35 轮**；宁可少做一条并如实写进报告，也不要把已做的因为没登记 manifest 而作废。
