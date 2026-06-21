# 样式性能监控指南

## 概述

本文档说明如何使用CSS性能监控工具和视觉回归测试。

---

## 性能监控

### 运行性能检查

```bash
npm run check:performance
```

### 性能指标

| 指标 | 说明 | 目标值 |
|------|------|--------|
| 总大小 | CSS文件总大小 | < 300 KB |
| 大文件 | 超过500行的文件 | < 3个 |
| 选择器深度 | 平均选择器嵌套层级 | < 3 |
| 硬编码颜色 | 未使用CSS变量的颜色 | < 500 |

### 性能得分

- **90-100**: 优秀 ✅
- **70-89**: 良好 ⚠️
- **0-69**: 需优化 ❌

---

## 视觉回归测试

### 运行测试

```bash
# 运行视觉回归测试
npm run test:visual

# 更新快照基准
npm run test:visual:update
```

### 测试覆盖

| 测试项 | 说明 |
|--------|------|
| 页面渲染 | 主要页面在不同视口下的渲染 |
| 暗色模式 | 暗色模式下的样式显示 |
| CSS变量 | 验证CSS变量正确加载 |
| 响应式 | 移动端布局适配 |

### 视口配置

| 设备 | 分辨率 |
|------|--------|
| Desktop | 1920x1080 |
| Tablet | 768x1024 |
| Mobile | 375x667 |

---

## CI集成

### 性能检查

```yaml
- name: Check CSS Performance
  run: npm run check:performance
```

### 视觉测试

```yaml
- name: Run Visual Tests
  run: npm run test:visual
```

---

## 最佳实践

### 1. 定期检查

```bash
# 每周运行
npm run check:performance
npm run test:visual
```

### 2. 提交前

```bash
npm run check:health
npm run check:performance
```

### 3. 性能优化

- 减少CSS文件大小
- 简化选择器嵌套
- 使用CSS变量替代硬编码颜色
- 按需加载CSS

---

## 相关文档

- [STYLE_INDEX.md](./STYLE_INDEX.md) - 文档索引
- [STYLE_CI_GUIDE.md](./STYLE_CI_GUIDE.md) - CI/CD集成
