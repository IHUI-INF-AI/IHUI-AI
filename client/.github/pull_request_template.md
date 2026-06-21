## 变更说明

<!-- 简要描述本次变更内容 -->

## 变更类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 样式优化
- [ ] 重构
- [ ] 测试
- [ ] 文档

## 视觉回归基线更新

> 如果本次变更涉及 UI 样式调整，视觉回归测试基线需要更新。

### 何时需要更新基线

- 修改了页面布局、颜色、字体、间距等样式
- 新增/删除了页面元素
- 主题色系调整
- 响应式断点变更

### 更新流程

```bash
# 1. 启动 dev 服务器
npm run dev

# 2. 更新所有视觉回归基线
npx playwright test e2e/visual-regression.spec.ts --project=chromium --update-snapshots

# 3. 仅更新指定页面基线（例如首页）
npx playwright test e2e/visual-regression.spec.ts -g "首页" --project=chromium --update-snapshots

# 4. 验证更新后的基线能通过测试
npx playwright test e2e/visual-regression.spec.ts --project=chromium
```

### 基线文件位置

- 视觉回归: `e2e/visual-regression.spec.ts-snapshots/*.png`
- 基线已标记为 binary（`.gitattributes`），git 不会产生文本 diff

### 检查清单

- [ ] 基线更新后，本地运行 `npx playwright test e2e/visual-regression.spec.ts` 全部通过
- [ ] 基线更新后，运行 `npm run typecheck && npm run tokens:check` 无报错
- [ ] PR 描述中说明基线更新的原因

## 测试验证

- [ ] `npm run typecheck` 通过
- [ ] `npm run lint` 通过
- [ ] `npm run tokens:check` 通过
- [ ] `npx playwright test e2e/visual-regression.spec.ts` 通过（如涉及 UI 变更）
