# 登录模块图标库 (login-icons.ts)

> 单一来源 / 登录场景统一图标库  
> 严格对齐侧边栏 `Sidebar.vue` 的图标规范 (24×24 viewBox + 2px stroke + currentColor 继承)

## 1. 规范总览

| 维度 | 规范 | 备注 |
|------|------|------|
| **viewBox** | `0 0 24 24` | 与 Lucide 默认一致, 坐标系统一 |
| **stroke-width** | `2` | 强调线条清晰度, 与侧边栏严格一致 |
| **stroke-linecap** | `round` | 端点圆润 |
| **stroke-linejoin** | `round` | 拐角圆润 |
| **fill** | `none` (除 `MailIcon` 标识场景) | 默认无填充, 仅描边 |
| **stroke** | `currentColor` | 颜色继承父级, 便于 hover/focus 调色 |
| **尺寸** | `1em × 1em` | 跟随父级 `font-size` 缩放, 默认 16px |
| **渲染方式** | `h('svg', ...)` + `markRaw` | 跳过响应式代理, 性能优 |

## 2. 使用方式

```vue
<script setup lang="ts">
import { UserIcon, LockIcon } from '@/components/login/icons/login-icons'
</script>

<template>
  <!-- 输入框前缀 -->
  <el-input v-model="username">
    <template #prefix>
      <component :is="UserIcon" class="input-icon" />
    </template>
  </el-input>

  <!-- Tab 标签 -->
  <component :is="UserTabIcon" class="tab-icon" />
</template>

<style scoped>
/* 1em 让图标随父级 font-size 缩放 (默认 16px → 16×16 显示) */
.input-icon { width: 1em; height: 1em; color: var(--el-text-color-placeholder); }
.tab-icon   { width: 1em; height: 1em; transition: transform 0.22s; }
</style>
```

### 2.1 关键约束

- ✅ **必须** 通过 `markRaw` 包装的组件 + `:is` 动态渲染
- ✅ **必须** 在 DOM 上挂载 `class="input-icon"` / `class="tab-icon"` 等语义化类名
- ❌ **禁止** 在模板内直接写 `<svg>...</svg>` 内联图标 (会绕过规范)
- ❌ **禁止** 使用 `el-icon` / `lucide-fallback` / `@element-plus/icons-vue` 中的同语义图标

## 3. 图标清单 (按用途分组)

### 3.1 Tab 标签图标 (`TabSwitcher` 专用)

| 导出名 | Lucide 对应 | 用途 | 注册位置 |
|--------|-------------|------|----------|
| `UserTabIcon` | `User` | 账号登录 tab | `components/login/components/TabSwitcher.vue` |
| `PhoneTabIcon` | `Phone` | 手机号登录 tab | 同上 |
| `EnterpriseTabIcon` | `Building2` | 企业登录 tab (预留) | 当前未使用, 保留扩展 |

### 3.2 输入框前缀图标

| 导出名 | Lucide 对应 | 用途 | 注册位置 |
|--------|-------------|------|----------|
| `UserIcon` | `User` | 用户名输入 | `forms/AccountLoginForm.vue`, `forms/AccountForm.vue` |
| `MailIcon` | `Mail` | 邮箱输入 (注册模式) | `forms/AccountForm.vue`, `forms/RegisterForm.vue` |
| `PhoneIcon` | `Phone` | 手机号输入 | `forms/PhoneLoginForm.vue`, `forms/PhoneForm.vue`, `forms/PasswordReset.vue`, `PhoneBindingDialog.vue` |
| `KeyIcon` | `Key` | 图形验证码输入 | `components/CaptchaInput.vue` |
| `KeyRoundIcon` | `KeyRound` | 短信验证码输入 | `forms/PhoneLoginForm.vue`, `forms/PhoneForm.vue`, `forms/PasswordReset.vue` |
| `LockIcon` | `Lock` | 密码输入 | `forms/AccountLoginForm.vue`, `forms/AccountForm.vue`, `forms/PasswordReset.vue` |
| `ClockIcon` | `Clock` | 历史账号下拉 | `forms/AccountLoginForm.vue` |

### 3.3 操作类图标

| 导出名 | Lucide 对应 | 用途 | 注册位置 |
|--------|-------------|------|----------|
| `CloseIcon` | `X` | 关闭按钮 | `UniversalLogin.vue` |
| `EyeIcon` | `Eye` | 密码显示 | `PasswordToggleIcon.vue`, `forms/*.vue` |
| `EyeOffIcon` | `EyeOff` | 密码隐藏 | 同上 |
| `RefreshIcon` | `RefreshCw` | 图形验证码刷新 | `components/CaptchaInput.vue` |
| `SearchIcon` | `Search` | 搜索 (预留) | 当前未使用 |
| `ArrowDownIcon` | `ChevronDown` | 国家区号下拉 | `PhoneBindingDialog.vue` |
| `ForgotPasswordIcon` | `KeyRound` (别名) | 忘记密码 | `iconMap.forgot-password` |
| `DocumentCheckedIcon` | `FileCheck` | 协议确认徽章 | `UniversalLogin.vue` |
| `MessageSquareIcon` | `MessageSquare` | 邮箱验证方式 radio | `auth/PasswordReset.vue` |
| `CircleCheckIcon` | `CircleCheck` | 密码重置成功徽章 | `auth/PasswordReset.vue` |
| `InfoIcon` | `Info` | 企业模式 banner | 当前未使用, 保留扩展 |

## 4. `iconMap` 动态查找

提供字符串 key → 组件映射, 便于业务侧按名称动态选择:

```ts
import { iconMap } from '@/components/login/icons/login-icons'

// 使用:
const PhoneIcon = iconMap['phone']
```

支持 key: `user-tab` / `phone-tab` / `enterprise-tab` / `user` / `mail` / `phone` / `key` / `key-round` / `lock` / `clock` / `close` / `info` / `eye` / `eye-off` / `refresh` / `search` / `arrow-down` / `forgot-password` / `document-checked` / `message-square` / `circle-check`

## 5. 颜色规范

### 5.1 默认 (静态)

```css
.input-icon {
  color: var(--el-text-color-placeholder);  /* 浅色 #a8abb2, 暗色 #6b6c75 */
}
```

### 5.2 hover / focus (交互态)

| 模式 | 颜色 | 备注 |
|------|------|------|
| 浅色 hover | `#a0c4ff` | 边框 hover 色, 同步图标 |
| 浅色 focus | `#3b82f6` | 边框 focus 色, 同步图标 |
| 暗色 hover | `#60a5fa` | |
| 暗色 focus | `#93c5fd` | |

具体实现在各 form 的 CSS: `.input:hover .input-icon` / `.el-input.is-focus .input-icon`。

### 5.3 协议徽章 (特殊)

```css
.agreement-confirm-icon {
  color: #ffffff;            /* 圆形徽章内白图标 */
  background: var(--color-primary);  /* 蓝底 */
}
```

## 6. 微动效约定 (Tab 图标)

```css
.tab-icon {
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
              stroke-width 0.22s ease;
}

/* hover: 缩放 1.08 */
.tab-icon:hover { transform: scale(1.08); }

/* active: 描边加重 + 缩放 1.05 */
.is-active .tab-icon {
  stroke-width: 2.25;
  transform: scale(1.05);
}
```

## 7. 扩展指南

新增图标时按以下步骤:

1. **找到 Lucide 对应名**: https://lucide.dev/icons/ 搜索同语义图标
2. **保持几何参数**: `viewBox="0 0 24 24"`, `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`
3. **追加到 login-icons.ts** 底部 (按用途分组, 加 JSDoc 注释)
4. **加入 `iconMap` 映射** (如需动态查找)
5. **更新本文档** 的图标清单表格
6. **同步 stylelint-plugin-no-where-dark-css-var 检测**: 确保新文件不引入 `:where(html.dark) { --xxx: ... }` 模式
7. **运行回归测试**: `npx playwright test e2e/login-icons.spec.ts`

### 7.1 反例 (禁止)

```ts
// ❌ 错误: 写硬编码颜色
const UserIcon = createIcon('UserIcon', [
  h('circle', { cx: 12, cy: 8, r: 4, stroke: '#3b82f6' })
])

// ❌ 错误: 改 viewBox
const UserIcon = createIcon('UserIcon', [
  h('circle', { cx: 12, cy: 8, r: 4, viewBox: '0 0 32 32' })
])

// ❌ 错误: 改 stroke-width
const UserIcon = createIcon('UserIcon', [
  h('circle', { cx: 12, cy: 8, r: 4, 'stroke-width': '1.5' })
])
```

## 8. 已清理的依赖 (2026-07-02, 含 auth/PasswordReset.vue + user/LoginPopup.vue)

- ❌ `@element-plus/icons-vue` 在登录文件夹的引用: **0 条** (只保留 `<el-icon>` 包裹的子组件, 已替换为 `<component :is="XxxIcon">`)
- ❌ `lucide-fallback` 在登录文件夹的引用: **0 条** (其他业务模块仍保留 lucide-fallback 兜底)
- ❌ 模板内 `<el-icon><User /></el-icon>` 模式: **0 条** (全部改为 `*Icon` 命名规范)

## 9. 相关文件

- 图标库源: `client/src/components/login/icons/login-icons.ts`
- 兜底库 (业务侧保留): `client/src/lib/lucide-fallback.ts`
- 回归测试 (源码级 + 视觉级): `client/e2e/login-icons.spec.ts` (覆盖 11 个文件)
- 回归测试 (渲染级): `client/src/components/login/icons/__tests__/login-icons.test.ts` (21 图标 x 6 属性)
- 视觉验证脚本: `client/e2e/login-icons-snapshots.spec.ts`
- 输入框设计令牌: `client/src/components/login/_login-tokens.scss`
- 协议徽章 CSS: `client/src/components/login/_agreement-scoped.css`
- 输入框发光清理回归: `client/e2e/input-glow-cleanup.spec.ts`
