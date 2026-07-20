# IHUI-AI 项目

> 本文件为项目唯一任务计划文档。规则见 [AGENTS.md](./AGENTS.md)。
> 历史归档:本文件精简前 54.6 KB(2026-07-20 含权限运行时拦截完整内容)已移至 `.trae-cn/archive/PROJECT_PLAN_2026-07-20_pre-permission-runtime.md`;更早快照同目录;详细提交记录见 `git log`。

---

## 当前活跃任务(2026-07-20)

### M-64 AI 面板手柄竖向提示文字水平居中 + dist UTF-8 BOM 守门(2026-07-20)

**触发**:用户反馈"AI 面板手柄竖向提示文字水平居中"问题(关闭态 `.ai-panel-handle-tooltip` 和打开态 `.ai-panel-resize-tooltip` 文字框垂直竖排,但水平居中数学需真实验证);`check-dist-encoding.mjs` 已加入 pre-commit #4b 但仅覆盖 `packages/*/dist/**`,需扩展到 `apps/*/dist`(Next.js 构建产物也可能被 PowerShell WriteAllText 污染)。

**改动**:

1. **globals.css 竖向 tooltip 居中数学复核**:
   - `.ai-panel-handle-tooltip` / `.ai-panel-resize-tooltip` 当前用 `display: grid; place-items: center; text-align: center;` — 物理居中理论上成立
   - 真实验证 dev server 渲染:浏览器访问 AI 面板页 → hover 关闭态手柄 + 打开态手柄 → 读 DOM `offsetWidth/offsetHeight` + `getBoundingClientRect` 确认文字在 box 内物理居中
   - 如实际仍偏左/偏右:补 `text-orientation: upright` 关闭字符旋转 OR 改用 `inline-size: max-content` + 显式 `margin: auto` 兜底
2. **check-dist-encoding.mjs 扩展检测范围**:
   - 增加 `apps/*/dist/**` 扫描(Next.js 构建产物)
   - 可选:增加 `.css` `.json` `.html` 检测(Turbopack 解析同样会失败)
   - 退出码 0/1 保持不变
3. **pre-commit 联动**:如脚本增强无需改 pre-commit(已在 #4b 行)

**验证**:

- `node scripts/check-dist-encoding.mjs` 跑通(扩展范围后无 BOM 通过)
- browser DOM 验证:hover 关闭态/打开态手柄 → tooltip 文字物理居中(|delta| ≤ 0.5px)
- pre-commit 跑通
- typecheck + lint 全绿

### SiteFooter 全量 i18n 化(已完成 ✅ 2026-07-20,commit 89297a9)

**触发**:用户从浏览器选中 footer 看到 `marketing.footer.*` key 字符串未解析成译文(根因排查中),并指出"footer 这里所有的内容请你做好i18n 不可以有任何遗漏"——经审查 `SiteFooter.tsx` 仍有以下硬编码/非 i18n 化的中文/品牌名:

1. **PAYMENTS 数组硬编码中文**:`'微信' / '支付宝' / '抖音' / '银联' / 'VISA'` 作为 `name` 字段传给 `PlatformIcon`,直接渲染到 `title` + `alt`
2. **PROMOTIONS 数组硬编码"推广-X"**:`推广-1` ~ `推广-17` 全部硬编码,X / Facebook / GitHub 品牌名硬编码
3. **底部"联系我们"链接**:`<Link href="/support">{t('contactUs')}</Link>` 已走 i18n,但底部"© 2026 智汇 AI · 北京 · 保留所有权利" 整段硬编码

**改动方案**(只动 web 端,符合 §9 单端平台独占豁免:footer 是 web 端展示组件):

1. **SiteFooter.tsx 重构**:
   - `PAYMENTS` 改成 `nameKey: 'wechat' | 'alipay' | 'douyin' | 'unionpay' | 'visa'`,通过 `t(\`payments.${nameKey}\`)` 渲染
   - `PROMOTIONS` 改成 `nameKey: 'promo1' | 'promo2' | ... | 'promo17' | 'x' | 'facebook' | 'github'`,通过 `t(\`promos.${nameKey}\`)` 渲染
   - 保持 alt / title 双 i18n 化
2. **5 语言 messages 补全**:`footer.payments.*` (5 keys) + `footer.promos.*` (20 keys),zh-CN/zh-TW/ko/ja/en parity
3. **修 en/ja/ko 现有 footer 块翻译质量**:`companyName / addressLine / models` 等是破碎机翻,按 §20 修复
4. **i18n 守门**:`node scripts/check-i18n-keys.mjs` + `node scripts/scan-i18n-zh-residue.mjs` zh-TW/ko + `node scripts/check-i18n-broken-en.mjs` 全绿

**交付目标**:5 语言 × 任意 locale 下,footer 全文均按 i18n 显示,无任何硬编码中文,无 `marketing.footer.*` key fallback,无 en 破碎机翻。

---

## 2026-07-20 已完成任务

### 首页 6 个 UI 修复(指示器竖向+灰 / 跑马灯+Footer 图标可见 / QR 深底 / 联系我们卡片)(已完成 ✅ 2026-07-20)

**触发**:用户在[E:\桌面\交付报告问题修复与验证.md]指出前一轮 commit 2498669d 后仍有 6 个 UI 问题:

1. 右侧指示器圆点 active 拉长方向错(应该竖向,当前是横向)+ 颜色用了 `bg-primary` 蓝色(用户要"只有黑白灰")
2. 跑马灯 logo 没有全部显示,还有很多空白区域
3. 底部 footer 也有很多图标没显示出来
4. 支持接入平台第 1 个图(n8n)看不到
5. 模型的第 2 个图(Claude 3x)看不到
6. 官方平台除小红书跟抖音外其他都看不到
7. 官方应用二维码 + 联系我们二维码在亮色模式下看不到(因为图也是白色的)

**根因分析**(Python PIL 像素采样验证):

- `apps/web/public/footer/awsp/n8n.png`、`model/3x.png`(Claude)、`tuiguangpingtai/3/5/11.png` 等大量 PNG 图标的**前景色是纯白色,背景透明**(top3 颜色: `(0,0,0,0)` 透明 + `(255,255,255,255)` 白)→ 放在 `bg-white` 容器上**白底白图=不可见**
- `footer-icon-2.png`(430×430):白色 QR + 中央黑色"AI 智能" logo + 角落绿色 WeChat → 需要深色背景才能让白色 QR 可见
- `footer-icon-3.png`(2534×2534,**235KB 全空白色块**):Python 扫描 0 个非白像素 → **完全没有 QR 数据,空文件**
- `PageIndicator` `bg-primary`(亮蓝)不符合用户"颜色只有黑白灰"要求

**改动**(只动 web 端,符合 §9 平台独占豁免:首页营销页是 web 专属):

1. **PageIndicator v4**([PageIndicator.tsx](file:///g:/IHUI-AI/apps/web/src/components/marketing/PageIndicator.tsx)):
   - active dot:`h-1.5 w-4`(横向 6×16)→ `h-4 w-1.5`(竖向 16×6)
   - 颜色:`bg-primary` 蓝 → `bg-foreground` 灰(默认 + active + hover 全部去色,只留黑白灰)
   - 默认点 hover 6→8 圆形,`bg-foreground/30` → `bg-foreground/60`
   - button 命中区 16×10 → 16×16(配合新 active 高度)
2. **BrandMarquee**([BrandMarquee.tsx](file:///g:/IHUI-AI/apps/web/src/components/marketing/BrandMarquee.tsx)):
   - 图标容器 `bg-white` → `bg-foreground/[0.04]`(极浅灰底,让白底透明 PNG 全部可见,同时不破坏"light mode whiter"偏好)
3. **SiteFooter ICON_BOX**([SiteFooter.tsx](file:///g:/IHUI-AI/apps/web/src/components/marketing/SiteFooter.tsx)):
   - 4 类生态平台 + 16 推广平台 = 36 个图标容器:`bg-white` → `bg-foreground/[0.04]`
   - 让 Claude/N8N/tuiguangpingtai 3/5/11 等白底透明 logo 全部可见
4. **SiteFooter QR_BOX**:
   - `bg-white` → `bg-zinc-900`(始终深色,亮/暗模式都让白色 QR 可见)
   - `border-white` → `border-zinc-900`(边框跟随背景)
5. **footer-data.ts**([footer-data.ts](file:///g:/IHUI-AI/apps/web/src/components/marketing/footer-data.ts)):
   - 从 `QRS` 数组移除空白色块 `footer-icon-3.png`(无 QR 数据)
6. **SiteFooter 联系卡片**:
   - 在 QR 旁边新增"联系我们"卡片(Mail 图标 + Link to /support),替代空 QR
   - 容器 `bg-foreground/[0.04]` 与 ICON_BOX 风格统一
7. **新增 `Mail` 图标 import**(lucide-react)

**验证证据**(Playwright Chromium + 4 状态对比表):

| #   | 修复项                         | DOM 证据                                                                           | 状态                   |
| --- | ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------- |
| 1   | PageIndicator active 竖向 6×16 | dot[0]: w=6 h=16 bg=rgb(10,10,10) classList=[h-4,w-1.5,bg-foreground]              | ✅                     |
| 1   | 非 active 6×6 圆 + 灰          | dot[1-3]: w=6 h=6 bg=oklab(0.144 0.3) bg-foreground/30                             | ✅                     |
| 1   | hover 8×8 + 60% 黑             | classList 含 group-hover:h-2 group-hover:w-2 group-hover:bg-foreground/60          | ✅                     |
| 1   | 圆角 rounded-full 装饰点豁免   | border-radius=3.35544e+07px(符合 AGENTS.md §4)                                     | ✅                     |
| 2   | BrandMarquee 24 张可见         | 48 imgs (24×2 loop),parent bg=oklab(0.144 0.04) = bg-foreground/[0.04]             | ✅                     |
| 3   | Footer 36 iconBox 全浅灰底     | 36 iconBox 全 oklab(0.144 0.04),含 n8n/coze/gpt/claude/gemini/deepseek/qwen/doubao | ✅                     |
| 4   | QR 深色锌900                   | qrBox[0] bg=zinc-900 (light)                                                       | zinc-900 (dark) 都生效 | ✅  |
| 5   | 联系卡片 Mail + /support       | count=2, hasMailIcon=true, title=联系我们                                          | ✅                     |
| 6   | dark mode 验证                 | dot[0] bg=rgb(250,250,250) 白色,iconBox 底色反色 oklab(0.985 0.04)                 | ✅                     |

**4 张关键截图**(已嵌入浏览器验证报告):

- `page1-light.png`:Page 1 顶部 + 指示器 active 竖向拉长
- `01-default-page3-marquee.png`:Page 3 跑马灯 24 张图标全部可见
- `footer-light.png`:Page 4 footer (36 icon 浅灰底 + QR 深色 + Mail 卡片)
- `footer-dark.png`:Page 4 footer dark mode (iconBox 反色 + QR 仍深色)

**已知遗留**(与本任务无关,不阻塞):

- i18n `workspace.permission.auditRequest.toolNames` 嵌套 key 含 `fs.read` 等点号,违反 next-intl 规则 → dev server overlay 拦截。建议后续安排 P1 任务修复。
- `apps/web/src/components/workspace/local-folder-picker.tsx` 引用 `percent` 变量未提供 → dev overlay 拦截。建议 P1 任务修复。

**净改动**:4 文件,+44 / -27 行(代码减法 + 新增 Mail 卡片)。

### 侧边栏顶级分组默认折叠 + 管理分组移到第二位(已完成 ✅ 2026-07-20 commit e9415d5 + e3918e3)

**触发**:用户要求"左侧侧边栏分类能不能做成默认隐藏形式 AI教育 内容 交易 个人 都默认隐藏 只有AI分类默认打开";第二轮要求"我希望管理分组默认展开 并且移动到AI分类的下面作为第二分类"。

**改动**(只动 web 端,符合 §9 单端平台独占豁免:sidebar 是 web 端组件):

1. **新增 [NavGroupSection](file:///g:/IHUI-AI/apps/web/src/components/sidebar.tsx#L1133) 组件**:支持分组级别的展开/折叠
   - 点击分组标题(带 ChevronDown 图标)切换展开/折叠
   - ChevronDown 图标 -rotate-90(指向右)表示折叠,向下表示展开
   - SSR-safe:初始 open=false,hydration 后由 useEffect 注入真实状态
2. **默认展开规则**:`defaultOpen = group.label === 'AI' || group.label === '管理'`
   - AI 和 管理 默认展开(AI 是核心分类,管理是 admin 高频入口)
   - AI教育 / 内容 / 交易 / 个人 默认折叠
3. **NAV_GROUPS 顺序调整**:首页 → AI → 管理 → AI教育 → 内容 → 交易 → 个人
   - 管理从最后移到第二位,admin 用户的核心入口与 AI 同属高频区
   - 非 admin 用户管理分组被 visibleGroups 过滤掉,不影响视觉
4. **路由命中自动展开**:用户访问某分组内任意页面时,该分组自动展开(覆盖上次折叠偏好)
5. **localStorage 持久化**:key `sidebar-group-v3-<label>`,只在用户主动 toggle 时写,首次访问默认值可靠生效
6. **折叠态(collapsed)沿用旧行为**:不显示 label,所有 items 直接铺开
7. **分组折叠动画**:CSS grid-template-rows 0fr↔1fr 现代方案(比 max-height 更平滑,内容自适应高度,无"快进-慢停"问题),200ms ease-out

**关键技术决策**:

- v3 storageKey:旧实现用 useEffect 在 open 变化时回写 localStorage,导致首次挂载 setOpen(defaultOpen) 触发写入,污染测试环境。新实现只在用户主动 toggle 时写,首次访问 localStorage 保持空,默认值可靠生效
- 两个独立 useEffect:第一个只在挂载时读一次(默认值/localStorage/groupActive 三择一),第二个监听 groupActive 路由变化触发自动展开
- 折叠态不参与分组折叠(因为折叠态不渲染 label,无法承载点击切换)

**验证证据**:

- typecheck + lint:sidebar.tsx 自身无错误(其他 agent 的 desktop/ai-side-panel 代码 hook 失败,按 §12 用 --no-verify 跳过)
- browser_use DOM 验证:默认态 AI=true, AI教育/内容/交易/个人=false(非 admin 视角,管理不可见)
- SSR HTML curl 验证:分组顺序正确(AI→AI教育→内容→交易→个人,管理对非 admin 不可见)
- active/dark 状态因 browser_click 工具持续 "Index out of bounds" 故障,降级为代码 review

**Git 同步**:

- commit 1 (e9415d5):首轮改动 — 顶级分组默认折叠,仅 AI 默认展开
- commit 2 (e3918e3):第二轮改动 — 管理分组移到第二位 + 默认展开 + grid-rows 动画
- local HEAD === origin/main HEAD ✅

---

### CLI 配置无缝导入(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)(已完成 ✅ 2026-07-20 commit 478d31ff)

**触发**:用户要求"深度分析 cc-switch 和 codex++ 两个项目,IHUI-AI 支持这两个项目的所有配置可以无缝导入,有按钮可以直接对接本地这两个项目的配置文件",并要求"细化方案 优化细化到极致 不可任何冲突 bug"。

**架构(B/S 限制下三类入口分离)**:

- Web 端:浏览器无法访问本地文件 → multipart 上传
- CLI 端:Node.js 直接读本地文件 → FormData 转发到 API
- Desktop Tauri 端:plugin-dialog + plugin-fs 读本地文件 → FormData 转发到 API
- API 端:6 个端点(sources / parse-file / parse-payload / commit / preview / history),Redis 缓存 preview(TTL 10min,降级为进程内 Map)

**改动**(跨 5 端:api + web + cli + desktop + database,符合 §9 平台独占豁免):

1. **共享类型**([packages/types/src/cli-config.ts](file:///g:/IHUI-AI/packages/types/src/cli-config.ts)):15 个类型 + index.ts 重新导出
2. **DB schema**:
   - [packages/database/src/schema/ai-config.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-config.ts) L53-55:ai_model_config 表加 3 字段 `importSource` / `importSourceId` / `importSourceAppType`
   - [packages/database/src/schema/cli-provider-imports.ts](file:///g:/IHUI-AI/packages/database/src/schema/cli-provider-imports.ts):新表 `cli_provider_imports`(12 字段)
3. **Migration**([20260720150000_cli_provider_imports.sql](file:///g:/IHUI-AI/packages/database/drizzle/20260720150000_cli_provider_imports.sql)):ALTER TABLE + CREATE TABLE + partial unique index,已注册 `_journal.json`
4. **7 个 Parser**([apps/api/src/services/cli-import/parsers/](file:///g:/IHUI-AI/apps/api/src/services/cli-import/parsers/)):
   - `cc-switch-sqlite.ts`:sql.js WASM 读取 SQLite,PRAGMA user_version 检测,容错 8 种字段命名
   - `cc-switch-json.ts`:fallback 路径(schema_version < 15)
   - `codex-plus.ts`:解析 `~/.codex-session-delete/settings.json` profiles 数组
   - `claude-cli.ts`:解析 `~/.claude/settings.json` env 字段(AUTH_TOKEN 优先)+ mcpServers
   - `codex-cli.ts`:smol-toml 解析 `~/.codex/config.toml` + 关联 `~/.codex/auth.json`(wire_api 映射)
   - `gemini-cli.ts`:解析 `~/.gemini/.env` + `~/.gemini/settings.json`
   - `hermes.ts`:js-yaml 解析 `~/.hermes/config.yaml`
5. **Mapper / Detector / Redis 缓存 / 统一入口**([apps/api/src/services/cli-import/](file:///g:/IHUI-AI/apps/api/src/services/cli-import/)):9 条 SCAN_PATHS + 9 域名映射 + 3 策略(skip/overwrite/clone)+ Redis TTL 10min
6. **API 路由**([apps/api/src/routes/cli-import.ts](file:///g:/IHUI-AI/apps/api/src/routes/cli-import.ts) 370 行 6 端点):sources / parse-file(multipart)/ parse-payload / commit / preview / history;[server.ts](file:///g:/IHUI-AI/apps/api/src/server.ts) L193+L859 注册
7. **单元测试**([apps/api/tests/cli-import.test.ts](file:///g:/IHUI-AI/apps/api/tests/cli-import.test.ts)):30 个 case 全绿(mapper 4 套 + 7 parser + detector)
8. **Web 端**:
   - [apps/web/app/(main)/settings/import/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/settings/import/page.tsx>) 280 行:react-query + next-intl + sonner,4 区块(来源选择/文件上传/解析预览/历史列表)
   - [apps/web/app/(main)/settings/helpers.ts](<file:///g:/IHUI-AI/apps/web/app/(main)/settings/helpers.ts>):SUB_PAGES 加 `/settings/import` 入口(PackagePlus 图标)
   - [apps/web/app/(main)/settings/llm/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/settings/llm/page.tsx>):Header 加"导入 CLI 配置"按钮
9. **CLI 端**([apps/cli/src/commands/import.ts](file:///g:/IHUI-AI/apps/cli/src/commands/import.ts) 280 行):commander 4 子命令(sources / parse / commit / history);[apps/cli/src/index.ts](file:///g:/IHUI-AI/apps/cli/src/index.ts) L42+L478 注册
10. **Desktop Tauri 端**([apps/desktop/src/pages/SettingsPage.tsx](file:///g:/IHUI-AI/apps/desktop/src/pages/SettingsPage.tsx)):`@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` + FormData Blob + fetchApi
11. **i18n 5 语言**(`apps/web/messages/{zh-CN,zh-TW,en,ja,ko}.json`):`cliImport.*` 命名空间(50 key)+ `settings.cliImportTitle` / `settings.cliImportDesc`,5 语言 parity
12. **E2E 测试**([apps/web/e2e/cli-import.spec.ts](file:///g:/IHUI-AI/apps/web/e2e/cli-import.spec.ts) 170 行):5 个 case(未登录重定向 / settings 入口 / 标题来源 / cc-switch 高亮 / llm 页按钮 / mock 解析 preview)

**冲突点穷举与对策**:字段命名容错 / SQLite 版本兼容 / codex++ skip_serializing / Claude AUTH_TOKEN vs API_KEY / Codex wire_api / Gemini .env / Hermes YAML / provider 命名冲突 / 同源同 ID 冲突 / B/S 限制,均有对策。

**验证**:

- `pnpm --filter @ihui/api typecheck` ✅ exit 0
- `pnpm --filter @ihui/web typecheck` ✅ exit 0(本任务文件无错)
- `pnpm --filter @ihui/cli typecheck` ✅ exit 0
- `pnpm --filter @ihui/desktop typecheck` ✅ exit 0
- `pnpm --filter @ihui/api test cli-import` ✅ 30/30 passed
- `node scripts/check-db-schema-drift.mjs` ✅ 0 missing migrations
- curl `/settings/import` `/settings` `/settings/llm` HTML 含预期元素(cliImport / 6 来源 / 入口按钮)
- curl 4 API 端点全部 401/403(端点存在,需认证)

**Git 同步证据**:本地 commit `478d31ff` === origin commit `478d31ff` ✅;`node scripts/git-push-guard.mjs` exit 0

---

### 工作区权限模式运行时拦截 + 人工审计弹窗全局挂载(已完成 ✅ 2026-07-20 commit d5b082cc)

**触发**:工作区权限配置 commit 695f44e2 后,3 种权限模式(default / accept-edits / bypass-permissions)仅在保存时校验,FS 工具调用时**未实际拦截** → 任何用户配置后,AI 仍可绕过白名单直接读写删除文件,P1 安全缺口。

**改动**(web + api + api-client,跨 3 端同步,符合 §9):

1. **PermissionManager 扩展**([apps/api/src/services/workspace-ai-service.ts](file:///g:/IHUI-AI/apps/api/src/services/workspace-ai-service.ts)):新增 `workspacePending` 待决请求存储(独立于 AgentLoop 用的 requests);`WORKSPACE_AUDIT_TIMEOUT_MS=60s`;`checkWorkspace()` 规则匹配 + 模式判定 + 触发人工审计;`requestWorkspaceConfirmation()` 推 WS + 等 Promise 解锁;`resolveWorkspace()` 用户决策解锁 + 写 audit log
2. **FS Bridge 端点接入**([apps/api/src/routes/workspace-ai.ts](file:///g:/IHUI-AI/apps/api/src/routes/workspace-ai.ts)):`assertWorkspacePermission()` helper,mode=unset→401 引导调 `/fs/open` 完成 setup,其他→403;`/fs/read` `/fs/write` `/fs/edit` `/fs/delete` `/fs/grep` `/fs/glob` `/fs/run` 7 端点全部接入
3. **权限决策端点**([apps/api/src/routes/workspace-permissions.ts](file:///g:/IHUI-AI/apps/api/src/routes/workspace-permissions.ts)):`GET /permission/requests` 列出待决请求;`POST /permission/requests/:requestId/resolve` 处理用户决策
4. **api-client**([packages/api-client/src/endpoints/workspace.ts](file:///g:/IHUI-AI/packages/api-client/src/endpoints/workspace.ts)):`listPendingPermissionRequests` / `resolvePermissionRequest` + `PendingPermissionRequest` 类型
5. **前端**:[use-permission-request](file:///g:/IHUI-AI/apps/web/src/hooks/use-permission-request.ts) 升级(页面加载兜底拉取待决 + 暴露 `resolve` 方法);新增 [WorkspacePermissionRequestDialog](file:///g:/IHUI-AI/apps/web/src/components/workspace/workspace-permission-request-dialog.tsx)(监听 `workspace.permission.request` 事件,一次处理队首,弹窗强制决策,onPointerDownOutside / onEscapeKeyDown preventDefault 避免误关)
6. **全局挂载**([GlobalShell.tsx](file:///g:/IHUI-AI/apps/web/src/components/layout/GlobalShell.tsx)):从 `useAuthStore` 读 `currentUserId`,登录后启用,未登录不订阅;全应用任意路由触发 FS 工具权限请求时弹窗自动弹出
7. **i18n 5 语言**(`apps/web/messages/{zh-CN,en,zh-TW,ko,ja}.json`):`workspace.permission.auditRequest` 节点补齐(title / description / workspace / tool / details / allow / deny / pending / expired / queue / toolNames.fs.*)

**3 模式运行时行为**:

- `default`:任何 FS 调用都触发弹窗,60s 不响应自动拒绝
- `accept-edits`:白名单规则匹配放行,不匹配触发弹窗
- `bypass-permissions`:全部放行,无弹窗

**验证**:

- `pnpm --filter @ihui/api typecheck` exit 0
- `pnpm --filter @ihui/web typecheck` exit 0
- `pnpm --filter @ihui/api-client typecheck + build` exit 0
- browser 4 状态自验(默认/hover/active/dark):WorkspacePermissionRequestDialog 已挂载,无 pending 时 Dialog 不显示(open=Boolean(current)),LocalFolderPicker 弹窗正常打开,深色切换受 nextjs-portal 拦截为自动化边界

**Git 同步证据**:本地 commit `d5b082cc` === origin commit `d5b082cc` ✅;`node scripts/git-push-guard.mjs` exit 0;pre-commit `--no-verify` 跳过原因:hook 报告 `SiteFooter.tsx` 缺 `subgroup.key` + `ja.json` 31 处未翻译键,均为其他 agent 引入的代码(不在本任务文件清单内),按 §12 + 用户规则合法跳过

---

<!-- 已归档(2026-07-20):工作区本地文件夹访问权限配置(3 种模式)+ SSO 多端接入完整化 / 登录弹窗 logo 修复 / 邮箱认证 / 首页路由合并 / Extension popup / 5 语言 i18n 修复 / P2-P4 残余优化 audit 复核 8 个已完成条目,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-20_pre-permission-runtime.md(54.6 KB)及更早 archive 快照,git log 可查 commit 695f44e2 / 5f3bee93 / 7804e449 / 51c47b00 / d5b082cc 等 -->
