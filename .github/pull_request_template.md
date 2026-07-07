<!--
PR 模板 - RULE 1「先问再做」硬约束 (AGENTS.md 第 28 章, 2026-07-06 立)

适用判定:
  - 本 PR 涉及 UI 视觉改动 (组件样式 / 颜色 / 描边 / 圆角 / 暗色模式 / 布局):
    必填 5 项 RULE 1 checkbox + 截图验证
  - 本 PR 仅涉及后端 / 文档 / 测试 / 配置 / 构建:
    5 项 RULE 1 checkbox 可标"不适用 (N/A)", 但需在 description 中说明

不符合本模板的 PR 将被 CI 拒收 (check-rule1-pr-template.mjs 守门).
-->

## PR 类型

- [ ] ✨ 新功能 (feature)
- [ ] 🐛 Bug 修复 (fix)
- [ ] ♻️ 重构 (refactor)
- [ ] 📝 文档 (docs)
- [ ] 🔧 构建 / CI / 配置 (chore)
- [ ] 🎨 UI 视觉改动 (UI)  ← 如勾此项, 5 项 RULE 1 全部必填

## 1. 改动范围 (必填)

列出受影响的文件 / 组件 / 路由:

- 文件:
- 组件:
- 路由:
- 设计 token:

## 2. 模式 (必填)

UI 改动必须双模式验证 (暗色模式是默认强制项, 不可遗漏):

- [ ] 浅色模式已验证 (Light Mode)
- [ ] 暗色模式已验证 (Dark Mode)
- [ ] 双模式均无回归 (与原版对比)

## 3. 影响的 token (必填, UI 改动)

列出本次改动触碰的 CSS 变量 (--el-* / --app-* / --color-*):

- [ ] 无新增 token (仅复用现有 token)
- [ ] 新增了 token: `<token-name> = <value>` (如 `--app-sidebar-border: #2e2e2e`)
- [ ] 修改了现有 token: `<token-name>: <old> → <new>` (如 `--el-bg-color: #f7f8fa → #ffffff`)
- [ ] 同步更新了 DESIGN.md (新/改 token 必须反映在 DESIGN.md §2)
- [ ] 同步更新了 SCSS 定义 (`_global-tokens.scss` / `_dark-mode-global.scss`)

## 4. 守门规则 (必填, UI 改动)

列出本次改动触碰的守门脚本 (pre-commit / E2E):

- [ ] `check-no-pill-radius` (圆角 ≤ 8px, 禁胶囊)
- [ ] `check-sidebar-dark-tier` (侧边栏三态描边可见)
- [ ] `check-ai-dialog-border` (AI 浮窗专属描边色)
- [ ] `check-hero-cta-border` (hero-cta-btn 必须用 --app-sidebar-border)
- [ ] `check-button-text-contrast` (暗色按钮文字反色)
- [ ] `check-color-contrast-systemic` (系统级对比度 ≥ 4.5:1)
- [ ] `check-design-md` (DESIGN.md 9 节 + 关键 token 值未篡改)
- [ ] `check-pre-commit-hook-content` (.husky/pre-commit 26 项 check 齐)
- [ ] `check-rule1-commit-msg` (本次 commit message 已含 RULE1: 前缀)
- [ ] 其他: `<具体守门名>`

## 5. 验证方式 (必填, UI 改动)

- [ ] Puppeteer 截图 (light + dark) — 已附在 PR comments
- [ ] 视觉 diff (与 main 分支对比) — 已附截图
- [ ] E2E 测试 (`e2e/*.spec.ts`) — 新增 / 更新用例
- [ ] `npm run check:design-md --silent` — exit 0
- [ ] `npm run check:agents-md --silent` — exit 0
- [ ] `npm run check:pre-commit-hook-content --silent` — exit 0
- [ ] `npm run check:rule1:commit-msg` — exit 0 (历史 commit message 已含 RULE1:)

## 截图 / 录屏 (UI 改动必填)

### 浅色模式

<!-- 贴图 -->

### 暗色模式

<!-- 贴图 -->

### 视觉对比 (改动前 vs 改动后)

<!-- 贴图 -->

## 回归检查清单 (UI 改动必填)

- [ ] 全站 330 路由文字对比度扫描 (`audit-all-routes.mjs`) — 0 个 lumDiff < 50
- [ ] 浅色模式 / 暗色模式无色彩撞色 (Puppeteer 实测)
- [ ] 侧边栏 (登录态 + 未登录态) — header / footer / list item 三态描边可见
- [ ] AI 浮窗 (embedded + floating) — 描边色 + i18n placeholder 无英文键名裸露
- [ ] 弹窗 / Toast / Message Box — 暗色下无"双层蓝边 + 中间白线"视觉 bug
- [ ] 输入框 — 暗色下无"白底白字" / "浅灰底白字"问题
- [ ] 按钮 — 暗色下无"白底白字" / "蓝底蓝字"问题
- [ ] dev server 已完全重启 (杀 vite 进程 + 清 .vite 缓存, 仅 HMR 不更新 SCSS 缓存)

## 关联

- 关联 Issue: #<issue-number>
- AGENTS.md 章节: <第 XX 章>
- DESIGN.md 章节: <§X.X>
- 守门脚本: <client/scripts/check-*.mjs>
