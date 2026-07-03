# AGENTS.md — 项目通用 Agent 行为规范

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


