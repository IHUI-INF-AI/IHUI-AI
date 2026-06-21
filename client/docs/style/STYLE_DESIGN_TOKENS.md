# 设计系统变量文档

## 概述

本文档记录所有设计系统预留的CSS变量，说明其用途和使用场景。

---

## 一、设计系统变量分类

### 1. 颜色系统变量

| 变量前缀 | 用途 | 示例 |
|----------|------|------|
| `--el-color-*` | Element Plus主题色 | `--el-color-primary` |
| `--el-text-*` | 文本颜色 | `--el-text-color-primary` |
| `--el-bg-*` | 背景颜色 | `--el-bg-color` |
| `--el-fill-*` | 填充颜色 | `--el-fill-color-light` |
| `--el-border-*` | 边框颜色 | `--el-border-color` |

### 2. 布局系统变量

| 变量前缀 | 用途 | 示例 |
|----------|------|------|
| `--global-*` | 全局样式 | `--global-border-radius` |
| `--border-*` | 统一边框 | `--border-unified-color` |
| `--radius-*` | 圆角 | `--radius` |

### 3. 组件系统变量

| 变量前缀 | 用途 | 示例 |
|----------|------|------|
| `--card-*` | 卡片组件 | `--card-foreground` |
| `--sidebar-*` | 侧边栏组件 | `--sidebar-background` |
| `--input-*` | 输入框组件 | `--input-border` |
| `--popover-*` | 弹出框组件 | `--popover-background` |

---

## 二、设计系统预留变量

以下变量位于 `styles/css-variables.scss`，是设计系统预留的标准变量：

### 颜色变量
```scss
--background          // 页面背景
--foreground          // 页面前景
--card                // 卡片背景
--card-foreground     // 卡片前景
--popover             // 弹出框背景
--popover-foreground  // 弹出框前景
--primary             // 主色
--primary-foreground  // 主色前景
--secondary           // 次要色
--secondary-foreground // 次要色前景
--muted               // 静音色
--muted-foreground    // 静音色前景
--accent              // 强调色
--accent-foreground   // 强调色前景
--destructive         // 危险色
--destructive-foreground // 危险色前景
```

### 边框变量
```scss
--border              // 边框颜色
--input               // 输入框边框
--ring                // 焦点环
--radius              // 圆角大小
```

### 侧边栏变量
```scss
--sidebar             // 侧边栏背景
--sidebar-foreground  // 侧边栏前景
--sidebar-primary     // 侧边栏主色
--sidebar-primary-foreground // 侧边栏主色前景
--sidebar-accent      // 侧边栏强调色
--sidebar-accent-foreground // 侧边栏强调色前景
--sidebar-border      // 侧边栏边框
--sidebar-ring        // 侧边栏焦点环
```

---

## 三、亮/暗模式变量

以下变量在亮色和暗色模式下有不同的值，这是预期的重复定义：

| 变量 | 亮色模式 | 暗色模式 |
|------|----------|----------|
| `--background` | （--el-bg-color） | （--color-dark-bg-1） |
| `--foreground` | （--color-dark-bg-1） | （--color-gray-fafafa） |
| `--card` | （--el-bg-color） | （--color-dark-bg-1） |
| `--primary` | （--color-dark-bg-1） | （--color-gray-fafafa） |
| `--muted` | （--color-neutral-100） | （--color-dark-bg-5） |
| `--accent` | （--color-neutral-100） | （--color-dark-bg-5） |
| `--border` | （--color-neutral-200） | （--color-dark-bg-5） |

---

## 四、变量使用指南

### 推荐使用
```scss
// 使用设计系统变量
.button {
  background: var(--el-color-primary);
  color: var(--el-text-color-primary);
  border-radius: var(--global-border-radius);
}
```

### 避免使用
```scss
// 避免硬编码颜色
.button {
  background: （--el-text-color-primary）;
  color: （--color-gray-333）;
  border-radius: 8px;
}
```

---

## 五、变量命名规范

### 前缀规范
- `--el-*` - Element Plus组件变量
- `--global-*` - 全局设计变量
- `--[组件名]-*` - 组件专用变量

### 命名模式
```scss
// 格式: --[作用域]-[属性]-[状态]
--el-color-primary
--el-text-color-primary
--card-background
--button-hover-bg
```

---

## 六、维护指南

### 添加新变量
1. 确定变量作用域（全局/组件）
2. 选择合适的前缀
3. 在对应文件中定义
4. 更新本文档

### 删除变量
1. 确认变量未被使用
2. 运行 `npm run check:variables` 验证
3. 从定义文件中删除
4. 更新本文档

### 修改变量值
1. 确认影响范围
2. 同时更新亮/暗模式值
3. 测试所有使用场景

---

## 七、相关文档

- [STYLE_INDEX.md](./STYLE_INDEX.md) - 文档索引
- [STYLE_GUIDE.md](./STYLE_GUIDE.md) - 完整样式规范
- [STYLE_MAINTENANCE_GUIDE.md](./STYLE_MAINTENANCE_GUIDE.md) - 维护指南
