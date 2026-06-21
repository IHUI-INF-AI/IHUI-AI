# 样式迁移指南

## 概述

本指南帮助开发者将旧样式迁移到新的模块化结构，确保样式代码的一致性和可维护性。

---

## 一、迁移步骤

### 1. 识别样式类型

首先确定你的样式属于哪个类别：

| 样式类型 | 目标文件 | 识别标志 |
|----------|----------|----------|
| 按钮 | `_buttons.scss` | `.el-button`, `.btn`, `.card-action` |
| 输入框 | `_inputs.scss` | `.el-input`, `.el-select`, `.el-textarea` |
| 卡片 | `_cards.scss` | `.card`, `.panel`, `.box` |
| 暗色模式 | `_dark-mode.scss` | `html.dark`, `:root.dark` |
| Element Plus | `_element-plus.scss` | `.el-*` 组件覆盖 |

### 2. 迁移流程

```
1. 定位旧样式代码
2. 确定目标模块文件
3. 复制样式到目标文件
4. 替换硬编码值为CSS变量
5. 删除旧代码
6. 运行 npm run style:check 验证
```

---

## 二、常见迁移模式

### 模式1：硬编码颜色 → CSS变量

```scss
// ❌ 迁移前
.button {
  background-color: （--el-text-color-primary）;
  border-radius: 8px;
  box-shadow: 0 2px 8px （--color-black-6）;
}

// ✅ 迁移后
.button {
  background-color: var(--el-color-primary);
  border-radius: var(--global-border-radius);
  box-shadow: var(--global-box-shadow);
}
```

### 模式2：重复选择器 → 合并

```scss
// ❌ 迁移前（分散在多个文件）
// file1.scss
.card { padding: 16px; }

// file2.scss
.card { margin: 8px; }

// ✅ 迁移后（合并到 _cards.scss）
// _cards.scss
.card {
  padding: 16px;
  margin: 8px;
}
```

### 模式3：暗色模式样式 → 统一位置

```scss
// ❌ 迁移前（分散在各文件）
// component.scss
.component { background: （--el-bg-color）; }
html.dark .component { background: （--el-text-color-primary）; }

// ✅ 迁移后（统一到 _dark-mode.scss）
// component.scss
.component { background: var(--el-bg-color); }

// _dark-mode.scss（如需特殊处理）
html.dark .component { }
```

---

## 三、迁移检查清单与场景执行指引

**说明**：以下为进行样式迁移时按阶段勾选的操作清单。按「场景执行步骤」操作即可完整做完。

### 场景执行步骤（按阶段做）

**迁移前**：确认要迁移的样式属于全局/模块/组件；在同一模块或全局样式中搜索相同选择器避免重复；确认目标文件（如 `src/styles/_xxx-unified.scss` 或组件 scoped）。

**迁移中**：用 §二 的 CSS 变量替换硬编码色值与尺寸；选择器保持 BEM、嵌套不超过 3 层；对复杂覆盖加注释说明用途。

**迁移后**：运行 `npm run lint`（若已配置 stylelint 会一并执行）；无 stylelint 时用 `npm run build` 确认无语法错误。在浏览器中切换亮色/暗色、缩放或窄屏测试布局；确认无误后删除已迁移的旧代码。

### 迁移前检查
- [ ] 确认样式类型（全局/模块/组件）
- [ ] 检查是否有重复定义（同文件或同模块内搜索）
- [ ] 确认目标模块文件（见 §一、§四）

### 迁移中检查
- [ ] 使用 CSS 变量替换硬编码（见 §二、dark-mode-guide §2.1）
- [ ] 保持选择器简洁（BEM、嵌套 ≤3 层）
- [ ] 添加必要注释（覆盖原因、设计令牌来源）

### 迁移后检查
- [ ] 运行 `npm run lint`（或 `npm run style:check` 若已配置）
- [ ] 测试亮色/暗色模式（设置中切换主题）
- [ ] 测试响应式布局（缩放、窄屏）
- [ ] 删除旧代码（仅删除已迁移且无引用部分）

---

## 四、迁移工具

### 自动检查命令
```bash
# 代码与样式检查（lint 中若配置了 stylelint 会一并执行）
npm run lint

# 若项目已配置 style:check / style:stats，可额外运行
# npm run style:check
# npm run style:stats
```

### VSCode快捷操作
1. 使用代码片段快速插入CSS变量
2. 保存时自动修复样式问题
3. 使用 `Ctrl+Shift+F` 全局搜索重复定义

---

## 五、迁移示例

### 示例1：按钮样式迁移

**迁移前** (index.scss):
```scss
.submit-btn {
  background: （--el-text-color-primary）;
  color: （--el-bg-color）;
  border-radius: 8px;
  padding: 12px 24px;
}
html.dark .submit-btn {
  background: （--el-bg-color）;
  color: （--el-text-color-primary）;
}
```

**迁移后** (_buttons.scss):
```scss
.submit-btn {
  background: var(--el-color-primary);
  color: var(--el-bg-color-page);
  border-radius: var(--global-border-radius);
  padding: 12px 24px;
}
```

### 示例2：输入框样式迁移

**迁移前** (component.scss):
```scss
.search-input {
  border: 1px solid （--el-text-color-primary）;
  border-radius: 4px;
}
.search-input:focus {
  border-color: （--el-text-color-primary）;
}
```

**迁移后** (_inputs.scss):
```scss
.search-input {
  border: 1px solid var(--border-unified-color);
  border-radius: var(--global-border-radius);
  
  &:focus {
    border-color: var(--el-color-primary);
  }
}
```

---

## 六、常见问题

### Q: 迁移后样式不生效？
A: 检查CSS变量是否正确定义，运行 `npm run style:check`

### Q: 如何处理复杂的暗色模式？
A: 优先使用CSS变量，特殊情况在 `_dark-mode.scss` 中处理

### Q: 迁移时发现重复定义怎么办？
A: 合并到目标模块文件，删除重复代码

---

## 七、获取帮助

- 查看 [STYLE_QUICK_REFERENCE.md](./STYLE_QUICK_REFERENCE.md) 快速参考
- 查看 [STYLE_GUIDE.md](./STYLE_GUIDE.md) 完整规范
- 运行 `npm run style:check` 检查问题
