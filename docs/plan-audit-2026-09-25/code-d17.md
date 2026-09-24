<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D17(生态入口收敛)— 编码批次报告(code-d17)

日期:2026-09-26 · 代理:编码子代理(无 git 写权限,未 add/commit)

## 交付摘要(≤15 行)

1. **新页真实路由**:`apps/web/app/(main)/ecosystem/page.tsx` → URL `/ecosystem`(与 5 个市场页同属 `(main)` 路由组,布局/鉴权一致)。
2. 页面为**聚合层**:5 个市场卡片(老 URL 直达不变,非替代)+ "专家包"分组(2 个纯导航组合包,成员全部链向既有页面,不新增数据实体)。
3. 客户端组件单文件:`apps/web/src/components/ecosystem/ecosystem-hub.tsx`(114 行;page 19 行;均 <250)。
4. **nav-data.ts 改法**:实测 5 个入口**不在** nav-data.ts(任务书前提有偏),它们并列挂在 `apps/web/src/components/layout/GlobalTopBar.tsx` 的 `groupSettings`(HEAD :131-:139)。侧栏本就无这 5 项,故按允许清单在侧栏 `hotGroupLabel` 组**新增 1 条** `/ecosystem`(labelKey `ecosystemHub`,复用已导入的 LayoutGrid 图标,零新 import)。
5. **顶栏 5→1 的收敛动作在"需要邻居文件"清单**(见下),按任务书"先停下不扩大范围"执行,未动 GlobalTopBar。
6. **i18n 未写入五语文件**:单写者检查 `git status --porcelain` 对 5 个 locale 文件输出全非空(见取证),按 RULES 硬规矩停写。增量文案(20 键 × 5 语,含 `nav.ecosystemHub` + `ecosystem.*` 命名空间)已备好可直接套用的载荷(见"待主代理执行")。
7. 五语键数:21 个新键(1 个 nav.ecosystemHub + 20 个 ecosystem 命名空间),zh-TW/en/ja/ko 译文已写好待 apply。
8. 新文件均已 `node scripts/watermark.mjs inject`(verify 全量 10507/10507 完好)。
9. 页面文案零硬编码中文(全走 `useTranslations('ecosystem')`);page.tsx 的 SEO metadata 按守门 70 文档出口声明 `i18n-content-exempt-file`(扫描日志列于"内容文案豁免"段,不计红)。
10. 无 `title` 属性、无分割线、无渐变遮罩、无字符箭头(图标全 lucide-react)、圆角只用 `rounded-xl/rounded-md` 档位、hover 仅 `bg-accent` subtle 变色。
11. `check-nav-dead-links`:exit 0(197 条侧栏 href 全推得出真实 page,含新 `/ecosystem`)。
12. web typecheck:我的文件 **0 错**;全量 33 错全在他人禁改在途文件(清单见下),与本批无交集。
13. `check-i18n-keys` 全量模式当前判红**仅因** ecosystem 键未落 locale 文件(他人正改五语文件所致,载荷 apply 后即消);`--staged`(空暂存)exit 0。
14. 运行时取证**未完成**:本机 8801 无服务(与仓内登记一致);另起私有 dev 端口 8899 后 `/`、`/ai-skills`、`/ecosystem` 一律 500 —— 共享工作树含他人半成品的全局性失效,非本批页面问题;已按监听 PID 精确终止进程树,端口确认清空,无残留。
15. 除清单内 3 处文件外零改动(收尾 `git status --porcelain` 对目标路径核对:`M nav-data.ts` + 两个新目录 `??`)。

## 受影响文件(实际改动)

| 文件 | 动作 |
| --- | --- |
| `G:\IHUI-AI\apps\web\app\(main)\ecosystem\page.tsx` | 新建(server 壳 + metadata,19 行)|
| `G:\IHUI-AI\apps\web\src\components\ecosystem\ecosystem-hub.tsx` | 新建(client 聚合组件,114 行)|
| `G:\IHUI-AI\apps\web\src\components\sidebar\nav-data.ts` | 修改(hot 组 +1 条 `/ecosystem` 入口,2 行)|
| `G:\IHUI-AI\.ihui-agent\tmp\plan-audit\i18n-d17\zh-CN.snippet.json` | 新建(临时载荷,gitignored)|
| `G:\IHUI-AI\.ihui-agent\tmp\plan-audit\i18n-d17\i18n-translations.json` | 新建(i18n-apply 直用格式,gitignored)|

## 需要邻居文件(本批按任务书未动,需主代理派单/协调)

1. `apps/web/src/components/layout/GlobalTopBar.tsx`(:131-:139 `groupSettings` 并列 5 项 → 收敛为 1 项 `/ecosystem` 需在此做;这是票面"五个门"的真正挂点)。**禁止修改清单未列它,但它也不在本批允许清单,故未动。**
2. `apps/web/src/lib/path-labels.ts`(面包屑标签:新 `/ecosystem` 与 5 老路径的部分条目在此,新增条目需同步)。
3. `apps/web/src/lib/command-registry.ts`(:147-:171 五条市场直达命令,可考虑加 `/ecosystem` 一条)。
4. `apps/web/src/lib/ui-routes.generated.ts` 为生成物,下次生成时自然收录 `/ecosystem`。

## 待主代理执行(阻塞项与原因)

**i18n 五语文件正被他人编辑**(单写者取证:`git status --porcelain -- packages/i18n/messages/web/*` 五文件全为 ` M`,工作树对 HEAD 各含 +22/−8 行的 `ai.pane.contextUsage` 在途改动,`git diff --cached` 为空)。按 RULES"输出非空 ⇒ 不得写",本批未碰。他人改动落地后执行:

```bash
# ① 把 zh-CN.snippet.json 的 ecosystem 命名空间(20 键)并进 packages/i18n/messages/web/zh-CN.json,
#    并在顶层 nav 对象内加 "ecosystemHub": "生态市场"
# ② node scripts/i18n-apply.mjs --input .ihui-agent/tmp/plan-audit/i18n-d17/i18n-translations.json
# ③ node scripts/check-i18n-keys.mjs            # 预期 ecosystem 缺失消失
# ④ node scripts/scan-i18n-zh-residue.mjs zh-TW 与 ko  # 残留巡检
```

注意:**locale 键必须在同一提交批次与本代码一起入库**,否则 CI `check:i18n-keys`(全量,现 exit 1)会点名 `ecosystem-hub.tsx`。

## 验证命令与末行输出(原文摘录)

1. `pnpm --filter @ihui/web typecheck` → `Exit status 2`(33 错)。**全部 33 错的文件分布**(uniq -c,零条属本批文件;前 7 项均在任务书"禁止修改"清单内):
   `15 tool-category.test.ts / 6 message-input.tsx / 3 tool-call-summary-category.test.tsx / 2 voice-note.tsx / 2 desktop-feed-payload.ts / 1 tool-category.ts / 1 use-prompt-drafts.ts / 1 use-prompt-drafts.test.tsx`;`grep -E "ecosystem|nav-data" tsc.log` → 空。
2. `node scripts/check-nav-dead-links.mjs` → 末行:`✅ 无死链:全部侧边栏导航均有对应页面`,`nav-exit=0`(侧栏 href 197 条 / 路由 889 条)。
3. `node scripts/check-i18n-keys.mjs` → 末行:`[i18n 键检查] 发现 缺失键问题,拒绝提交/CI失败!`,direct-exit=1;**缺失全部且仅为**本批引用的 `ecosystem` 命名空间(即上面"待执行"载荷),无他人既有红混入。`--staged` 档 exit 0。
4. `node scripts/scan-hardcoded-zh.mjs`(全量)→ zh-exit=0;本批文件仅出现于"内容文案豁免(声明式,不计红)"段:`apps/web/app/(main)/ecosystem/page.tsx (2 处) ← SEO metadata...`;violation 段零命中;hub 组件 0 命中。
5. `node scripts/watermark.mjs verify` → `[watermark:verify] 覆盖 10507/10507 个已跟踪文件, 残迹(载荷丢失) 0 个, 载荷损坏 0 个, 跳过 0 个` + `纳入口径的文件均已携带完整溯源水印。`(新文件 inject 输出:`injected` ×2)
6. 运行时:`/ecosystem` 于私有 dev(8899)返回 500,**对照组** `/ai-skills`(既有页)与 `/`(根)同样 500 ⇒ 共享工作树他人半成品导致的全站性失效;进程树已按 PID(2644/12380 及子进程)精确终止,`netstat` 复核 `port-8899-clear`。未做浏览器 DOM 取证(非本批代码缺陷,如实登记)。

## 设计取舍与合规说明

- **不复制 5 页正文**:本页只链接、零业务数据获取,符合 §3"不造第二份真相"。
- **"专家包"最小可用形态**:contentCreator(aiSkills+skillsMarket+connectors)/ developerExtension(mcpStore+capabilityMarket)两个组合,成员全是既有页面,零新 API/DB——票面"最小可用聚合概念形状"。若用户期望别的包定义,改 `BUNDLES` 常量即可(文案键同步 i18n-d17 载荷)。
- 动态键 `t(\`cards.${key}.title\`)` 的"静态前缀可达"告会在载荷 apply 后消失(键表即按嵌套对象 `ecosystem.cards.<key>.title` 设计)。
- 本票为 web 单端(入口收敛属桌面 web 形态,主代理登记 PLAN 时建议标"单端"豁免,§9)。

## 剩余缺口

- 顶栏 GlobalTopBar 的 5→1 收敛(唯一真正消除"五个门"的动作)→ 邻居文件,待主代理派单。
- i18n 载荷落地(阻塞于他人正在编辑五语文件)。
- 运行时 4 态截图(阻塞于共享工作树全站 500;待他人半成品修复或主代理在干净基线复验)。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
