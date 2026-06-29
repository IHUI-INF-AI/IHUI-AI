# 样式维护指南

## 概述

本文档提供样式系统的日常维护流程和最佳实践，确保样式代码的长期健康。

---

## 一、日常维护流程

### 1. 开发前检查
```bash
# 检查样式健康度
npm run check:health

# 检查硬编码颜色（`npm run check:colors` 已移除，建议用 stylelint 或手动检查 var(--...) 替代）
# npm run check:colors  # 已移除

# 检查CSS变量使用
npm run check:variables
```

### 2. 开发中规范
- 使用CSS变量而非硬编码颜色
- 遵循文件分配规则
- 保持选择器简洁

### 3. 提交前检查
```bash
# 完整检查
npm run lint:all

# 样式检查
npm run style:check
```

---

## 二、健康度指标

### 目标值

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| 总体得分 | ≥90 | 85 | ⚠️ |
| 文件结构 | 100 | 100 | ✅ |
| CSS变量 | ≥80 | 50 | ❌ |
| 硬编码颜色 | ≥80 | 90 | ✅ |
| Stylelint | 100 | 100 | ✅ |
| 文件大小 | ≥80 | 85 | ✅ |

### 改进计划

1. **CSS变量优化** (紧急)
   - 清理663个未使用变量
   - 合并159个重复定义
   - 预期提升至80+

2. **硬编码颜色优化** (中期)
   - 替换3189处硬编码颜色
   - 使用CSS变量统一管理
   - 预期提升至95+

---

## 三、工具使用指南

### 样式检查工具

| 工具 | 命令 | 用途 |
|------|------|------|
| 样式检查 | `npm run style:check` | Stylelint检查 |
| 样式修复 | `npm run style:fix` | 自动修复问题 |
| 样式报告 | `npm run style:report` | 文件大小统计 |
| 样式统计 | `npm run style:stats` | 行数统计 |

### 健康度检查工具

| 工具 | 命令 | 用途 |
|------|------|------|
| 综合健康度 | `npm run check:health` | 总体健康评分 |
| 硬编码颜色 | `npm run check:colors`（已移除） | 建议用 stylelint 或手动检查 |
| CSS变量分析 | `npm run check:variables` | 变量使用分析 |
| 智能清理 | `npm run check:smart-cleanup` | 变量清理建议 |

---

## 四、问题处理指南

### 问题1：硬编码颜色过多

**症状**: 硬编码颜色扫描报告大量匹配（`npm run check:colors` 已移除，建议用 stylelint 或手动检查）

**解决方案**:
1. 用 stylelint 或手动搜索 `#`、`rgb(`、`rgba(` 查看详情（`npm run check:colors` 已移除）
2. 优先替换高频出现的颜色
3. 使用CSS变量替代

**示例**:
```scss
// ❌ 硬编码
.button { background: （--el-text-color-primary）; }

// ✅ CSS变量
.button { background: var(--el-color-primary); }
```

### 问题2：未使用CSS变量过多

**症状**: `npm run check:variables` 报告大量未使用变量

**解决方案**:
1. 运行 `npm run check:smart-cleanup` 查看分类
2. 删除标记为✅的安全变量
3. 审查标记为🔍的全局变量
4. 保留标记为🔒的保护变量

### 问题3：Stylelint报错

**症状**: `npm run style:check` 报错

**解决方案**:
1. 运行 `npm run style:fix` 自动修复
2. 手动修复无法自动处理的问题
3. 检查选择器复杂度

---

## 五、定期维护任务与场景执行指引

**说明**：以下为样式定期维护时按周期勾选的任务清单。按「场景执行步骤」操作即可完整做完。

### 场景执行步骤（按周期做）

**每周**：运行 `npm run lint` 与 `npm run build`，确认无新增样式错误；若有 `npm run check:health` 则运行并对比上次得分。抽查新增文件是否引入硬编码颜色（`npm run check:colors` 已移除，建议用 stylelint 或手动搜索 `#`、`rgb(` 等关键字），若有则改为 CSS 变量（见 dark-mode-guide §7）。

**每月**：若有 `npm run check:smart-cleanup` 则运行；否则在 `_design-tokens.scss`、`variables.scss` 及各 `*-unified.scss` 中人工查找未引用变量并评估是否可删。更新本指南或 STYLE_FLATTEN 等文档中的示例与链接。

**每季度**：通读 `src/styles` 目录结构，检查单文件是否过大（可考虑拆成多个 partial）；设计令牌是否有新增或废弃，同步更新 `_design-tokens.scss` 与文档。

### 每周任务
- [ ] 运行 `npm run check:health`（若未配置则用 `npm run lint` + `npm run build`）
- [ ] 检查健康度/构建结果变化，处理新增告警
- [ ] 处理新增的硬编码颜色（搜索并替换为变量）

### 每月任务
- [ ] 运行 `npm run check:smart-cleanup`（若未配置则人工审查未使用变量）
- [ ] 清理未使用的 CSS 变量（确认无引用后再删）
- [ ] 更新样式文档（本指南、STYLE_FLATTEN、design-tokens 说明）

### 每季度任务
- [ ] 全面审查样式架构（目录、命名、拆分是否合理）
- [ ] 优化大文件结构（单文件过大可拆 partial）
- [ ] 更新设计令牌（_design-tokens 与文档一致）

---

## 六、最佳实践

### 1. CSS变量使用
```scss
// ✅ 推荐
.element {
  color: var(--el-text-color-primary);
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

// ❌ 避免
.element {
  color: （--color-gray-333）;
  background: （--el-bg-color）;
  border-radius: 8px;
}
```

### 2. 选择器命名
```scss
// ✅ 推荐：BEM命名
.card { }
.card__header { }
.card__body { }
.card--featured { }

// ❌ 避免：嵌套过深
.container .wrapper .content .card .header { }
```

### 3. 文件组织
```scss
// ✅ 推荐：按功能分文件
// _buttons.scss - 按钮样式
// _inputs.scss - 输入框样式
// _cards.scss - 卡片样式

// ❌ 避免：混合多种样式
// styles.scss - 包含所有样式
```

---

## 七、故障排除

### Q: 样式不生效？
1. 检查CSS变量是否正确定义
2. 检查选择器优先级
3. 运行 `npm run style:check`

### Q: 暗色模式异常？
1. 使用CSS变量而非硬编码
2. 检查 `html.dark` 选择器
3. 验证变量在暗色模式下的值

### Q: 构建体积过大？
1. 运行 `npm run style:report` 查看文件大小
2. 清理未使用的CSS变量
3. 合并重复的样式规则

---

## 八、相关文档

- [STYLE_INDEX.md](./STYLE_INDEX.md) - 文档索引
- [STYLE_QUICK_REFERENCE.md](./STYLE_QUICK_REFERENCE.md) - 快速参考
- [STYLE_GUIDE.md](./STYLE_GUIDE.md) - 完整规范
- [STYLE_MIGRATION_GUIDE.md](./STYLE_MIGRATION_GUIDE.md) - 迁移指南
