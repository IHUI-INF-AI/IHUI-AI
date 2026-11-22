<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# B3 — /share 分享页零外链(复现 WorkBuddy 自包含报告 + 超越:判据化)

- HEAD sha(现读):`4fe208a71c20d5b3fcca68d40daa7d7a2185bee4` · 分支 `main`
- 触及面(仅这三枚,未 commit/未 push/未动 PLAN·AGENTS·scripts):
  - `apps/cli/src/commands/share.ts`(改)
  - `apps/cli/src/utils/markdown-to-html.ts`(新增 = 自写渲染器落点)
  - `apps/cli/tests/share-self-contained.test.ts`(新增反向牙用例)

## 一、现场读数(①②③ 判定证据,均本席复跑)

- 缺陷面:旧 `share.ts` 第 250 行 `<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js">` +
  页内 `container.innerHTML = window.marked.parse(raw)` / 否则 `textContent` ⇒ 渲染外包给网络,断网打开只剩纯文本流水。
- 对照程序现读(`G:/workbuddy/resources/`):`conversation-report.html` bytes=53482 externalScripts=0 linkTags=0 inlineScript=1;
  `startup-report.html` bytes=43807 externalScripts=0 linkTags=0 inlineScript=1 ⇒ **零外链是它的产品承诺**,我们此前比它差。
- ① 无现成渲染器:`packages/shared` 只有 `artifactToMarkdown`(反向)与 `isMermaidLanguage`(react-markdown className 判定);
  apps/cli 内三处 `escapeHtml`(lib/sso.ts、tools/mcp-oauth.ts、share.ts 私有)都是转义不是 markdown→HTML。
- ② `marked` 不可用:只躺在 `node_modules/.pnpm/marked@{14.0.0,16.4.2,18.0.9}`,由 leva / mermaid / isomorphic-dompurify 带入
  (pnpm-lock 27837 / 40844 / 41866 行现读);仓内 `package.json` 对 `"marked":` **0 命中**,root 与 apps/cli 均无 `node_modules/marked`,
  `require.resolve('marked')` = MODULE_NOT_FOUND ⇒ 用它等于新增依赖(机主禁),不采。
- ③ 采:在本仓自写受控子集渲染器(行为复现,代码自研,测试钉住)。

## 二、落了什么

1. `apps/cli/src/utils/markdown-to-html.ts`(410 行,零 `node:` 内建、零依赖):
   块级=ATX 标题 / 围栏代码(未闭合不吞后文)/ 引用(可嵌套)/ 无序·有序列表(按缩进嵌套)/ GFM 管道表格(含 `:-- --: :-:` 对齐)/ `---` 分割线 / 段落(段内换行→`<br>`,等价 GFM breaks:true);
   行内=代码 / 粗 / 斜 / 删 / 链接 / 图片。支持与**不处理**两张清单以常量导出(`MARKDOWN_SUPPORTED_SYNTAX` / `MARKDOWN_UNSUPPORTED_SYNTAX`,共 9+9 条),不假装全支持。
   转义唯一出口 `escapeHtml`(share.ts 亦 import 它,私有副本已删 ⇒ §0.6 单一真相源);
   链接协议白名单 http/https/mailto/`#`,javascript:/data:/file:/`//host`/`&#106;` 实体混淆一律降级为文本;
   图片不产出 `<img src>`(降级 `[图片]` 文字引用)⇒ 分享页打开时对外零请求;`collapseLanguages` 让 `tool_call` 围栏默认折叠;嵌套深度封顶 8(超限折回当前层,不炸栈也不丢内容)。
2. `apps/cli/src/commands/share.ts`:CDN 外链与「marked + textContent 兜底」整段摘除,markdown **在导出时**静态渲染;
   `renderHtml` 私有方法提为模块级出口 `renderShareHtml`(用例可直达,不必造 session);`renderMarkdown` 末尾换行归一 ⇒ 哈希 / `.md` / 页内 `<pre>` 三者逐字节同一;
   旧五枚色值字面量 `#1a1a1a #f6f8fa #eaeef2 #d0d7de #0969da` 全部改取 `DOC_*` 常量(§4 单一色值源),圆角继续走 `RADIUS_CSS_PX` 插值,单边描边出现次数不变(仍 1 处 h3 左条);
   头注第 4 步与「防篡改:加载时可校验」改写为实测行为(旧声明无消费者 = 声明必须有消费者)。
3. `apps/cli/tests/share-self-contained.test.ts`(17 例):零外链断言(标签级 `<script src>`/`<link href>` 数=0 + 字面兜 + 无 `<img>`/`@import`/`url(http`);
   **阳性对照两条防假绿**:把当年那枚 CDN 外链插回 ⇒ `externalAssetRefs(tampered).scripts == [LEGACY_CDN]`;插 `<link rel=stylesheet>` ⇒ links 报出它;
   第三条反向对照钉住"正文里 `[x](https://…/app.js)` 锚点**不**被误计"(尺子不假红);另有渲染行为锁、协议白名单 11 形态锁、清单形状锁、E2E 真写盘自证 `sha256(<pre> 反解) == result.hash`。
4. 超越对照的轴:①"零外链"从散文变成可判定属性(对照程序没有);②防篡改真闭环(重算 SHA-256,三态含**未判定**);③XSS 收口(旧实现把会话内容裸 HTML 直接 innerHTML);④`tool_call` 折叠。

## 三、验证末行现读

- `cd apps/cli && npx vitest run tests/share-self-contained.test.ts` → `Test Files 1 passed (1)` / `Tests 17 passed (17)` / Duration 1.15s
- `npx tsc --noEmit -p apps/cli/tsconfig.json` → 该面 7 条 error,**全部在 `apps/cli/src/commands/skill-package.ts`**(他席把 `apps/cli/src/skills/packaging/index.ts` 处于 `D` 暂存删除中);`share.ts` 与 `markdown-to-html.ts` = **0 错误**
- `npx tsc --noEmit -p apps/cli/tsconfig.tests.json` → 我的文件仅 1 条 TS7016(scratch-dir.mjs 无 d.ts),与既有 **31** 枚同型用例一致(该面存量 528 行红,非本票造成)
- `npx eslint src/commands/share.ts src/utils/markdown-to-html.ts tests/share-self-contained.test.ts` → 无输出(0 problems)
- `npx prettier --write` 三文件后重新 `watermark.mjs inject` 并 `verify`:「判定面=worktree 覆盖 3/3 个指定文件, 残迹 0, 载荷损坏 0, 仅隐写 0」+「纳入口径的文件均已携带完整溯源水印」
- 磁盘导出实测(`.ihui-agent/tmp/rea-goal-b49/gen-share.mts` → `share-sample.html`):9/9 PASS,`bytes=7050 inlineScripts=1`,外部脚本 `[]`、外部样式 `[]`、`<img>` `count=0`、去标签可读正文 `textLen=1544`
- 真浏览器(Chromium,`context.setOffline(true)` = 缺陷的原始复现条件):`externalRequests=[] consoleErrors=[]`;`bodyTextLen=708 img=0 scriptSrc=0 linkHref=0 collapsedToolBlocks=1 tableRows=9 nestedList=1`;完整性标 `"完整性:校验通过(SHA-256 一致)"`;另开一档 `javaScriptEnabled:false` → `bodyTextLen=701` 且标为 `"完整性:未判定(等待校验)"` ⇒ `BROWSER-RESULT state=pass`
- 相关守门自测(worktree 面):`check-no-divider` exit 0 未点名本票文件;`check-file-size` exit 0(410 行 < 800 阈值);`check-radius-single-source` 按 HEAD blob 面判(本票改动未提交,不在其射程),其红点 `apps/mobile-rn/App.tsx` 属既有/他席,与本票无关

## 四、未竟(带解锁条件)

1. 「零外链」现在只有 apps/cli 用例这一颗牙,没进提交链 ⇒ 解锁条件:主席挂 `guardian-runner` 条目(建议 stagedTriggers 收到 `apps/cli/src/commands/share.ts`,出现 `<script src=` / `<link ` 即红);本席受"不动 scripts/"约束只能出用例。
2. `generateQRCode` 仍返回空串(降级)⇒ 解锁条件:机主批准 qr 依赖,或另开一票自写 QR(版本选择 + RS 纠错 + 掩码,约一整票工作量)。
3. 渲染器是受控子集,`MARKDOWN_UNSUPPORTED_SYNTAX` 那 9 类按纯文本输出 ⇒ 解锁条件:确需全量 CommonMark 时,由机主批准把 `marked` 登记为 apps/cli 直接依赖,届时走②档(本地内联其产物,仍不加 CDN)。
4. 第二枚消费方(web/miniapp 同类导出)出现时,应把本模块上提到 `packages/shared/src/utils`(它零 `node:` 内建,不破门 126 纯度)⇒ 现在不上提,避免无消费者的提前建层。
5. 证据件留在 `.ihui-agent/tmp/rea-goal-b49/`:`share-sample.html` + `gen-share.mts` + `verify-browser.mts`(临时 fake-home/ws 已清)⇒ 解锁条件:主席落账后可整目录清理。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
