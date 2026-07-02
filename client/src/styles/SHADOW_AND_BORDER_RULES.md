# 投影与描边规则（SHADOW_AND_BORDER_RULES）

> 本文件定义全站 CSS 投影（box-shadow）与描边（border/outline）的统一规范。
> 适用范围：`src/components/`、`src/views/`、`src/styles/` 下所有 .vue / .scss / .css 文件。
> 违反本规范需走 PR review 并在项目记忆中补充例外说明。

---

## 一、核心原则

### 1.1 扁平化设计（Flat Design）

- **禁止 box-shadow**：所有 UI 元素默认无投影，靠 `border` + `border-color` 变化区分层级与状态。
- **使用统一描边**：仅使用 `var(--unified-border)` 或 `var(--unified-border-bottom)`（定义在 [element-plus-vars.scss](file:///g:/IHUI-AI/client/src/styles/element-plus-vars.scss)）。
- **禁止单独写 `1px solid <color>`**：必须用 `var(--unified-border)` 携带颜色与宽度。

### 1.2 例外场景（允许使用 box-shadow）

| 场景 | 用途 | 推荐值 |
|---|---|---|
| Dialog / Drawer 外层容器 | 与页面背景分离 | `var(--login-dialog-shadow)` |
| 悬浮按钮（FAB） | 提示"可点击" | `0 8px 20px rgba(37, 99, 235, 0.32)` |
| 消息 toast / notification | 浮层感 | Element Plus 默认 |
| 第三方登录图标 hover | 浮起反馈 | `0 6px 14px rgba(37, 99, 235, 0.20)` |
| 发送按钮 `is-ready` | 状态强调 | `0 2px 6px rgba(37, 99, 235, 0.22)` |

> **原则**：按钮/容器的浮起投影是允许的，**输入框/表单元素的 0 0 0 Npx 外环发光绝不允许**。

---

## 二、输入框与表单元素硬性规范（硬约束）

### 2.1 绝对禁止（零容忍）

```scss
/* ❌ 禁止：Bootstrap 风格蓝色外环发光 */
.input:focus,
.el-input__wrapper:focus-within,
.verification-code-digit:focus {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);  /* 蓝色外环 */
  box-shadow: 0 0 0 4px rgba(160, 196, 255, 0.30); /* 浅蓝外环 */
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.14);  /* 半透明蓝外环 */
}
```

**违规样式关键词**（任意一条命中即违规）：
- `box-shadow` 中含 `0 0 0 \d+px`（外环模式）— 任何颜色都视为发光
- `box-shadow` 应用于 `:focus`、`:focus-within`、`.is-focus`、`[data-focused="true"]` 等聚焦态选择器

### 2.2 推荐做法（border-only）

```scss
/* ✅ 正确：仅 border-color 变化 */
.el-input__wrapper {
  border: 1px solid #e4e7ed;
  transition: border-color 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: none;  /* 显式重置，避免 Element Plus 默认 */
}

.el-input__wrapper:hover {
  border-color: #a0c4ff;  /* 浅蓝 */
}

.el-input__wrapper:focus-within,
.el-input__wrapper.is-focus {
  border-color: #3b82f6;  /* 主蓝 */
}
```

### 2.3 暗色模式颜色规范

| 状态 | 亮色 border | 暗色 border |
|---|---|---|
| 默认 (default) | `#e4e7ed` | `#374151` |
| Hover | `#a0c4ff` | `#60a5fa` |
| Focus | `#3b82f6` | `#93c5fd` |
| Error | `--el-color-danger` | `--el-color-danger-light-3` |
| Success | `--el-color-success` | `--el-color-success-light-3` |
| Disabled | `--el-disabled-border-color` | `--el-disabled-border-color` |

> **暗色模式禁止**：使用 `rgba(0, 0, 0, X)` 做半透明边框背景 — 暗色背景下不可见。
> **暗色模式必须**：使用 `var(--color-white-N)` 透明度色板或显式 hex。

---

## 三、按钮投影规范

### 3.1 投影层级

```scss
/* ✅ 推荐：仅 1-2 层投影，控制范围 */
.el-button:hover {
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.22);  /* 一层柔和投影 */
}

.el-button:active {
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.30);   /* 按下时收缩 */
}
```

### 3.2 禁止行为

- ❌ 投影中混入 `0 0 0 Npx` 外环（即使是按钮）
- ❌ 投影范围超过 `0 16px 48px`（过于扩散）
- ❌ 投影透明度超过 `0.40`（过于浓重）
- ❌ hover 与 focus 用相同投影（focus 应该更明显）

### 3.3 暗色模式按钮投影

```scss
:where(html.dark) .el-button:hover {
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.30);  /* 暗色用更亮蓝 */
}
```

---

## 四、Dialog / Drawer / Popover 容器投影

### 4.1 弹窗外壳

```scss
/* ✅ 登录弹窗示例：多层柔和投影 */
.el-dialog.login-dialog {
  box-shadow:
    0 24px 64px rgba(15, 23, 42, 0.18),
    0 8px 24px rgba(15, 23, 42, 0.10),
    0 2px 6px rgba(15, 23, 42, 0.06);
}
```

### 4.2 暗色模式弹窗

```scss
:where(html.dark) .el-dialog.login-dialog {
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.55),
    0 8px 24px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.04);  /* 微白色内描边 */
}
```

> **暗色模式技巧**：在 `0 0 0 1px` 中使用极淡白色（`rgba(255, 255, 255, 0.04)`）做"内描边"，让弹窗与纯黑背景有清晰边界。这是 **唯一** 允许 `0 0 0 1px` 模式的场景。

---

## 五、Token 体系

### 5.1 全局 box-shadow token

```scss
/* 定义在 src/styles/_global-tokens.scss */
:root {
  --global-box-shadow: none;            /* 默认无投影 */
  --el-box-shadow: var(--global-box-shadow);
  --el-box-shadow-light: var(--global-box-shadow);
  --el-box-shadow-dark: var(--global-box-shadow);
}
```

### 5.2 局部模块 token

```scss
/* src/components/login/_login-tokens.scss */
$login-dialog-shadow:
  0 24px 64px rgba(15, 23, 42, 0.18),
  0 8px 24px rgba(15, 23, 42, 0.10),
  0 2px 6px rgba(15, 23, 42, 0.06);

$login-dialog-shadow-dark:
  0 24px 64px rgba(0, 0, 0, 0.55),
  0 8px 24px rgba(0, 0, 0, 0.35),
  0 0 0 1px rgba(255, 255, 255, 0.04);
```

### 5.3 透明度色板

```scss
/* 白色透明度阶梯（暗色模式专用） */
--color-white-2: rgba(255, 255, 255, 0.02);
--color-white-4: rgba(255, 255, 255, 0.04);
--color-white-8: rgba(255, 255, 255, 0.08);
--color-white-12: rgba(255, 255, 255, 0.12);

/* 黑色透明度阶梯（亮色模式专用） */
--color-black-2: rgba(0, 0, 0, 0.02);
--color-black-8: rgba(0, 0, 0, 0.08);
--color-black-12: rgba(0, 0, 0, 0.12);
```

---

## 六、Stylelint 强制规则

`.stylelintrc.json` 已配置 `declaration-property-value-disallowed-list` 规则检测违规模式。

未来增强计划（v2）：
- 编写自定义 plugin `stylelint-plugin-no-input-glow.cjs`
- 检测 `:focus` / `:focus-within` / `.is-focus` 状态下的 `box-shadow` 模式
- 检测 `0 0 0 \d+px rgba(blue-color)` 模式（蓝色外环）
- 错误信息：`禁止在输入框聚焦态使用 box-shadow 外环发光，请改用 border-color 变化`

---

## 七、参考案例

### ✅ 优秀案例（可复用）

- [UniversalLogin.vue](file:///g:/IHUI-AI/client/src/components/login/UniversalLogin.vue) — 弹窗版登录表单，纯 border 变化
- [Login.vue.styles.scss](file:///g:/IHUI-AI/client/src/views/Login.vue.styles.scss) — 整页版登录容器
- [_input-area.scss](file:///g:/IHUI-AI/client/src/styles/ai-chat/_input-area.scss) — AI Chat 输入框，扁平化重构

### ❌ 反面教材（已修复）

- 早期 `_input-area.scss` 使用 `box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12)` — **已删除**（2026-07-01）
- 早期 `UniversalLogin.vue` 使用 `--ulogin-input-focus-glow` 变量 — **已删除**（2026-07-01）
- 早期 `VerificationCodeInput.vue` 数字框使用 `box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12)` — **已删除**（2026-07-01）
- 早期 `CaptchaInput.vue` 图片使用 `box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12)` — **已删除**（2026-07-01）
- 早期 `AccountBindDialog.vue` 使用 `box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12)` — **已删除**（2026-07-01）

---

## 八、变更历史

| 日期 | 操作 | 文件 |
|---|---|---|
| 2026-07-01 | 创建本文档 | `src/styles/SHADOW_AND_BORDER_RULES.md` |
| 2026-07-01 | 删除 login 模块全部输入框 box-shadow 发光 | 5 个文件 |
| 2026-07-01 | 删除 AI Chat 输入框 box-shadow 发光 | `_input-area.scss` |
| 待办 | 添加 stylelint 自定义 plugin | `.stylelintrc.json` |

---

> **违反本规则的 PR 将被直接拒绝。** 任何例外必须在本文件登记并经项目负责人批准。
