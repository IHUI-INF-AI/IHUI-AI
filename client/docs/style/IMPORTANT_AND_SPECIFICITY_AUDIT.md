# !important 与高特异性选择器排查报告

> 生成说明：全面检索项目中 `!important` 及注释/写法上的「高特异性」使用，便于后续按规范（CSS_VARIABLES.md：禁止 !important、禁止高特异性）逐步替换。  
> **最近更新：** 已确认全项目 0 处实际 `!important`（`npm run check:no-important` 通过）；本报告重点为**高特异性选择器**的全面盘点。

## 项目强制规范（.cursorrules）

**本项目禁止使用任何 `!important` 和更高特异性选择器。**  
原因：会导致后续修改、调整、维护时样式难以覆盖，经常「改不生效」。  

- 新增或修改样式时：不得使用 `!important`，不得使用 `.class.class` 或长链选择器堆叠特异性。
- 需要覆盖样式时：优先用 CSS 变量、单一类名、或 CSS Layer 控制优先级；覆盖第三方用一层包裹类即可。
- 自检：运行 `npm run check:no-important` 可扫描 `src` 下是否出现 `!important` 或 `.foo.foo` 式双类。

**当前状态：** 全项目 **0 处 `!important`**，**0 处 `.foo.foo` 同名单类重复**。兜底样式已改为 `@layer fallback`。

**已完成的降特异性处理：** 以下文件中已用 `:where()` 包裹高特异性前缀，在不改变视觉效果的前提下降低选择器权重，便于后续覆盖与维护：
- **index.scss**：`:root` / `html.dark` / `div.floating-chat-dialog-wrapper` 等用 `:where(:root)`、`:where(html.dark)`、`:where(div.floating-chat-dialog-wrapper)`；暗色输入框与 Element 块用 `:where(html.dark, :root.dark)`、`:where(html.dark)`。
- **Login.vue.styles.scss**：`body:has()` → `:where(body):has()`；`#app` → `:where(#app)`；`html.dark` / `body.dark` → `:where(html.dark)` / `:where(body.dark)`。
- **App.vue**：`body:has()` → `:where(body):has()`；`html.dark body` → `:where(html.dark) body`。
- **global-containers-fallback.css**：暗色容器/卡片选择器 `html.dark` → `:where(html.dark)`。
- **AIChat.vue**：`:root body` 长链 → `:where(:root, body)`；`html.dark` → `:where(html.dark)`。
- **UniversalLogin.vue**：`#app`、`html.dark`、`html.dark body`、`html body` → `:where(#app)`、`:where(html.dark)`、`:where(html.dark) body`、`:where(html, body)`。
- **EduDocumentation.vue**：`html.dark body` → `:where(html.dark) body`。
- **_open-platform.scss**、**Notification.vue**、**AiWorld.vue**、**LearnAI.vue**：暗色相关选择器 `html.dark` / `html.dark body` → `:where(html.dark)` / `:where(html.dark) body`。

以下为**高特异性选择器**的盘点（部分已通过 :where() 处理），便于后续继续用 Layer 或缩短选择器进一步降特异性。

---

## 一、`!important` 使用情况（当前：0 处）

- **检查结果：** `npm run check:no-important` **通过**，未发现 `!important` 或 `.class.class` 双类。
- 代码中仅存在**注释**里提到「替代 !important」「无需 !important」等说明，无实际 `!important` 声明。
- 若后续新增样式，请勿使用 `!important`；需覆盖时用 CSS 变量、单类或 @layer。

---

## 二、高特异性选择器全面盘点

### 2.1 以 `:root` / `html.dark` / `html body` 开头的长链

| 文件 | 选择器示例 | 说明 |
|------|------------|------|
| **AIChat.vue** | `:root body .floating-chat-dialog-wrapper .floating-chat-dialog div.input-area` | 输入区圆角，整条链 5–6 级 |
| **AIChat.vue** | `:root body .floating-chat-dialog-wrapper .floating-chat-dialog div.input-area div.input-wrapper` | 同上 |
| **AIChat.vue** | `:root body .floating-chat-dialog-wrapper .floating-chat-dialog div.input-area div.input-wrapper div.chat-input` | 同上 |
| **AIChat.vue** | `:root body .el-popper.openclaw-popover` | Popover 样式 |
| **AIChat.vue** | `html.dark .floating-chat-dialog-wrapper`、`html.dark .api-access-dialog`、`html.dark .ai-capability-popup` 等 | 暗色浮窗/弹层 |
| **AIChat.vue** | `html.dark .el-popper.ai-chat-action-tooltip.el-popper`（多类并列） | 工具提示 |
| **index.scss** | `:root .input-area`、`:root .input-wrapper`、`:root .chat-input` + 多组 `.floating-chat-dialog-wrapper …`、`div.floating-chat-dialog-wrapper div.floating-chat-dialog div.input-area` 等 | 圆角兜底，注释「使用高特异性选择器替代 !important」 |
| **index.scss** | `html.dark .el-input__wrapper`、`:root.dark .el-input__wrapper` 等 | 暗色输入框透明背景，注释「提高选择器特异性避免 !important」 |
| **index.scss** | `html.dark { .el-dialog, .el-message, … }` | Element 组件暗色变量 |
| **global-containers-fallback.css** | `html.dark .page-container:not(.agents-container)`、`html.dark .el-card`、`html.dark .glass-card` 等 | 暗色容器/卡片兜底 |
| **Login.vue.styles.scss** | `html.dark .cross-project-banner`、`html.dark #app .login-content.login-page`、`html.dark body`、`html.dark .login-content.login-page :deep(...)` 等大量 | 登录页暗色，部分带 `#app` 或长链 |
| **UniversalLogin.vue** | `#app html.dark .login-content .login-button.el-button--primary` 等 6+ 选择器并列、`html.dark body .el-overlay:has(...)`、`html.dark body #app .login-content.login-page ...` | 登录主按钮、协议弹层、overlay，链长且带 #app |
| **UniversalLogin.vue** | `html.dark .account-form-container .login-form :deep(.el-form-item[prop='captcha'] ...)` | 验证码表单项 |
| **AiWorld.vue** | `html.dark .ai-world-page`、`html.dark .ai-world-page__nav` | 暗色 AI 世界页与侧栏 |
| **Notification.vue** | `html.dark .notification-dropdown-popper .notification-dropdown` | 暗色通知下拉 |
| **App.vue** | `html.dark body`、`html.dark body .glass-header` | 全局暗色与头部 |
| **_open-platform.scss** | `html.dark body .open-platform-container .cta-btn.primary` 等 | 开放平台 CTA/hero |
| **LearnAI.vue** | `html.dark body .el-dropdown-menu__item .el-icon` 等 | 暗色下拉图标 |
| **EduDocumentation.vue** | `html.dark body .edu-docs-root` 及 `.edu-docs-root .docs-content .markdown-content ...` 等极长链（约 30+ 处） | 教育文档暗色与内容区，链非常长 |

### 2.2 以 `#app` 或 `body` 开头的长链

| 文件 | 选择器示例 | 说明 |
|------|------------|------|
| **Login.vue.styles.scss** | `#app .login-page-root .login-form-wrapper .login-content.login-page` | 登录容器，4–5 级 |
| **Login.vue.styles.scss** | `body:has(.main-content.login-route) .error-overlay`、`body:has(.login-content.login-page) .error-overlay` 等 | 按路由显示 overlay |
| **UniversalLogin.vue** | `#app .login-form.el-form`、`#app .account-form-container .el-form` 等 | 表单容器 |
| **UniversalLogin.vue** | `.form-area .form-container.account-form-container .login-form :deep(.el-form-item[prop='username'] .el-form-item__content .el-input.el-input--prefix .el-input__inner)` 等（多组并列，链极长） | 登录输入框 6px 圆角等，注释「使用高特异性选择器替代 !important」 |
| **UniversalLogin.vue** | `body .el-overlay:has(.agreement-confirm-dialog-wrapper .el-dialog)`、`html body .el-overlay-dialog:has(...)` | 协议弹层 overlay |
| **App.vue** | `body:has(.main-content.login-route) .loading-overlay`、`body:has(.login-content.login-page) .error-overlay` 等 | 加载/错误 overlay、skip-link |

### 2.3 使用 `:has()` 的高特异性

| 文件 | 选择器示例 | 说明 |
|------|------------|------|
| **AIChat.vue** | `body .el-overlay:has(.ai-chat-delete-confirm)`、`body .el-overlay:has(.api-access-dialog)` | 删除确认/API 弹层 overlay |
| **AIChat.vue** | `.floating-chat-dialog-wrapper .floating-chat-dialog .input-area .input-wrapper .chat-input-container:has(.voice-mini-card)` 等 | 语音卡片时输入区样式 |
| **AIChat.vue** | `&:has(.prompt-templates-container)` | 提示词模板容器 |
| **UniversalLogin.vue** | `.login-form .el-form-item:has(.login-button)`、`:deep(.el-form-item:has(.verification-code-background-bar).is-error)`、`:deep(.el-form-item:has([placeholder*='6位验证码']) ...)`、`body .el-overlay:has(.agreement-confirm-dialog-wrapper ...)` 等 | 表单项与 overlay |
| **Login.vue.styles.scss** | `body:has(.main-content.login-route) .error-overlay` 等 | 见 2.2 |
| **App.vue** | `body:has(.main-content.login-route) ...` | 见 2.2 |
| **EduDocumentation.vue** | `body.route-edu-docs .el-overlay:not(:has(.upload-dialog))`、`body.route-edu-docs .el-overlay:has(.upload-dialog)` | 文档页 overlay 区分 |
| **HeaderActions.vue** | `.search-trigger-wrapper:not(:has(.search-trigger-inline)) .search-trigger-fallback` | 搜索回退 |
| **_unified-search.scss** | `.search-bar:has(.el-input)` | 搜索栏 |
| **VoiceRecordingAnimation.vue** | `.voice-recording-animation:has(.grid .area:nth-child(n):hover) .wrap .card`（n=1..15） | 悬停联动 |
| **AIDialog.vue** | `&:has(.input-wrapper:hover:not(:focus-within))::before`、`.el-popper[class*="el-dropdown__popper"]:has(.model-selector-dropdown)`、`#el-popper-container > .el-popper:has(...)`、`.ai-dialog:not(:has(...))::before` | 输入框焦点/下拉/popper |

### 2.4 极长「表单/登录」选择器（Element + :deep）

| 文件 | 选择器示例 | 说明 |
|------|------------|------|
| **index.scss** | `div.login-page-container div.login-content div.form-area div.form-container form.login-form div.el-form-item div.el-form-item__content div.username-input-wrapper div.el-input div.el-input__wrapper` | 登录用户名输入框圆角，约 11 级 |
| **UniversalLogin.vue** | `.form-area .form-container.account-form-container .login-form :deep(.el-form-item[prop='username'] .el-form-item__content .el-input.el-input--prefix .el-input__inner)` 及 prop=password、captcha、多组合 | 登录表单输入框统一样式，注释「使用高特异性选择器替代 !important」 |

### 2.5 属性选择器与 `[class*="..."]`

| 文件 | 选择器示例 | 说明 |
|------|------------|------|
| **index.scss** | `[class*="container"]:not(.app-container, .home-container, ...)` | 全局容器排除列表 |
| **index.scss** | `div[class*="input-area"]`、`div[class*="input-wrapper"]:not(...)`、`div[class*="chat-input"]` | 聊天输入相关兜底 |
| **index.scss** | `[class*="card"]:not(...)`、`[class*="box"]:not(...)`、`[class*="panel"]`、`[class*="wrapper"]` 等（fallback 层） | 卡片/盒子/面板等兜底，多 :not |
| **AIChat.vue** | 注释「使用高特异性选择器覆盖全局 [class*="container"] 样式」 | 输入框容器 |
| **AIDialog.vue** | `.el-popper[class*="el-dropdown__popper"]:has(...)`、`#el-popper-container > .el-popper:has(...)` | 下拉 popper |

### 2.6 BEM 父级子级（非「同名单类」双类）

- **AiWorld.vue**：`.ai-world-page__nav .ai-world-page__nav-inner`、`.ai-world-page__nav button` 等，注释「用完整 BEM 双类提高特异性覆盖全局 button」；当前无 `.ai-world-page__nav.ai-world-page__nav` 同名单类，检查脚本不报。
- 其他 BEM 如 `.sl .sl-plan` 等为正常父子，非「高特异性双类」。

### 2.7 注释中明确写「高特异性替代 !important」的文件（无实际 !important）

- **AIChat.vue**、**AIDialog.vue**、**UniversalLogin.vue**、**Login.vue.styles.scss**、**index.scss**、**SimpleFallback.vue**、**common.scss**、**Home.vue.styles.scss**、**AgentsSquareList.vue**、**Input1.vue**、**ProjectSelectorBanner.vue**、**Toolbar.vue**、**MCPUseManager.vue**、**MCPManager.vue**、**CountryCodeSelector.vue**、**_layers.scss**、**layers/_utilities.scss**、**_search-bar-append.scss**、**runtime-overrides.scss**、**brand-marquee.scss**、**global-containers-fallback.css** 等（仅注释，无违规）。

---

## 三、历史 !important 位置参考（已清除，仅作记录）

以下为审计时曾记录的「典型 !important 位置」摘要，当前均已移除，保留供回溯：

- **global-containers-fallback.css**：body、.page-container、.el-card/.glass-card 等兜底 → 已用 @layer 控制。
- **AgentsSquareList.vue**：.agents-square-list__card 覆盖 .glass-card → 已用选择器/变量。
- **HeaderActions.vue**：.header-right、主题下拉 → 已用变量/选择器。
- **AIChat.vue**：浮窗/输入区/删除确认 overlay → 已用高特异性选择器或 Layer。
- **_dialogs-unified.scss**：浮窗标题栏 → 已用选择器/Layer。
- **index.scss**：首屏、链接、图标尺寸、登录等 → 已用高特异性选择器或 Layer。

---

## 四、建议的后续动作

1. **保持零 !important**  
   - 继续以 `CSS_VARIABLES.md` 与 `.cursorrules` 为准：新代码禁止 `!important`，用 `:where()` / Layer / 单类 控制优先级。  
   - 提交前运行 `npm run check:no-important` 确保未引入 `!important` 或 `.foo.foo` 双类。

2. **高特异性选择器（可选逐步降低）**  
   - **优先可降特异性模块**：`UniversalLogin.vue`（登录表单极长链）、`Login.vue.styles.scss`、`index.scss` 中 `:root`/`html.dark` 长链、`EduDocumentation.vue` 中 `html.dark body .edu-docs-root .docs-content ...`。  
   - 手段：用 `@layer` 划定「覆盖区」、用 `:where()` 包裹前缀降低权重、或收束为单一起始类（如 `.login-page` / `.edu-docs-root`）再写子选择器，避免 `#app`、`html.dark body` 长链。  
   - `:has()` 与 `body:has(...)` 语义性强，可保留；可考虑将 `html.dark body #app ...` 缩短为 `html.dark .login-content.login-page ...` 等。

3. **global-containers-fallback.css**  
   - 已用 @layer 控制兜底，保持「最后加载」角色即可，无需再引入 !important。

4. **硬编码颜色**  
   - 若仍有硬编码色（如曾提到的 `#f2f2f2`、`#2a2a2a`），建议改为 CSS 变量，便于主题与暗色一致。

如需对某一文件做「降特异性」的具体改法，可指定文件或模块再细化。
