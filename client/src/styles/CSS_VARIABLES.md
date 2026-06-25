# CSS 变量文档

本文档记录项目中使用的所有 CSS 变量，方便后续维护和主题定制。

> **说明**：下文代码块中的色值（如 `（--el-text-color-primary）`、`rgba(...)`）仅为变量含义/fallback 的示例说明，实际代码中禁止硬编码，须使用 `var(--variable-name)`。

## 颜色变量

### 主色调
```css
--el-color-primary: （--el-text-color-primary）;           /* 亮色模式主色 */
--el-color-primary-light-3: （--color-gray-333）;   /* 主色浅色变体 3 */
--el-color-primary-light-5: （--color-gray-666）;   /* 主色浅色变体 5 */
--el-color-primary-light-7: （--color-gray-999）;   /* 主色浅色变体 7 */
--el-color-primary-light-9: （--color-neutral-200）;   /* 主色浅色变体 9 */
```

### 暗色模式主色调
```css
--el-color-primary: （--el-bg-color）;           /* 暗色模式主色 */
--el-color-primary-light-3: （--color-neutral-300）;   /* 主色浅色变体 3 */
--el-color-primary-light-5: （--color-neutral-400）;   /* 主色浅色变体 5 */
--el-color-primary-light-7: （--color-neutral-500）;   /* 主色浅色变体 7 */
--el-color-primary-light-9: （--color-neutral-700）;   /* 主色浅色变体 9 */
```

### 语义色
```css
--el-color-success: （--color-green-22c55e）;           /* 成功色 */
--el-color-warning: （--el-text-color-primary）;           /* 警告色 */
--el-color-danger: （--color-red-ef4444）;            /* 危险色 */
--el-color-info: （--el-text-color-primary）;              /* 信息色 */
```

### 背景色
```css
--el-bg-color: （--color-neutral-f7f8fa）;                /* 容器背景色 */
--el-bg-color-page: （--el-bg-color）;           /* 页面背景色 */
--el-bg-color-hover: （--el-bg-color）;          /* 悬停背景色 */
--el-fill-color: （--color-neutral-100）;              /* 填充色 */
--el-fill-color-light: （--color-gray-fafafa）;        /* 浅填充色 */
--el-fill-color-lighter: （--el-bg-color）;      /* 更浅填充色 */
```

### 暗色模式背景色
```css
--el-bg-color: （--color-dark-bg-3）;                /* 容器背景色 */
--el-bg-color-page: （--el-text-color-primary）;           /* 页面背景色 */
--el-bg-color-hover: （--color-dark-bg-5）;          /* 悬停背景色 */
--el-fill-color: （--color-dark-bg-6）;              /* 填充色 */
--el-fill-color-light: （--color-gray-333）;        /* 浅填充色 */
```

### 文字色
```css
--el-text-color-primary: （--color-dark-bg-1）;      /* 主要文字色 */
--el-text-color-regular: （--color-gray-222）;      /* 常规文字色 */
--el-text-color-secondary: （--color-gray-333）;    /* 次要文字色 */
--el-text-color-placeholder: （--color-gray-999）;  /* 占位符文字色 */
```

### 暗色模式文字色
```css
--el-text-color-primary: （--el-bg-color）;      /* 主要文字色 */
--el-text-color-regular: （--color-neutral-200）;      /* 常规文字色 */
--el-text-color-secondary: （--color-neutral-400）;    /* 次要文字色 */
--el-text-color-placeholder: （--color-neutral-500）;  /* 占位符文字色 */
```

### 对比色 token（明暗模式自动适配）⚠️
**用途**：在 `var(--el-color-primary)` 背景上放置文字/图标时使用，自动切换明暗模式下的对比色。
- 亮色模式：primary=#000 → 对比色=#fff（黑底白字）
- 暗色模式：primary=#fff → 对比色=#000（白底黑字）

```css
--color-on-primary: #ffffff;              /* 亮色模式：白字 */
--color-on-primary: #000000;              /* 暗色模式：黑字 */
```

**铁律**：primary 背景上的文字/图标禁止用 `var(--el-color-white)`、`var(--el-text-color-primary)`、`#fff`、`#000`，必须用 `var(--color-on-primary)`。

### 透明度色板（亮色/暗色通用）
全站唯一写死处，所有 `rgba(255,255,255,x)` / `rgba(0,0,0,x)` 必须使用以下变量。
```css
/* 白色透明度阶梯 */
--color-white-0: rgba(255, 255, 255, 0);
--color-white-2: rgba(255, 255, 255, 0.02);
--color-white-3: rgba(255, 255, 255, 0.03);
--color-white-4: rgba(255, 255, 255, 0.04);
--color-white-5: rgba(255, 255, 255, 0.05);
--color-white-6: rgba(255, 255, 255, 0.06);
--color-white-8: rgba(255, 255, 255, 0.08);
--color-white-10: rgba(255, 255, 255, 0.1);
--color-white-12: rgba(255, 255, 255, 0.12);
--color-white-14: rgba(255, 255, 255, 0.14);
--color-white-15: rgba(255, 255, 255, 0.15);
--color-white-18: rgba(255, 255, 255, 0.18);
--color-white-20: rgba(255, 255, 255, 0.2);
--color-white-30: rgba(255, 255, 255, 0.3);
--color-white-35: rgba(255, 255, 255, 0.35);
--color-white-40: rgba(255, 255, 255, 0.4);
--color-white-45: rgba(255, 255, 255, 0.45);
--color-white-50: rgba(255, 255, 255, 0.5);
--color-white-60: rgba(255, 255, 255, 0.6);
--color-white-70: rgba(255, 255, 255, 0.7);
--color-white-72: rgba(255, 255, 255, 0.72);
--color-white-75: rgba(255, 255, 255, 0.75);
--color-white-80: rgba(255, 255, 255, 0.8);
--color-white-85: rgba(255, 255, 255, 0.85);
--color-white-90: rgba(255, 255, 255, 0.9);
--color-white-95: rgba(255, 255, 255, 0.95);
--color-white-96: rgba(255, 255, 255, 0.96);
--color-white-98: rgba(255, 255, 255, 0.98);

/* 黑色透明度阶梯 */
--color-black-2: rgba(0, 0, 0, 0.02);
--color-black-3: rgba(0, 0, 0, 0.03);
--color-black-04: rgba(0, 0, 0, 0.04);
--color-black-5: rgba(0, 0, 0, 0.05);
--color-black-6: rgba(0, 0, 0, 0.06);
--color-black-8: rgba(0, 0, 0, 0.08);
--color-black-10: rgba(0, 0, 0, 0.1);
--color-black-12: rgba(0, 0, 0, 0.12);
--color-black-15: rgba(0, 0, 0, 0.15);
--color-black-20: rgba(0, 0, 0, 0.2);
--color-black-25: rgba(0, 0, 0, 0.25);
--color-black-30: rgba(0, 0, 0, 0.3);
--color-black-40: rgba(0, 0, 0, 0.4);
--color-black-45: rgba(0, 0, 0, 0.45);
--color-black-50: rgba(0, 0, 0, 0.5);
--color-black-60: rgba(0, 0, 0, 0.6);
--color-black-70: rgba(0, 0, 0, 0.7);
--color-black-75: rgba(0, 0, 0, 0.75);
--color-black-80: rgba(0, 0, 0, 0.8);
--color-black-85: rgba(0, 0, 0, 0.85);
--color-black-87: rgba(0, 0, 0, 0.87);
--color-black-90: rgba(0, 0, 0, 0.9);
--color-black-95: rgba(0, 0, 0, 0.95);
```

### 语义色别名
全站唯一写死处，组件统一使用 `var(--el-color-*)`。
```css
--color-blue-1890ff: #1890ff;
--color-green-52c41a: #52c41a;
--color-red-f5222d: #f5222d;
--color-red-ff4d4f: #ff4d4f;
--color-orange-fa8c16: #fa8c16;
--color-purple-722ed1: #722ed1;
```

### 品牌色及透明度变体
```css
--color-brand-blue: #1677ff;
--color-brand-blue-06: rgba(22, 119, 255, 0.06);
--color-blue-1890ff-04: rgba(24, 144, 255, 0.04);
--color-gray-light: #f0f0f0;
```

## 边框变量

```css
--border-unified-color: （--color-black-10）;        /* 统一边框色 - 亮色 */
--border-unified-color-hover: （--color-black-20）;  /* 边框悬停色 */
--dropdown-border-color: （--color-black-15）;      /* 下拉菜单边框色 */
```

### 暗色模式边框
```css
--border-unified-color: （--color-white-12）;        /* 统一边框色 - 暗色 */
--border-unified-color-hover: （--color-white-20）;   /* 边框悬停色 */
--dropdown-border-color: （--color-white-15）;       /* 下拉菜单边框色 */
```

## 圆角变量

```css
--global-border-radius: 6px;           /* 全局统一圆角 */
--el-input-border-radius: 6px;         /* 输入框圆角 */
--el-border-radius-base: 6px;          /* 基础圆角 */
--el-border-radius-round: 6px;         /* 圆形圆角 */
--el-border-radius-circle: 6px;        /* 圆形圆角 */
```

## 阴影变量

> **扁平化设计**（2026-06-24 封版统一）：所有 `--global-box-shadow` 已改为 `none`。如需为单元素恢复阴影，请使用 `border` 或 `outline` 替代。

```css
/* 扁平化：投影统一移除 */
--global-box-shadow: none;
--el-box-shadow: var(--global-box-shadow);
--el-box-shadow-light: var(--global-box-shadow);
--el-box-shadow-dark: var(--global-box-shadow);
```

## 间距变量

```css
--space-v: clamp(12px, 2vh, 24px);     /* 垂直间距 */
--space-h: clamp(12px, 3vw, 24px);     /* 水平间距 */
--grid-gap: clamp(10px, 2vw, 15px);    /* 栅格间距 */
```

## 布局变量

```css
--global-header-height: 60px;          /* 顶部菜单栏高度 */
--global-header-top-gap: 0px;          /* 顶部菜单栏间距 */
```

## 字体变量

```css
--global-font-family: var(--font-family-chinese);  /* 全局字体 */
--font-family-chinese: 'HarmonyOS Sans SC', sans-serif;  /* 中文字体 */
```

## 使用规范

### 0. 样式优先级（强制）

**不允许使用 `高优先级覆盖`，不允许使用高特异性选择器。**

- 不得使用 `高优先级覆盖`；覆盖样式请用 CSS 变量、单类、或 `@layer`。
- 不得使用 `.class.class` 或长链选择器堆叠特异性；需覆盖时用 `:where()` 降低前缀或用 Layer。
- 自检：运行 `npm run check:no-important`。详见 `.cursorrules` 与 `docs/IMPORTANT_AND_SPECIFICITY_AUDIT.md`。

### 1. 边框使用
```css
/* 正确 */
border: 1px solid var(--border-unified-color);

/* 错误 - 不要使用硬编码颜色 */
border: 1px solid （--color-neutral-200）;
```

### 2. 圆角使用
```css
/* 正确 */
border-radius: var(--global-border-radius);

/* 错误 - 不要使用硬编码值 */
border-radius: 6px;
```

### 3. 阴影使用
```css
/* 正确 */
box-shadow: var(--global-box-shadow);

/* 错误 - 不要使用硬编码值 */
box-shadow: 0 2px 8px （--color-black-6）;
```

### 4. 背景色使用
```css
/* 正确 */
background-color: var(--el-bg-color);

/* 错误 - 不要使用硬编码颜色 */
background-color: （--el-bg-color）;
```

## 样式模块列表

| 模块文件 | 用途 |
|---------|------|
| `_variables-unified.scss` | 统一变量定义 |
| `_animations-unified.scss` | 动画系统 |
| `_layouts-unified.scss` | 布局容器 |
| `_typography-unified.scss` | 排版系统 |
| `_components-unified.scss` | 通用组件 |
| `_element-plus-overrides.scss` | Element Plus 覆盖 |
| `_cards-unified.scss` | 卡片样式 |
| `_buttons-unified.scss` | 按钮样式 |
| `_home-unified.scss` | 首页样式 |
| `_login-unified.scss` | 登录页样式 |
| `_ai-chat-unified.scss` | AI 聊天样式 |
| `_user-unified.scss` | 用户组件样式 |
| `_dialogs-unified.scss` | 对话框样式 |
| `_forms-unified.scss` | 表单样式 |
| `_navigation-unified.scss` | 导航栏样式 |
| `_mobile-unified.scss` | 移动端样式 |
| `_settings-unified.scss` | 设置面板样式 |
| `_file-manager-unified.scss` | 文件管理器样式 |
| `_pdf-viewer-unified.scss` | PDF 查看器样式 |
| `_tables-unified.scss` | 表格样式 |
| `_lists-unified.scss` | 列表样式 |
| `_notifications-unified.scss` | 通知提示样式 |
| `_loading-unified.scss` | 加载状态样式 |
| `_tabs-unified.scss` | 标签页样式 |
| `_tooltips-unified.scss` | 工具提示样式 |
| `_charts-unified.scss` | 图表样式 |
| `_dark-mode-unified.scss` | 暗色模式样式 |

## 注意事项

1. **禁止使用 `高优先级覆盖`**（项目强制规范，见根目录 `.cursorrules`）  
   - 原因：会导致后续修改、调整、维护时样式难以覆盖，修改不生效。  
   - 替代：用 `:where()` 降低上游特异性，或 CSS Layer、调整加载顺序、单一包裹类覆盖。

2. **禁止使用高特异性选择器**（同上）  
   - 禁止 `.class.class`、长链 `html.dark body .page .section ...` 等堆叠。  
   - 替代：单条选择器保持 1～2 层关系；用 CSS Layers 和 `:where()` 管理优先级。

3. **统一使用 CSS 变量** - 避免硬编码颜色和数值  
4. **支持暗色模式** - 所有组件必须支持暗色模式  
5. **响应式设计** - 使用媒体查询适配移动端  
6. **检查命令** - 运行 `npm run check:no-important` 扫描违规（历史遗留见 `docs/IMPORTANT_AND_SPECIFICITY_AUDIT.md`）
