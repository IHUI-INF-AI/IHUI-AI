# AGENTS.md — 项目通用 Agent 行为规范（权威单一事实来源）

> ## ⛔ 强制前置指令（MUST-READ BEFORE ANY WORK）
> **任何 AI Agent（包括但不限于 Cursor、WorkBuddy / CodeBuddy、Copilot 等）在为本项目执行任何任务之前，必须完整读取本文件全部内容，并严格遵守其中每一条规范。**
> - 本文件是项目所有编码、设计、提交、自验规范的**单一权威来源**。
> - 开始工作前：**先读完本文件**，再动手；未读取即开工视为违规。
> - 本文件已整合原 `client/.cursorrules` 与 `client/.cursor/rules/` 下全部 23 个 `.mdc` 规则（见文末《Cursor 规则完整整合》章节），无需再单独查阅那些文件。
> - 既有硬约束（开发服务器、主题色、纯白/纯黑边框、AI 面板模式分离、端口、行尾、i18n、暗色模式等）**依旧全部有效**，与本整合章节互补，不得互相覆盖或弱化。
> - 红线（❌）条款为不可协商的强制约束，违反即视为回归。


## 目标驱动模式执行规范（/goal）

当用户触发 `/goal <可量化完成条件>` 时，进入目标驱动模式，严格按以下流程执行：

### 7 步执行流程
1. **目标解析与初始化**：拆分硬性/软性指标，生成执行计划，初始化 STATE.md
2. **单轮任务执行**：聚焦核心问题，输出执行摘要
3. **独立评估校验**：基于真实结果输出二选一结论
4. **循环判定**：未达成则继续，已达成则交付，达上限则终止
5. **最终交付校验**：逐条核对硬性指标
6. **状态清除与交还控制权**：输出交付报告
7. **更新 loop-run-log.md**

### 红线规则
- 最大自动迭代 20 轮
- 高危操作必须暂停确认
- 严格围绕目标，禁止扩展需求
- 连续 3 轮无进展暂停请求指导
- 每轮完整承接上下文

### 判定标准
- 硬性指标全部满足才算达成
- 必须有可验证依据（日志/测试结果/文件内容）
- 隐性默认达标项：无语法错误、可启动、无回归、符合规范

### 适用场景
- 代码重构/迁移/升级
- 批量修复报错/跑通测试
- 按设计落地功能
- 清单型收尾任务

### 不适用场景
- 模糊探索性任务
- 频繁人工决策的创意工作
- 高风险生产环境操作
- 单轮可完成的简单任务

---

## 开发服务器启动约定（2026-07-03 立）

启动前后端必须使用 `scripts/dev-up.ps1`，**禁止**直接 `npm run dev` / `python -m uvicorn` 手动起 — 端口漂移、旧进程残留、env 文件错配都会导致 30+ 分钟的故障定位。

### 启动方式

```powershell
# 标准: 后端 8000 + Vite 8888 (本地 dev)
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1

# CI 慢盘场景: 把 health timeout 拉到 90s
$env:HEALTH_TIMEOUT=90; powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1

# 只起后端 (前端调试用)
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -NoFrontend

# 端口探活 (不启动任何服务)
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Status

# 优雅停机
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Down
```

### HEALTH_TIMEOUT 约定

| 场景 | 推荐值 | 原因 |
|---|---|---|
| 本地开发（首次冷启动） | 默认 60s（已写入 dev-up.ps1） | FastAPI 11+ legacy routers 加载需 50-60s |
| CI 慢盘 / 容器化 | `HEALTH_TIMEOUT=90` | 网络/磁盘抖动留 50% 余量 |
| 已热启动 / dev 模式热重载 | 默认 60s | 仅 ~2s 即可 restart |

**历史教训 (2026-07-03)**: 旧默认 30s 不足以让后端冷启动完成（路由模块多），首启必失败。已提至默认 60s，CI 需显式 90s 留余量。

### 启动后必跑验收

```bash
# 1. 端口探活 (秒级, 不启服务)
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1 -Status

# 2. 烟测 (5 个 HTTP 探活, 防路由静默失败)
cd client && npx playwright test e2e/dev-up-smoke.spec.ts --project=chromium --reporter=line

# 3. 端口字面量守门 (防 18000 历史端口复活)
cd client && npm run check:port-drift
```

### 后端路由静默失败防控

`server/app/api/v1/router.py` 用 `try/except ImportError` 包裹了大量"可选"路由模块（如 `app.api.v1.tools.personality`）。如果 import 路径写错（如历史错配到 `app.api.v1.tools.personality` 而文件实际在 `app.api.v1.agents.personality`），路由会被静默跳过，HTTP 调用会 5xx 而不是 404，难以排查。

**防回归措施**：
- `e2e/dev-up-smoke.spec.ts:70` 包含 "personality 路由注册" 断言，必须通过
- 任何新增"可选"路由，必须在 dev-up-smoke.spec.ts 加对应探活断言

### 红线

- ❌ 直接 `npm run dev` / `python -m uvicorn` 手动起（端口/进程/env 失控）
- ❌ 把 HEALTH_TIMEOUT 设回 30s 以下（FastAPI 冷启必失败）
- ❌ 跳过 dev-up-smoke 烟测就交付 PR
- ❌ 新增 try/except 路由导入而不在烟测加探活

---

## 主题色改动硬约束（2026-07-02 立）

修改以下任一文件，**必须**同时执行 ① + ② + ③，否则视为回归：

- `client/src/styles/_theme-tokens.ts`（THEME_TOKENS / THEME_INVARIANTS）
- `client/src/styles/_theme-tokens.scss`（SCSS 桥接镜像）
- `client/src/components/ThemeToggle.vue`（auto 模式视觉标识）
- `client/src/components/header/parts/ThemeToggle.vue`（header 简化版）
- `client/src/composables/useFirstDarkHint.ts`（首次暗色提示）
- `client/src/views/Home.vue` / `Home.vue.styles.scss`（first-page 区域）

### 三项必跑检查

```bash
# ① 同步性 + 硬编码拦截 (单值唯一来源)
npm run check:theme-tokens

# ② 对比度 + 联调值守门 (暗色按钮可读性)
npm run check:contrast

# ③ 视觉回归基线 (首页 first-page + ThemeToggle, light/dark/auto)
npx playwright test e2e/visual/theme-snapshot.spec.ts
# 基线变更: 追加 --update-snapshots, 然后人工 review diff 后提交
```

### 改色流程

1. 改 `client/src/styles/_theme-tokens.ts` 中 `THEME_TOKENS` 或 `THEME_INVARIANTS`
2. **同步** `client/src/styles/_theme-tokens.scss` 桥接镜像
3. **同步** `client/scripts/check-theme-contrast.mjs` 顶部锚定值（脚本独立运行）
4. 跑 ① ② 验证通过
5. 跑 ③ 重新生成 baseline，人工 review diff
6. 在 PR 描述中说明改色理由 + 截图对比

### 红线

- ❌ 在 `_theme-tokens.ts` / `_theme-tokens.scss` 以外的文件硬编码 `#6a6d77` / `#5a5d67` / `#e5eaf3` / `#2563eb` / `#07c160` 等主题色值
- ❌ 把 darkSurface 改浅到 < 4.0:1 对比度（破坏 ghost 按钮可读性）
- ❌ 删 `runThemeInvariantsCheck()` dev 期 console 校验
- ❌ 跳过 `check:contrast` 把不达标的 PR 合并

---

## 纯白/纯黑边框改动硬约束（2026-07-02 立）

修改任何 border / outline / box-shadow 涉及纯白或纯白变量 / 蓝色外环发光的文件，**必须**同步以下任一工具触发拦截，否则视为回归：

- `client/.stylelintrc.json` `declaration-property-value-disallowed-list` 规则
- `client/e2e/pure-border-cleanup.spec.ts`（源码级 CI 回归）
- `client/e2e/pure-border-visual.spec.ts`（运行时视觉回归，需 PW_BASE_URL）

### 禁止模式（被 stylelint 强制约束）

- `border/outline: var(--el-color-white) | var(--el-color-black)`
- `border/outline: var(--color-white) | var(--color-black)`（不带 N 后缀）
- `box-shadow: 0 0 0 Npx rgba(59,130,246|37,99,235|96,165,250|160,196,255, ...)`（蓝色外环发光）

### 推荐模式

```scss
border: 1px solid var(--color-white-30);   /* 默认 30% 白 */
&:hover { border-color: var(--color-white-50); }  /* hover 50% 白 */
&:active { border-color: var(--color-white-60); } /* active 60% 白 */
&.is-selected { border-color: var(--color-white-80); } /* 选中 80% 白 */
```

或使用 SCSS Mixin（见 `client/src/styles/_design-tokens.scss` 12.14 节）：

```scss
@include dt.border-soft("default");     // 1px solid var(--color-white-30)
@include dt.border-soft("hover");       // 1px solid var(--color-white-50)
@include dt.border-soft("active");      // 1px solid var(--color-white-60)
@include dt.border-soft("selected");    // 1px solid var(--color-white-80)
```

### 红线

- ❌ 在 border / outline 上用 `var(--el-color-white)` / `var(--el-color-black)` / `#fff` / `#000` / `white` / `black`
- ❌ 用 `box-shadow: 0 0 0 Npx rgba(blue)` 模拟外环（输入框/表单元素禁止）
- ❌ 跨 P0/P1 commit 混合作业（hunks 物理混合时不要强拆，保留原 P0 commit，独立 PR 补白环清理）
- ❌ 顺手"优化"无关位置的边框色（自作主张行为）

---

## AI 面板 embedded/floating 模式样式分离约束（2026-07-02 立）

AIChat 组件同时支持两种渲染模式：
- **floating 模式**：.floating-chat-dialog 在屏幕任意位置浮动，父容器有 `padding: 8px`
- **embedded 模式**：.floating-chat-dialog.is-embedded 嵌在 ai-side-panel 内，_sidebar-layout.scss 显式把 padding 设为 0

这两种模式的样式规则在 `client/src/components/ai/AIChat.vue` 的 `<style scoped>` 里**共用了大部分规则**，但 `.dialog-header` 是个例外 — 它有浮窗专属的"贴边"hack。

### 必须区分模式的规则

#### 1. `.floating-chat-dialog .dialog-header` （浮窗专属，禁止污染 embedded）

```scss
.dialog-header {
  width: calc(100% + 16px); /* 抵消父容器左右 padding 8px*2 */
  margin: -8px -8px 0 -8px;
  box-sizing: border-box;
  border-radius: var(--global-border-radius) var(--global-border-radius) 0 0;
}
```

**设计意图**：浮窗的 `.floating-chat-dialog` 有 `padding: 8px`，标题栏通过 `width: calc(100% + 16px)` + 负 margin 反向贴边，露出浮窗顶部描边。

**红线**：
- ❌ 不要在 embedded 模式下使用这套负 margin 贴边 hack（embedded 模式父容器 padding 已经是 0）
- ❌ 不要把浮窗专属的 `width: calc(100% + 16px)` 改成更激进的"自动填充"逻辑

#### 2. `.floating-chat-dialog.is-embedded .dialog-header` （embedded 专用重置）

```scss
&.is-embedded .dialog-header {
  width: 100%;
  margin: 0;
  border-radius: 0;
}
```

**设计意图**：embedded 模式父容器 padding 已被 _sidebar-layout.scss 设为 0，负 margin 反而会反向溢出 16px（左侧 -8px、右侧 +8px）。这条规则强制重置为标准 100% 宽，让标题栏贴齐 ai-side-panel 边缘。

**红线**：
- ❌ 禁止删除此覆盖规则 — 删除后 dialog-header 会重新溢出 16px，与暗色 sidebar (#6a6d77) 形成视觉错位
- ❌ 禁止把 `width: 100%` 改成 `width: calc(100% + 16px)` 等带 padding 反向补偿的形式

#### 3. 前置条件：父容器 padding 必须为 0

`_sidebar-layout.scss` 必须有：

```scss
.ai-side-panel-body .floating-chat-dialog.is-embedded {
  border: none;
  border-radius: 0;
  padding: 0;  /* ← 必须为 0 */
  background: var(--el-bg-color);
}
```

**红线**：
- ❌ 禁止把 `padding: 0` 改回 `padding: 8px` — 这是 embedded 模式与 floating 模式视觉解耦的基础
- ❌ 禁止在 `.floating-chat-dialog.is-embedded` 上加 `border` — embedded 模式贴齐 ai-side-panel 边缘，border 会导致与 sidebar 形成 1px 错位

### 守门工具

#### 源码级守门（已加入 e2e）

`client/e2e/ai-panel-header-no-overflow.spec.ts` 包含 2 个源码级断言：
1. `AIChat.vue` 必须含 `&.is-embedded .dialog-header { ... width: 100%; ... margin: 0 }` 覆盖
2. `_sidebar-layout.scss` 必须含 `.floating-chat-dialog.is-embedded { padding: 0 }` 规则

```bash
npx playwright test e2e/ai-panel-header-no-overflow.spec.ts -g "源码级"
```

#### 浏览器级守门（需 PW_BASE_URL，dev server 健康时跑）

6 个浏览器级断言覆盖亮色/暗色/320px min-width 边界/500px 中等面板/默认 320px/header-right 按钮不溢出场景。所有浏览器级测试在 Mobile Chrome (Pixel 5) 项目下 skip（AI 面板在 mobile viewport 不渲染）：

```bash
cmd /c "set PW_BASE_URL=http://localhost:8888&& npx playwright test e2e/ai-panel-header-no-overflow.spec.ts"
```

#### 精确锚点 regex

源码级测试使用的 regex（**禁止修改**）：

```js
// AIChat.vue is-embedded 覆盖块
/&\.is-embedded\s+\.dialog-header\s*\{[^}]*width:\s*100%[^}]*margin:\s*0/

// _sidebar-layout.scss embedded padding 重置
/[^{}]*\.floating-chat-dialog\.is-embedded\s*\{[^}]*padding:\s*0/
```

`[^}]*` 强制让 `width: 100%` 和 `margin: 0` 必须在**同一个规则块**内，避免跨块误匹配。

### 历史 bug 复盘（2026-07-02 发现）

**症状**：AI 面板 embedded 模式下，对话框标题栏 `.dialog-header` 渲染成 336px（父容器仅 320px），左右各溢出 8px。视觉上与 ai-side-panel (#6a6d77 暗色背景) 形成错位。

**根因**：`.floating-chat-dialog .dialog-header` 的浮窗专属负 margin 在 embedded 模式未被覆盖。父容器 `.floating-chat-dialog.is-embedded` 的 padding 已经是 0（_sidebar-layout.scss 显式设置），但 `width: calc(100% + 16px)` + `margin: -8px -8px 0 -8px` 仍在生效，把标题栏反向推出父容器 16px。

**修复**：在 AIChat.vue 浮窗规则后追加 `&.is-embedded .dialog-header { width: 100%; margin: 0; border-radius: 0; }` 覆盖。

**实测验证**：

| 指标 | 修复前 ❌ | 修复后 ✅ |
|---|---|---|
| `.dialog-header` width | 336px | **320px**（= 父容器 100%） |
| header.x / right | 92 / 428 | **100 / 420**（与父容器精确对齐） |
| header.margin | `-8px -8px 0px` | **0** |
| 父容器容纳 | 溢出 +8px | **0 溢出** |

---

## 多 commit 协作模式下的 hunks 边界规范（2026-07-02 立）

当本批次改动可能与他人的 P0/P1 commit 在同一文件产生 hunks 物理混合时，**禁止**用 `git add -p` 强拆，按以下流程处理：

### 降级方案 A：交付报告形式

1. 本批次 commit 写自己的全部改动（包括与他人的 hunks 混合处）
2. 在 commit message 顶部加 `🤝 Hunks-Overlap: <file>` 标注混合作业
3. 在交付报告里说明：`<file> 的 N-M 行实际属于 <他人 commit/PR 编号>，合并后会自动归属正确`

### 降级方案 B：拆 stash + 独立 PR

1. `git stash push -m "batch-fix-2026-07-02"`
2. `git pull --rebase` 把对方 P0/P1 commit 拉下来
3. `git stash pop` 后重新 commit（此时 hunks 边界清晰）
4. 若有冲突需手工解决

### Commit message 模板

```
<type>(<scope>): <subject>             ← 中文一句话说明
                                        ← 空行
- 改动 1: <文件>:<行号> <旧>→<新>
- 改动 2: <文件>:<行号> <旧>→<新>
                                        ← 空行
Refs: #<issue/PR>
Test: <e2e spec 名>
```

**type 取值**：`feat | fix | refactor | docs | style | test | chore`
**scope 取值**：`theme | border | i18n | login | ai | sidebar | dev | e2e | docs | ci`

### 红线

- ❌ `git add -p` 强拆混合作业 hunk（会破坏对方 commit 完整性）
- ❌ 提交时不带"Refs"或"Test"字段（后续无法追溯）
- ❌ 用英文 commit message（与项目中文规范不一致）

---

## 端口配置统一守门（2026-07-02 立）

修改任何含端口字面量（8000/8888/4173/18000）的文件，**必须**通过 `npm run check:port-drift` 守门，否则视为回归：

### 触发文件

- `client/vite.config.ts`（dev server 端口）
- `client/playwright.config.ts`（e2e baseURL 端口）
- `client/scripts/**/*.ts`（端口校验脚本）
- `client/e2e/**/*.ts`（e2e 测试连接端口）
- `.github/workflows/*.yml`（CI 端口）
- `scripts/*.ps1` / `*.sh` / `*.bat`（本地启动脚本）

### 端口字面量规则

| 端口 | 用途 | 唯一来源 |
|------|------|----------|
| 8000 | 后端 (FastAPI) | `client/config/ports.ts:BACKEND_PORT` |
| 8888 | 前端 (Vite dev) | `client/config/ports.ts:FRONTEND_PORT` |
| 4173 | 前端 (Vite preview) | `client/config/ports.ts:PREVIEW_PORT` |
| 18000 | 已废弃 (DEPRECATED) | `client/config/ports.ts:DEPRECATED_PORTS` |

**强约束**：所有端口引用必须从 `client/config/ports.ts` 导入（`BACKEND_URL` / `FRONTEND_URL` / `PREVIEW_URL` / `BACKEND_PORT` / `FRONTEND_PORT` / `PREVIEW_PORT` / `DEPRECATED_PORTS`），**禁止**硬编码端口字面量。

### 守门命令

```bash
# 本地开发 / CI 必跑
npm run check:port-drift

# 输出失败时: 替换端口字面量为 ports.ts import, 重新跑
# 退出码 0 = 通过, 1 = 发现违规
```

### 红线

- ❌ 在 `vite.config.ts` / `playwright.config.ts` 硬编码 8000/8888/4173（必须 import ports.ts）
- ❌ 在 e2e 测试硬编码 `http://localhost:8888`（应使用 baseURL 变量）
- ❌ 跳过 `check:port-drift` 把不达标的 PR 合并
- ❌ 引入新的端口字面量（必须先在 `ports.ts` 定义常量）

---

## 行尾格式守门（2026-07-02 立）

修改任何 src/scripts/e2e/config/docs 下的 `.ts/.vue/.scss/.json/.md` 等文本文件，**必须**保持 LF 行尾（`\n`），禁止引入 CRLF（`\r\n`）或 lone CR（`\r`）：

### 触发文件

- `client/src/**/*.{ts,tsx,js,jsx,mjs,cjs,vue,scss,css,sass,less,json,md,html,xml,yml,yaml}`
- `client/scripts/**/*.{ts,js,mjs}`
- `client/e2e/**/*.{ts,js,mjs}`
- `client/config/**/*`
- `scripts/**/*`
- `docs/**/*.{md,mdx}`

**例外**：
- `.gitattributes`（CRLF-on-Windows 提示注释）
- `.ps1` / `.sh` / `.bat` / `.cmd`（Windows 脚本，由 .gitattributes `eol=lf` + git 自动转换处理）

### 守门命令

```bash
# staged 模式 (默认): 只检查 git diff --cached --name-only 中的文件
# 集成到 lint-staged 与 pre-commit hook
npm run check:line-endings

# 全项目模式: 找出所有 CRLF 文件用于批量规范化
npm run check:line-endings:all

# 批量规范化历史遗留:
#   git add --renormalize .
#   git commit -m "chore: normalize line endings to LF"
```

### 守门集成

`client/scripts/check-line-endings.mjs` 默认检查 git staged 文件，可与 lint-staged / pre-commit hook 集成：

```json
// package.json lint-staged 段 (建议)
"lint-staged": {
  "*.{ts,vue,scss,json,md}": [
    "node scripts/check-line-endings.mjs"
  ]
}
```

### 红线

- ❌ 在 Windows 编辑器保存为 CRLF 后 commit（git 会自动转 LF，但 .gitattributes 已声明 `text=auto eol=lf`）
- ❌ 用 `String.Replace` 等字符串工具直接修改 .ts 文件后未规范化行尾
- ❌ 跳过 `check:line-endings` 把含 CRLF 的 PR 合并
- ❌ 引入 .ps1/.bat 文件用 LF 行尾（Windows 脚本会运行失败）

---

## AI 浮窗对话历史入口唯一性硬约束（2026-07-02 立）

对话历史入口**只能存在于一个地方**：`Sidebar.vue` 的 `<SidebarChatHistory />`。AI 浮窗 header 早期有 session-list-btn 按钮 + 左侧滑出的 ChatSessionPanel 组件，已在 2026-07-02 清理。**任何重新引入浮窗内对话历史入口的行为都是回归**。

### 禁止的文件 / 标识

- ❌ 重新创建 `client/src/components/ai/chat-parts/ChatSessionPanel.vue`
- ❌ 重新创建 `client/src/components/icons/SessionListIcon.vue`
- ❌ 在 `client/src/components/ai/chat-parts/chatheaderbar.vue` 加回 `class="session-list-btn"` 按钮
- ❌ 在 `client/src/components/ai/chat-parts/chatheaderbar.vue` import `SessionListIcon`
- ❌ 在 `client/src/components/ai/AIChat.vue` import / 使用 `ChatSessionPanel`
- ❌ 在 `client/src/components/ai/AIChat.vue` 重新声明 `const showSessionList = ref(false)` / `watch(showSessionList, ...)`
- ❌ 在 `client/src/styles/ai-chat/_session-list.scss` 重新加回 `.session-list-panel / .session-list-header / .session-list-title / .session-list-close / .session-list-content / .session-list-slide-*` 6 个块
- ❌ 在 `client/src/components/icons/index.ts` 重新 export `SessionListIcon`
- ❌ 在 `client/src/components/ai/chat-parts/index.ts` 重新 export `ChatSessionPanel`

### 守门工具

**源码级守门（已加入 e2e，CI 必跑）**：

`client/e2e/ai-floating-chat-history-removed.spec.ts` 包含 **6 个源码级断言 × 2 视口 = 12 个测试**：

1. `ChatHeaderBar.vue` 不再渲染 `session-list-btn` 按钮
2. `ChatHeaderBar.vue` 不再 import `SessionListIcon`
3. `ChatSessionPanel.vue` 文件不存在
4. `AIChat.vue` 不再 import / 使用 `ChatSessionPanel`
5. `SessionListIcon.vue` 文件不存在 + `icons/index.ts` 不再 export
6. `chat-parts/index.ts` 不再 export `ChatSessionPanel`

```bash
npx playwright test e2e/ai-floating-chat-history-removed.spec.ts
```

**任何一条失败 = 浮窗对话历史入口被重新引入 = 立即回滚**。

### 设计意图

对话历史是"侧边栏持久状态"，浮窗是"临时对话窗口"。两个入口并存会导致：
- 状态不同步（侧边栏删除一条 → 浮窗还在显示）
- 视觉冗余（同一份数据在两个位置）
- 交互割裂（侧边栏展开时浮窗入口遮挡内容）

**统一入口 = 单源真相**（single source of truth）。

---

## 登录/注册按钮设计令牌应用硬约束（2026-07-02 立）

`_login-tokens.scss` 定义了登录模块的完整设计令牌（圆角 10px / 高 44px / 蓝色阴影 #2563eb / hover 上移 1px / 暗色版）。**UniversalLogin.vue 的 submit 按钮必须消费这些 token，不允许退回 Element Plus 默认样式**。

### 必须满足的规则

`client/src/components/login/UniversalLogin.vue`：

1. **第 1 行附近**必须有 `@use './_login-tokens.scss' as lt;`（消费令牌）
2. **`.submit-btn` 规则块**内必须引用 **≥ 3 个 `lt.$login-btn-*` 变量**（`$login-btn-radius / $login-btn-height / $login-btn-font-size / $login-btn-font-weight / $login-btn-letter-spacing`）
3. **`.submit-btn` 规则块**内必须使用 **3 个 `lt.login-btn-*` mixin**（`@include lt.login-btn-primary` / `@include lt.login-btn-primary-hover` / `@include lt.login-btn-primary-active`）
4. **`html.dark .universal-login .submit-btn` 暗色变体规则块**必须存在，必须引用 `lt.$login-dark-primary` 等暗色 token

### 禁止模式

- ❌ 退回 Element Plus 默认样式（4px 圆角 / 40px 高度 / `#409eff` 浅蓝 / 无阴影 / 无 hover 上移）
- ❌ 硬编码 `#2563eb` / `#07c160` 等品牌色（必须走 `lt.$login-primary` token）
- ❌ 硬编码 `10px` / `44px` / `15px` / `600` / `0.5px`（必须走 `lt.$login-btn-*` token）
- ❌ 删掉 `html.dark .submit-btn` 暗色变体块
- ❌ 把 `_login-tokens.scss` 整个文件删除（它是设计源头）

### 守门工具

**源码级守门（已加入 e2e，CI 必跑）**：

`client/e2e/login-submit-btn-design-tokens.spec.ts` 包含 **5 个源码级断言 × 2 视口 = 10 个测试**：

1. `_login-tokens.scss` 文件必须存在
2. `UniversalLogin.vue` 必须 `@use './_login-tokens.scss' as lt`
3. `.submit-btn` 引用 ≥ 3 个 `lt.$login-btn-*` 变量
4. `.submit-btn` 应用 3 个 `lt.login-btn-*` mixin
5. `html.dark .submit-btn` 暗色变体块必须存在

```bash
npx playwright test e2e/login-submit-btn-design-tokens.spec.ts
```

**任何一条失败 = 登录按钮退回到 Element Plus 默认丑样式 = 立即回滚**。

### 设计意图

Element Plus 默认的 `<el-button type="primary">` 是 `#409eff` 浅蓝（通用 SaaS 配色），与项目"黑-白-蓝"极简风格不匹配。`_login-tokens.scss` 把登录按钮统一为项目 CTA 蓝 `#2563eb`（更深、更专业），并加上 10px 圆角 + 44px 高度 + 蓝色阴影 + hover 上移的"亲和力"细节，与全局 miniapp 按钮的"极简黑白"形成"主操作蓝色 + 次操作黑白"的双层级设计语言。

---

## 文案 / i18n 联动改动硬约束（2026-07-03 立）

UI 上**任意可见文案**（`<span>` / `<a>` / `<h1>` / `aria-label` / `placeholder` / 面包屑 / 导航 / 404 文案 / `document.title` / 路由 `meta.title`）的修改，**必须**同步触发"6 语言 i18n 联动 + 入口级联 + 防回归守门"三件套。**2026-07-03 侧边栏 "成为供应商" → "加入我们" 改动** 走完一遍完整流程后，把这套配方固化为硬约束。

### 一、改动范围识别（4 类入口 + 5 个 i18n 段）

任何 UI 文字改动都会落在下表的 1 个或多个位置。**遗漏任一处 = 不同语言 / 不同入口显示不一致**：

| 位置 | 触发条件 | 示例 |
|---|---|---|
| **sidebar / dropdown / mobile menu** | 在 `Sidebar.vue` / `HeaderNavigation.vue` / `MobileMenu.vue` 模板内出现 | `t('navigation.becomeSupplier')` |
| **页面 h1 / 文档 title** | 路由 `meta.title` / 页面 `<h1>` / `document.title` | `meta: { title: 'routes.becomeSupplier' }` |
| **about 页面快捷链接** | `aboutUs.json.quickNav.*` | `quickNav.becomeSupplier: "加入我们"` |
| **核心模块快捷入口** | `core.json.aboutUs.*` 或 `core.json.navigation.*` | `core.aboutUs.becomeSupplier: "加入我们"` |
| **顶层 legacy locale** | `src/locales/zh-CN.json` 等顶层文件（老代码 fallback） | 顶层 `becomeSupplier: "加入我们"` |
| **full 合并集** | `src/locales/full/{locale}/*.json`（mergeLocaleMessage 全量集） | `full/zh-CN/about.json` |

i18n 段（共 5 段，**6 语言都要同步**）：

1. `src/locales/modules/{locale}/navigation.json`
2. `src/locales/modules/{locale}/routes.json`
3. `src/locales/modules/{locale}/aboutUs.json`
4. `src/locales/modules/{locale}/core.json`
5. `src/locales/{locale}.json` 顶层 legacy + `src/locales/full/{locale}/*.json`

**6 语言** = `zh-CN / en / en-US / zh-TW / ja / ko`（项目强制 6 语言，缺一不可）

### 二、改动流程（缺一不可）

```bash
# 1. 改 6 语言 × 4-5 段 i18n 文件（具体范围用 Grep 旧值定位）
# 2. 模板 / 注释 / README 同步: 引用 t(key) 不硬编码
# 3. 写 E2E 源码级守门 (e2e/<context>-<old-value>-<new-value>.spec.ts)
# 4. 写 pre-commit 轻量级守门 (scripts/check-<context>-<old-value>-<new-value>.mjs)
# 5. 接入 package.json npm scripts + simple-git-hooks pre-commit
# 6. 接入 .github/workflows/ci.yml playwright-e2e 任务
# 7. 跑全套验证: e2e 88 用例 + check:line-endings + check:port-drift + check:i18n:keys
# 8. 中文 commit message: fix(i18n)/test(e2e+scripts)/ci(workflows) 三类拆 commit
# 9. push origin/main
```

### 三、必须满足的规则

#### A. i18n 规则

1. **6 语言** = `zh-CN / en / en-US / zh-TW / ja / ko` 必须**全部**同步
2. **导航 / 路由 / 页面 / 快捷链接 / 顶层 legacy / full 集** 这 5 段必须**全部**同步
3. **模板** 必须用 `t('key.path')` **不硬编码**（硬编码会导致 i18n 切换失效）
4. **路由 `meta.title`** 必须用 `t('routes.xxx')` **不硬编码**（影响 `document.title`）
5. **页面 h1** 与 **导航 label** 可以**不同**（e.g. 页面 h1="成为供应商" + 导航 label="加入我们"） — 这是设计意图，**不算回归**，spec 需明确豁免

#### B. 防回归守门规则

1. **E2E 源码级守门** ≥ 88 用例（44 断言 × 2 视口 chromium + Mobile Chrome），覆盖：
   - 6 语言 × 4 段 i18n 文件
   - 模板引用（Sidebar / Header / MobileMenu / BecomeSupplier.vue）
   - 注释 / README 文档
   - 顶层 legacy locale 文件
   - 路由配置（`/about/xxx` 路由 name + meta.title）
2. **pre-commit 轻量级守门** < 100ms，覆盖：
   - 6 语言 navigation.json 字段值
   - 模板引用 `t('navigation.xxx')` 存在性
   - 模板内不含旧值字面量
   - 注释含新值
3. **CI workflow 接入** 必须在 `.github/workflows/ci.yml` playwright-e2e 任务的早期步骤运行（启动预览之后立即跑，越早失败越好）

#### C. 禁止模式

- ❌ 只改 1-2 个语言（不完整 = 视觉不一致）
- ❌ 只改 `navigation.json` 1 段（漏掉 routes/aboutUs/core/顶层/full = 不同入口显示不一致）
- ❌ 模板硬编码"成为供应商族"（应走 `t()`，i18n 切换失效）
- ❌ 删 E2E 守门 spec 后只剩 pre-commit（pre-commit < 100ms 太弱，必须 CI 兜底）
- ❌ 删 pre-commit 轻量级守门（pre-commit 拦截可避免 88 用例 E2E 跑完才发现）
- ❌ 把 CI 守门放到 playwright-e2e 任务**之后**（应在启动预览后立即跑，越早失败越省 CI 时间）
- ❌ 路由 `meta.title` 硬编码（影响 `document.title` 多语言切换）
- ❌ 页面 h1 改成新值（页面 h1 是页面主题，nav label 才是入口文案，两者可不同）

### 四、参考实现（"成为供应商" → "加入我们" 案例）

#### 4.1 E2E 守门（88 用例）

`client/e2e/sidebar-becomesupplier-join-us.spec.ts`（345 行）— 16 类断言：

1. 6 语言 navigation.becomeSupplier（6 用例）
2. 6 语言 routes.becomeSupplier（6 用例）
3. 6 语言 aboutUs.quickNav.becomeSupplier（6 用例）
4. 6 语言 core.aboutUs.becomeSupplier（6 用例）
5. Sidebar.vue 引用 `t('navigation.becomeSupplier')` 不硬编码（1 用例）
6. HeaderNavigation.vue 同上（1 用例）
7. useSidebar.ts 注释 4 字 label 案例（1 用例）
8. useSidebar.test.ts 注释（1 用例）
9. README.md 导航章节（1 用例）
10. 反向断言：6 语言 navigation.json 不含旧值（1 用例）
11. 反向断言：6 语言 routes.json 不含旧值（1 用例）
12. 顶层 i18n 5 语言至少有 1 处新值（5 用例）
13. full/*/about.json 5 语言 quickNav 新值（5 用例）
14. 路由配置 1：`/about/become-supplier` 路由 name = 'becomeSupplier'（1 用例）
15. 路由配置 2：`meta.title` 引用 i18n key（1 用例）
16. BecomeSupplier.vue 页面 h1 用 `t('becomeSupplier.title')`（1 用例）

合计 44 断言 × 2 视口 = **88 用例**，实测 4.6s 跑完。

```bash
npx playwright test e2e/sidebar-becomesupplier-join-us.spec.ts --reporter=list
```

#### 4.2 pre-commit 轻量级守门

`client/scripts/check-becomesupplier-join-us.mjs`（216 行）— 4 类检查：

1. 6 语言 `navigation.json.becomeSupplier` 字段值精确匹配
2. `Sidebar.vue` / `HeaderNavigation.vue` 引用 `t('navigation.becomeSupplier')` + 不含旧值字面量
3. `useSidebar.ts` / `useSidebar.test.ts` 注释含新值 + 不含旧值
4. 退出码 1 = 回归，0 = 通过

```bash
node scripts/check-becomesupplier-join-us.mjs          # 全量
node scripts/check-becomesupplier-join-us.mjs --staged # 仅 staged
```

#### 4.3 CI 接入

`.github/workflows/ci.yml` playwright-e2e 任务（`启动预览` 之后立即）：

```yaml
- name: 跑侧边栏 "加入我们" 源码级守门 (88 用例, 不需浏览器, 早失败)
  run: cd client && npx playwright test e2e/sidebar-becomesupplier-join-us.spec.ts --reporter=list
```

#### 4.4 package.json 接入

```json
"scripts": {
  "check:becomesupplier:join-us": "node scripts/check-becomesupplier-join-us.mjs",
  "check:becomesupplier:join-us:staged": "node scripts/check-becomesupplier-join-us.mjs --staged"
},
"simple-git-hooks": {
  "pre-commit": "... && npm run check:becomesupplier:join-us:staged --silent"
}
```

### 五、设计意图

**单 span 文字改动 = 6 语言 × 5 段 × N 入口 = 30+ 处可能遗漏**。任一处遗漏都会导致：

- 不同语言用户看到旧值（语言不一致）
- 不同入口（sidebar / mobile menu / about 快捷链接）看到不一致文案（入口不一致）
- 路由跳转 404（路由 name 被改）
- `document.title` 跟随不到新文案（`meta.title` 硬编码）

**三件套防回归**：

```
E2E 88 用例 (CI 兜底)  +  pre-commit < 100ms (本地拦截)  +  CI 早期步骤 (早失败)
```

三者互补：pre-commit 拦截常见错误，E2E 兜底复杂场景，CI 早期步骤缩短反馈时间。

### 六、模板：新增文案改动时的最小操作清单

```bash
# 1. Grep 旧值定位所有位置
Grep -n "old_value" client/src/

# 2. 改 6 语言 × 5 段 i18n 文件
# (改后跑 i18n:customize-en-us 同步 en-US)

# 3. 改模板: t('key.path') 不硬编码
# 4. 改注释 / README

# 5. 写 E2E: e2e/<context>-<old>-<new>.spec.ts (≥ 88 用例模板)
# 6. 写 pre-commit: scripts/check-<context>-<old>-<new>.mjs
# 7. 接入 package.json scripts + pre-commit
# 8. 接入 .github/workflows/ci.yml

# 9. 跑全套验证
cd client
npm run check:i18n:keys
npm run check:line-endings
npm run check:port-drift
node scripts/check-<context>-<old>-<new>.mjs
npx playwright test e2e/<context>-<old>-<new>.spec.ts --reporter=list

# 10. 拆 commit (按本章节红线的"hunks 边界规范")
git add client/src/locales/...
git commit -m "fix(i18n): <context> 旧值 → 新值 (6 语言 × 5 段)"
git add client/e2e/<context>-<old>-<new>.spec.ts client/scripts/check-<context>-<old>-<new>.mjs client/package.json
git commit -m "test(e2e+scripts): <context> 旧值 → 新值 防回归 (88 用例 + pre-commit)"
git add .github/workflows/ci.yml
git commit -m "ci(workflows): playwright-e2e 接入 <context> 旧值 → 新值 88 用例源码级守门"
git push origin main
```

### 七、关联守门

| 守门 | 文件 | 覆盖 |
|---|---|---|
| AGENTS.md 章节完整性 | `scripts/check-agents-md-sections.mjs` | 本章节必须存在（10 → 11 章） |
| 轻量级 pre-commit | `scripts/check-becomesupplier-join-us.mjs` | "加入我们" 6 语言 nav + 模板 + 注释 |
| E2E 源码级 CI 守门 | `e2e/sidebar-becomesupplier-join-us.spec.ts` | 88 用例 6 语言 × 4 段 + 入口 + 路由 + 页面 h1 |
| 端口漂移 | `scripts/check-port-drift.mjs` | 端口字面量（防 ci.yml 加 `--port`） |
| 行尾 LF | `scripts/check-line-endings.mjs` | 防 e2e / i18n 文件混入 CRLF |

### 红线

- ❌ 改 1-2 语言（必须 6 语言 × 5 段全覆盖）
- ❌ 模板硬编码"成为供应商族"（必须走 `t()`）
- ❌ 改页面 h1（页面主题 ≠ 导航 label，故意区分）
- ❌ 只写 E2E 不写 pre-commit（pre-commit 拦截更早）
- ❌ 只写 pre-commit 不写 E2E（pre-commit 太弱，CI 必须兜底）
- ❌ CI 守门放到 playwright-e2e 任务**之后**（应早期步骤跑）
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 的 EXPECTED_SECTIONS（章节守门会失败）

---

## 会话过期通知位置 + 自动关闭硬约束（2026-07-03 立）

会话过期通知（session-expired notification）是用户 401 后唯一的"重新登录"入口，其**位置 / 自动关闭 / 事件派发 / 可达性**四要素是用户体验与可达性的硬性保障。修改以下任一文件，**必须**保留四要素全部行为，否则视为回归：

- `client/src/composables/useAppLifecycle.ts`（`SESSION_EXPIRED_DURATION_MS` / `position` / `duration` / `customClass` / `onClick` / `onClose`）
- `client/src/styles/_session-expired-notification.scss`（`left: 50%` + `margin-left: -165px` 居中覆盖 + 暗色模式）
- `client/src/utils/request.ts`（必须 `dispatchEvent('session-expired')`，禁止直接 `clearAndRedirect` 或 `ElMessageBox`）
- `client/src/main.ts`（必须 `import './styles/_session-expired-notification.scss'`）

### 必须满足的规则

#### 1. `position: 'top-left'`（不可改 top-center / top-right）

`useAppLifecycle.ts` ElNotification 块必须显式 `position: 'top-left'`：

```ts
const notification = ElNotification({
  // ...
  position: 'top-left',
  // ...
})
```

**设计意图**：Element Plus `ElNotification` 的 `notify.mjs:8-13` 仅声明 4 个位置 key（`top-left` / `top-right` / `bottom-left` / `bottom-right`），**不支持 `top-center`**。若传 `top-center`，`notify.mjs:21` 会 `notifications['top-center'].forEach(...)` 触发 `Cannot read properties of undefined (reading 'forEach')`，通知永不出现。

本项目用 `position: 'top-left'` 走 Element Plus 支持的代码路径，再用 scss `left: 50%` + `margin-left: -165px` 实现视觉水平居中（见规则 3）。

#### 2. `duration` 必须在 4000-15000ms 区间（禁止 0 / 永久 / <4s / >15s）

`useAppLifecycle.ts` 必须有：

```ts
const SESSION_EXPIRED_DURATION_MS = 8000  // 当前值, 8s
```

且 `ElNotification({ duration: SESSION_EXPIRED_DURATION_MS })`。**当前值 8000**，禁止改成：

- `0` = 永久显示，通知会遮挡屏幕，用户忘记关闭则长期占位
- `< 4000` = 用户来不及看清并操作（特别是可达性场景）
- `> 15000` = 等同于半永久挂起，失去"自动关闭"语义

#### 3. scss 必须含 `left: 50%` + `margin-left: -165px` 居中覆盖

`_session-expired-notification.scss` 必须含：

```scss
.session-expired-notification {
  left: 50% !important;
  margin-left: -165px !important;  // 通知宽度 330px 的一半, 精确居中
}
```

**设计意图**：`ElNotification` 走 `top-left` 路径后，Element Plus 默认会给 `.el-notification.left { left: 16px }`，导致通知落在屏幕**左侧**而非居中。本覆盖把 `left` 改为 `50%`，再用 `margin-left: -165px` 反向偏移通知宽度的一半（`--el-notification-width` = 330px），实现精确水平居中。

**动画兼容性**：Element Plus 入场动画作用于 `left` / `transform`，不作用于 `margin-left`，故本覆盖不影响入场动画。

#### 4. `request.ts` 必须统一派发 `session-expired` 事件

`request.ts` 401 处理路径必须用：

```ts
window.dispatchEvent(new CustomEvent('session-expired', {
  detail: { reason: i18nT('auth.sessionExpiredMessage') },
}))
```

**禁止**直接调 `ElMessageBox` / `clearAndRedirect` / `useLoginDialog().open()` — 这些会绕过 `useAppLifecycle` 的统一通知逻辑，导致：

- 通知位置 / 自动关闭 / 防抖锁全部失效
- 多个并发 401 会同时弹多个通知（防抖锁在 `useAppLifecycle` 内）
- 未来调整通知样式需要改多处，违反单一职责

#### 5. 必须带 `onClick` 回调（可达性）

`useAppLifecycle.ts` ElNotification 块必须含：

```ts
onClick: (e?: MouseEvent) => {
  if (e?.target) {
    const target = e.target as HTMLElement
    if (
      target.closest('.el-button') ||
      target.closest('.el-notification__closeBtn')
    ) {
      return  // 排除按钮与关闭按钮, 它们有自己的处理逻辑
    }
  }
  useLoginDialog().open('login')
  notification.close()
},
```

**设计意图**：通知本体（非按钮区域）也可点击触发"重新登录"，提升可达性。**必须排除** `.el-button`（避免与按钮自身 `onClick` 重复触发）和 `.el-notification__closeBtn`（Element Plus 自带关闭按钮，点击不应弹登录框）。

#### 6. 必须有"重新登录" + "取消"两个按钮

`useAppLifecycle.ts` ElNotification `message` 必须用 `h()` 渲染：

```ts
h('div', { class: 'session-expired-notify' }, [
  h('p', { class: 'session-expired-msg' }, reason),
  h('div', { class: 'session-expired-actions' }, [
    h(ElButton, { type: 'primary', size: 'small', onClick: ... }, t('auth.relogin')),
    h(ElButton, { size: 'small', onClick: ... }, t('common.cancel')),
  ]),
])
```

**设计意图**："重新登录"是主操作（蓝色 primary），"取消"让用户保留控制权（不强制登录，可继续浏览）。

#### 7. `customClass: 'session-expired-notification'` 必须存在

`useAppLifecycle.ts` 必须含 `customClass: 'session-expired-notification'`，这是 scss 样式钩子的唯一来源。**禁止**改成其他类名（会导致 `_session-expired-notification.scss` 全部规则失效）。

#### 8. `main.ts` 必须 import scss

`client/src/main.ts` 必须含：

```ts
import './styles/_session-expired-notification.scss'
```

**禁止**删除此 import（scss 不会自动挂载，通知会失去居中覆盖 + 暗色模式适配）。

### 禁止模式

- ❌ `position: 'top-center'`（触发 Element Plus `notify.mjs:21` forEach 错误，通知永不出现）
- ❌ `position: 'top-right'`（回退到右上角 bug，与"顶部居中下滑"设计意图冲突）
- ❌ `duration: 0` 或 `> 15000`（永久挂起 / 半永久挂起，遮挡屏幕）
- ❌ `duration < 4000`（用户来不及反应）
- ❌ 删除 `_session-expired-notification.scss` 的 `left: 50%` 或 `margin-left: -165px`（通知会落到屏幕左侧 `left: 16px`）
- ❌ 在 `request.ts` 直接调 `ElMessageBox` / `clearAndRedirect` / `useLoginDialog().open()`（绕过统一通知逻辑）
- ❌ 删除 `useAppLifecycle.ts` 的 `onClick` 回调（点击通知本体无效果，可达性不足）
- ❌ 删除 `useAppLifecycle.ts` 的 `onClose` 回调（防抖锁 `sessionExpiredNotifying` 永不复位，下次会话过期通知将永不出现）
- ❌ 删除 `_session-expired-notification.scss` 文件
- ❌ `main.ts` 不 import `_session-expired-notification.scss`
- ❌ 删除"取消"按钮（用户失去"不重新登录"的选择权）

### 守门工具

#### 1. 源码级守门（CI 必跑，10 用例）

`client/e2e/session-expired-notification.spec.ts` 覆盖：

1. `useAppLifecycle.ts` 必须用 `ElNotification`（反 `ElMessageBox`）
2. `position: 'top-left'` + 反 `top-right` + 反 `top-center`
3. scss `left: 50%` + `margin-left: -165px` 必须存在
4. `duration` 解析后必须在 4000-15000ms 区间（支持字面量 + `SESSION_EXPIRED_DURATION_MS` 常量追溯）
5. `type: 'warning'`
6. `customClass: 'session-expired-notification'`
7. 必须有"重新登录"按钮（`relogin` 文案）
8. 必须有"取消"按钮（`cancel` 文案）
9. scss 文件存在 + `main.ts` import 该 scss
10. `onClick` 回调存在 + 排除 `.el-button` + 排除 `.el-notification__closeBtn` + 调 `useLoginDialog().open('login')`

```bash
npx playwright test e2e/session-expired-notification.spec.ts --reporter=list
```

#### 2. 浏览器级守门（需 PW_BASE_URL，4 测试 × 2 视口 = 8 用例）

`client/e2e/session-expired-position.spec.ts` 在运行时验证通知真的水平居中：

- 浅色 + Desktop Chrome
- 暗色 + Desktop Chrome
- 浅色 + Mobile Chrome (Pixel 5)
- 暗色 + Mobile Chrome (Pixel 5)

每个测试断言：

1. 通知中心 X 与 viewport 中心 X 偏差 < 20px（容差覆盖子像素渲染 / 滚动条 / DPR 缩放）
2. 通知 top < 100px（顶部下滑）
3. 通知 x > 50px（Desktop）/ > 20px（Mobile，防 top-left 默认 `left: 16px` 退化）

```bash
cmd /c "set PW_BASE_URL=http://localhost:8888&& npx playwright test e2e/session-expired-position.spec.ts"
```

#### 3. 章节守门

`scripts/check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS` 必须含本章节标题（12 章之一）。

#### 4. 单元测试

`client/src/composables/__tests__/useAppLifecycle.test.ts` 覆盖：

- `session-expired` 事件触发后调用 `ElNotification`（位置 `top-left`）
- 防抖锁（多次 dispatchEvent 只弹一次）
- `onClose` 重置防抖锁

`client/src/utils/__tests__/request.test.ts` 覆盖：

- 401 路径必须 `window.dispatchEvent('session-expired')`（用 `addEventListener` spy 验证）

### 历史 bug 复盘（2026-07-03 修复）

**症状 1（旧实现）**：会话过期用 `ElMessageBox` 居中模态弹窗，强制打断用户操作，用户必须先关闭弹窗才能继续，体验割裂。

**症状 2（改版初版）**：改用 `ElNotification` 顶部下滑通知，但 `duration: 0`（永久挂起）+ `position: 'top-right'`（右上角），用户反馈"通知一直挂右上角挡按钮"。

**症状 3（事件派发分裂）**：`request.ts` 在不同 401 路径分别派发事件 + 直接调 `clearAndRedirect`，逻辑分裂，部分路径通知永不出现。

**修复（2026-07-03，commit 864ceec7 + f3695688）**：

1. `position: 'top-left'` + scss `left: 50%` + `margin-left: -165px` 实现顶部居中下滑
2. `SESSION_EXPIRED_DURATION_MS = 8000`（8s 自动关闭，平衡"看清操作"与"不长期遮挡"）
3. `request.ts` 删除 `clearAndRedirect`，统一 `dispatchEvent('session-expired')`
4. `onClick` 回调提升可达性（点击通知本体也弹登录框）
5. `onClose` 重置防抖锁，允许下次会话过期再次通知

**实测验证**：

| 指标 | 修复前 ❌ | 修复后 ✅ |
|---|---|---|
| 通知位置 | top-right（右上角，挡按钮） | 顶部居中（top-left + scss 覆盖） |
| 自动关闭 | `duration: 0` 永久挂起 | 8s 自动关闭 |
| 事件派发 | `request.ts` 多路径分裂（部分直接 clearAndRedirect） | 统一 `dispatchEvent('session-expired')` |
| 可达性 | 仅按钮可点 | `onClick` 回调，通知本体也可点 |
| 防抖锁复位 | 永不复位（下次会话过期通知永不出现） | `onClose` 重置，下次正常 |

### 设计意图

**会话过期通知是"非阻断式提醒"，不是"强制操作"**。改版前后对比：

| 维度 | 旧实现（ElMessageBox 模态） | 新实现（ElNotification 顶部下滑） |
|---|---|---|
| 阻断性 | 强阻断（必须关闭才能操作页面） | 非阻断（通知 8s 后自动消失，用户可继续浏览） |
| 位置 | 屏幕中央（遮挡主内容） | 顶部居中（不遮挡主内容） |
| 操作 | 仅"重新登录" | "重新登录" + "取消"（用户保留控制权） |
| 可达性 | 仅按钮可点 | 通知本体也可点 |
| 自动关闭 | 否（必须手动关） | 是（8s 后自动消失） |

**为什么不用 `top-center`？** Element Plus `ElNotification` 的 `notify.mjs:8-13` 仅声明 4 个位置 key，`top-center` 不在其中，运行时会触发 `forEach` 错误。这是 Element Plus 的实现限制，本项目通过 `top-left` + scss 覆盖绕过。

### 红线

- ❌ `position: 'top-center'`（Element Plus 限制，触发 forEach 错误）
- ❌ `duration: 0` 或 `> 15000`（永久 / 半永久挂起）
- ❌ 删除 scss `left: 50%` 居中覆盖
- ❌ `request.ts` 直接调 `ElMessageBox` / `clearAndRedirect`
- ❌ 删除 `onClick` / `onClose` 回调
- ❌ 删除"取消"按钮
- ❌ 改 `customClass` 名称
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 的 `EXPECTED_SECTIONS`（章节守门会失败）

---

## 会话过期通知按钮双层蓝边 + 中间白线视觉 bug 硬约束（2026-07-03 立）

会话过期通知内的"重新登录"按钮是用户 401 后唯一的登录入口，其**视觉边界**决定了用户能否清晰识别可点击区域。Element Plus 暗色 `.el-button--primary` 默认有 `border: 2px solid` + `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18)`，在小尺寸蓝色按钮上会形成"双层蓝边 + 中间白线"视觉错觉，**必须**在通知作用域内局部重置，否则视为回归。

### 触发文件

- `client/src/styles/_session-expired-notification.scss`（必须含局部重置规则）
- `client/src/composables/useAppLifecycle.ts`（用 `customClass: 'session-expired-notification'` 注入样式钩子）

### 根因（Element Plus 暗色 primary 按钮）

`client/src/styles/_element-plus-overrides.scss:408-435` 的 `html.dark :where(.el-button--primary)` 规则在暗色模式下强制应用：

```scss
border-width: var(--el-border-width-primary)  // = 2px
border-color: var(--el-color-primary)         // 暗色下 #409eff
box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18)
```

**原始设计意图**：补强 `#2563eb` CTA 蓝在 `#6a6d77` darkSurface 上的边界（1.001:1 → 3:1+），适用于 sidebar / 暗色卡片等"按钮与底色对比度不足"场景。

**为何不适用于 ElNotification**：

| 场景 | 底色 | 蓝按钮对比度 | inset 白环 |
|---|---|---|---|
| sidebar 浅色 ghost 按钮 | #6a6d77 | 1.001:1（不足） | **需要** |
| ElNotification 通知 | #1a1a1a（dark-bg-3） | 4.5:1（WCAG AA 已通过） | **不再需要** |

ElNotification 背景 = `--el-bg-color-overlay` = `var(--color-dark-bg-3)` = `#1a1a1a`，比 `#6a6d77` 深 64 单位（106/109/119 → 26/26/26），`#409eff` 蓝 on `#1a1a1a` 对比度 4.5:1 已达 WCAG AA 标准。但 32px 蓝底按钮 + 2px 蓝边 + inset 1px 白环三者叠加，视觉上"两层蓝边夹白线"，像是渲染 bug。

### 必须满足的规则

`_session-expired-notification.scss` 必须在 `.session-expired-notification` 作用域内（含 `.session-expired-actions` 子级）含以下规则：

```scss
.session-expired-notification {
  .session-expired-notify {
    .session-expired-actions {
      .el-button--primary {
        border-width: 0;        // 移除 2px 蓝边, 蓝色背景已提供视觉边界
        box-shadow: none;       // 移除 inset 白环, 通知背景对比度足够

        &:hover,
        &:active,
        &:focus,
        &:focus-visible {
          box-shadow: none;     // 状态切换时白环不能又出现
        }
      }

      .el-button:not(.el-button--primary) {
        box-shadow: none;       // 取消按钮 (默认 el-button) 也移除 inset 白环
      }
    }
  }
}
```

**关键约束**：

1. 重置规则**必须在** `.session-expired-notification` 作用域内（特异度 0,4,1），**不能**直接放在全局或 `_element-plus-overrides.scss` 关闭 inset 白环（会污染 sidebar 等其他需要 inset 白环的 CTA 按钮）
2. `border-width: 0` 而非 `border: 0`（保留 `border-color` 不被破坏，未来如果需要恢复"边线"提示可以加颜色）
3. hover/active/focus 状态也必须 `box-shadow: none`（Element Plus 默认 hover 会引入新阴影）

### 禁止模式

- ❌ 把 inset 白环在 `_element-plus-overrides.scss` 全局关闭（会破坏 sidebar 的 CTA 按钮边界识别）
- ❌ 只重置 `box-shadow` 不重置 `border-width: 0`（2px 蓝边依然在 32px 按钮上显得厚重）
- ❌ 重置规则放在 `.el-button--primary` 顶层（特异度 0,1,0 不够，Element Plus 的 `:where()` 规则 0,0,0 也会被更高特异度规则覆盖；但放在全局会污染其他位置）
- ❌ hover/active/focus 不重置 `box-shadow: none`（Element Plus 状态切换会重新引入 inset 白环）
- ❌ 把重置规则放到 `_session-expired-notification.scss` 之外的文件（作用域丢失，副作用扩大）

### 守门工具

#### 1. 源码级守门（CI 必跑，5 用例 × 2 视口 = 10 用例）

`client/e2e/session-expired-button-no-double-border.spec.ts` 在源码级别保证：

1. `_session-expired-notification.scss` 必须含 `.el-button--primary { border-width: 0 }` 重置
2. 必须含 `.el-button--primary { box-shadow: none }` 重置
3. hover/active/focus/focus-visible 必须也 `box-shadow: none`
4. `.el-button:not(.el-button--primary)` 也必须 `box-shadow: none`（取消按钮）
5. 重置规则必须在 `.session-expired-notification` 作用域内（特异度 ≥ 0,3,0）

```bash
npx playwright test e2e/session-expired-button-no-double-border.spec.ts --reporter=list
```

#### 2. 浏览器级守门（需 PW_BASE_URL，4 测试 × 1 视口 = 4 用例）

`client/e2e/session-expired-button-no-double-border-visual.spec.ts` 在浏览器运行时验证：

- 浅色 + Desktop Chrome：primary `borderWidth=0px` + `boxShadow=none`，取消按钮 `boxShadow=none`
- 暗色 + Desktop Chrome：同上
- 暗色 + Desktop Chrome hover 状态：`boxShadow=none`（状态切换不引入白环）
- 暗色 + Mobile Chrome (Pixel 5)：同上

```bash
cmd /c "set PW_BASE_URL=http://localhost:8888&& npx playwright test e2e/session-expired-button-no-double-border-visual.spec.ts"
```

#### 3. 章节守门

`scripts/check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS` 必须含本章节标题（13 章之一）。

### 历史 bug 复盘（2026-07-03 修复）

**症状**：用户反馈"重新登录按钮怎么有两层蓝色边呢 中间还夹着白线"。

**实测渲染**（修复前，浏览器 computed style）：

```json
{
  "borderWidth": "2px",
  "borderColor": "rgb(64, 158, 255)",  // 外层 2px 蓝边
  "boxShadow": "rgba(255, 255, 255, 0.18) 0px 0px 0px 1px inset",  // inset 1px 白环
  "backgroundColor": "rgb(64, 158, 255)"  // 蓝色背景
}
```

**根因**：

1. Element Plus 暗色 primary 按钮的 2px 蓝边（`--el-border-width-primary` 来自 `_element-plus-overrides.scss:408-435`）
2. 同规则的 `inset 1px rgba(255,255,255,0.18)` 内嵌阴影（设计意图是补强 sidebar 上 CTA 蓝的边界）
3. 两个规则在小尺寸（32px）蓝色按钮上叠加，视觉上呈现"外层蓝边 → 背景蓝 → 内侧白环 → 中心蓝"四层结构，肉眼把 inset 白环误识别为"中间夹着白线"

**修复**：在 `.session-expired-notification` 作用域内局部重置 `border-width: 0` + `box-shadow: none`，**不污染** `_element-plus-overrides.scss` 的全局规则（sidebar 等其他位置仍依赖 inset 白环补强边界）。

**实测验证**（修复后）：

| 指标 | 修复前 ❌ | 修复后 ✅ |
|---|---|---|
| 暗色 primary `border-width` | 2px | **0px** |
| 暗色 primary `box-shadow` | `inset 0 0 0 1px rgba(255,255,255,0.18)` | **none** |
| 暗色 primary `background-color` | `#409eff`（蓝） | `#409eff`（蓝，未变） |
| 暗色 hover `box-shadow` | `inset 0 0 0 1px rgba(255,255,255,0.18)` | **none** |
| 浅色 primary `box-shadow` | `none`（Element Plus 浅色默认无 inset） | **none**（未变） |
| 全局 sidebar CTA 按钮 | 正常（依赖 inset 白环） | **正常**（未污染） |

### 设计意图

**Element Plus 暗色 primary 按钮的 inset 白环是有意为之**，但它只在"按钮底色对比度不足"的场景下必要。ElNotification 背景 `#1a1a1a` 已经是"deep dark"，蓝色按钮对比度 4.5:1 自给自足，inset 白环反而成视觉噪音。

**作用域隔离原则**：CSS 重置应该贴近使用点，**不要**在全局关闭 Element Plus 的设计意图。本硬约束用 `.session-expired-notification` 作用域限制重置范围，sidebar / 暗色卡片等仍依赖 inset 白环的场景不受影响。

### 红线

- ❌ 把 inset 白环在 `_element-plus-overrides.scss` 全局关闭（破坏 sidebar CTA 按钮边界）
- ❌ 删 `_session-expired-notification.scss` 的 `.el-button--primary { border-width: 0; box-shadow: none }` 规则
- ❌ 把重置规则搬出 `.session-expired-notification` 作用域
- ❌ hover/active/focus 状态不重置 `box-shadow: none`
- ❌ 删 `e2e/session-expired-button-no-double-border.spec.ts` 或 `e2e/session-expired-button-no-double-border-visual.spec.ts`（防回归兜底失效）
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 的 `EXPECTED_SECTIONS`（章节守门会失败）

---

## Vue scoped + @use partial 规范（2026-07-03 立）

父组件的 `<style lang="scss" scoped>` 块通过 `@use 'partial' as *` 引入 SCSS partial 时，**partial 中的选择器会被加上父组件的 scope hash（如 `[data-v-f3f3558b]`）**。这会与子组件内部的 DOM 元素**永远不匹配** —— 子组件内部元素只接收子组件自己的 scope attr，**不**接收父组件的 scope attr。

### 触发场景（满足任一即中招）

1. 父组件 `<style scoped>` 块顶部 `@use '@/styles/xxx/partial' as *`
2. partial 内有针对子组件内部元素的选择器（如 `.header-right`、`.mode-tag`、`.cs-status-wrap`）
3. 父组件在 template 里用 `<ChildComponent />` 渲染该子组件
4. 子组件内部元素**永远不会**接收父组件的 scope attr

### 症状

- 改完 CSS 没报错，浏览器 DevTools 也看不到规则（`getMatchedStylesForNode` 返回 0 命中）
- `getComputedStyle` 返回的是 Element Plus / 全局默认值，不是你写的值
- 用户反馈"完全没变化"或"按钮不显示 / 边框消失 / 动画不跑"

### 修复范式

#### A. 子组件内部元素样式 → 迁回子组件自己的 `<style scoped>` 块

```scss
// ❌ 错误: _header.scss 在父 AIChat.vue @use
// 父选择器变成 .header-right[data-v-parentHash], 子组件内 .header-right 只有 [data-v-childHash]
.header-right {
  display: flex;
  gap: 8px;
}

// ✅ 正确: 迁到 chatheaderbar.vue 自己的 <style scoped> 块
// 子组件内所有元素都有 [data-v-childHash], 选择器匹配成功
.dialog-header {
  .header-right {
    display: flex;
    gap: 8px;
  }
}
```

**根元素**（如 `.dialog-header`）的样式可以保留在父 `@use` partial，因为子组件根元素**会**接收父 scope attr（Vue 3 的设计），父 scoped 选择器可以命中子组件根。

#### B. `@keyframes` 也必须随使用方走

scoped 块内的 `@keyframes name` 会被加上 scope 后缀，**只**在该 scope 内可见。引用 `animation: name` 的选择器如果在另一个 scope 加载，会找不到 keyframe。

```scss
// ❌ 错误: @keyframes typing 留在父, 子组件 scoped 内用 animation: typing
// → 子组件 scope 找不到该 keyframe

// ✅ 正确: @keyframes typing 迁到子组件的 <style scoped> 块
// 或迁到非 scoped 块（变全局）但只适用于真正全局的动画
```

#### C. 非 scoped 块（全局）的 `@use` 是另一个故事

父组件 `<style lang="scss">`（**无** scoped）的 `@use` partial 选择器不带 scope attr，可命中所有元素（含子组件内部）。**但**这违背"样式贴近使用方"的工程规范，不推荐。

`AIChat.vue` 的 `_api-access.scss` 和 `_customer-service-theme.scss` 加载在非 scoped 块，纯粹是历史原因。**新代码禁止**用非 scoped 块 + `@use` 来规避 scope 问题。

### 必跑守门

```bash
# 1. 源码级: 列出 @use 的 partial, 确认每个 partial 内的选择器都只命中父组件的"直接 DOM 元素"
#    子组件内部元素选择器（如 .header-right）必须迁回子组件 scoped
Grep "@use" client/src/components/ai/AIChat.vue

# 2. 浏览器级 CDP 审计: 打开浮窗, 用 getMatchedStylesForNode 验证关键选择器命中
node scripts/audit-ai-chat-scope.mjs

# 3. E2E 源码级守门 (24 用例, 已存在)
npx playwright test e2e/ai-header-style-scope.spec.ts --reporter=list

# 4. pre-commit 轻量级守门 (< 100ms, 已存在)
node scripts/check-ai-header-style-scope.mjs --staged
```

### 适用子组件清单（2026-07-03 审计）

| 父组件 | @use partial | 加载位置 | 子组件内部元素选择器 | 状态 |
|---|---|---|---|---|
| `AIChat.vue` | `_header.scss` | scoped | `.header-right` 等 6 个块 | ✅ 已迁回 `chatheaderbar.vue` |
| `AIChat.vue` | `_message-list.scss` | scoped | 无（仅直接 DOM 选择器） | ✅ 无需迁移 |
| `AIChat.vue` | `_input-area.scss` | scoped | 无（仅直接 DOM 选择器） | ✅ 无需迁移 |
| `AIChat.vue` | `_session-list.scss` | scoped | 无（仅直接 DOM 选择器） | ✅ 无需迁移 |
| `AIChat.vue` | `_api-access.scss` | **非 scoped** | 0（dialog 元素在 AIChat.vue 直接渲染） | ⚠️ 历史遗留, 禁止新加 |
| `AIChat.vue` | `_customer-service-theme.scss` | **非 scoped** | 5 个块（`.cs-status-*`） | ✅ 已迁回 `chatheaderbar.vue` |

### 审计方法 (新增 @use partial 时必做)

```bash
# Step 1: 列出所有 @use 引入的 partial
Grep -n "@use.*'" client/src/components/Parent.vue

# Step 2: 列出每个 partial 内的顶层选择器
Grep -n "^\." client/src/styles/xxx/_partial.scss

# Step 3: 对每个选择器, 判断它命中的是:
#   - 父组件的"直接 DOM 元素" (template 里 <div class="x">) → OK
#   - 子组件的"内部元素" (template 里 <Child />, .x 在 Child 内部) → 必须迁回 Child 的 scoped 块

# Step 4: 在浏览器里实际验证
#   用 CDP 的 CSS.getMatchedStylesForNode 拿 matched rules, 0 命中 = bug
node scripts/audit-ai-chat-scope.mjs
```

### 历史 bug 复盘（2026-07-03 发现）

**症状**：用户反馈"AI对话框最上面右上角的这几个图标挨着太近了 请你调整间距"，修改 `_header.scss` 的 `.header-right` gap 4px → 8px，**完全没效果**。

**根因**：`_header.scss` 被 `AIChat.vue` 的 `<style scoped>` 块 `@use` 引入，Vue 编译器给所有选择器加 `[data-v-f3f3558b]` 后缀。但 `.header-right` 元素在 `<ChatHeaderBar />` 子组件的 template 内，子组件内部元素只接收子组件自己的 `[data-v-xxx]` attr，**不**接收父的 `[data-v-f3f3558b]`。结果：选择器变成 `.header-right[data-v-f3f3558b]`，永远不匹配真实 DOM。

**CDP 验证**（修复前）：
```js
// CSS.getMatchedStylesForNode(.header-right) 返回 17 条规则
// 全部是 * { } / :where() / 全局 el-button 等
// 0 条 .header-right 自己的规则
```

**修复**：把 `.header-right` / `.header-left` / `.header-center` / `.mode-tag` / `.typing-indicator` / `.minimized-model-info` 6 个块从 `_header.scss` 迁到 `chatheaderbar.vue` 自己的 `<style scoped>` 块。`@keyframes typing` 一并迁移（scoped keyframes 跨组件不共享）。

**根元素 `.dialog-header` 保留在 `_header.scss`**：因为子组件根元素会接收父 scope attr，父 scoped 选择器可以命中子组件根。

**实测验证**（修复后）：
- `.header-right` gap: 4px → 8px 视觉上**生效**
- 标题栏三个按钮间距明显拉大，用户反馈 OK
- `.quick-tool-item` border-radius: 8px → 4px 视觉上**生效**
- CDP matched rules: 17 → 24 条，命中实际的 .header-right 规则

### 红线

- ❌ 在父 `<style scoped>` 块 `@use` 的 partial 内写**子组件内部元素**选择器
- ❌ 修复 scope 失配时**只在父组件里用 `:deep()` 穿透**（掩盖问题，应迁回子组件）
- ❌ 用 `<style lang="scss">`（**非** scoped）作为规避 scope 问题的"万能解"（违背样式贴近使用方原则）
- ❌ 跨组件共享 `@keyframes` 不确认 scope 兼容性（scoped keyframes 不跨组件共享）
- ❌ 改完 CSS 只看"页面没报错"就交付，**必须**用 CDP 验证 getMatchedStylesForNode 实际命中
- ❌ 新增 @use partial 时跳过"是否含子组件内部元素选择器"审计
- ❌ 删 `e2e/ai-header-style-scope.spec.ts` 或 `scripts/check-ai-header-style-scope.mjs`（防回归兜底失效）
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 的 `EXPECTED_SECTIONS`（章节守门会失败）

---

## 暗色浮层 primary 按钮双层蓝边 + 中间白线视觉 bug 硬约束（2026-07-03 立）

Element Plus 暗色 `.el-button--primary` 默认的 `border: 2px solid` + `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18)` 在 **浮层组件**（ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown）内的小尺寸蓝色按钮上叠加，会形成"双层蓝边 + 中间白线"视觉错觉。**必须**在浮层作用域内局部重置 `border-width: 0` + `box-shadow: none`，否则视为回归。

### 触发文件

- `client/src/styles/_element-plus-overrides.scss`（必须含浮层作用域排除规则，第 436-464 行）
- 浮层组件清单：ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown（共 6 类）

### 根因（与第 13 章 ElNotification 同源）

`_element-plus-overrides.scss:408-435` 的 `html.dark :where(.el-button--primary)` 规则在暗色模式下强制应用：

```scss
border-width: var(--el-border-width-primary)  // = 2px
border-color: var(--el-color-primary)         // 暗色下 #409eff
box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18)
```

**原始设计意图**：补强 `#2563eb` CTA 蓝在 `#6a6d77` darkSurface 上的边界（1.001:1 → 3:1+），适用于 sidebar / 暗色卡片等"按钮与底色对比度不足"场景。

**为何不适用于所有浮层**：

| 浮层组件 | 底色（--el-bg-color-overlay = #1a1a1a） | 蓝按钮对比度 | inset 白环 |
|---|---|---|---|
| ElMessageBox | #1a1a1a（dark-bg-3） | 4.5:1（WCAG AA 已通过） | **不需要** |
| ElNotification | #1a1a1a | 4.5:1 | **不需要** |
| ElDialog | #1a1a1a | 4.5:1 | **不需要** |
| ElMessage | #1a1a1a | 4.5:1 | **不需要** |
| ElPopper | #1a1a1a | 4.5:1 | **不需要** |
| ElDropdown | #1a1a1a | 4.5:1 | **不需要** |
| sidebar ghost 按钮 | #6a6d77 | 1.001:1（不足） | **需要**（保留） |

浮层背景 = `--el-bg-color-overlay` = `var(--color-dark-bg-3)` = `#1a1a1a`，比 `#6a6d77` 深 64 单位，`#409eff` 蓝 on `#1a1a1a` 对比度 4.5:1 已达 WCAG AA 标准。但小尺寸蓝色按钮 + 2px 蓝边 + inset 1px 白环三者叠加，视觉上"两层蓝边夹白线"，像是渲染 bug。

### 必须满足的规则

`_element-plus-overrides.scss` 必须在 `html.dark` 块内、全局 `:where(.el-button--primary)` 规则之后，含以下浮层作用域排除规则：

```scss
html.dark {
  // ... 全局 :where(.el-button--primary) 规则保留 (sidebar 等场景依赖) ...

  // 浮层内 primary 按钮: 移除 inset 白环
  :where(.el-message-box, .el-notification, .el-dialog, .el-message, .el-popper, .el-dropdown-menu) :where(.el-button--primary) {
    border-width: 0;        // 移除 2px 蓝边
    box-shadow: none;       // 移除 inset 白环

    &:hover,
    &:active,
    &:focus,
    &:focus-visible {
      box-shadow: none;     // 状态切换时白环不能又出现
    }
  }
}
```

**关键约束**：

1. **覆盖范围必须含 6 类浮层组件**：ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown，少一个都会让该类浮层继续出现"双层蓝边"
2. **必须在 `html.dark` 块内**：放到全局会让浅色模式也错误重置（浅色本就没有 inset 白环，重置无副作用但语义错误，且 Element Plus 浅色 primary 的 border-color 会被错误清零）
3. **必须在全局 `:where(.el-button--primary)` 规则之后**：CSS 级联中，相同特异性下后定义胜出。本规则特异性 = `html.dark` (0,1,1) + `:where()` (0,0,0) + `:where()` (0,0,0) = (0,1,1)，与全局规则相同，靠"后定义"胜出
4. `border-width: 0` 而非 `border: 0`（保留 `border-color` 不被破坏，未来恢复边线只需删 border-width）
5. hover/active/focus/focus-visible 状态也必须 `box-shadow: none`（Element Plus 默认 hover 会引入新阴影）

### 与第 13 章的关系

- **第 13 章**：会话过期通知（ElNotification）内的 primary 按钮局部重置 → 作用域 `.session-expired-notification`
- **第 15 章（本章节）**：所有 6 类浮层内的 primary 按钮局部重置 → 作用域 `:where(.el-message-box, .el-notification, ...)`

**两者并存**：第 13 章的 `.session-expired-notification` 作用域嵌套在 ElNotification 内，本章节的浮层作用域排除规则更宽泛（覆盖所有 ElNotification，不止 session-expired）。两者特异性相同，规则内容相同，互为冗余兜底 —— 任意一个被误删，另一个仍能保证 ElNotification 内的按钮无双层蓝边。

**历史顺序**：先有第 13 章（session-expired 单点修复），后有第 15 章（6 类浮层统一覆盖）。第 13 章保留是为了应对"用户突然只看 session-expired 的回归测试"场景，第 15 章是"对所有同类浮层问题的统一防御"。

### 禁止模式

- ❌ 在 `_element-plus-overrides.scss` 全局关闭 inset 白环（会破坏 sidebar 等其他 CTA 按钮边界）
- ❌ 浮层排除规则覆盖组件少于 6 类（漏一类会让该类浮层继续出现"双层蓝边"）
- ❌ 浮层排除规则放在 `html.dark` 块外（浅色模式也会被错误重置）
- ❌ 浮层排除规则放在全局 `:where(.el-button--primary)` 规则之前（CSS 级联会被先定义的规则覆盖）
- ❌ hover/active/focus/focus-visible 状态不重置 `box-shadow: none`（状态切换会重新引入 inset 白环）
- ❌ 只重置 `box-shadow` 不重置 `border-width: 0`（2px 蓝边依然在小按钮上显得厚重）

### 守门工具

#### 1. 源码级守门（CI 必跑，4 用例）

`client/e2e/dark-overlay-primary-button-no-double-border.spec.ts` 在源码级别保证：

1. 浮层排除规则必须覆盖 6 类浮层组件（ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown）
2. 浮层排除规则必须重置 `border-width: 0`
3. 浮层排除规则必须重置 `box-shadow: none`
4. 浮层排除规则必须在 `html.dark` 块内（不能放到全局）

```bash
npx playwright test e2e/dark-overlay-primary-button-no-double-border.spec.ts --reporter=list
```

#### 2. 浏览器级守门（需 PW_BASE_URL，5 用例）

`client/e2e/dark-overlay-primary-button-no-double-border-visual.spec.ts` 在浏览器运行时验证：

- 暗色 + ElMessageBox：primary `borderWidth=0px` + `boxShadow=none`
- 暗色 + ElDialog：同上
- 暗色 + ElNotification：同上
- 暗色 + ElPopper：同上
- 暗色 + 非浮层位置：primary **仍保留 inset 白环**（确保不污染全局 sidebar 等场景）

```bash
$env:PW_BASE_URL='http://127.0.0.1:8888'; npx playwright test e2e/dark-overlay-primary-button-no-double-border-visual.spec.ts --reporter=list --project=chromium
```

#### 3. pre-commit 轻量级守门（< 10ms）

`scripts/check-dark-overlay-primary-button-no-double-border.mjs` 在 pre-commit 阶段拦截：

- 6 类浮层组件必须全部出现在排除规则选择器中
- `border-width: 0` / `box-shadow: none` / hover/active/focus/focus-visible 状态 `box-shadow: none` 必须齐备
- 浮层排除规则必须在 `html.dark` 块内（行号顺序检查）

```bash
node scripts/check-dark-overlay-primary-button-no-double-border.mjs --staged
```

#### 4. 章节守门

`scripts/check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS` 必须含本章节标题（15 章之一）。keyword 自动派生为"暗色浮层 primary 按钮双层蓝边 + 中间白线视觉 bug 硬约束"。

### 历史 bug 复盘（2026-07-03 修复）

**症状**：用户反馈"重新登录按钮怎么有两层蓝色边呢 中间还夹着白线"（session-expired 通知内的 primary 按钮）。

**初始修复（第 13 章）**：在 `.session-expired-notification` 作用域内局部重置（commit 已提交）。但后续审计发现：

- ElMessageBox / ElDialog / ElPopper / ElMessage / ElDropdown 等**所有浮层**内的 primary 按钮都存在同样的"双层蓝边 + 中间白线"问题
- 单点修复 session-expired 不能覆盖其他 5 类浮层
- 如果未来新增一个浮层（如 ElDrawer），又得加一个局部重置规则

**本章节修复（第 15 章）**：在 `_element-plus-overrides.scss` 的 `html.dark` 块内，全局 `:where(.el-button--primary)` 规则之后追加浮层作用域排除规则，一次性覆盖 6 类浮层。

**实测验证**（修复后）：

| 浮层组件 | 修复前 ❌ | 修复后 ✅ |
|---|---|---|
| ElMessageBox primary `border-width` | 2px | **0px** |
| ElMessageBox primary `box-shadow` | inset 白环 | **none** |
| ElNotification primary `border-width` | 2px | **0px** |
| ElDialog primary `box-shadow` | inset 白环 | **none** |
| ElPopper primary `border-width` | 2px | **0px** |
| 非浮层 sidebar primary `box-shadow` | inset 白环 | **保留 inset 白环**（不污染） |

### 设计意图

**Element Plus 暗色 primary 按钮的 inset 白环是有意为之**，但它只在"按钮底色对比度不足"的场景下必要。所有 6 类浮层背景 `#1a1a1a` 已经是"deep dark"，蓝色按钮对比度 4.5:1 自给自足，inset 白环反而成视觉噪音。

**作用域隔离原则**：CSS 重置应该贴近使用点，**不要**在全局关闭 Element Plus 的设计意图。本硬约束用浮层选择器作用域限制重置范围，sidebar / 暗色卡片等仍依赖 inset 白环的场景不受影响。

### 红线

- ❌ 在 `_element-plus-overrides.scss` 全局关闭 inset 白环（破坏 sidebar CTA 按钮边界）
- ❌ 删 `_element-plus-overrides.scss` 的浮层作用域排除规则（6 类浮层"双层蓝边"回归）
- ❌ 浮层排除规则覆盖组件少于 6 类
- ❌ 把浮层排除规则搬到 `html.dark` 块外
- ❌ 把浮层排除规则搬到全局 `:where(.el-button--primary)` 规则之前
- ❌ hover/active/focus/focus-visible 状态不重置 `box-shadow: none`
- ❌ 删 `e2e/dark-overlay-primary-button-no-double-border.spec.ts` 或 `e2e/dark-overlay-primary-button-no-double-border-visual.spec.ts` 或 `scripts/check-dark-overlay-primary-button-no-double-border.mjs`（防回归兜底失效）
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 的 `EXPECTED_SECTIONS`（章节守门会失败）

---

## 暗色浮层底色统一硬约束（2026-07-03 立）

6 类浮层组件（ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown）的**暗色底色必须统一为 `#1a1a1a`**（`--color-dark-bg-3` = `--el-bg-color` = `--el-bg-color-overlay`），**禁止** hardcode 任何其他颜色（`#ffffff` / `#2a2a2a` / `white` / `black` / `rgb(...)` 等）。这是浮层内 primary 按钮对比度 4.5:1（WCAG AA）的前提，也是设计一致性的硬性要求。

### 触发文件

- `client/src/styles/_element-plus-overrides.scss`（4 类浮层组件 background-color 规则）
- `client/src/styles/_el-message-box.scss`（.el-message-box 暗色 background-color）
- `client/src/styles/_el-message-global.scss`（.el-message / .el-notification 暗色 background-color）
- `client/src/styles/_session-expired-notification.scss`（.session-expired-notification background）

### 必须满足的规则

6 类浮层组件选择器规则块内的 `background-color` / `background` 属性**必须**用 `var(--el-bg-color*)` 系列：

```scss
// ✅ 合规
:where(.el-notification) {
  background-color: var(--el-bg-color);
}
:where(html.dark) :where(.el-message) {
  background-color: var(--el-bg-color-overlay, #1a1a1a);  // 允许带 fallback
}

// ❌ 违规
:where(html.dark) :where(.el-message) {
  background-color: var(--color-dark-202228, #202228);  // 不属于 --el-bg-color* 系列
}
:where(html.dark) :where(.el-notification) {
  background-color: #1a1a1a;  // hardcode 颜色
}
```

**允许的 token**：

- `var(--el-bg-color)`（推荐，4 类浮层组件在 `_element-plus-overrides.scss` 用此 token）
- `var(--el-bg-color-overlay)`（推荐，浮层 overlay 语义）
- `var(--el-bg-color-overlay, #1a1a1a)`（允许带 fallback）
- `var(--el-bg-color, #1a1a1a)`（允许带 fallback）

**禁止的写法**：

- `#xxx` / `rgb(...)` / `rgba(...)` / `white` / `black` 等 hardcode 颜色
- `var(--color-dark-202228, ...)`（虽然暗色下被 alias 到 dark-bg-3，但破坏 token 体系一致性，应直接用 `var(--el-bg-color-overlay)`）

### 例外：`.el-popper.is-dark`（tooltip 反差设计）

`.el-popper.is-dark` 是 Element Plus 设计的反差 tooltip：

- 浅色模式下：背景 = `--el-text-color-primary`（深色文字色 = 深色 tooltip 背景）
- 暗色模式下：背景 = `--el-text-color-primary`（浅色文字色 = 浅色 tooltip 背景）

这是 Element Plus 的设计选择，**不属于"浮层底色统一"范畴**，本硬约束**不检查** `.el-popper.is-dark`。

守门只针对 `.el-popper.el-dropdown-menu__popper`（dropdown popper wrapper，背景 = `var(--el-bg-color)` = #1a1a1a）。

### 状态变体例外

`.el-notification--error` / `.el-notification--success` / `.el-notification--warning` 等状态变体允许 hardcode 语义色（如 `#281414` for error）。这些是状态语义色，不属于"浮层底色统一"范畴。

守门只检查普通浮层组件（无 `--error` / `--success` / `--warning` / `--info` 后缀）。

### 历史 bug 复盘（2026-07-03 修复）

**症状**：`_el-message-global.scss` 中 `.el-message` 和 `.el-notification` 暗色模式下的 `background-color` 用了 `var(--color-dark-202228, #202228)`。

**根因**：
- `--color-dark-202228` 在 `_global-tokens.scss:370` 浅色定义为 `#202228`（偏蓝紫深色）
- `dark-mode-override.scss:85` 暗色下 alias 到 `var(--color-dark-bg-3, #1a1a1a)` = #1a1a1a
- 暗色下实际渲染确实是 #1a1a1a（alias 生效），所以视觉上无 bug
- 但是这种"用 alias token 而不是直接用 `var(--el-bg-color*)`"的写法破坏了 token 体系一致性，未来如果有人删除了 `dark-mode-override.scss:85` 的 alias 规则，会回退到 `#202228`（fallback），形成隐性回归

**修复**：把 `var(--color-dark-202228, #202228)` 改为 `var(--el-bg-color-overlay, #1a1a1a)`，统一 token 体系。

**实测验证**（修复后）：

| 文件 | 选择器 | 修复前 ❌ | 修复后 ✅ |
|---|---|---|---|
| `_el-message-global.scss:313` | `:where(html.dark) :where(.el-message)` | `var(--color-dark-202228, #202228)` | `var(--el-bg-color-overlay, #1a1a1a)` |
| `_el-message-global.scss:569` | `:where(html.dark) :where(.el-notification)` | `var(--color-dark-202228, #202228)` | `var(--el-bg-color-overlay, #1a1a1a)` |

### 守门工具

#### 1. 源码级守门（CI 必跑，5 用例）

`client/e2e/dark-overlay-bg-color-unified.spec.ts` 在源码级别保证：

1. `_element-plus-overrides.scss` 中浮层组件 background-color 必须用 `var(--el-bg-color*)`
2. `_el-message-box.scss` 中 `.el-message-box` background-color 必须用 `var(--el-bg-color*)`
3. `_el-message-global.scss` 中 `.el-message` background-color 必须用 `var(--el-bg-color*)`
4. `_session-expired-notification.scss` 中 `.el-notification` background 必须用 `var(--el-bg-color*)`
5. 4 个文件 × 6 类浮层组件规则块内禁止 hardcode 颜色

```bash
npx playwright test e2e/dark-overlay-bg-color-unified.spec.ts --reporter=list
```

#### 2. 浏览器级守门（需 PW_BASE_URL，6 用例）

`client/e2e/dark-overlay-bg-color-unified-visual.spec.ts` 在浏览器运行时验证：

- 暗色 + ElMessageBox：`backgroundColor = rgb(26, 26, 26)`（#1a1a1a）
- 暗色 + ElNotification：同上
- 暗色 + ElDialog：同上
- 暗色 + ElMessage：同上
- 暗色 + ElPopper.el-dropdown-menu__popper：同上
- 暗色 + ElDropdownMenu：同上

```bash
$env:PW_BASE_URL='http://127.0.0.1:8888'; npx playwright test e2e/dark-overlay-bg-color-unified-visual.spec.ts --reporter=list --project=chromium
```

#### 3. pre-commit 轻量级守门（< 10ms）

`scripts/check-dark-overlay-bg-color-unified.mjs` 在 pre-commit 阶段拦截：

- 4 个文件 × 6 类浮层组件规则块内禁止 hardcode 颜色
- 检测正则：`background:/background-color:` 后跟 `#xxx` / `rgb` / `white` / `black` 等

```bash
node scripts/check-dark-overlay-bg-color-unified.mjs --staged
```

#### 4. 章节守门

`scripts/check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS` 必须含本章节标题（17 章之一）。keyword 自动派生为"暗色浮层底色统一硬约束"。

### 与第 15 章的关系

- **第 15 章**：浮层内 primary 按钮**移除 inset 白环**（浮层底色已深，不需要补强）
- **第 17 章（本章节）**：浮层底色**统一为 #1a1a1a**（保证 WCAG AA 对比度 4.5:1）

**互为前提**：第 17 章保证浮层底色深 (#1a1a1a)，第 15 章基于此移除 inset 白环（因为对比度已够）。如果浮层底色变浅（如 #2a2a2a），蓝按钮对比度 < 4.5:1，第 15 章的"移除白环"反而会让按钮边界识别困难。

### 红线

- ❌ 在浮层组件规则块内 hardcode 颜色（`#xxx` / `rgb(...)` / `white` / `black` 等）
- ❌ 用 `var(--color-dark-202228, ...)` 等 alias token 代替 `var(--el-bg-color*)`（破坏 token 体系一致性）
- ❌ 删 `dark-mode-override.scss:85` 的 `--color-dark-202228: var(--color-dark-bg-3, #1a1a1a)` alias 规则（已修复后的源码不再依赖此 alias，但保留作为兼容）
- ❌ 删 `e2e/dark-overlay-bg-color-unified.spec.ts` 或 `e2e/dark-overlay-bg-color-unified-visual.spec.ts` 或 `scripts/check-dark-overlay-bg-color-unified.mjs`（防回归兜底失效）
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 的 `EXPECTED_SECTIONS`（章节守门会失败）

---

## 圆角统一硬约束（2026-07-03 立）

### 设计意图

项目"黑-白-蓝"极简设计语言要求**圆角风格全站一致**。彻底圆角/胶囊形（pill / capsule）会破坏设计一致性，让 UI 显得"廉价"（用户反馈原话："圆角太大了 跟项目不统一"）。本硬约束规定**全项目圆角单一来源**：`var(--global-border-radius)` (8px)。

### 圆角 token 体系（单一来源）

| 用途 | Token | 解析值 |
|---|---|---|
| 全站容器/卡片 | `var(--global-border-radius)` | 8px |
| 按钮 | `var(--app-button-radius)` | = `var(--global-border-radius)` = 8px |
| 浮窗 | `var(--fcd-radius-lg)` | 15px（仅浮窗专用） |
| 头像/纯装饰圆点 | `border-radius: 50%` | 几何圆形（白名单） |

**SCSS 变量源头**：`_global-tokens.scss` 中 `$global-border-radius: 8px;` 是全站唯一数字源头，所有 token 引用必须最终解析到它。

### 禁止模式

❌ 以下写法**全部禁止**：

```scss
// 胶囊形 / 彻底圆角
border-radius: 14px;   // ❌ 胶囊形
border-radius: 16px;   // ❌ 胶囊形
border-radius: 20px;   // ❌ 胶囊形
border-radius: 999px;  // ❌ 胶囊形
border-radius: 9999px; // ❌ 胶囊形

// 已移除的违规 token
border-radius: var(--app-button-radius-pill); // ❌ token 已删除, 不允许恢复
```

### 推荐模式

✅ 以下写法**合规**：

```scss
// 容器/卡片
border-radius: var(--global-border-radius);

// 按钮
border-radius: var(--app-button-radius);

// 浮窗
border-radius: var(--fcd-radius-lg);

// 头像/纯装饰圆点（白名单）
border-radius: 50%;
```

### 例外白名单

仅以下场景允许使用 `border-radius: 50%`（几何圆形，非胶囊）：

1. **头像** `.avatar` / `.user-avatar` / `.agent-avatar` 等
2. **纯装饰圆点** `.recording-dot` / `.waveform-bar` / `.status-dot` 等
3. **Loader / spinner** 等纯几何圆形元素

**不允许**：按钮、卡片、输入框、徽章（badge）、tag、标签等 UI 元素使用 50% 圆角。

### 守门工具（三层防回归）

#### 第一层：pre-commit 守门

`scripts/check-no-pill-radius.mjs` 在 `.husky/pre-commit` 第 7 步执行：

- 扫描暂存 `.vue` / `.scss` / `.css` 文件
- 检测正则：`border-radius:\s*(1[4-9]|[2-9]\d|999|9999)px`（排除 50% 与注释行）
- 阈值 `NO_PILL_RADIUS_THRESHOLD=0`：暂存文件中不允许任何胶囊形圆角
- 性能 < 100ms（pre-commit 友好）

手动执行：

```bash
# 检查暂存文件
npm run check:no-pill-radius:staged

# 检查整个 src 目录
npm run check:no-pill-radius
```

#### 第二层：CI 集成

`.github/workflows/ci.yml` 的 `style-audit` job 中新增 step：

```yaml
- name: Check no pill/capsule border-radius
  run: NO_PILL_RADIUS_THRESHOLD=0 node scripts/check-no-pill-radius.mjs --all
```

PR 阶段全量扫描 `src`，违规会阻断合并。

#### 第三层：E2E 源码 + 渲染守门

`e2e/tw-selector-radius.spec.ts`（11 用例，chromium + Mobile Chrome 双跑）：

- **A-G2 源码级守门**（7 用例 × 2 浏览器 = 14）：验证 `.tw-selector-pill` 圆角 token + `--app-button-radius` 解析链 + `$global-border-radius=8px` + 不能含 14px 旧值
- **F1/F2 渲染级守门**（2 用例 × 2 浏览器 = 4）：dev server 启动时验证 `getComputedStyle.borderRadius = 8px`（浅色/暗色），未启动时自动 skip

### 已修复文件清单（2026-07-03）

| 文件 | 违规数 | 修复 |
|---|---|---|
| `styles/ai-chat/_input-area.scss` `.tw-selector-pill` | 1 处 14px | → `var(--app-button-radius)` |
| `components/ai/AIChat.vue` scoped 覆盖块 | 1 处 14px | → `var(--app-button-radius)` |
| `styles/_global-tokens.scss` | 1 处 `--app-button-radius-pill: 14px` | token 删除 |
| `styles/_open-platform.scss` | 31 处 14/16/20/999/9999px | → `var(--global-border-radius)` |
| `views/AiWorldBannerDetail.vue` | 2 处 9999px | → `var(--global-border-radius)` |
| `components/edu/WrongBookSummary.vue` | 2 处 999px | → `var(--global-border-radius)` |

### 红线

- ❌ 在 `.vue` / `.scss` / `.css` 文件中使用 `border-radius: 14px` / `16px` / `20px` / `999px` / `9999px`
- ❌ 恢复已删除的 `--app-button-radius-pill` token
- ❌ 在 `_global-tokens.scss` 之外定义新的圆角 token
- ❌ 用 `border-radius: 50%` 写按钮/卡片/徽章（仅头像/纯装饰圆点允许）
- ❌ 删除 `scripts/check-no-pill-radius.mjs` 或注释掉 `.husky/pre-commit` 中的调用
- ❌ 删除 `e2e/tw-selector-radius.spec.ts`（防回归兜底失效）
- ❌ 在 CI 的 `style-audit` job 中移除 pill-radius 检查 step
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 的 `EXPECTED_SECTIONS`（章节守门会失败）

---

## 侧边栏尺寸永久锁定 v11 硬约束（2026-07-04 立）

**v11 永久锁定值**（用户口头强制要求"永久固定这个尺寸 不允许修改了 除非我强制要求"）：

| 文件 | 常量 / token | 锁定值 |
|---|---|---|
| `client/src/composables/useSidebar.ts` | `MIN_WIDTH` | **60** |
| `client/src/composables/useSidebar.ts` | `MAX_WIDTH` | **116** |
| `client/src/composables/useSidebar.ts` | `DEFAULT_WIDTH` | **116** |
| `client/src/composables/useSidebar.ts` | `COLLAPSE_THRESHOLD` | **60** |
| `client/src/composables/useSidebar.ts` | `CURRENT_CONFIG_VERSION` | **11** |
| `client/src/styles/_sidebar-layout.scss` | `--sidebar-width` | **116px** |
| `client/src/styles/_sidebar-layout.scss` | `--sidebar-min-width` | **60px** |
| `client/src/styles/_sidebar-layout.scss` | `--sidebar-max-width` | **116px** |
| `client/src/styles/_sidebar-layout.scss` | `--sidebar-collapsed-width` | **60px** |

### 设计动机

2026-07-04 用户在 1 小时内连续迭代 `100 → 120 → 110 → 116` 共 4 次，每次都出现"改 `useSidebar.ts` 忘改 `_sidebar-layout.scss`"或反之的错位。v11 (60-116) 是"4 字中文 label 完整显示 + 5 字截断 + 比 120 紧凑 4px"的甜蜜点：

- 比 120 窄 4px → 更紧凑
- 比 110 宽 6px → 4 字 label 全部不截断
- 文字区 = 116 - 8 (margin) - 20 (padding) = **88px**，恰好能容纳 4 字中文 + 图标 + 间距

### 三层守门

#### 第一层：pre-commit 轻量级守门

`scripts/check-sidebar-config.mjs` 在 `.husky/pre-commit` 第 6 步执行：

- 触发文件：`useSidebar.ts` / `useSidebar.test.ts` / `_sidebar-layout.scss` / `Sidebar.vue` 任一在 staged 时启动
- 检查 8 个锁定值（4 useSidebar 常量 + 4 scss token）必须同时匹配
- 性能 < 50ms（pre-commit 友好）

手动执行：

```bash
# 检查暂存文件
npm run check:sidebar:config:staged

# 检查整个 src 目录
npm run check:sidebar:config
```

#### 第二层：CI 集成

`.github/workflows/ci.yml` 的 `style-audit` job 中新增 step：

```yaml
- name: Check sidebar size locked at v11 (60-116)
  run: node scripts/check-sidebar-config.mjs --all
```

#### 第三层：E2E 源码 + 渲染守门

`e2e/sidebar-width-v11.spec.ts`（12 用例，chromium）：

- **A1-A4 源码级**（4 用例）：`useSidebar.ts` 4 个常量精确匹配
- **B1-B4 源码级**（4 用例）：`_sidebar-layout.scss` 4 个 token 精确匹配
- **C 源码级**（1 用例）：`CURRENT_CONFIG_VERSION = 11`
- **D 源码级**（1 用例）：`Sidebar.vue` 拖拽注释含 v11 且不含 v8/v9/v10
- **E 浏览器渲染级**（1 用例）：dev server 启动时 `getBoundingClientRect.width = 116px`，未起时自动 skip
- **F 浏览器渲染级**（1 用例）：12 个 nav-item label 文字 `scrollWidth <= clientWidth`（0 截断）
- **G 源码级反向**（3 用例）：`useSidebar.ts` 注释禁止残留 v8=100 / v9=120 / v10=110 旧值

### 解除锁定流程（仅用户口头强制要求时）

```bash
# 1. 同步修改两个文件的 EXPECTED 锚定值
#    - scripts/check-sidebar-config.mjs: const EXPECTED = { ... }
#    - e2e/sidebar-width-v11.spec.ts: const EXPECTED = { ... }
# 2. CURRENT_CONFIG_VERSION +1（v11 → v12），触发 localStorage 迁移
# 3. 跑全套验证
npm run check:sidebar:config
npx playwright test e2e/sidebar-width-v11.spec.ts
# 4. 提交时附"unlock: sidebar size"前缀，在 PR 描述中说明改动原因
```

### 红线

- ❌ 改 `useSidebar.ts` 的 `MIN_WIDTH` / `MAX_WIDTH` / `DEFAULT_WIDTH` / `COLLAPSE_THRESHOLD` 任意一个
- ❌ 改 `_sidebar-layout.scss` 的 `--sidebar-width` / `--sidebar-min-width` / `--sidebar-max-width` / `--sidebar-collapsed-width` 任意一个
- ❌ 降低 `CURRENT_CONFIG_VERSION`（会破坏现有用户 v11 持久化数据）
- ❌ 删除 `scripts/check-sidebar-config.mjs` 或注释掉 `.husky/pre-commit` 中的调用
- ❌ 删除 `e2e/sidebar-width-v11.spec.ts`（防回归兜底失效）
- ❌ 在 CI 的 `style-audit` job 中移除 sidebar-config 检查 step
- ❌ 在 PR 中"无说明地"修改这两个文件的 `EXPECTED` 锚定值（必须附"unlock: sidebar size"前缀）
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` 和 `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS`（章节守门会失败）
- ❌ 改完后不跑 `npm run check:sidebar:config` + `npx playwright test e2e/sidebar-width-v11.spec.ts` 验证就提交

---

## 暗色模式按钮/标签/消息文字反色硬约束（2026-07-04 立）

**根因（用户反馈原文）**："button 这种按钮在暗色模式下背景色为浅色时没有自动切换文字色为深色，项目中还有很多很多类似这样的情况。"

全项目（Web + 后续 miniapp）必须从根本解决"暗色模式浅色背景 + 深色/浅色文字不可见"问题，建立全局**双 token 反色体系**。

### 设计原则

| 模式 | 背景 | 文字 | 反色关系 |
|---|---|---|---|
| 浅色 | EP 默认浅色（亮绿/亮黄/亮红/亮灰） | 深字 | ✅ 可读 |
| 暗色（修复前） | EP 仍为亮色（亮绿/亮黄/亮红/亮灰） | 浅字 | ❌ 1.7-2.5:1 不可见 |
| 暗色（修复后） | 深饱和版本（深绿/深琥珀/深红/深灰） | 浅字 | ✅ 4.5:1+ 通过 |

**关键洞察**：浅色背景下深字可读，暗色背景下浅字可读。所以"文字色 token" 永定（不随 light/dark 切换），只把 EP `--el-color-*` 在暗色下重映射为**深饱和版本**。

### 锚定 token 体系

`client/src/styles/_global-tokens.scss` `:root` 中新增 4 对永定 token：

```scss
--app-text-on-success: #ffffff;   /* 深绿底白字，5.5:1 WCAG AA */
--app-text-on-warning: #fde68a;   /* 深琥珀底浅黄，4.85:1（黄底用纯白仅 1.7:1 失败）*/
--app-text-on-danger:  #ffffff;   /* 深红底白字，5.9:1 WCAG AA */
--app-text-on-info:    #ffffff;   /* 深灰底白字，5.1:1 WCAG AA */
```

### 暗色 EP 主题色重映射（_dark-mode-global.scss）

`html.dark` 块内显式重映射 4 个 EP 主题色为深饱和版本（Tailwind 700 级）：

| EP token | 暗色值 | 文字 token | 对比度 | 用途 |
|---|---|---|---|---|
| `--el-color-success` | `#15803d` | `--app-text-on-success` | 5.5:1 | 成功态按钮 / tag / alert / message |
| `--el-color-warning` | `#b45309` | `--app-text-on-warning` | 4.85:1 | 警告态按钮 / tag / alert / message |
| `--el-color-danger` | `#b91c1c` | `--app-text-on-danger` | 5.9:1 | 危险态按钮 / tag / alert / message |
| `--el-color-info` | `#4b5563` | `--app-text-on-info` | 5.1:1 | 信息态按钮 / tag / alert / message |

### 按钮 4 类独立规则（_element-plus-overrides.scss）

2026-07-04 把 success/warning/danger/info 从 default 统一选择器**拆出**，每类独立 `background-color: var(--el-color-{type})` + `color: var(--app-text-on-{type})`。

**禁止**：把 4 类彩色按钮合并到 `:where(.el-button--default)` 共用选择器（共用会因 4 类背景色不同而冲突）。

### el-tag 暗色反色（_element-plus-overrides.scss `html.dark` 块）

5 类 tag（success/warning/danger/info/primary）在 `html.dark` 块中加浅色字 + 深色 alpha 背景：

| tag type | 暗色 color | 暗色 background-color |
|---|---|---|
| `.el-tag--success` | `#bbf7d0`（浅绿）| `rgba(21,128,61,0.18)` |
| `.el-tag--warning` | `#fde68a`（浅黄）| `rgba(180,83,9,0.20)` |
| `.el-tag--danger` | `#fecaca`（浅红）| `rgba(185,28,28,0.18)` |
| `.el-tag--info` | `#d1d5db`（浅灰）| `rgba(75,85,99,0.20)` |
| `.el-tag--primary` | `#93c5fd`（浅蓝）| `rgba(37,99,235,0.18)` |

### el-alert 暗色反色（_element-plus-overrides.scss `html.dark` 块）

4 类 alert（success/warning/info/error）每类覆盖 `background-color` + `color` + `__title` + `__description` + `__icon` 5 个子元素。

### el-message / el-notification 暗色

- `_el-message-global.scss` 已有 4 类覆盖（Part 6 + 7）— 复用即可
- `_el-message-global.scss` 末尾的 `.el-message--primary` 兜底保持

### 三层守门

#### 第一层：pre-commit 轻量级守门

`scripts/check-button-text-contrast.mjs` 在 `.husky/pre-commit` 第 8 步执行（紧跟 primary-button-contrast 之后）：

- 触发文件：`_dark-mode-global.scss` / `_element-plus-overrides.scss` / `_global-tokens.scss` 任一在 staged 时启动
- 检查 4 类 EP `--el-color-*` 暗色映射禁止值（EP 默认亮色 / `--el-bg-color*` / 深色 hex）
- 检查 4 类按钮 color 必须严格等于 `var(--app-text-on-*)`
- 检查 5 类 el-tag + 4 类 el-alert 暗色反色覆盖存在
- 检查 4 个 `--app-text-on-*` token 必须 = 永定值
- 性能 < 200ms

```bash
# 暂存文件
npm run check:button-text-contrast:staged

# 全量
npm run check:button-text-contrast
```

#### 第二层：CI 集成

`.github/workflows/ci.yml` 的 `style-audit` job 中新增 step（紧跟 primary-button-contrast 之后）：

```yaml
- name: 跑按钮/标签/消息暗色文字反色守门 (16 用例, 不需浏览器, 早失败)
  run: cd client && npx playwright test e2e/button-text-contrast.spec.ts --reporter=list
```

#### 第三层：E2E 源码 + 浏览器级守门

`e2e/button-text-contrast.spec.ts`（16 用例，chromium）：

- **A1-A4 源码级**（4 用例）：`_dark-mode-global.scss` 暗色 4 个 EP `--el-color-*` 精确匹配深饱和版本
- **B1-B4 源码级**（4 用例）：4 类彩色按钮 color 必须用 `--app-text-on-*`
- **C1-C5 源码级**（5 用例）：5 类 el-tag 暗色反色覆盖存在 + 颜色非深色
- **D1-D4 源码级**（4 用例）：4 类 el-alert 暗色反色覆盖存在
- **E1-E4 源码级**（4 用例）：4 个 `--app-text-on-*` token 永定值精确匹配
- **F1-F4 浏览器渲染级**（4 用例）：dev server 启动时注入测试按钮，验证 `getComputedStyle` 计算对比度 ≥ 4.5

### 红线

- ❌ 改 `_dark-mode-global.scss` 暗色 `--el-color-{success,warning,danger,info}` 回 EP 默认亮色（`#67c23a`/`#e6a23c`/`#f56c6c`/`#909399`）
- ❌ 改 `_dark-mode-global.scss` 暗色 `--el-color-{success,warning,danger,info}` 引用 `var(--el-bg-color*)` / `var(--el-text-color-*)` / 深色 hex
- ❌ 改 4 类按钮 color 为硬编码白色（`#fff` / `white` / `var(--el-color-white)`） — 必须用 `var(--app-text-on-*)` token
- ❌ 改 4 类按钮 color 为 `var(--el-bg-color*)` / `var(--el-text-color-*)` / 深色 hex（与深饱和背景撞色）
- ❌ 把 4 类彩色按钮合并到 `:where(.el-button--default)` 共用选择器
- ❌ 改 `_global-tokens.scss` 的 `--app-text-on-{success,warning,danger,info}` token 引用 `var(--el-bg-color*)` 等深色变量
- ❌ 删除 `html.dark` 块中 5 类 el-tag 浅色字反色覆盖
- ❌ 删除 `html.dark` 块中 4 类 el-alert 暗色反色覆盖
- ❌ 删除 `scripts/check-button-text-contrast.mjs` 或注释掉 `.husky/pre-commit` 中的调用
- ❌ 删除 `e2e/button-text-contrast.spec.ts`（防回归兜底失效）
- ❌ 在 CI 的 `style-audit` job 中移除 button-text-contrast 检查 step
- ❌ 改完后不跑 `npm run check:button-text-contrast` + `npx playwright test e2e/button-text-contrast.spec.ts` 验证就提交

### 同步更新清单（改色时必须同步）

| 改动点 | 必同步 |
|---|---|
| `--el-color-{success,warning,danger,info}` 暗色值 | `scripts/check-button-text-contrast.mjs` `EXPECTED_DARK` + `e2e/button-text-contrast.spec.ts` `EXPECTED_DARK` + 本章节表格 |
| `--app-text-on-{success,warning,danger,info}` token 值 | 同上 + 4 类按钮 color + 5 类 tag color 验证 |
| 4 类按钮 color token 名 | 必保留 `var(--app-text-on-*)` 命名（守门正则严格匹配） |
| 5 类 tag 暗色 color/background-color | 守门断言深色字列表 (`#15803d`/`#b45309`/`#b91c1c` 等) 需同步更新 |

### 延伸场景（待评估，本批次未涵盖）

- `el-link` 暗色 link 颜色（已用 `--el-color-primary` 但 hover 浅蓝可能不可见）
- `el-button--text` / `--plain` / `--ghost` 暗色覆盖（无背景，按钮文字 = `--el-text-color-primary` 暗色下已浅，可读）
- miniapp 端按钮（计划下一批次）
- `.text-success` / `.text-warning` / `.text-danger` 等状态文本 class 散落各处（低优先级）

---

## Git Hook 同步硬约束（2026-07-04 立）

**根因（2026-07-04 发现）**：

`simple-git-hooks@2.13.1` v2 系列存在 monorepo 设计缺陷：`_getHooksDirPath(projectRoot)` 用 `projectRoot`（即 `process.cwd()`）而非 `gitRoot` 推导 hooks 目录。在本项目（`g:\IHUI-AI\client\package.json` 位于 monorepo 子目录）执行 `npx simple-git-hooks` 时，钩子被写到 `g:\IHUI-AI\client\.git\hooks\pre-commit`（错位死代码），而 git 真正查找的 `g:\IHUI-AI\.git\hooks\pre-commit` 永远不会被 simple-git-hooks 触碰。结果：所有 pre-commit / pre-push 守门只在 CI 跑，本地提交拦截失效。

**解决方案（手工维护 + 守门）**：

放弃依赖 `simple-git-hooks` 自动同步，改用「手工 `g:\IHUI-AI\.git\hooks\pre-commit` + `client/.husky/pre-commit` 镜像 + 守门脚本」三层架构。

### 三层架构

| 层 | 文件 | 状态 | 作用 |
|---|---|---|---|
| 1. Git 真正查找 | `g:\IHUI-AI\.git\hooks\pre-commit` | **不入版本库**（.git 不受 git 管理）| git 触发时实际执行 |
| 2. 项目级源 | `g:\IHUI-AI\.husky\pre-commit` | 入版本库 | 14 项检查的「事实单一来源」 |
| 3. 守门脚本 | `client/scripts/check-pre-commit-hook-content.mjs` | 入版本库 | pre-commit 阶段断言「第 1 层 = 第 2 层」同步 |

### 必须满足的规则

1. **`g:\IHUI-AI\.git\hooks\pre-commit` 必须与 `g:\IHUI-AI\.husky\pre-commit` 内容一致**

   守门脚本 `client/scripts/check-pre-commit-hook-content.mjs` 在 pre-commit 阶段运行 `diff` 校验。任何对 `.husky/pre-commit` 的修改必须同步执行 `cp .husky/pre-commit .git/hooks/pre-commit`（或 `cmd /c copy /Y` Windows 等价命令）。

2. **simple-git-hooks 配置中所有命令必须以 `cd client && ` 开头**

   `client/package.json` `simple-git-hooks` 块中 pre-commit / pre-push 命令不能直接 `npm run ...` 或 `node scripts/...`，必须先 `cd client`（项目根无 package.json / node_modules）。即使第 1 层改为手工维护，simple-git-hooks 配置仍可能因 `npm install` 触发 prepare 脚本并把错位 hook 写到 `client/.git/hooks/`，命令本身的 `cd` 前缀是兜底。

3. **`.husky/pre-commit` 必须包含 14 项 check 调用**

   按顺序：lint-staged / no-important / nul / markraw-staged / high-specificity-staged / i18n:keys / agents-md / becomesupplier:join-us:staged / sidebar:dark-tier:staged / ai-header:style-scope:staged / ai-customer-service-status:staged / session-expired-button:no-double-border:staged / dark-overlay-primary-button:no-double-border:staged / dark-overlay-bg-color-unified:staged

   新增检查项必须同步更新本章节 + `client/scripts/check-pre-commit-hook-content.mjs` `EXPECTED_CHECKS` + e2e 守门测试。

4. **`.husky/pre-push` 必须用 `check:el-token` 替代不存在的 `check:tokens`**

   `client/package.json` 中没有 `check:tokens` 脚本（npm 提示的最相似脚本是 `check:el-token`）。所有 hook 脚本必须使用存在的 npm script，否则 pre-push 因 `set -e` 立即失败。

5. **`g:\IHUI-AI\client\.git\` 必须不存在**

   该目录是 simple-git-hooks v2 bug 制造的副作用（错位 hook 写入位置）。每 30 天跑一次 `find . -name '.git' -type d -not -path './.git/*' -not -path './.git'` 清理，或在 pre-commit 守门里加 `if [ -d client/.git ]` 检查并自动清理。

### 守门工具

#### 1. 守门脚本（pre-commit 阶段必跑）

`client/scripts/check-pre-commit-hook-content.mjs`：
- 读取 `g:\IHUI-AI\.git\hooks\pre-commit` 内容
- 与 `g:\IHUI-AI\.husky\pre-commit` 做 `diff`
- 校验 14 项 check 调用都存在
- 退出码 0 通过，1 不通过

#### 2. 同步操作 SOP

修改 `.husky/pre-commit` 后必须执行：
```powershell
# Windows
cmd /c copy /Y "g:\IHUI-AI\.husky\pre-commit" "g:\IHUI-AI\.git\hooks\pre-commit"

# Linux/macOS
cp .husky/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

#### 3. CI 兜底

`client/e2e/pre-commit-hook-sync.spec.ts`（计划下一批次新增）：
- 读取 `g:\IHUI-AI\.git\hooks\pre-commit`（开发机 CI 环境可能没有 .git/hooks/pre-commit，需 fallback 跳过）
- 校验关键 14 项调用都在
- 校验 0 个 simple-git-hooks 残留 wrapper 标记

### 禁止模式

- ❌ 修改 `client/package.json` `simple-git-hooks` 配置后不验证 `cd client &&` 前缀（pre-commit 会因找不到 npm script 失败）
- ❌ 修改 `.husky/pre-commit` 后不同步到 `.git/hooks/pre-commit`（守门会失败，开发者误以为是检查脚本问题）
- ❌ 在 `.git/hooks/pre-commit` 直接修改而不修改 `.husky/pre-commit`（下次重装或换机器时丢失修改）
- ❌ 用 `husky install` / `husky add` 命令（Husky v9 在本项目尚未启用，混用会污染 `core.hooksPath`）
- ❌ 删除 `client/scripts/check-pre-commit-hook-content.mjs`（防回归兜底失效）
- ❌ 改完后不跑 `npm run check:agents-md --silent` 验证章节计数就提交（章节守门会失败）
- ❌ 引入新 check 脚本（如 `check:xxx:staged`）后不更新本章节 EXPECTED_CHECKS 列表（pre-commit 14 项守门漏检）

### 延伸场景（待评估，本批次未涵盖）

- 迁移至 Husky v9（用 `core.hooksPath` 替代手工同步，已评估为「需要 `npm install husky --save-dev` 改写 `prepare` 脚本，影响面较大，列为 v2 长期方案」）
- simple-git-hooks v3 发布后评估（v3 修复了 `_getHooksDirPath` bug，届时可回退到自动同步）
- GitHub Actions / GitLab CI 上的 `core.hooksPath` 自动化（远端环境无 `.git/hooks/`，依赖 CI workflow 的对应 job step）

---

## 前端样式改动后 Agent 自验硬约束（2026-07-04 立）

**根因（用户原话 2026-07-04）**："以后你不能让我自己去硬刷新 而且全部处理好保证前端页面显示为更改后的样式才停下来"。

Vite HMR 偶发不刷新 scoped CSS（特别是 `<style scoped>` 块），浏览器 DevTools 看到的仍是旧 CSS。本硬约束规定：**任何对前端样式的修改，Agent 必须自己在浏览器里跑一遍端到端自验，强制让用户看到更新后的样式才算交付完成**。**绝对不能让用户自己去硬刷新**（`Ctrl+Shift+R` / `Cmd+Shift+R`）。

### 触发条件（满足任一即必须自验）

1. 修改任何 `.vue` / `.scss` / `.css` / `.sass` / `.less` 文件中的样式规则（color / padding / margin / border / font-size / display / flex / grid 等）
2. 改 Element Plus 主题色 / 暗色模式 token / CSS 变量
3. 改 `<style scoped>` 块（含 `@use` partial 引入的子组件内部选择器）
4. 改全局 `_global-tokens.scss` / `_element-plus-overrides.scss` / `_dark-mode-global.scss` 等会影响多个组件的样式表
5. 改 `index.html` / `vite.config.ts` 的 CSS 相关配置
6. 改 i18n 文字后视觉布局发生变化（新增/删除文字、变长变短）

### 必须满足的流程（缺一不可）

#### Step 1: 改完后**立即**调用 MCP 浏览器工具强制刷新页面

```ts
// 通过 browser_navigate 加 cache buster 强制刷新 (推荐, 不需要清磁盘缓存)
browser_navigate({ url: 'http://127.0.0.1:8888/?reload=' + Date.now() })
```

**禁止**只调用 `browser_snapshot`（snapshot 不触发 reload，DOM 拿到的还是旧数据）。

#### Step 2: 等待页面 hydration 完成后, 用 `browser_evaluate` 验证计算样式

```ts
browser_evaluate({
  script: `JSON.stringify({
    el: !!document.querySelector('.target-class'),
    paddingBottom: getComputedStyle(document.querySelector('.target-class')).paddingBottom,
    color: getComputedStyle(document.querySelector('.target-class')).color,
  })`
})
```

返回的 `paddingBottom` / `color` 等必须是新值, 不是旧值. 如果 `el === false` 表明选择器写错或 DOM 还未挂载, 需重试.

#### Step 3: 调用 `browser_take_screenshot` 视觉确认

```ts
browser_take_screenshot({ name: 'after-fix-verify' })
```

截图必须**视觉对比**改动是否生效（间距/颜色/边框/对齐/截断等）, 不仅"页面没报错就交付".

#### Step 4: 必要时验证 dev server 返回的 CSS 包含新值

```bash
# 拉一次 dev server 的 CSS 资源, grep 确认新值/旧值
curl.exe -s "http://127.0.0.1:8888/src/components/SidebarChatHistory.vue?vue&type=style&index=0&scoped=true&lang.scss" -o $tmp
# 旧值出现次数 = 0, 新值出现次数 = 1
```

如果 dev server 仍返回旧值, 说明 Vite 没监听文件变化, 需要触发文件 touch / 重启 dev server / 检查 vite.config.ts 的 `server.watch` 配置.

#### Step 5: 在交付报告里附 ① + ② + ③ 证据

- ① `browser_evaluate` 的 JSON 输出（getComputedStyle 值）
- ② `browser_take_screenshot` 截图（视觉确认）
- ③ （可选）dev server 返回 CSS 的 grep 结果

**没有这 3 项证据, 视为"未完成交付"**。

### 为什么 HMR 偶发不刷新 scoped CSS

Vite + Vue 3 scoped CSS 链路:
- 文件保存 → Vite watcher 触发 HMR
- Vite 增量更新 CSSOM, **不** 重新拉 `.vue` 文件的 query string 资源
- 浏览器**可能**缓存了上一次 query string 的 CSS, 导致 `getComputedStyle` 仍是旧值
- 触发现象: 用户反馈"完全没变化"、"改了和没改一样"、"硬刷新才行"

**根因**: Vite 5.x 对 `<style scoped>` 的 HMR 边界 case 还在迭代, 特别是 `@use` partial + scoped 跨文件的场景.

**绕开方案**: 在 URL 上加 `?reload=<timestamp>` 让 Vite 重新发整个 `.vue` 资源, 浏览器拿到的 CSS 就是新的. 这是 Step 1 推荐方案.

### 常见陷阱（Agent 必看）

| 陷阱 | 症状 | 修复 |
|---|---|---|
| 只改 `.vue` 模板没改 style | 用户看不到视觉变化 | 改模板必须改对应 CSS, 不能用 `<div style="...">` 内联凑数 |
| 改 `:where(...)` 选择器没改 unlayered scoped | 全局规则优先级被压, 改完没效果 | 改完用 `getMatchedStylesForNode` 验证规则命中 |
| 改 scoped 选择器但子组件用了 `:deep()` 穿透 | 父改了子不变, 或反之 | 改完用 `getComputedStyle` 验证**真实渲染的子元素** |
| Vite watcher 失效（WSL/网络盘） | 文件保存了但 dev server 没收到 | `touch` 文件 / 重启 dev server / 用 `chokidar` polling 模式 |
| 改完没验证就 commit | 用户报告"看不到效果"再回滚 | 跑 Step 1-5, 没截图不交付 |
| 截图截图时没等动画/过渡结束 | 看到的是中间帧不是终态 | `setTimeout(1000)` 等动画结束再截图 |

### 守门工具

#### 1. 源码级守门 (pre-commit 阶段, < 50ms)

`client/scripts/check-frontend-verify.mjs`:
- 检查 AGENTS.md 含本章节 + 必含 7 个关键词 (`browser_navigate` / `browser_take_screenshot` / `Ctrl+Shift+R` / `scss` / `scss` / `computed` / 章节标题 slug)
- 检查章节正文含"不能让用户硬刷新"否定语义
- 退出码 1 = 章节被删/关键词漏检

```bash
node scripts/check-frontend-verify.mjs          # 全量
node scripts/check-frontend-verify.mjs --staged # 仅 staged
```

#### 2. 章节守门 (与第 N 章并行, 防章节被删)

`scripts/check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS` 必须含本章节标题.

#### 3. 自动化自验脚本 (推荐用于 e2e / CI 流程)

`scripts/verify-frontend-change.mjs` (本批次未实现, 列为 v2 长期方案):
- 接受 `--file=<path>` 参数
- 读取修改的 CSS 文件
- 自动用 `playwright` 打开页面 + 截图 + 验证关键选择器的 `getComputedStyle`
- 失败时输出 diff (旧值 vs 新值), 退出码 1

### 历史 bug 复盘（2026-07-04 立）

**症状**: 用户 2026-07-04 反馈"改完样式没变化, 我自己硬刷新才生效".

**根因**:
1. Vite 5.x HMR 对 scoped CSS 偶发不触发完整 reload
2. 浏览器 CSSOM 缓存了上次 query string 的 CSS
3. Agent 没有自验就交付, 用户被迫硬刷新

**修复**:
1. Agent 改完样式后**必须**用 `browser_navigate('?reload=<ts>')` 强制刷新
2. 用 `browser_evaluate` 验证 `getComputedStyle` 拿到新值
3. 用 `browser_take_screenshot` 视觉确认
4. 在交付报告里附 3 项证据

**绝对不能**让用户自己去硬刷新. 这是用户体验红线, 违反一次 = 整体流程重做.

### 红线

- ❌ 改完样式后**只**调 `browser_snapshot` 不调 `browser_navigate` (snapshot 不触发 reload)
- ❌ 改完样式后**只**在终端里 `curl` 验证 CSS 包含新值, 不到浏览器里跑
- ❌ 改完样式后**只**截图, 没用 `getComputedStyle` 验证计算样式
- ❌ 改完样式后**没等**页面 hydration 完成就截图 (看到的是旧值)
- ❌ 在交付报告里写"已修改" 但**没附** 截图 / evaluate 输出 / dev server CSS grep
- ❌ 让用户自己去 `Ctrl+Shift+R` 硬刷新 (用户原话: "以后你不能让我自己去硬刷新")
- ❌ 用 `<div style="...">` 内联样式凑数绕过 scoped CSS 链路问题 (掩盖 bug, 不修复)
- ❌ 把"Agent 自验"流程写在 prompt 里但不执行 (口头承诺不交付)
- ❌ 删 `client/scripts/check-frontend-verify.mjs` (防回归兜底失效)
- ❌ 删本章节前不更新 `check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS` (章节守门会失败)


---

## /edu 教育中心路由名一致性硬约束（2026-07-04 立）

**根因（2026-07-04 Phase C 完成）**：/edu 教育中心模块包含 32 个 Edu* 路由名，主侧边栏 Sidebar.vue 通过 nameMap + prefixMap 双映射机制让 /edu/* 子路由跳转后 eduCenter 顶级菜单项保持 active 高亮。若新增/删除 edu 路由时忘记同步更新 Sidebar.vue nameMap，会导致子路由跳转后侧边栏高亮丢失（用户反馈"侧边栏不亮了"）。

### 锁定清单（32 个 Edu* 路由名）

`scripts/check-edu-route-consistency.mjs` 的 `EXPECTED_EDU_ROUTE_NAMES` 锁定 32 个路由名：
- EduHome / EduLearn / EduLearnDetail / EduLearnChapter / EduLearnCertificate
- EduExam / EduExamPaper / EduExamRecord / EduExamWrongBook
- EduAsk / EduAskDetail / EduAskCreate
- EduCircle / EduCircleDetail / EduCirclePost
- EduLive / EduLiveRoom
- EduMember / EduMemberReport / EduMemberNotes / EduMemberOfflineRecords / EduMemberCertUpload / EduMemberPapers / EduMemberPaperUpload
- EduPoint / EduOrder / EduOrderDetail / EduMessage / EduNotification / EduResource / EduSearch / EduAdminHome

### 必须满足的规则

1. **`client/src/router/modules/edu.ts` 中所有路由 name 必须以 `Edu` 前缀开头**（命名规范）
2. **路由名数量必须恰好 32 个**（防止误删/误增）
3. **Sidebar.vue nameMap 必须包含全部 32 个 Edu* → 'eduCenter' 映射**
4. **Sidebar.vue prefixMap 必须包含 `['/edu/', 'eduCenter']` + `['/edu', 'eduCenter']`**（放最前优先匹配）
5. **Sidebar.vue navGroups 必须包含 `key='eduCenter'` + `path='/edu'` 顶级菜单项**，label 引用 `t('navigation.eduCenter')`

### 守门工具（三层防回归）

#### 第一层：pre-commit 源码级守门

`scripts/check-edu-route-consistency.mjs` 在 `.husky/pre-commit` 执行：

- 8 项检查：edu.ts 路由名 Edu 前缀 + 数量=32 + 集合匹配 + Sidebar.vue nameMap 32 映射 + prefixMap 2 条目 + navGroups eduCenter 项 + label i18n 引用
- 性能 < 50ms（pre-commit 友好）
- `--staged` 模式：仅当 edu.ts 或 Sidebar.vue 在 staged 时才检查

```bash
npm run check:edu:route-consistency          # 全量
npm run check:edu:route-consistency:staged   # 仅 staged
```

#### 第二层：CI 集成

`.github/workflows/ci.yml` 的 `playwright-e2e` job 中新增 step（PR 阶段全量扫描）：

```yaml
- name: 跑 /edu 教育中心路由名一致性源码级守门 (8 项检查, 不需浏览器, 早失败)
  run: cd client && npm run check:edu:route-consistency
```

#### 第三层：E2E 浏览器级守门

`e2e/edu-sidebar.spec.ts`（29 用例 × 2 浏览器 = 58 测试，chromium + Mobile Chrome 双跑）：
- A: 主侧边栏 eduCenter 菜单项存在 + label 正确
- B: 点击 eduCenter 跳转到 /edu + active 高亮
- C: /edu 页面渲染内部 el-aside 侧边栏 + 11 个 el-menu-item
- D: 11 个模块菜单项 label 正确
- E: 10 个子路由跳转后 eduCenter 保持 active
- F: 内部侧边栏点击跳转验证

### 红线

- ❌ 在 `edu.ts` 中添加不以 `Edu` 前缀开头的路由名
- ❌ 新增/删除 edu 路由时不同步更新 `EXPECTED_EDU_ROUTE_NAMES` + Sidebar.vue nameMap
- ❌ 删除 Sidebar.vue prefixMap 中的 `['/edu/', 'eduCenter']` 或 `['/edu', 'eduCenter']` 条目
- ❌ 删除 Sidebar.vue navGroups 中的 `eduCenter` 顶级菜单项
- ❌ 删除 `scripts/check-edu-route-consistency.mjs` 或注释掉 `.husky/pre-commit` 中的调用
- ❌ 删除 `e2e/edu-sidebar.spec.ts`（防回归兜底失效）
- ❌ 在 CI 的 `playwright-e2e` job 中移除 edu-route-consistency 检查 step
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS`（章节守门会失败）

---

## 纯 CSS style 块 // 行注释硬约束（2026-07-04 立）

**根因（2026-07-04 发现）**：批量颜色对比度修复时，12 个文件的纯 CSS `<style scoped>` 块（无 `lang="scss"`）内误用 `// 2026-07-04 修复: ...` 行注释。纯 CSS 只支持 `/* */` 注释，不支持 SCSS 的 `//` 行注释。PostCSS 解析失败（`CssSyntaxError: Unknown word`），Vite build 阻断。

**关键教训**：`npm run typecheck`（vue-tsc）**不会**捕获此错误，只有 `npm run build`（Vite + PostCSS）会报错。因此 typecheck 通过 ≠ build 通过。

### 禁止模式

```vue
<style scoped>
.btn {
  color: var(--app-button-text-on-primary); // ❌ 纯 CSS 不支持 // 注释
}
</style>
```

### 推荐模式

```vue
<style scoped>
.btn {
  color: var(--app-button-text-on-primary); /* ✅ 纯 CSS 用 /* */ 注释 */
}
</style>
```

或为 `<style>` 标签添加 `lang="scss"`（SCSS 支持 `//` 注释）：

```vue
<style scoped lang="scss">
.btn {
  color: var(--app-button-text-on-primary); // ✅ SCSS 支持 // 注释
}
</style>
```

### 守门工具（两层防回归）

#### 第一层：pre-commit 源码级守门

`scripts/check-no-css-line-comments.mjs` 在 `.husky/pre-commit` 执行：

- 扫描 .vue 文件中所有 `<style>` 块
- 若块无 `lang="scss"`（纯 CSS），检测块内 `//` 行注释
- 排除 URL 协议（`http://` / `https://`）
- 性能 ~200ms（711 文件扫描）
- `--staged` 模式：仅扫描 staged .vue 文件

```bash
npm run check:no-css-line-comments          # 全量
npm run check:no-css-line-comments:staged   # 仅 staged
```

#### 第二层：CI 集成

`.github/workflows/ci.yml` 的 `playwright-e2e` job 中新增 step（PR 阶段全量扫描）：

```yaml
- name: 跑纯 CSS style 块 // 行注释守门 (711 文件扫描, 不需浏览器, 早失败)
  run: cd client && npm run check:no-css-line-comments
```

### 已修复文件清单（2026-07-04，12 个文件）

| 文件 | 违规数 | style 块类型 |
|---|---|---|
| `views/AskList.vue` | 1 | `<style scoped>` |
| `views/AskDetail.vue` | 2 | `<style scoped>` |
| `views/CircleDetail.vue` | 1 | `<style scoped>` |
| `views/CircleList.vue` | 2 | `<style scoped>` |
| `views/ExamList.vue` | 2 | `<style scoped>` |
| `views/ExamDo.vue` | 1 | `<style scoped>` |
| `views/PointCenter.vue` | 3 | `<style scoped>` |
| `views/Ranking.vue` | 2 | `<style scoped>` |
| `views/Search.vue` | 1 | `<style scoped>` |
| `views/MessageCenter.vue` | 1 | `<style scoped>` |
| `components/PdfToolsPanel.vue` | 2 | `<style scoped>` |
| `components/ThemeToggle.vue` | 1 | `<style>` (非 scoped) |

### 红线

- ❌ 在纯 CSS `<style>` / `<style scoped>` 块（无 `lang="scss"`）内使用 `//` 行注释
- ❌ 批量颜色修复时用脚本/搜索替换注入 `//` 注释而不区分 style 块 lang 属性
- ❌ 删除 `scripts/check-no-css-line-comments.mjs` 或注释掉 `.husky/pre-commit` 中的调用
- ❌ 在 CI 的 `playwright-e2e` job 中移除 no-css-line-comments 检查 step
- ❌ 删章节前不更新 `check-agents-md-sections.mjs` + `e2e/agents-md-sections.spec.ts` 的 `EXPECTED_SECTIONS`（章节守门会失败）





---

## Cursor 规则完整整合（单一事实来源 · 已并入本文件）
> 以下章节为原 `client/.cursorrules` 全局主规则与 `client/.cursor/rules/` 下全部 23 个 `.mdc` 模块的**完整正文整合**。
> 由本文件统一托管后，AI 只需读取本文件即可获得全部规范；原始 Cursor 文件保留为 Cursor 编辑器副本，但本文件为权威版。
> 本章节内部标题已整体降级，不引入新的顶级 `## ` 章节，以保持下方章节守门脚本（check-agents-md-sections）的 25 章节契约不变。

### 一、全局主规则（原 `client/.cursorrules`）
You are an intelligent programming assistant.
ALWAYS respond in Simplified Chinese (简体中文).

#### 开发服务器管理规则

**自动启动开发服务器：**
- 当用户要求"打开页面"、"启动"、"运行"或类似请求时，**立即自动启动开发服务器**，不要询问用户是否要启动
- 使用 `npm run dev` 或项目配置的启动命令在后台启动开发服务器
- 不要询问"是否需要启动服务器"、"服务器是否在运行"等问题
- 直接执行启动操作，然后告知用户服务器已启动

**检查服务器状态：**
- 如果需要检查服务器是否运行，静默检查，不要询问用户
- 如果服务器未运行，直接启动；如果已运行，继续后续操作

**页面打开：**
- 启动服务器后，自动在浏览器中打开相关页面（如果可能）
- 提供正确的本地 URL（通常是 http://localhost:端口号 或 http://127.0.0.1:端口号）

#### 扁平化设计规范（强制遵守）

**本项目采用扁平化设计，严格禁止以下视觉效果：**

1. **文本投影（Text Shadow）**
   - ❌ **绝对禁止**使用 `text-shadow` 属性
   - ✅ 使用高对比度颜色确保文本可读性
   - ✅ 通过调整字体粗细和颜色来增强视觉层次
   - 全局样式已强制移除所有文本投影，任何新增代码不得添加

2. **盒阴影（Box Shadow）**
   - ❌ 禁止使用 `box-shadow` 创建深度效果
   - ✅ 使用边框（border）来分隔元素
   - ✅ 使用背景色变化来区分状态

3. **代码生成规则：**
   - 生成任何 CSS/SCSS 代码时，**永远不要添加 `text-shadow`**
   - 生成任何 CSS/SCSS 代码时，**永远不要添加不必要的 `box-shadow`**
   - 使用边框而非阴影来分隔元素
   - 使用颜色对比而非阴影来创建层次

**检查清单（生成代码后必须验证）：**
- [ ] 没有使用 `text-shadow`
- [ ] 没有使用不必要的 `box-shadow`
- [ ] 使用边框而非阴影来分隔元素
- [ ] 颜色对比度符合可访问性标准

#### CSS 优先级规范（强制遵守）

**硬性规定：不允许使用 `!important`，不允许使用高特异性选择器。** 违反会导致后续修改、调整、维护时样式难以覆盖，修改不生效。

1. **禁止 `!important`**
   - ❌ 任何 CSS/SCSS 中**不得**使用 `!important`
   - ✅ 需要覆盖时：用更具体但**单一职责**的类名、或调整样式加载顺序、或使用 CSS Layer 控制优先级
   - ✅ 覆盖第三方/组件库：在全局样式中用**一层**类名包裹（如 `.page-container .el-input`），避免长链与多重类名堆叠

2. **禁止高特异性选择器**
   - ❌ **不得**通过「堆叠类名」提高特异性（如 `.foo.foo`、`.a .b .c .d` 长链）
   - ❌ **不得**为覆盖而写 `html.dark body .page .section .component` 等长链（应用 `:where()` 包裹前缀以降特异性）
   - ✅ 单条选择器尽量保持「一个类或 1～2 层关系」（如 `.block__element`、`.parent .child`）
   - ✅ 需要覆盖时：用 `:where()` 降低上游特异性，或使用 CSS Layer 把「基础样式」放在低优先级层

3. **推荐做法**
   - 组件内：使用 BEM 或单一类名，不写 `!important`，不写超过 2 层深度的选择器
   - 全局覆盖：用 CSS 变量统一颜色/尺寸，或单独一个「覆盖层」文件，用 Layer 控制顺序
   - 第三方覆盖：尽量只改 CSS 变量；若必须改类，用 `.wrapper .third-party-class` 一层包裹即可

**检查清单（写样式后必须自检）：**
- [ ] 没有使用 `!important`
- [ ] 没有 `.class.class` 或超过 2 层深度的长链选择器
- [ ] 覆盖样式优先用变量或 Layer，而非加更多类名/更长的选择器

### 二、模块化规则全集（原 `client/.cursor/rules/*.mdc` · 共 23 条）
> 每条规则标注其「作用域」：匹配文件（globs）与是否常驻生效（alwaysApply）。
> `alwaysApply: true` 表示对所有文件全局常驻；`false` 表示仅在匹配到对应文件类型时生效。

#### 规则文件：`api-development.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/api/**/*.ts", "**/services/**/*.ts"]` · 说明：API 接口开发自动规则

### API 开发规则

当编辑 API 相关文件时，我会自动遵循以下规则：

#### API 函数结构（强制）

```typescript
import request from '@/utils/request'

// 1. 类型定义
interface GetUserListParams {
  page?: number
  pageSize?: number
  keyword?: string
}

interface User {
  id: number
  name: string
  email: string
}

interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// 2. API 函数
/**
 * 获取用户列表
 * @param params 查询参数
 * @returns 分页用户数据
 */
export const getUserList = (params?: GetUserListParams) => {
  return request<PaginatedResponse<User>>({
    url: '/api/users',
    method: 'GET',
    params,
  })
}

/**
 * 创建用户
 * @param data 用户数据
 * @returns 创建的用户
 */
export const createUser = (data: Omit<User, 'id'>) => {
  return request<User>({
    url: '/api/users',
    method: 'POST',
    data,
  })
}
```

#### 自动执行

1. **类型定义** - 为所有 API 添加请求/响应类型
2. **JSDoc 注释** - 添加函数说明、参数说明、返回值说明
3. **错误处理** - 确保使用统一的 request 封装
4. **命名规范** - get/create/update/delete + 资源名

#### RESTful 规范

| 操作 | 方法 | 路径 | 函数名 |
|------|------|------|--------|
| 查询列表 | GET | /api/users | getUserList |
| 查询详情 | GET | /api/users/:id | getUserById |
| 创建 | POST | /api/users | createUser |
| 更新 | PUT | /api/users/:id | updateUser |
| 删除 | DELETE | /api/users/:id | deleteUser |

#### 规则文件：`auto-lint-fix.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.ts", "**/*.tsx", "**/*.vue", "**/*.js", "**/*.jsx"]` · 说明：自动 Lint 检查修复规则

### 自动 Lint 检查修复规则

**每次修改代码文件后，我必须自动检查并修复 linter 错误。**

#### 自动执行流程

```
修改文件 → ReadLints 检查 → 发现错误 → 自动修复 → 再次检查 → 循环直到无错误
```

#### 检查步骤

##### 1. 使用 ReadLints 工具
```
每次修改 .ts/.tsx/.vue/.js/.jsx 文件后
立即调用 ReadLints 工具检查该文件
```

##### 2. 错误分类处理

| 错误类型 | 处理方式 |
|----------|----------|
| TypeScript 类型错误 | 修复类型定义 |
| ESLint 规则违反 | 按规则修复代码 |
| 未使用的变量 | 删除或添加使用 |
| 缺少导入 | 添加导入语句 |
| 格式错误 | 修复格式 |

##### 3. 常见错误自动修复

```typescript
// ❌ 错误：'xxx' is defined but never used
const unused = 'value' // 删除此行

// ❌ 错误：Type 'string' is not assignable to type 'number'
const num: number = '123' // 修复类型

// ❌ 错误：Cannot find module 'xxx'
// 添加导入语句
import xxx from 'xxx'

// ❌ 错误：Expected 2 arguments, but got 1
fn(a) // 添加缺失参数
fn(a, undefined)

// ❌ 错误：Object is possibly 'undefined'
obj.prop // 添加可选链
obj?.prop
```

##### 4. 修复后重新检查

```
修复完成后必须再次运行 ReadLints
确保所有错误都已修复
如果还有错误，继续修复
```

#### 禁止行为

- ❌ **禁止**修改代码后不检查 linter
- ❌ **禁止**忽略 linter 错误
- ❌ **禁止**让用户自己修复 linter 错误
- ❌ **禁止**在有 linter 错误的情况下说"完成"

#### 自动执行声明

**我承诺在每次修改代码后自动运行 ReadLints 检查，发现错误自动修复，直到文件无 linter 错误。**

#### 规则文件：`auto-verify-fix.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：自动测试验证修复规则（核心规则）

### 自动测试验证修复规则

**这是核心规则，我在每次代码修改后必须自动执行。**

#### 核心原则

**每次修改代码后，我必须自己验证修改是否生效，发现问题必须自动修复，直到完全解决后才告知用户。**

#### 强制工作流程

```
修改代码 → 检查 Linter → Playwright 验证 → 发现问题 → 自动修复 → 再次验证 → 循环直到成功 → 告知用户
```

##### 第一步：修改代码
- 根据用户需求修改代码

##### 第二步：检查 Linter 错误
```bash
### 使用 ReadLints 工具检查修改的文件
### 如果有 linter 错误，立即修复
```

##### 第三步：Playwright 验证

```javascript
// 1. 打开浏览器访问页面
browser_navigate({ url: 'http://localhost:5173/目标路径' })

// 2. 等待页面加载
browser_wait({ time: 2 })

// 3. 获取页面快照
browser_snapshot()

// 4. 验证样式修改
const styles = await page.locator('.target-element').evaluate(el => {
  const computed = window.getComputedStyle(el)
  return {
    backgroundColor: computed.backgroundColor,
    color: computed.color,
    // 其他需要验证的属性
  }
})

// 5. 验证功能修改
await page.click('.button')
// 检查预期结果

// 6. 截图记录
browser_screenshot()
```

##### 第四步：问题修复循环

```
如果验证失败:
  1. 分析失败原因（HMR 问题？缓存？代码错误？）
  2. 自动修复问题
  3. 返回第二步重新验证
  4. 重复直到成功
```

##### 第五步：确认成功后告知用户

只有在以下条件全部满足后才能告知用户：
- ✅ Linter 无错误
- ✅ Playwright 验证通过
- ✅ 功能符合预期
- ✅ 截图确认效果

#### 特别注意场景

以下场景 HMR 可能不会正确更新，需要特别处理：

| 场景 | 处理方式 |
|------|----------|
| CSS/样式修改 | 可能需要硬刷新验证 |
| `:global()` 选择器 | 检查样式是否生效 |
| Teleport 组件样式 | 验证目标位置样式 |
| SCSS 复杂嵌套 | 检查编译结果 |
| 环境变量修改 | 需要重启服务器 |
| 配置文件修改 | 需要重启服务器 |

#### 严格禁止

- ❌ **禁止**修改代码后直接告诉用户"刷新页面查看效果"
- ❌ **禁止**让用户当测试人员
- ❌ **禁止**假设"代码修改 = 生效"
- ❌ **禁止**在没有验证前就说"已完成修改"
- ❌ **禁止**让用户自己测试或验证
- ❌ **禁止**给用户布置验证任务
- ❌ **禁止**发现问题后询问"是否需要继续修复"，必须自动修复
- ❌ **禁止**中途停下来询问用户，发现问题就要彻底解决

#### 验证类型

##### 1. 样式验证
```javascript
// 获取计算样式
const style = await page.locator('.element').evaluate(el => {
  const s = window.getComputedStyle(el)
  return {
    display: s.display,
    color: s.color,
    backgroundColor: s.backgroundColor,
    fontSize: s.fontSize,
    padding: s.padding,
    margin: s.margin,
  }
})
// 对比期望值
```

##### 2. 功能验证
```javascript
// 点击按钮
await page.click('.submit-btn')

// 等待响应
await page.waitForSelector('.success-message')

// 验证结果
const text = await page.textContent('.result')
expect(text).toContain('预期文本')
```

##### 3. 表单验证
```javascript
// 填写表单
await page.fill('input[name="username"]', 'testuser')
await page.fill('input[name="password"]', 'password123')
await page.click('button[type="submit"]')

// 验证提交结果
await page.waitForNavigation()
```

##### 4. API 验证
```javascript
// 监听网络请求
const response = await page.waitForResponse('/api/endpoint')
const data = await response.json()
expect(data.code).toBe(200)
```

#### 错误处理

当验证失败时，按以下顺序排查：

1. **检查控制台错误** - `browser_console` 查看错误日志
2. **检查网络请求** - 确认 API 是否正常
3. **检查元素存在** - 确认 DOM 结构正确
4. **检查样式计算** - 确认 CSS 生效
5. **HMR 问题** - 尝试硬刷新
6. **缓存问题** - 清理缓存重试

#### 自动执行声明

**我承诺在每次代码修改后自动执行以上验证流程，绝不跳过验证步骤，发现问题自动修复直到完全解决。**

#### 规则文件：`browser-testing.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：Cursor 内置浏览器自动测试规则

### Cursor 内置浏览器自动测试规则

**修改前端代码后，必须使用 Cursor 内置浏览器（cursor-ide-browser MCP）自动验证效果。**

#### 重要：禁止使用外部浏览器

- ❌ **禁止** 打开外部 Chrome/Firefox/Edge 等浏览器进行测试
- ❌ **禁止** 让用户手动打开浏览器查看效果
- ✅ **必须** 使用 Cursor 内置浏览器 (cursor-ide-browser MCP)
- ✅ **必须** 自动验证修改效果，不通过不告知用户完成

#### MCP 浏览器工具使用

##### 正确的工作流程（必须遵守）

```
1. browser_navigate → 打开页面
2. browser_lock → 锁定浏览器（如果需要交互）
3. browser_snapshot → 获取页面结构和元素引用
4. 交互操作（click/fill/hover 等）
5. browser_snapshot → 验证结果
6. browser_unlock → 解锁浏览器（完成所有操作后）
```

##### 关键规则

1. **browser_lock 必须在 browser_navigate 之后** - 不能在没有页面的情况下锁定
2. **browser_snapshot 必须在任何交互之前** - 获取元素引用
3. **browser_unlock 必须在完成所有操作后** - 释放浏览器控制
4. **短时等待策略** - 使用 1-3 秒的短等待，配合 snapshot 检查，而不是一次长等待

##### 1. 导航到页面

```javascript
// 打开目标页面
browser_navigate({ url: 'http://localhost:5173/path' })
```

##### 2. 锁定浏览器（交互前）

```javascript
// 锁定浏览器以进行交互
browser_lock()
```

##### 3. 获取页面快照

```javascript
// 获取当前页面结构和元素引用
browser_snapshot()
```

##### 4. 等待页面加载

```javascript
// 短时等待（推荐 1-3 秒）
browser_wait({ time: 2 })

// 然后用 snapshot 检查是否就绪
browser_snapshot()
```

##### 5. 交互操作

```javascript
// 点击元素（使用 snapshot 中的 ref）
browser_click({ ref: 'element-ref' })

// 输入文本（append 模式）
browser_type({ ref: 'input-ref', text: 'test text' })

// 清空并输入（replace 模式）
browser_fill({ ref: 'input-ref', value: 'new value' })

// 悬停
browser_hover({ ref: 'element-ref' })

// 滚动
browser_scroll({ ref: 'element-ref', scrollIntoView: true })
```

##### 6. 截图验证

```javascript
// 截取页面截图
browser_screenshot()
```

##### 7. 检查控制台

```javascript
// 检查控制台错误
browser_console()
```

##### 8. 解锁浏览器（完成后）

```javascript
// 完成所有操作后解锁
browser_unlock()
```

#### 验证流程

##### UI/样式修改验证

```
1. browser_navigate → 打开页面
2. browser_wait({ time: 2 }) → 等待加载
3. browser_snapshot → 查看元素
4. browser_screenshot → 截图确认
5. 对比期望效果
6. 不符合 → 修改代码 → 重新验证
```

##### 交互功能验证

```
1. browser_navigate → 打开页面
2. browser_lock → 锁定浏览器
3. browser_snapshot → 获取元素引用
4. browser_click/fill → 执行交互
5. browser_wait({ time: 1 }) → 短暂等待
6. browser_snapshot → 检查结果
7. browser_console → 检查错误
8. browser_unlock → 解锁浏览器
9. 不符合 → 修改代码 → 重新验证
```

##### 表单提交验证

```
1. browser_navigate → 打开表单页面
2. browser_lock → 锁定浏览器
3. browser_snapshot → 获取表单元素
4. browser_fill → 填写表单字段
5. browser_click → 点击提交
6. browser_wait({ time: 2 }) → 等待提交结果
7. browser_snapshot → 验证成功/失败提示
8. browser_unlock → 解锁浏览器
9. 不符合 → 修改代码 → 重新验证
```

#### 常见验证场景

##### 样式验证

```javascript
// 通过截图验证样式
browser_navigate({ url: 'http://localhost:5173/target-page' })
browser_wait({ time: 2 })
browser_screenshot()

// 通过 snapshot 查看元素属性
browser_snapshot()
// 检查元素是否有正确的 class
```

##### 显示/隐藏验证

```javascript
// 锁定浏览器
browser_lock()

// 获取元素引用
browser_snapshot()

// 执行操作
browser_click({ ref: 'toggle-button' })

// 等待动画
browser_wait({ time: 0.5 })

// 检查元素是否显示/隐藏
browser_snapshot()

// 完成后解锁
browser_unlock()
```

##### 路由跳转验证

```javascript
// 锁定浏览器
browser_lock()

// 获取链接引用
browser_snapshot()

// 点击链接
browser_click({ ref: 'nav-link' })

// 等待跳转
browser_wait({ time: 1 })

// 验证 URL 和页面内容
browser_snapshot()

// 完成后解锁
browser_unlock()
```

##### 错误处理验证

```javascript
// 锁定浏览器
browser_lock()

// 获取按钮引用
browser_snapshot()

// 触发错误场景
browser_click({ ref: 'submit-button' })

// 等待错误提示
browser_wait({ time: 1 })

// 检查错误提示
browser_snapshot()

// 完成后解锁
browser_unlock()
```

#### 验证检查清单

每次前端代码修改后，确认以下内容：

- [ ] 使用 Cursor 内置浏览器（cursor-ide-browser MCP）
- [ ] 页面无 JS 错误（browser_console）
- [ ] 元素正确渲染（browser_snapshot）
- [ ] 样式符合预期（browser_screenshot）
- [ ] 交互功能正常（browser_click/fill）
- [ ] 响应式布局正确（可选）

#### 自动执行声明

**我承诺在每次修改前端代码后：**
1. **只使用 Cursor 内置浏览器进行测试，不打开外部浏览器**
2. **自动验证修改效果，不通过不告知用户完成**
3. **遵循正确的 lock/unlock 工作流程**

#### 规则文件：`code-review.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：代码审查自动规则

### 代码审查规则

在编写或修改代码时，我会自动进行代码审查：

#### 审查维度（自动检查）

##### 1. 代码质量

- **命名规范** - 变量/函数/类名是否清晰有意义
- **代码结构** - 是否遵循单一职责原则
- **重复代码** - 是否有可以抽取的重复逻辑
- **注释完整** - 关键逻辑是否有注释

##### 2. 类型安全

- **显式类型** - 是否有 any 类型需要替换
- **空值处理** - 是否正确处理 null/undefined
- **类型收窄** - 是否使用类型守卫

##### 3. 性能考虑

- **避免重渲染** - Vue 组件是否正确使用 computed
- **内存泄漏** - 是否清理定时器/事件监听
- **大数据处理** - 列表是否使用虚拟滚动

##### 4. 安全性

- **XSS 防护** - 是否安全使用 v-html
- **敏感信息** - 是否暴露密钥或密码
- **输入验证** - 用户输入是否经过验证

##### 5. 可维护性

- **代码可读** - 逻辑是否容易理解
- **错误处理** - 是否有完善的错误处理
- **边界条件** - 是否考虑边界情况

#### 自动执行流程

每次代码修改后，我会自动：

1. **静态检查** - 检查 linter 错误
2. **类型检查** - 确保类型正确
3. **逻辑审查** - 检查潜在问题
4. **优化建议** - 提供改进建议
5. **安全扫描** - 检查安全隐患

#### 问题等级

| 等级 | 标识 | 说明 |
|------|------|------|
| 必须修复 | 🔴 | 严重问题，必须修复后才能提交 |
| 建议修复 | 🟡 | 潜在问题，建议修复 |
| 可选优化 | 🟢 | 优化建议，可以考虑 |

#### 审查输出格式

```
#### 代码审查结果

##### 🔴 必须修复
1. [文件:行号] 问题描述
   建议：修复方案

##### 🟡 建议修复
1. [文件:行号] 问题描述
   建议：修复方案

##### 🟢 优化建议
1. [文件:行号] 优化点
   建议：优化方案

##### ✅ 优点
- 代码中做得好的地方
```

#### 规则文件：`composables.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/composables/**/*.ts", "**/hooks/**/*.ts"]` · 说明：Composables 开发自动规则

### Composables 开发规则

当编辑组合式函数文件时，我会自动遵循以下规则：

#### Composable 结构（强制）

```typescript
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Ref, MaybeRef } from 'vue'

/**
 * useXxx - 功能描述
 * @param options 配置选项
 * @returns 返回值说明
 * @example
 * ```ts
 * const { data, loading, execute } = useXxx({ immediate: true })
 * ```
 */
export function useXxx(options: UseXxxOptions = {}) {
  // ============ 配置解构 ============
  const {
    immediate = true,
    onSuccess,
    onError,
  } = options

  // ============ 响应式状态 ============
  const data = ref<DataType | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // ============ 计算属性 ============
  const isReady = computed(() => data.value !== null && !loading.value)
  const hasError = computed(() => error.value !== null)

  // ============ 核心方法 ============
  const execute = async () => {
    loading.value = true
    error.value = null
    
    try {
      const result = await fetchData()
      data.value = result
      onSuccess?.(result)
      return result
    } catch (e) {
      const err = e as Error
      error.value = err
      onError?.(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    data.value = null
    loading.value = false
    error.value = null
  }

  // ============ 生命周期 ============
  onMounted(() => {
    if (immediate) {
      execute()
    }
  })

  onUnmounted(() => {
    // 清理逻辑（取消请求、清除定时器等）
  })

  // ============ 返回 ============
  return {
    // 状态
    data,
    loading,
    error,
    // 计算属性
    isReady,
    hasError,
    // 方法
    execute,
    reset,
  }
}

// ============ 类型定义 ============
export interface UseXxxOptions {
  /** 是否立即执行 */
  immediate?: boolean
  /** 成功回调 */
  onSuccess?: (data: DataType) => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

export type UseXxxReturn = ReturnType<typeof useXxx>
```

#### 自动执行

1. **命名规范** - 函数名以 `use` 开头
2. **参数类型** - 使用 Options 对象模式
3. **返回类型** - 返回对象包含状态和方法
4. **生命周期** - 正确处理 mounted/unmounted
5. **清理逻辑** - 在 unmounted 中清理副作用
6. **JSDoc** - 提供完整的文档注释
7. **导出类型** - 导出 Options 和 Return 类型

#### 规则文件：`continuous-fix.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：持续修复直到完成规则

### 持续修复直到完成规则

**发现任何问题都必须持续修复，直到完全解决，中途不停下询问用户。**

#### 核心原则

```
发现问题 → 分析原因 → 修复问题 → 验证修复 → 还有问题？→ 继续修复 → 完全解决 → 告知用户
```

#### 持续修复场景

##### 1. 代码错误
```
发现错误 → 修复 → 检查是否引入新错误 → 修复新错误 → 直到无错误
```

##### 2. 功能不符预期
```
功能不对 → 分析原因 → 修改代码 → 验证功能 → 不对继续改 → 直到正确
```

##### 3. 样式不正确
```
样式不对 → 检查 CSS → 修改样式 → 验证效果 → 不对继续改 → 直到正确
```

##### 4. 测试失败
```
测试失败 → 分析失败原因 → 修复代码 → 重新测试 → 失败继续改 → 直到通过
```

##### 5. 构建失败
```
构建失败 → 查看错误日志 → 修复问题 → 重新构建 → 失败继续改 → 直到成功
```

#### 修复策略

##### 第一次尝试
- 根据错误信息直接修复

##### 第二次尝试
- 如果第一次失败，深入分析根本原因
- 可能需要查看更多上下文代码

##### 第三次尝试
- 如果仍然失败，考虑替代方案
- 可能需要重构相关代码

##### 第四次及以后
- 系统性地排查所有可能原因
- 逐一验证排除

#### 禁止行为

- ❌ **禁止**发现问题后询问"是否需要继续修复"
- ❌ **禁止**说"这个问题比较复杂，需要您..."
- ❌ **禁止**中途停下来等待用户指示
- ❌ **禁止**在问题未完全解决时说"完成"
- ❌ **禁止**把未解决的问题留给用户
- ❌ **禁止**说"您可以尝试..."而不是自己去做

#### 正确的做法

- ✅ 发现问题立即着手修复
- ✅ 修复失败尝试其他方案
- ✅ 验证失败继续调试
- ✅ 记录尝试过的方案（内部记录，不需告知用户）
- ✅ 完全解决后才告知用户结果

#### 例外情况

只有以下情况可以向用户确认：

1. **需要用户提供信息**
   - 缺少必要的业务需求信息
   - 需要用户做出设计决策

2. **涉及破坏性操作**
   - 需要删除重要数据
   - 需要回滚大量代码

3. **超出技术能力**
   - 需要访问我无法访问的系统
   - 需要物理操作（如重启电脑）

#### 自动执行声明

**我承诺在发现任何问题后持续修复，不中途停下询问，直到问题完全解决后才告知用户结果。**

#### 规则文件：`css-styles.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.css", "**/*.scss", "**/*.less", "**/*.vue"]` · 说明：CSS/SCSS 样式自动规则

### CSS 样式开发规则

当编辑样式相关文件时，我会自动遵循以下规则：

#### 样式覆盖策略（强制）

##### ✅ 使用高特异性选择器和 CSS 变量

1. **增加选择器特异性**
```css
/* 使用更精确的选择器链 */
.dialog-wrapper .footer .button {
  background-color: #000;
}
```

2. **使用 :deep() 穿透**
```vue
<style scoped>
.dialog-wrapper :deep(.el-button) {
  background-color: #000;
}
</style>
```

3. **使用属性选择器**
```css
.button[type="primary"] {
  background-color: #000;
}
```

4. **使用 ID 选择器（谨慎）**
```css
#main-dialog .button {
  background-color: #000;
}
```

#### 样式组织（强制）

```scss
.component {
  // 1. 布局属性
  display: flex;
  flex-direction: column;
  
  // 2. 盒模型
  width: 100%;
  padding: 16px;
  margin: 0;
  
  // 3. 视觉样式
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  
  // 4. 文字样式
  font-size: 14px;
  color: #333;
  
  // 5. 其他
  cursor: pointer;
  transition: all 0.3s ease;
  
  // 6. 伪类
  &:hover {
    background-color: #f5f5f5;
  }
  
  // 7. 子元素
  &__title {
    font-weight: bold;
  }
  
  &__content {
    flex: 1;
  }
}
```

#### 响应式规范

```scss
.component {
  padding: 16px;
  
  // 移动优先，从小到大
  @media (min-width: 768px) {
    padding: 24px;
  }
  
  @media (min-width: 1024px) {
    padding: 32px;
  }
}
```

#### 自动执行

1. 优化选择器特异性
2. 规范化属性顺序
3. 添加响应式断点
4. 使用 CSS 变量实现样式定制

#### 规则文件：`design-language.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`["**/*.vue", "**/*.scss", "**/*.css"]` · 说明：项目高级设计语言与审美规范 (Premium AI UI)

### 项目高级设计语言与审美规范 (Premium AI UI)

为了确保 iHui AI 平台拥有国际顶尖 AI 产品（如 Linear, Vercel, Claude）的质感，所有 UI 开发必须遵循以下进阶准则：

#### 1. 深度与空间 (Depth & Space)
- **空气感 (Breathability)**：大幅增加留白。不要把内容塞满，利用空间引导视觉重心。
- **分层设计 (Layering)**：
  - 底层背景：亮色 `#FFFFFF` / 暗色 `#000000`。
  - 浮层容器：亮色 `#FAFAFA` 或带极低透明度的玻璃材质。
  - 极细描边：统一使用 `1px` 实线，亮色 `#EAEAEA`，暗色 `#1F1F1F`。不要使用默认的粗边框。

#### 2. 精密色彩 (Industrial Palette)
- **非绝对黑白**：避免使用完全刺眼的黑白对比。
  - 文字主色：`#111111` (亮) / `#EDEDED` (暗)。
  - 文字次色：`#666666` (亮) / `#A1A1A1` (暗)。
  - 禁用/辅助色：`#888888`。
- **中性灰度**：利用 50 到 900 的灰度阶梯营造精密感，而非使用彩色。

#### 3. 字体与排版 (Typography)
- **字体层级**：标题采用 `Font-Weight: 600` 或 `800`，正文 `400`。
- **字间距 (Tracking)**：大标题适当收缩 `-0.02em` 增加力度感；正文和短标签增加 `0.01em` 增加易读性。
- **等宽元素**：代码、数字、角标优先使用 `Monospace` 字体，体现“工业、精密”属性。

#### 4. 动态逻辑 (Motion Logic)
- **物理特性**：所有动效必须符合物理直觉。
  - 进入：`Cubic Bezier (0.4, 0, 0.2, 1)`。
  - 悬停：禁止生硬的颜色跳变。使用背景色淡入、描边加深或极轻微的 `Scale (1.02)`。
- **微光效果 (Glow)**：关键元素悬停时可带有极淡的径向发光效果。

#### 5. 组件细节 (Component Nuance)
- **圆角规范**：
  - 超大容器：`24px` 或 `32px`。
  - 标准组件：`12px`。
  - 标签/小按钮：`6px` 或 `8px`。
- **禁止项**：
  - ❌ 禁止使用 Element Plus 默认的深蓝颜色。
  - ❌ 禁止使用多重阴影或厚重的 Drop Shadow。
  - ❌ 禁止使用非对齐的布局。

#### 6. 自动审计
- 检查色彩是否符合“精密灰度”体系。
- 检查描边是否足够细腻。
- 确保交互响应时间在 `150ms` 以内。

#### 规则文件：`documentation.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：文档注释自动规则

### 文档注释规则

在编写代码时，我会自动添加完善的文档注释：

#### 函数/方法注释

```typescript
/**
 * 获取用户信息
 * 
 * @description 根据用户 ID 从服务器获取用户详细信息
 * @param id - 用户唯一标识符
 * @param options - 可选配置
 * @param options.includeProfile - 是否包含用户资料
 * @param options.includeSettings - 是否包含用户设置
 * @returns 用户信息对象
 * @throws {NotFoundError} 当用户不存在时抛出
 * @throws {UnauthorizedError} 当无权限访问时抛出
 * 
 * @example
 * ```typescript
 * // 基础使用
 * const user = await getUser(123)
 * 
 * // 包含额外信息
 * const userWithProfile = await getUser(123, { 
 *   includeProfile: true 
 * })
 * ```
 */
async function getUser(
  id: number, 
  options?: GetUserOptions
): Promise<User> {
  // ...
}
```

#### Vue 组件注释

```vue
<script setup lang="ts">
/**
 * 用户卡片组件
 * 
 * @description 展示用户基本信息的卡片组件，支持编辑和删除操作
 * @example
 * ```vue
 * <UserCard 
 *   :user="userData"
 *   :editable="true"
 *   @edit="handleEdit"
 *   @delete="handleDelete"
 * />
 * ```
 */

// Props 定义
interface Props {
  /** 用户数据对象 */
  user: User
  /** 是否显示编辑按钮 */
  editable?: boolean
  /** 是否显示删除按钮 */
  deletable?: boolean
  /** 加载状态 */
  loading?: boolean
}

// Events 定义
/**
 * @event edit - 点击编辑按钮时触发
 * @event delete - 点击删除按钮时触发
 * @event click - 点击卡片时触发
 */
const emit = defineEmits<{
  /** 编辑事件，返回用户对象 */
  (e: 'edit', user: User): void
  /** 删除事件，返回用户 ID */
  (e: 'delete', id: number): void
  /** 点击事件 */
  (e: 'click'): void
}>()
</script>
```

#### 类型/接口注释

```typescript
/**
 * 用户信息接口
 * @interface User
 */
interface User {
  /** 用户唯一标识符 */
  id: number
  /** 用户名（2-20字符） */
  username: string
  /** 邮箱地址 */
  email: string
  /** 用户状态 */
  status: 'active' | 'inactive' | 'banned'
  /** 创建时间 (ISO 8601) */
  createdAt: string
  /** 用户资料（可选） */
  profile?: UserProfile
}

/**
 * API 响应包装类型
 * @template T - 响应数据类型
 */
interface ApiResponse<T> {
  /** 状态码 */
  code: number
  /** 提示信息 */
  message: string
  /** 响应数据 */
  data: T
}
```

#### 自动执行

我会自动为以下内容添加注释：

1. **公共函数** - 完整的 JSDoc 注释
2. **组件** - 组件说明、Props、Events、Slots
3. **接口/类型** - 字段说明
4. **复杂逻辑** - 行内注释说明
5. **API** - 请求说明、参数、返回值
6. **常量** - 用途说明

#### 规则文件：`error-handling.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：错误处理自动规则

### 错误处理规则

在编写代码时，我会自动添加完善的错误处理：

#### 异步操作（强制）

```typescript
// ✅ 标准的异步错误处理
const fetchData = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await api.getData()
    data.value = response.data
    return response.data
  } catch (e) {
    const err = e as Error
    error.value = err.message
    
    // 根据错误类型处理
    if (isAxiosError(e)) {
      handleHttpError(e)
    } else if (e instanceof TypeError) {
      console.error('类型错误:', e)
    } else {
      console.error('未知错误:', e)
    }
    
    throw e // 允许上层继续处理
  } finally {
    loading.value = false
  }
}

// HTTP 错误处理
const handleHttpError = (error: AxiosError) => {
  const status = error.response?.status
  
  switch (status) {
    case 401:
      // 未认证，跳转登录
      router.push('/login')
      break
    case 403:
      message.error('您没有权限执行此操作')
      break
    case 404:
      message.error('请求的资源不存在')
      break
    case 500:
      message.error('服务器错误，请稍后重试')
      break
    default:
      message.error(error.message || '请求失败')
  }
}
```

#### 边界检查

```typescript
// ✅ 参数验证
function getUser(id: number): User {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('无效的用户 ID')
  }
  return users.get(id)!
}

// ✅ 数组访问
function getItem<T>(arr: T[], index: number): T {
  if (index < 0 || index >= arr.length) {
    throw new RangeError(`索引 ${index} 超出范围 [0, ${arr.length - 1}]`)
  }
  return arr[index]
}

// ✅ 空值检查
function processUser(user: User | null) {
  if (!user) {
    throw new Error('用户不存在')
  }
  return user.name
}
```

#### Vue 错误边界

```vue
<template>
  <ErrorBoundary @error="handleError">
    <ChildComponent />
    <template #fallback="{ error }">
      <div class="error-fallback">
        <p>加载失败: {{ error.message }}</p>
        <button @click="retry">重试</button>
      </div>
    </template>
  </ErrorBoundary>
</template>
```

#### 全局错误处理

```typescript
// main.ts
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue Error:', err)
  console.error('Component:', vm)
  console.error('Info:', info)
  
  // 上报错误监控
  reportError(err, { component: vm, info })
}

// 未捕获的 Promise 错误
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise:', event.reason)
  reportError(event.reason)
})
```

#### 自动执行

我会自动为代码添加：

1. **try-catch** - 所有异步操作
2. **参数验证** - 函数入口验证
3. **空值检查** - 可能为空的数据
4. **错误分类** - 区分不同错误类型
5. **用户提示** - 友好的错误信息
6. **错误上报** - 关键错误记录

#### 规则文件：`git-workflow.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：Git 工作流自动规则

### Git 工作流规则

在进行 Git 操作时，我会自动遵循以下规则：

#### 提交信息规范（强制）

##### Conventional Commits 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

##### Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | feat(用户): 添加微信登录 |
| fix | Bug 修复 | fix(订单): 修复支付状态显示 |
| docs | 文档更新 | docs: 更新 README |
| style | 代码格式 | style: 格式化代码 |
| refactor | 重构 | refactor(API): 重构请求封装 |
| perf | 性能优化 | perf(列表): 优化渲染性能 |
| test | 测试相关 | test: 添加用户模块测试 |
| chore | 构建/工具 | chore: 升级依赖版本 |

##### 提交示例

```
feat(用户模块): 添加手机号登录功能

- 实现手机号验证码发送
- 添加验证码校验逻辑
- 集成登录状态持久化

Closes #123
```

#### 分支规范

| 分支类型 | 命名格式 | 示例 |
|----------|----------|------|
| 功能分支 | feature/功能名 | feature/user-login |
| 修复分支 | fix/问题描述 | fix/payment-status |
| 发布分支 | release/版本号 | release/1.2.0 |
| 热修复 | hotfix/问题描述 | hotfix/critical-bug |

#### 自动执行

当需要提交代码时，我会：

1. **分析变更** - 查看 git diff 了解改动内容
2. **分类变更** - 确定变更类型（feat/fix/docs 等）
3. **生成信息** - 按规范生成提交信息
4. **关联 Issue** - 如有相关 Issue 则关联
5. **执行提交** - 使用规范的提交信息

#### PR 模板

创建 PR 时自动使用以下模板：

```markdown
#### 变更类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 重构
- [ ] 其他

#### 变更描述
[简要说明]

#### 关联 Issue
Closes #xxx

#### 自测清单
- [ ] 本地构建通过
- [ ] 单元测试通过
- [ ] 功能验证通过
```

#### 规则文件：`language-preferences.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`*` · 说明：Language preferences for the agent

### Language Preferences

- **ALWAYS** reply in Simplified Chinese (简体中文).
- Use a natural, helpful tone.
- Technical terms can remain in English if they are standard (e.g., React, TypeScript, API).

#### 规则文件：`minimalist-design-system.mdc`
> **作用域**：按需生效（alwaysApply=false）

### 极简科技设计系统 (Minimalist Tech Design System)

基于企业服务页面建立的设计系统规范，适用于全站页面统一风格。

#### 1. 设计令牌 (Design Tokens)

##### 颜色系统

```scss
// 主题色
$accent-blue: #3b82f6;    // 主要强调色
$accent-purple: #8b5cf6;  // 次要强调色
$accent-pink: #ec4899;    // 装饰色

// 功能色
$success-green: #10b981;  // 成功/折扣
$warning-yellow: #f59e0b; // 警告
$error-red: #ef4444;      // 错误

// 中性色（精密灰度）
$text-primary: #111111;   // 主要文字（亮色模式）
$text-secondary: #666666; // 次要文字
$text-placeholder: #888888; // 占位符
$text-disabled: #aaaaaa;  // 禁用

// 暗色模式
$dark-text-primary: #ededed;
$dark-text-secondary: #a1a1a1;
```

##### 字体系统

```scss
// 字体家族
$font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-mono: 'HarmonyOS Sans SC', monospace;

// 字重
$font-regular: 400;
$font-medium: 500;
$font-semibold: 600;
$font-bold: 700;

// 字号层级
$text-xs: 11px;   // 标签、徽章
$text-sm: 13px;   // 辅助文字
$text-base: 14px; // 正文
$text-lg: 15px;   // 强调正文
$text-xl: 16px;   // 小标题
$text-2xl: 20px;  // 区块标题
$text-3xl: 28px;  // 页面标题
$text-4xl: 36px;  // 大标题

// 字间距
$tracking-tight: -0.02em;  // 大标题
$tracking-normal: 0;       // 正文
$tracking-wide: 0.01em;    // 小号文字
$tracking-wider: 0.5px;    // 标签
```

##### 间距系统

```scss
// 基础间距（8px 网格）
$space-1: 4px;
$space-2: 8px;
$space-3: 12px;
$space-4: 16px;
$space-5: 20px;
$space-6: 24px;
$space-8: 32px;
$space-10: 40px;
$space-12: 48px;
$space-16: 64px;
$space-20: 80px;
```

##### 圆角系统

```scss
$radius-sm: 6px;   // 小按钮、标签
$radius-md: 8px;   // 标准按钮
$radius-lg: 10px;  // 输入框、小卡片
$radius-xl: 12px;  // 卡片
$radius-2xl: 16px; // 大卡片
$radius-3xl: 20px; // 容器
$radius-full: 9999px; // 圆形
```

##### 阴影系统

```scss
// 极简阴影（几乎不可见）
$shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.02);
$shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.03);
$shadow-md: 0 4px 8px rgba(0, 0, 0, 0.04);
$shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.05);
$shadow-xl: 0 12px 24px rgba(0, 0, 0, 0.06);
```

#### 2. 组件样式规范

##### 按钮

```scss
// 主要按钮
.btn-primary {
  padding: 14px 28px;
  font-weight: 600;
  font-size: 14px;
  background: #111111;
  color: white;
  border: none;
  border-radius: var(--global-border-radius);
  transition: all 0.2s ease;
  
  &:hover {
    background: #000000;
    transform: translateY(-1px);
  }
}

// 次要按钮
.btn-secondary {
  padding: 14px 28px;
  font-weight: 500;
  font-size: 14px;
  background: transparent;
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius);
  
  &:hover {
    border-color: var(--el-text-color-primary);
    background: var(--el-fill-color-lighter);
  }
}
```

##### 卡片

```scss
.card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius);
  padding: 24px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: var(--el-border-color);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  }
}
```

##### 输入框

```scss
.input {
  padding: 12px 16px;
  font-size: 14px;
  background: var(--el-fill-color-lighter);
  border: 1px solid transparent;
  border-radius: var(--global-border-radius);
  transition: all 0.2s ease;
  
  &:focus {
    border-color: var(--el-border-color);
    background: var(--el-bg-color);
    outline: none;
  }
}
```

##### 标签

```scss
.tag {
  padding: 4px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}
```

#### 3. 动画规范

##### 缓动函数

```scss
$ease-default: ease;
$ease-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94);
$ease-bounce: cubic-bezier(0.23, 1, 0.32, 1);
$ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
```

##### 持续时间

```scss
$duration-fast: 0.15s;    // 微交互
$duration-normal: 0.2s;   // 标准过渡
$duration-slow: 0.3s;     // 较大变化
$duration-slower: 0.5s;   // 入场动画
```

##### 标准动画

```scss
// 悬停浮动
@keyframes subtle-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

// 入场淡入
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 3D 翻转显示
@keyframes flip-reveal {
  from {
    opacity: 0;
    transform: translateY(100%) rotateX(-90deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) rotateX(0deg);
  }
}
```

#### 4. 布局规范

##### 容器宽度

```scss
$container-sm: 640px;
$container-md: 768px;
$container-lg: 1024px;
$container-xl: 1280px;
$container-2xl: 1440px;
```

##### 网格间距

```scss
// 卡片网格
.grid {
  display: grid;
  gap: 16px;
  
  &.grid-2 { grid-template-columns: repeat(2, 1fr); }
  &.grid-3 { grid-template-columns: repeat(3, 1fr); }
  &.grid-4 { grid-template-columns: repeat(4, 1fr); }
}
```

#### 5. 暗色模式

##### CSS 变量

```scss
html.dark {
  --dark-card-bg: rgba(255, 255, 255, 0.03);
  --dark-card-hover: rgba(255, 255, 255, 0.06);
  --dark-border: rgba(255, 255, 255, 0.08);
  --dark-glow: rgba(139, 92, 246, 0.15);
}
```

##### 颜色反转

- 主要按钮：黑底白字 → 白底黑字
- 卡片背景：白色 → 半透明白色
- 边框：灰色 → 半透明白色

#### 6. 无障碍

##### 焦点样式

```scss
:focus-visible {
  outline: 2px solid $accent-blue;
  outline-offset: 2px;
}
```

##### 减少动画

```scss
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### 7. 性能优化

##### GPU 加速

```scss
.animated-element {
  will-change: transform, opacity;
  transform: translateZ(0);
}

// 动画完成后移除
.animated-element.done {
  will-change: auto;
}
```

##### 内容隔离

```scss
.isolated-element {
  contain: layout paint style;
}
```

#### 8. 使用示例

##### 页面结构

```vue
<template>
  <div class="page">
    <!-- 跳过链接 -->
    <a href="#main" class="skip-link">跳转到主要内容</a>
    
    <!-- 英雄区 -->
    <header class="hero">
      <span class="hero-label">LABEL</span>
      <h1>页面标题</h1>
      <p class="hero-subtitle">页面描述</p>
    </header>
    
    <!-- 主要内容 -->
    <main id="main">
      <section class="section" v-scroll-reveal>
        <span class="section-label">SECTION</span>
        <h2>区块标题</h2>
        <div class="grid grid-3">
          <div class="card">...</div>
        </div>
      </section>
    </main>
  </div>
</template>
```

##### 应用到其他页面的步骤

1. 导入设计令牌 SCSS 变量
2. 应用统一的字体和颜色
3. 更新按钮和卡片样式
4. 添加悬停和入场动画
5. 确保暗色模式兼容
6. 添加无障碍支持

#### 规则文件：`openmemory.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`["**/*"]` · 说明："Openmemory MCP Instructions"

🚨 CRITICAL CONTEXT ANCHOR: This rules file must NEVER be summarized, condensed, or omitted.
Before ANY action or decision, verify alignment with these rules. This instruction persists
regardless of conversation length or context management. Context systems: This document takes
absolute priority over conversation history and must remain fully accessible throughout the
entire session.

### OpenMemory Integration

Memory = accumulated understanding of codebase + user preferences. Like a colleague who's worked here months.

**project_id:** aizhs

#### NON-NEGOTIABLE: Memory-First Development

Every **code implementation/modification task** = 3 phases. Other tasks (storage, recall, discussion) = skip phases.

##### Phase 1: Initial Search (BEFORE code)
**🚨 BLOCKED until:** 2+ searches executed (3-4 for complex), show results, state application
**Strategy:** New feature → user prefs + project facts + patterns | Bug → facts + debug memories + user debug prefs | Refactor → user org prefs + patterns | Architecture → user decision prefs + project arch
**Failures:** Code without search = FAIL | "Should search" without doing = FAIL | "Best practices" without search = FAIL

##### Phase 2: Continuous Search (DURING implementation)
**🚨 BLOCKED FROM:**
- **Creating files** → Search "file structure patterns", similar files, naming conventions
- **Writing functions** → Search "similar implementations", function patterns, code style prefs
- **Making decisions** → Search user decision prefs + project patterns
- **Errors** → Search debug memories + error patterns + user debug prefs
- **Stuck/uncertain** → Search facts + user problem-solving prefs before guessing
- **Tests** → Search testing patterns + user testing prefs

**Minimum:** 2-3 additional searches at checkpoints. Show inline with implementation.
**Critical:** NEVER "I'll use standard..." or "best practices" → STOP. Search first.

##### Phase 3: Completion (BEFORE finishing)
**🚨 BLOCKED until:**
- Store 1+ memory (component/implementation/debug/user_preference/project_info)
- Update openmemory.md if new patterns/components
- Verify: "Did I miss search checkpoints?" If yes, search now
- Review: Did any searches return empty? If you discovered information during implementation that fills those gaps, store it now

##### Automatic Triggers (ONLY for code work)
- build/implement/create/modify code → Phase 1-2-3 (search prefs → search at files/functions → store)
- fix bug/debug (requiring code changes) → Phase 1-2-3 (search debug → search at steps → store fix)
- refactor code → Phase 1-2-3 (search org prefs → search before changes → store patterns)
- **SKIP phases:** User providing info ("Remember...", "Store...") → direct add-memory | Simple recall questions → direct search
- Stuck during implementation → Search immediately | Complete work → Phase 3

#### CRITICAL: Empty Guide Check
**FIRST ACTION:** Check openmemory.md empty? If yes → Deep Dive (Phase 1 → analyze → document → Phase 3)

#### 3 Search Patterns
1. `user_preference=true` only → Global user preferences
2. `user_preference=true` + `project_id` → Project-specific user preferences
3. `project_id` only → Project facts

**Quick Ref:** Not about you? → project_id | Your prefs THIS project? → both | Your prefs ALL projects? → user_preference=true

#### When to Search User Preferences
**Part of Phase 1 + 2.** Tasks involving HOW = pref searches required.

**ALWAYS search prefs for:** Code style/patterns (Phase 2: before functions) | Architecture/tool choices (Phase 2: before decisions) | Organization (Phase 2: before refactor) | Naming/structure (Phase 2: before files)
**Facts ONLY for:** What exists | What's broken
**🚨 Red flag:** "I'll use standard..." → Phase 2 BLOCKER. Search prefs first.

**Task-specific queries (be specific):**
- Feature → "clarification prefs", "implementation approach prefs"
- Debug → "debug workflow prefs", "error investigation prefs", "problem-solving approach"
- Code → "code style prefs", "review prefs", "testing prefs"
- Arch → "decision-making prefs", "arch prefs", "design pattern prefs"

#### Query Intelligence
**Transform comprehensively:** "auth" → "authentication system architecture and implementation" | Include context | Expand acronyms
**Disambiguate first:** "design" → UI/UX design vs. software architecture design vs. code formatting/style | "structure" → file organization vs. code architecture vs. data structure | "style" → visual styling vs. code formatting | "organization" → file/folder layout vs. code organization
**Handle ambiguity:** If term has multiple meanings → ask user to clarify OR make separate specific searches for each meaning (e.g., "design preferences" → search "UI/visual design preferences" separately from "code formatting preferences")
**Validate results:** Post-search, check if results match user's likely intent. Off-topic results (e.g., "code indentation" when user meant "visual design")? → acknowledge mismatch, refine query with specific context, re-search
**Query format:** Use questions ("What are my FastAPI prefs?") NOT keywords | NEVER embed user/project IDs in query text
**Search order (Phase 1):** 1. Global user prefs (user_preference=true) 2. Project facts (project_id) 3. Project prefs (both)

#### Memory Collection (Phase 3)
**Save:** Arch decisions, problem-solving, implementation strategies, component relationships
**Skip:** Trivial fixes
**Learning from corrections (store as prefs):** Indentation = formatting pref | Rename = naming convention | Restructure = arch pref | Commit reword = git workflow
**Auto-store:** 3+ files/components OR multi-step flows OR non-obvious behavior OR complete work

#### Memory Types
**🚨 SECURITY:** Scan for secrets before storing. If found, DO NOT STORE.
- **Component:** Title "[Component] - [Function]"; Content: Location, Purpose, Services, I/O
- **Implementation:** Title "[Action] [Feature]"; Content: Purpose, Steps, Key decisions
- **Debug:** Title "Fix: [Issue]"; Content: Issue, Diagnosis, Solution
- **User Preference:** Title "[Scope] [Type]"; Content: Actionable preference
- **Project Info:** Title "[Area] [Config]"; Content: General knowledge

**Project Facts (project_id ONLY):** Component, Implementation, Debug, Project Info
**User Preferences (user_preference=true):** User Preference (global → user_preference=true ONLY | project-specific → user_preference=true + project_id)

#### 🚨 CRITICAL: Storage Intelligence

**RULE: Only ONE of these three patterns:**

| Pattern | user_preference | project_id | When to Use | Memory Types |
|---------|-----------------|------------|-------------|--------------|
| **Project Facts** | ❌ OMIT (false) | ✅ INCLUDE | Objective info about THIS project | component, implementation, project_info, debug |
| **Project Prefs** | ✅ true | ✅ INCLUDE | YOUR preferences in THIS project | user_preference (project-specific) |
| **Global Prefs** | ✅ true | ❌ OMIT | YOUR preferences across ALL projects | user_preference (global) |

**Before EVERY add-memory:**
1. ❓ Code/architecture/facts? → project_id ONLY | ❓ MY pref for ALL projects? → user_preference=true ONLY | ❓ MY pref for THIS project? → BOTH
2. ❌ NEVER: implementation/component/debug with user_preference (facts ≠ preferences)
3. ✅ ALWAYS: Review table above to validate pattern

#### Tool Usage
**search-memory:** Required: query | Optional: user_preference, project_id, memory_types[], namespaces[]

**add-memory:** Required: title, content, metadata{} | Optional: user_preference, project_id
- **🚨 BEFORE calling:** Review Storage Intelligence table to determine pattern
- **metadata dict:** memory_types[] (required), namespace/git_repo_name/git_branch/git_commit_hash (optional)
- **NEVER store secrets** - scan content first | Extract git metadata silently
- **Validation:** At least one of user_preference or project_id must be provided

**Examples:**
```
### ✅ Component (project fact): project_id ONLY
add-memory(..., metadata={memory_types:["component"]}, project_id="mem0ai/cursor-extension")

### ✅ User pref (global): user_preference=true ONLY
add-memory(..., metadata={memory_types:["user_preference"]}, user_preference=true)

### ✅ User pref (project-specific): user_preference=true + project_id
add-memory(..., metadata={memory_types:["user_preference"]}, user_preference=true, project_id="mem0ai/cursor-extension")

### ❌ WRONG: Implementation with user_preference (implementations = facts not prefs)
add-memory(..., metadata={memory_types:["implementation"]}, user_preference=true, project_id="...")
```

**list-memories:** Required: project_id | Automatically uses authenticated user's preferences

**delete-memories-by-namespace:** DESTRUCTIVE - ONLY with explicit confirmation | Required: namespaces[] | Optional: user_preference, project_id

#### Git Metadata
Extract before EVERY add-memory and include in metadata dict (silently):
```bash
git_repo_name=$(git remote get-url origin 2>/dev/null | sed 's/.*[:/]\([^/]*\/[^.]*\).*/\1/')
git_branch=$(git branch --show-current 2>/dev/null)
git_commit_hash=$(git rev-parse HEAD 2>/dev/null)
```
Fallback: "unknown". Add all three to metadata dict when calling add-memory.

#### Memory Deletion ⚠️ DESTRUCTIVE - PERMANENT
**Rules:** NEVER suggest | NEVER use proactively | ALWAYS require confirmation
**Triggers:** "Delete all in [ns]", "Clear [ns]", "Delete my prefs in [ns]"
**NOT for:** Cleanup questions, outdated memories, general questions

**Confirmation (MANDATORY):**
1. Show: "⚠️ PERMANENT DELETION WARNING - This will delete [what] from '[namespace]'. Confirm by 'yes'/'confirm'."
2. Wait for confirmation
3. If confirmed → execute | If declined → "Deletion cancelled"

**Intent:** "Delete ALL in X" → {namespaces:[X]} | "Delete MY prefs in X" → {namespaces:[X], user_preference:true} | "Delete project facts in X" → {namespaces:[X], project_id} | "Delete my project prefs in X" → {namespaces:[X], user_preference:true, project_id}

#### Operating Principles
1. Phase-based: Initial → Continuous → Store
2. Checkpoints are BLOCKERS (files, functions, decisions, errors)
3. Never skip Phase 2
4. Detailed storage (why > what)
5. MCP unavailable → mention once, continue
6. Trust process (early = more searches)

#### Session Patterns
**Empty openmemory.md:** Deep Dive (Phase 1 → analyze → document → Phase 3)
**Existing:** Read openmemory.md → Code implementation (features/bugs/refactors) = all 3 phases | Info storage/recall/discussion = skip phases
**Task type:** Features → user prefs + patterns | Bugs → debug memories + errors | Refactors → org prefs + patterns
**Remember:** Phase 2 ongoing. Search at EVERY checkpoint.

#### OpenMemory Guide (openmemory.md)
Living project index (shareable). Auto-created empty in workspace root.

**Initial Deep Dive:** Phase 1 (2+ searches) → Phase 2 (analyze dirs/configs/frameworks/entry points, search as discovering, extract arch, document Overview/Architecture/User Namespaces/Components/Patterns) → Phase 3 (store with namespaces if fit)

**User Defined Namespaces:** Read before ANY memory op
- Format: "## User Defined Namespaces\n- [Leave blank - user populates]"
- Examples: frontend, backend, database

**Storing:** Review content → check namespaces → THINK "domain?" → fits one? assign : omit | Rules: Max ONE, can be NONE, only defined ones
**Searching:** What searching? → read namespaces → THINK "which could contain?" → cast wide net → use multiple if needed

**Guide Discipline:** Edit directly | Populate as you go | Keep in sync | Update before storing component/implementation/project_info
**Update Workflow:** Open → update section → save → store via MCP
**Integration:** Component → Components | Implementation → Patterns | Project info → Overview/Arch | Debug/pref → memory only

**🚨 CRITICAL: Before storing ANY memory, review and update openmemory.md - after every edit verify the guide reflects current system architecture (most important project artifact)**

#### Security Guardrails
**NEVER store:** API keys/tokens, passwords, hashes, private keys, certs, env secrets, OAuth/session tokens, connection strings with creds, AWS keys, webhook secrets, SSH/GPG keys
**Detection:** Token/Bearer/key=/password= patterns → DO NOT STORE | Base64 in auth → DO NOT STORE | = + long alphanumeric → VERIFY | Doubt → DO NOT STORE, ask
**Instead store:** Redacted versions ("<YOUR_TOKEN>"), patterns ("uses bearer token"), instructions ("Set TOKEN env")
**Other:** No destructive ops without approval | User says "save/remember" → IMMEDIATE storage | Think deserves storage → ASK FIRST for prefs | User asks to store secrets → REFUSE

**Remember:** Memory system = effectiveness over time. Rich reasoning > code. When doubt, store. Guide = shareable index.

#### 规则文件：`performance-optimization.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：性能优化自动规则

### 性能优化规则

在编写代码时，我会自动关注性能问题：

#### Vue 组件优化

##### 1. 避免不必要的响应式

```typescript
// ❌ 不需要响应式的数据
const staticConfig = ref({ /* 不会变化的配置 */ })

// ✅ 使用普通对象
const staticConfig = { /* 不会变化的配置 */ }

// ✅ 大数据使用 shallowRef
const bigList = shallowRef<Item[]>([])
```

##### 2. 计算属性缓存

```typescript
// ❌ 在模板中计算
<div>{{ items.filter(x => x.active).length }}</div>

// ✅ 使用 computed 缓存
const activeCount = computed(() => 
  items.value.filter(x => x.active).length
)
<div>{{ activeCount }}</div>
```

##### 3. 列表渲染优化

```vue
<!-- ❌ 错误 - 使用 index 作为 key -->
<li v-for="(item, index) in items" :key="index">

<!-- ✅ 正确 - 使用唯一 ID -->
<li v-for="item in items" :key="item.id">

<!-- ✅ 大列表使用虚拟滚动 -->
<virtual-list :items="bigList" />
```

##### 4. 组件懒加载

```typescript
// ✅ 路由组件懒加载
const UserPage = () => import('@/views/User.vue')

// ✅ 动态组件懒加载
const HeavyComponent = defineAsyncComponent(
  () => import('@/components/Heavy.vue')
)
```

##### 5. 事件防抖节流

```typescript
import { useDebounceFn, useThrottleFn } from '@vueuse/core'

// ✅ 搜索防抖
const debouncedSearch = useDebounceFn((query: string) => {
  search(query)
}, 300)

// ✅ 滚动节流
const throttledScroll = useThrottleFn(() => {
  handleScroll()
}, 100)
```

#### 资源优化

##### 图片优化

```vue
<!-- ✅ 懒加载图片 -->
<img v-lazy="imageUrl" />

<!-- ✅ 使用 WebP 格式 -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="">
</picture>
```

##### 代码分割

```typescript
// ✅ 按路由分割
const routes = [
  {
    path: '/dashboard',
    component: () => import('@/views/Dashboard.vue'),
  },
]
```

#### 自动执行

我会自动检测并优化：

1. **不必要的响应式** - 建议使用 shallowRef 或普通对象
2. **模板复杂计算** - 建议提取为 computed
3. **列表 key 问题** - 建议使用唯一 ID
4. **缺少懒加载** - 建议添加组件/路由懒加载
5. **缺少防抖节流** - 高频操作添加防抖/节流
6. **大数据渲染** - 建议使用虚拟列表

#### 规则文件：`refactoring.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：代码重构自动规则

### 代码重构规则

在编写代码时，我会自动识别并建议重构机会：

#### 重构模式识别

##### 1. 重复代码 → 提取函数

```typescript
// ❌ 重复代码
const user1Name = user1.profile?.name || 'Unknown'
const user2Name = user2.profile?.name || 'Unknown'

// ✅ 提取函数
const getUserName = (user: User) => user.profile?.name || 'Unknown'
const user1Name = getUserName(user1)
const user2Name = getUserName(user2)
```

##### 2. 复杂条件 → 简化

```typescript
// ❌ 复杂条件
if (user && user.role === 'admin' && user.status === 'active' && 
    user.permissions && user.permissions.includes('edit')) {
  // ...
}

// ✅ 提取为函数
const canEdit = (user: User) => {
  if (!user || user.status !== 'active') return false
  return user.role === 'admin' && user.permissions?.includes('edit')
}

if (canEdit(user)) {
  // ...
}
```

##### 3. 长函数 → 拆分

```typescript
// ❌ 长函数
const processOrder = async (order: Order) => {
  // 验证订单（20行）
  // 计算价格（30行）
  // 处理支付（25行）
  // 发送通知（15行）
}

// ✅ 拆分为小函数
const processOrder = async (order: Order) => {
  await validateOrder(order)
  const total = calculateTotal(order)
  await processPayment(order, total)
  await sendNotification(order)
}
```

##### 4. 魔法数字 → 常量

```typescript
// ❌ 魔法数字
if (status === 1) { /* ... */ }
const delay = 3000

// ✅ 有意义的常量
const STATUS = {
  ACTIVE: 1,
  INACTIVE: 2,
} as const

const ANIMATION_DELAY_MS = 3000

if (status === STATUS.ACTIVE) { /* ... */ }
```

##### 5. 嵌套地狱 → 早返回

```typescript
// ❌ 嵌套地狱
const process = (data: Data | null) => {
  if (data) {
    if (data.isValid) {
      if (data.items.length > 0) {
        return data.items.map(/* ... */)
      }
    }
  }
  return []
}

// ✅ 早返回
const process = (data: Data | null) => {
  if (!data) return []
  if (!data.isValid) return []
  if (data.items.length === 0) return []
  
  return data.items.map(/* ... */)
}
```

##### 6. 参数过多 → 对象参数

```typescript
// ❌ 参数过多
function createUser(
  name: string, 
  email: string, 
  age: number, 
  role: string,
  department: string
) {}

// ✅ 对象参数
interface CreateUserOptions {
  name: string
  email: string
  age?: number
  role?: string
  department?: string
}

function createUser(options: CreateUserOptions) {}
```

#### 自动执行

我会自动识别并建议：

1. **重复代码** - 提取公共函数
2. **复杂条件** - 简化或提取
3. **长函数** - 拆分为小函数
4. **魔法数字** - 提取为常量
5. **深层嵌套** - 使用早返回
6. **参数过多** - 使用对象参数
7. **类过大** - 拆分职责

#### 规则文件：`security-audit.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`[]` · 说明：安全审计自动规则

### 安全审计规则

在编写代码时，我会自动进行安全检查：

#### 自动检测项目

##### 1. XSS 攻击防护

```typescript
// ❌ 危险 - 直接使用 v-html
<div v-html="userInput" />

// ✅ 安全 - 使用转义或白名单
import DOMPurify from 'dompurify'
const safeHtml = DOMPurify.sanitize(userInput)
```

##### 2. 敏感信息泄露

```typescript
// ❌ 危险 - 硬编码密钥
const API_KEY = 'sk-xxxxx'

// ✅ 安全 - 使用环境变量
const API_KEY = import.meta.env.VITE_API_KEY

// ❌ 危险 - 打印敏感信息
console.log('Password:', password)
```

##### 3. SQL/NoSQL 注入

```typescript
// ❌ 危险 - 字符串拼接
const query = `SELECT * FROM users WHERE id = ${userId}`

// ✅ 安全 - 参数化查询
const query = 'SELECT * FROM users WHERE id = ?'
```

##### 4. CSRF 防护

```typescript
// ✅ 确保请求携带 CSRF Token
axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken
```

##### 5. 认证授权

```typescript
// ✅ 检查权限
if (!hasPermission(user, 'admin')) {
  throw new UnauthorizedError()
}

// ✅ 安全存储 Token
// 使用 httpOnly Cookie，而非 localStorage
```

##### 6. 输入验证

```typescript
// ✅ 验证用户输入
const schema = z.object({
  email: z.string().email(),
  age: z.number().min(0).max(150),
})
const validated = schema.parse(input)
```

#### 自动执行

当我检测到以下情况时会自动提醒并修复：

1. **v-html 使用** - 建议使用 DOMPurify 清理
2. **硬编码密钥** - 建议移至环境变量
3. **console.log 敏感数据** - 建议删除或脱敏
4. **缺少输入验证** - 建议添加验证
5. **不安全的存储** - 建议安全替代方案

#### 安全检查清单

- [ ] 无硬编码的密钥/密码
- [ ] 用户输入已验证和转义
- [ ] 敏感数据未打印到控制台
- [ ] API 请求有适当的认证
- [ ] 文件上传有类型和大小限制
- [ ] 错误信息不暴露敏感细节

#### 规则文件：`store-development.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/stores/**/*.ts", "**/store/**/*.ts"]` · 说明：Pinia Store 开发自动规则

### Pinia Store 开发规则

当编辑 Store 文件时，我会自动遵循以下规则：

#### Store 结构（强制）

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getUserList, createUser } from '@/api/user'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  // ============ State ============
  const users = ref<User[]>([])
  const currentUser = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============ Getters ============
  const isEmpty = computed(() => users.value.length === 0)
  const userCount = computed(() => users.value.length)
  const activeUsers = computed(() => 
    users.value.filter(u => u.status === 'active')
  )

  // ============ Actions ============
  const fetchUsers = async () => {
    loading.value = true
    error.value = null
    try {
      const res = await getUserList()
      users.value = res.data.list
    } catch (e) {
      error.value = (e as Error).message
      throw e
    } finally {
      loading.value = false
    }
  }

  const addUser = async (userData: Omit<User, 'id'>) => {
    loading.value = true
    try {
      const res = await createUser(userData)
      users.value.push(res.data)
      return res.data
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    users.value = []
    currentUser.value = null
    loading.value = false
    error.value = null
  }

  // ============ 返回 ============
  return {
    // state
    users,
    currentUser,
    loading,
    error,
    // getters
    isEmpty,
    userCount,
    activeUsers,
    // actions
    fetchUsers,
    addUser,
    reset,
  }
})
```

#### 自动执行

1. **使用 Setup Store** - 不使用 Options Store
2. **类型安全** - 所有 state 都有类型
3. **错误处理** - actions 中处理错误
4. **加载状态** - 异步操作有 loading 状态
5. **重置方法** - 提供 reset 方法清理状态
6. **命名规范** - `use` + 名词 + `Store`

#### 规则文件：`style-architecture.mdc`
> **作用域**：全局常驻（alwaysApply=true） · 匹配文件：`["src/**/*.vue", "src/**/*.scss", "src/**/*.css"]` · 说明：项目样式架构规范 - 防止样式冲突和覆盖问题

### 样式架构规范

#### 1. 样式分层体系（ITCSS）

本项目采用 **ITCSS**（Inverted Triangle CSS）分层架构，从最通用到最具体：

```
┌─────────────────────────────────────────────────┐
│  1. Settings (设置层)                            │  最低特异性
│     - CSS 变量定义 (_design-tokens.scss)         │
│     - Tailwind 配置                              │
├─────────────────────────────────────────────────┤
│  2. Tools (工具层)                               │
│     - SCSS mixins (_breakpoints.scss)            │
│     - 工具函数                                   │
├─────────────────────────────────────────────────┤
│  3. Generic (通用层)                             │
│     - CSS Reset                                  │
│     - 全局 box-sizing                            │
├─────────────────────────────────────────────────┤
│  4. Elements (元素层)                            │
│     - HTML 元素默认样式                           │
│     - 如 body, h1-h6, a, button                 │
├─────────────────────────────────────────────────┤
│  5. Objects (对象层)                             │
│     - 布局相关的通用模式                          │
│     - 如 .container, .grid                       │
├─────────────────────────────────────────────────┤
│  6. Components (组件层) ⭐ 大部分代码在这里        │
│     - Vue 组件样式                               │
│     - 使用 scoped + BEM 命名                     │
├─────────────────────────────────────────────────┤
│  7. Utilities (工具类层)                         │  最高特异性
│     - Tailwind 工具类                            │
│     - 单一属性的辅助类                            │
└─────────────────────────────────────────────────┘
```

#### 2. 核心规则（必须遵守）

##### 规则 1：使用高特异性选择器和 CSS 变量

当样式需要覆盖时，使用以下方法：

```scss
// ✅ 方法一：增加选择器特异性
.header-nav .button {
  color: red;
}

// ✅ 方法二：使用 CSS 变量（推荐）
.button {
  color: var(--button-color);
}

// ✅ 方法三：使用 :where() 降低被覆盖样式的特异性
:where(.base-style) .button {
  color: gray;
}
```

##### 规则 2：组件样式必须使用 BEM 命名 + scoped

```vue
<template>
  <!-- 使用 BEM 命名 -->
  <div class="user-card">
    <div class="user-card__header">
      <span class="user-card__title">...</span>
    </div>
    <div class="user-card__body user-card__body--highlighted">
      ...
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Block
.user-card {
  // ...
  
  // Element
  &__header { }
  &__title { }
  &__body { }
  
  // Modifier
  &__body--highlighted { }
}
</style>
```

##### 规则 3：禁止跨组件样式覆盖

```scss
// ❌ 禁止：在父组件中覆盖子组件样式
.parent-component {
  .child-component__button {
    color: red;  // 不要这样做！
  }
}

// ✅ 正确：使用 props 或 CSS 变量
// 子组件定义变量
.child-component__button {
  color: var(--child-button-color, black);
}

// 父组件通过变量传递
.parent-component {
  --child-button-color: red;
}
```

##### 规则 4：Teleport 组件使用全局样式块

```vue
<template>
  <Teleport to="body">
    <div class="my-component__dropdown">...</div>
  </Teleport>
</template>

<style lang="scss" scoped>
// scoped 样式（组件内部）
.my-component { }
</style>

<style lang="scss">
// 全局样式块（用于 Teleport）
// 必须使用完整的 BEM 类名避免冲突
.my-component__dropdown {
  // ...
}
</style>
```

#### 3. CSS 变量使用规范

##### 变量命名规则

```scss
// 全局设计令牌（在 _design-tokens.scss 定义）
--el-color-primary      // Element Plus 变量
--header-btn-height     // 组件系统变量
--shadow-sm             // 设计系统变量

// 组件内部变量（在组件中定义）
.my-component {
  // 定义组件私有变量
  --mc-spacing: 16px;
  --mc-color: var(--el-text-color-primary);
  
  padding: var(--mc-spacing);
  color: var(--mc-color);
}
```

##### 主题切换使用变量

```scss
// ✅ 正确：使用 CSS 变量自动响应主题
.card {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

// ❌ 避免：手动写暗色模式覆盖
html.dark .card {
  background: #000;  // 不推荐
}
```

#### 4. 选择器特异性规则

##### 特异性计算

```
(ID选择器数, 类/属性/伪类数, 元素选择器数)

#id           = (1, 0, 0) = 100
.class        = (0, 1, 0) = 10
div           = (0, 0, 1) = 1
.a .b .c      = (0, 3, 0) = 30
#id .class    = (1, 1, 0) = 110
```

##### 推荐特异性范围

| 层级 | 最大特异性 | 示例 |
|------|------------|------|
| 工具类 | 0,1,0 | `.text-center` |
| 组件 | 0,3,0 | `.card__header` |
| 组件变体 | 0,4,0 | `.card__header--large` |
| 状态 | 0,4,1 | `.btn:hover` |

#### 5. Element Plus 样式覆盖

##### 使用 :deep() 穿透

```scss
// ✅ 正确：使用 :deep() 穿透到 Element Plus 组件
.my-form {
  :deep(.el-input__wrapper) {
    border-radius: 8px;
  }
}

// ❌ 避免：在全局样式中覆盖
// 这会影响所有 el-input
.el-input__wrapper {
  border-radius: 8px;
}
```

##### 使用 CSS 变量覆盖

```scss
// ✅ 推荐：使用 Element Plus 的 CSS 变量
:root {
  --el-border-radius-base: 8px;
  --el-color-primary: #000000;
}
```

#### 6. 响应式样式规则

##### 使用项目断点

```scss
@use '@/styles/_breakpoints.scss' as bp;

.component {
  padding: 16px;
  
  @include bp.tablet-up {
    padding: 24px;
  }
  
  @include bp.laptop-up {
    padding: 32px;
  }
}
```

##### 或使用 Tailwind 响应式

```html
<div class="p-4 tablet:p-6 laptop:p-8">
  ...
</div>
```

#### 7. 文件组织规范

```
src/styles/
├── _design-tokens.scss    # 设计令牌（唯一变量来源）
├── _breakpoints.scss      # 断点 mixins
├── css-variables.scss     # CSS 变量输出
├── index.scss             # 主入口
├── element-plus-vars.scss # Element Plus 覆盖
├── responsive.scss        # 响应式通用样式
└── utilities.scss         # 工具类

src/components/
├── ComponentName/
│   ├── ComponentName.vue  # 组件（包含 scoped 样式）
│   └── index.ts           # 导出
```

#### 8. 样式审查清单

开发时自检：

- [ ] 类名是否符合 BEM 规范？
- [ ] 是否使用了 CSS 变量而非硬编码值？
- [ ] 选择器嵌套是否超过 3 层？
- [ ] 是否跨组件覆盖了其他组件的样式？
- [ ] Teleport 内容是否在全局样式块中？
- [ ] 是否使用了 ID 选择器？（避免）
- [ ] 样式覆盖是否通过特异性或 CSS 变量解决？

#### 9. 常见问题解决方案

##### 问题：样式不生效

```scss
// 1. 检查选择器特异性
// 2. 使用浏览器开发工具查看哪个规则覆盖了你的样式
// 3. 通过增加特异性或使用 CSS 变量解决

// ✅ 方法一：增加特异性
.my-component .btn { color: red; }

// ✅ 方法二：使用 CSS 变量
.btn { color: var(--btn-color, red); }
```

##### 问题：暗色模式样式不生效

```scss
// 使用 CSS 变量，自动响应主题切换
.component {
  // 不需要写 html.dark .component {}
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}
```

##### 问题：Element Plus 组件样式覆盖

```scss
// 方法 1: 使用 :deep()
.my-wrapper :deep(.el-button) {
  border-radius: 20px;
}

// 方法 2: 使用 CSS 变量（推荐）
.my-wrapper {
  --el-button-border-radius: 20px;
}
```

#### 规则文件：`testing.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**/*.ts"]` · 说明：测试文件自动规则

### 测试开发规则

当编辑测试文件时，我会自动遵循以下规则：

#### 测试结构（强制）

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MyComponent from '../MyComponent.vue'

describe('MyComponent', () => {
  // ============ 测试准备 ============
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============ 渲染测试 ============
  describe('渲染', () => {
    it('应该正确渲染组件', () => {
      const wrapper = mount(MyComponent)
      expect(wrapper.exists()).toBe(true)
    })

    it('应该显示传入的标题', () => {
      const wrapper = mount(MyComponent, {
        props: { title: '测试标题' }
      })
      expect(wrapper.text()).toContain('测试标题')
    })
  })

  // ============ 交互测试 ============
  describe('交互', () => {
    it('点击按钮应该触发事件', async () => {
      const wrapper = mount(MyComponent)
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('click')).toBeTruthy()
    })
  })

  // ============ 边界情况 ============
  describe('边界情况', () => {
    it('空数据时应该显示空状态', () => {
      const wrapper = mount(MyComponent, {
        props: { data: [] }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
    })
  })

  // ============ 异步测试 ============
  describe('异步操作', () => {
    it('应该正确加载数据', async () => {
      vi.mock('@/api/user', () => ({
        getUser: vi.fn().mockResolvedValue({ data: { name: 'Test' } })
      }))
      
      const wrapper = mount(MyComponent)
      await wrapper.vm.$nextTick()
      
      expect(wrapper.text()).toContain('Test')
    })
  })
})
```

#### 测试命名规范

- 使用中文描述测试目的
- `应该...` 格式描述预期行为
- 按功能分组（describe 嵌套）

#### 覆盖要求

1. **正常路径** - 测试预期的正常流程
2. **边界条件** - 空值、极端值
3. **错误处理** - 异常和错误情况
4. **用户交互** - 点击、输入等操作

#### 自动执行

1. 为新代码生成测试用例
2. 确保测试覆盖关键路径
3. Mock 外部依赖
4. 添加边界条件测试

#### 规则文件：`typescript.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.ts", "**/*.tsx"]` · 说明：TypeScript 代码自动规则

### TypeScript 开发规则

当编辑或创建 `.ts` / `.tsx` 文件时，我会自动遵循以下规则：

#### 类型定义（强制）

1. **显式类型** - 函数参数和返回值必须有类型
```typescript
// ✅ 正确
function fetchUser(id: number): Promise<User> {}

// ❌ 错误
function fetchUser(id) {}
```

2. **接口优先** - 使用 interface 定义对象类型
```typescript
// ✅ 优先使用
interface User {
  id: number
  name: string
}

// 联合类型时使用 type
type Status = 'active' | 'inactive'
```

3. **避免 any** - 使用 unknown 或泛型替代
```typescript
// ❌ 避免
const data: any = {}

// ✅ 使用
const data: unknown = {}
const data: Record<string, unknown> = {}
```

#### 错误处理（强制）

```typescript
// 异步函数必须有 try-catch
async function fetchData() {
  try {
    const response = await api.get()
    return response.data
  } catch (error) {
    if (error instanceof AxiosError) {
      // 处理 HTTP 错误
    }
    throw error
  }
}
```

#### 命名规范

- 接口名：PascalCase，不加 I 前缀
- 类型名：PascalCase
- 变量/函数：camelCase
- 常量：UPPER_SNAKE_CASE
- 枚举值：PascalCase

#### 导入顺序

```typescript
// 1. 第三方库
import { ref } from 'vue'
import axios from 'axios'

// 2. 内部模块（绝对路径）
import { useUser } from '@/composables/useUser'
import type { User } from '@/types'

// 3. 相对路径导入
import { helper } from './utils'
```

#### 自动执行

1. 添加缺失的类型注解
2. 将 any 替换为更精确的类型
3. 添加错误处理
4. 优化导入顺序
5. 添加 JSDoc 注释

#### 规则文件：`vue-components.mdc`
> **作用域**：按需生效（alwaysApply=false） · 匹配文件：`["**/*.vue"]` · 说明：Vue 组件开发自动规则

### Vue 组件开发规则

当编辑或创建 `.vue` 文件时，我会自动遵循以下规则：

#### 组件结构（强制）

```vue
<template>
  <!-- 模板内容 -->
</template>

<script setup lang="ts">
// 1. 导入
import { ref, computed, onMounted } from 'vue'
import type { PropType } from 'vue'

// 2. Props 定义（使用 TypeScript 接口）
interface Props {
  modelValue?: string
}
const props = withDefaults(defineProps<Props>(), {
  modelValue: ''
})

// 3. Emits 定义
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

// 4. 响应式状态
const state = ref()

// 5. 计算属性
const computed = computed(() => {})

// 6. 方法
const handleClick = () => {}

// 7. 生命周期
onMounted(() => {})

// 8. 暴露给父组件
defineExpose({})
</script>

<style scoped>
/* 样式 */
</style>
```

#### 自动执行

1. **Props 类型检查** - 确保所有 Props 都有 TypeScript 类型
2. **事件定义** - 使用 defineEmits 定义所有事件
3. **响应式** - 正确使用 ref/reactive/computed
4. **样式隔离** - 使用 scoped 或 CSS Modules
5. **命名规范** - 组件名 PascalCase，事件名 kebab-case
6. **性能优化** - 避免不必要的响应式，使用 shallowRef 优化

#### 禁止事项

- ❌ 不使用 Options API
- ❌ 不使用 any 类型
- ❌ 不在 template 中写复杂逻辑
- ❌ 不跨组件直接覆盖子组件样式（使用 CSS 变量传递）
