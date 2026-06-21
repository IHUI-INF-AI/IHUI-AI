# 样式开发快速参考卡片

## 🚀 快速命令

```bash
# 检查样式问题
npm run style:check

# 自动修复样式问题
npm run style:fix

# 查看样式文件统计
npm run style:stats

# 完整检查（ESLint + Stylelint）
npm run lint:all

# CI环境检查（不自动修复）
npm run lint:ci
```

## 📁 文件分配速查

| 样式类型 | 文件 | 示例 |
|----------|------|------|
| 按钮 | `_buttons.scss` | `.el-button`, `.card-action` |
| 输入框 | `_inputs.scss` | `.el-input`, `.el-select` |
| 卡片 | `_cards.scss` | `.card`, `.panel` |
| 暗色模式 | `_dark-mode.scss` | `html.dark` |
| Element Plus | `_element-plus.scss` | 组件覆盖 |
| 动画 | `animations.scss` | `@keyframes` |
| 响应式 | `responsive.scss` | `@media` |

## 🎨 CSS变量速查

```scss
// 圆角（唯一）
border-radius: var(--global-border-radius);  // 8px

// 描边（唯一）
border: 1px solid var(--border-unified-color);

// 投影（唯一）
box-shadow: var(--global-box-shadow);

// 主色调
color: var(--el-color-primary);  // 亮色（--el-text-color-primary）, 暗色（--el-bg-color）

// 背景
background: var(--el-bg-color);
background: var(--el-bg-color-page);

// 文字
color: var(--el-text-color-primary);
color: var(--el-text-color-regular);
color: var(--el-text-color-secondary);
```

## 📱 响应式断点

```scss
// 移动端优先写法
.component {
  padding: 16px;
  
  @media (min-width: 768px)  { padding: 24px; }  // 平板
  @media (min-width: 1024px) { padding: 32px; }  // 桌面
  @media (min-width: 1280px) { padding: 40px; }  // 大屏
}
```

## 🌙 暗色模式写法

```scss
// 正确：使用CSS变量
.component {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

// 需要特殊处理时
html.dark .component {
  // 暗色模式覆盖
}
```

## ❌ 禁止事项

```scss
// ❌ 禁止 !important
.element { color: red !important; }

// ❌ 禁止高特异性选择器
html body div.container div.content p { }

// ❌ 禁止硬编码颜色
.element { background: （--el-bg-color）; }

// ❌ 禁止重复定义
// 如果_buttons.scss已定义，不要在其他文件重复
```

## ✅ 推荐写法

```scss
// ✅ 使用CSS变量
.element {
  border-radius: var(--global-border-radius);
  border: 1px solid var(--border-unified-color);
}

// ✅ BEM命名
.card { }
.card__header { }
.card__body { }
.card--featured { }

// ✅ 简洁选择器
.header-nav-item { }
```

## 🔧 常见问题

### Q: 样式不生效？
1. 检查选择器优先级
2. 检查CSS变量是否正确
3. 运行 `npm run style:check`

### Q: 暗色模式异常？
1. 使用CSS变量而非硬编码
2. 检查 `html.dark` 选择器

### Q: Stylelint报错？
```bash
# 自动修复
npm run style:fix

# 查看具体错误
npm run style:check
```

## 📊 文件大小监控

```bash
# 查看所有样式文件行数
npm run style:stats
```

## 🔗 相关文档

- [STYLE_GUIDE.md](./STYLE_GUIDE.md) - 完整样式规范
- [STYLE_OPTIMIZATION_PLAN.md](./STYLE_OPTIMIZATION_PLAN.md) - 优化计划
