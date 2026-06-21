# CSS 变量命名规范

## 1. 命名约定

### 1.1 前缀规范

| 前缀 | 用途 | 示例 |
|------|------|------|
| `--el-` | Element Plus 官方变量 | `--el-color-primary` |
| `--global-` | 全局通用变量 | `--global-border-radius` |
| `--app-` | 应用级变量 | `--app-header-height` |
| `--{component}-` | 组件级变量 | `--footer-background` |

### 1.2 语义化命名

```scss
// ✅ 正确：语义化命名
--text-primary
--text-secondary
--bg-card
--border-light

// ❌ 错误：颜色值命名
--black-color
--white-bg
--gray-border
```

### 1.3 层级结构

```scss
// 基础层
--color-primary
--color-success
--color-warning
--color-danger

// 语义层
--text-primary
--text-secondary
--bg-page
--bg-card
--border-light

// 组件层
--button-bg
--input-border
--card-shadow
```

## 2. 颜色变量规范

### 2.1 Element Plus 颜色变量速查

```scss
// 主色调
--el-color-primary                    // 主色
--el-color-primary-light-{3,5,7,9}   // 主色浅色变体
--el-color-primary-dark-2            // 主色深色变体

// 功能色
--el-color-success                    // 成功色
--el-color-warning                    // 警告色
--el-color-danger                     // 危险色
--el-color-error                      // 错误色
--el-color-info                       // 信息色

// 文字颜色
--el-text-color-primary              // 主要文字
--el-text-color-regular              // 常规文字
--el-text-color-secondary            // 次要文字
--el-text-color-placeholder          // 占位文字
--el-text-color-disabled             // 禁用文字

// 背景颜色
--el-bg-color                        // 基础背景
--el-bg-color-page                   // 页面背景
--el-bg-color-overlay                // 遮罩背景

// 边框颜色
--el-border-color                    // 基础边框
--el-border-color-light              // 浅色边框
--el-border-color-lighter            // 更浅边框
--el-border-color-extra-light        // 超浅边框
--el-border-color-dark               // 深色边框

// 填充颜色
--el-fill-color                      // 基础填充
--el-fill-color-light                // 浅色填充
--el-fill-color-lighter              // 更浅填充
--el-fill-color-extra-light          // 超浅填充
--el-fill-color-dark                 // 深色填充
--el-fill-color-blank                // 空白填充
```

### 2.2 颜色使用场景

| 场景 | 推荐变量 |
|------|----------|
| 页面背景 | `var(--el-bg-color-page)` |
| 卡片背景 | `var(--el-bg-color)` |
| 主要文字 | `var(--el-text-color-primary)` |
| 次要文字 | `var(--el-text-color-secondary)` |
| 边框 | `var(--el-border-color-lighter)` |
| 分割线 | `var(--el-border-color-lighter)` |
| 悬停背景 | `var(--el-fill-color-light)` |
| 禁用状态 | `var(--el-text-color-disabled)` |

## 3. 间距变量规范

### 3.1 全局间距

```scss
:root {
  // 基础间距单位 (4px)
  --spacing-unit: 4px;
  
  // 间距比例
  --spacing-xs: calc(var(--spacing-unit) * 1);   // 4px
  --spacing-sm: calc(var(--spacing-unit) * 2);   // 8px
  --spacing-md: calc(var(--spacing-unit) * 3);   // 12px
  --spacing-lg: calc(var(--spacing-unit) * 4);   // 16px
  --spacing-xl: calc(var(--spacing-unit) * 6);   // 24px
  --spacing-2xl: calc(var(--spacing-unit) * 8);  // 32px
}
```

## 4. 圆角变量规范

```scss
:root {
  --global-border-radius: 8px;
  --global-border-radius-sm: 4px;
  --global-border-radius-lg: 12px;
  --global-border-radius-xl: 16px;
  --global-border-radius-full: 9999px;
}
```

## 5. 阴影变量规范

```scss
:root {
  --global-box-shadow: 0 2px 8px （--color-black-8）;
  --global-box-shadow-sm: 0 1px 4px （--color-black-5）;
  --global-box-shadow-lg: 0 4px 16px （--color-black-12）;
  --global-box-shadow-xl: 0 8px 32px （见设计变量）;
}

html.dark {
  --global-box-shadow: 0 2px 8px （--color-black-30）;
  --global-box-shadow-sm: 0 1px 4px （--color-black-20）;
  --global-box-shadow-lg: 0 4px 16px （--color-black-40）;
  --global-box-shadow-xl: 0 8px 32px （--color-black-50）;
}
```

## 6. 过渡动画规范

```scss
:root {
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;
  
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}
```

## 7. 组件样式模板

### 7.1 基础组件模板

```vue
<template>
  <div class="my-component">
    <!-- 内容 -->
  </div>
</template>

<style lang="scss" scoped>
.my-component {
  // 使用 CSS 变量
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  padding: var(--spacing-lg);
  transition: all var(--transition-normal);
  
  &:hover {
    background: var(--el-fill-color-light);
  }
  
  // 暗色模式适配（如需要特殊处理）
  :global(html.dark) & {
    // 暗色模式特定样式
  }
}
</style>
```

### 7.2 卡片组件模板

```vue
<style lang="scss" scoped>
.card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
  
  .card-header {
    color: var(--el-text-color-primary);
    border-bottom: 1px solid var(--el-border-color-lighter);
    padding: var(--spacing-lg);
  }
  
  .card-body {
    color: var(--el-text-color-regular);
    padding: var(--spacing-lg);
  }
  
  .card-footer {
    color: var(--el-text-color-secondary);
    border-top: 1px solid var(--el-border-color-lighter);
    padding: var(--spacing-md) var(--spacing-lg);
  }
}
</style>
```

## 8. 最佳实践

### 8.1 避免硬编码颜色

```scss
// ❌ 错误
.button {
  background: （--color-primary）;
  color: （--el-bg-color）;
}

// ✅ 正确
.button {
  background: var(--el-color-primary);
  color: var(--el-bg-color-page);
}
```

### 8.2 使用 CSS 变量回退值

```scss
// ✅ 推荐：提供回退值
.element {
  background: var(--custom-bg, var(--el-bg-color));
}
```

### 8.3 组件级变量定义

```scss
// 在组件内部定义组件级变量
.my-component {
  // 组件变量定义
  --component-bg: var(--el-bg-color);
  --component-text: var(--el-text-color-primary);
  --component-border: var(--el-border-color-lighter);
  
  // 使用组件变量
  background: var(--component-bg);
  color: var(--component-text);
  border: 1px solid var(--component-border);
}
```

### 8.4 暗色模式适配

```scss
// 方式一：使用 Element Plus 变量（自动适配）
.element {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

// 方式二：自定义暗色模式样式
.element {
  background: var(--el-bg-color);
  
  :global(html.dark) & {
    // 暗色模式特定样式
    background: var(--el-bg-color-overlay);
  }
}
```

## 9. 迁移指南

### 9.1 硬编码颜色迁移

| 硬编码颜色 | 替换为 |
|------------|--------|
| `（--el-text-color-primary）` | `var(--el-text-color-primary)` |
| `（--color-gray-333）` | `var(--el-text-color-regular)` |
| `（--color-gray-666）` | `var(--el-text-color-secondary)` |
| `（--color-gray-999）` | `var(--el-text-color-placeholder)` |
| `（--el-bg-color）` | `var(--el-bg-color)` |
| `（--color-neutral-100）` | `var(--el-bg-color-page)` |
| `（--color-gray-e4e7ed）` | `var(--el-border-color-lighter)` |
| `（--color-primary）` | `var(--el-color-primary)` |
| `（--color-success）` | `var(--el-color-success)` |
| `（--color-warning-variant）` | `var(--el-color-warning)` |
| `（--color-danger-variant）` | `var(--el-color-danger)` |

### 9.2 渐变色迁移

```scss
// ❌ 硬编码渐变
background: linear-gradient(135deg, （--el-text-color-primary） 0%, （--el-text-color-primary） 100%);

// ✅ 使用 CSS 变量
background: linear-gradient(
  135deg, 
  var(--el-color-primary) 0%, 
  var(--el-color-primary-light-3) 100%
);
```

## 10. 检测工具

使用项目中的检测脚本：

```bash
# 检查特定文件
npx tsx scripts/check-hardcoded-colors.ts src/views/YourFile.vue

# 检查多个文件
npx tsx scripts/check-hardcoded-colors.ts src/**/*.vue
```
