# 样式优化详细计划

## 一、项目现状分析

### 1.1 当前架构
```
src/styles/
├── index.scss          # 主入口文件 (~984行，已精简)
├── variables.scss      # SCSS变量定义
├── _buttons.scss       # 按钮样式模块
├── _inputs.scss        # 输入框样式模块
├── _cards.scss         # 卡片样式模块
├── _dark-mode.scss     # 暗色模式模块
├── _element-plus.scss  # Element Plus覆盖
├── animations.scss     # 动画样式
├── responsive.scss     # 响应式样式
├── fonts-unified.scss  # 字体样式
└── ...其他模块文件
```

### 1.2 已完成优化
- ✅ index.scss从2897行精简到984行
- ✅ 模块化架构已建立
- ✅ CSS变量体系统一
- ✅ 全局圆角、描边、投影变量唯一

---

## 二、优化任务详细计划

### 阶段一：样式质量保障 (优先级: 高)

#### 任务1.1：添加Stylelint样式检查工具
**目标**：自动检测样式问题，防止重复和冲突

**执行步骤**：
```bash
# 1. 安装依赖
npm install -D stylelint stylelint-config-standard-scss stylelint-order

# 2. 创建配置文件 .stylelintrc.json
# 3. 添加npm脚本
# 4. 运行检查并修复
```

**配置文件内容**：
```json
{
  "extends": ["stylelint-config-standard-scss"],
  "rules": {
    "no-duplicate-selectors": true,
    "declaration-block-no-duplicate-properties": true,
    "no-descending-specificity": null,
    "selector-class-pattern": null,
    "scss/at-rule-no-unknown": true,
    "order/properties-order": [
      "position",
      "display",
      "flex",
      "width",
      "height",
      "margin",
      "padding",
      "border",
      "border-radius",
      "background",
      "color",
      "font"
    ]
  }
}
```

**预期成果**：
- 自动检测重复选择器
- 自动检测重复属性
- 统一属性书写顺序

---

#### 任务1.2：创建样式规范文档
**目标**：建立团队样式开发规范

**文档结构**：
```markdown
# 样式开发规范

## 1. CSS变量使用规范
## 2. 模块化文件分配规则
## 3. 禁止事项清单
## 4. 命名规范
## 5. 响应式断点规范
```

---

### 阶段二：样式清理优化 (优先级: 中)

#### 任务2.1：清理未使用的样式规则
**目标**：移除死代码，减小CSS体积

**执行步骤**：
1. 使用PurgeCSS或类似工具分析
2. 识别未使用的CSS类
3. 逐一确认后删除

**工具配置**：
```javascript
// purgecss.config.js
module.exports = {
  content: ['./src/**/*.vue', './src/**/*.ts'],
  css: ['./src/styles/**/*.scss'],
  safelist: {
    standard: [/^el-/, /^router-/, /^v-/],
    deep: [/^el-/]
  }
}
```

---

#### 任务2.2：优化媒体查询合并
**目标**：减少重复的媒体查询声明

**优化前**：
```scss
.component-a {
  @media (max-width: 768px) { ... }
}
.component-b {
  @media (max-width: 768px) { ... }
}
```

**优化后**：
```scss
@media (max-width: 768px) {
  .component-a { ... }
  .component-b { ... }
}
```

---

### 阶段三：性能优化 (优先级: 中)

#### 任务3.1：CSS变量进一步压缩
**目标**：减少变量定义冗余

**优化方向**：
- 合并相似功能的变量
- 移除未使用的变量别名
- 统一命名规范

---

#### 任务3.2：动画性能优化
**目标**：确保动画使用GPU加速

**规范**：
```scss
// 推荐：使用transform和opacity
.animated {
  will-change: transform, opacity;
  transform: translateZ(0);
}

// 避免：触发重排的属性
.avoid {
  animation: bad 1s; // 不要动画width/height/margin等
}
```

---

## 三、执行时间表

| 阶段 | 任务 | 预计时间 | 负责人 |
|------|------|----------|--------|
| 阶段一 | 1.1 Stylelint配置 | 1小时 | - |
| 阶段一 | 1.2 规范文档编写 | 2小时 | - |
| 阶段二 | 2.1 清理未使用样式 | 3小时 | - |
| 阶段二 | 2.2 媒体查询合并 | 2小时 | - |
| 阶段三 | 3.1 变量压缩 | 1小时 | - |
| 阶段三 | 3.2 动画优化 | 1小时 | - |

**总计**：约10小时

---

## 四、验收标准与场景执行指引

**说明**：以下为样式优化项目完成后的验收清单。按「场景执行步骤」操作即可完整验证。

### 场景执行步骤（验收时按项做）

**4.1 功能验收**：本地 `npm run dev`，逐一点击主导航与关键子页，确认无错位、重叠、缺字；在设置中切换亮/暗模式再扫一遍；缩放窗口或使用设备模拟检查关键断点；对含 hover/transition 的按钮、卡片做一次交互，确认动效存在且无卡顿。

**4.2 质量验收**：运行 `npm run lint`（含 stylelint 若已配置），确保零错误；用编辑器或脚本在 `src/styles` 下搜索重复选择器与同规则内重复属性；对比优化前后 `dist/web/assets/css` 体积，计算是否达到目标（如减少 20%+）。

**4.3 性能验收**：Chrome DevTools → Lighthouse 或 Performance 面板录制首屏加载，查看「Styles」或 LCP 相关 CSS 加载时间；刷新时观察是否有先无样式再刷出的 FOUC；对动画区域使用 Performance 录制，查看帧率是否稳定在 60fps 左右。

### 4.1 功能验收
- [ ] 所有页面样式正常显示（主导航 + 关键子页遍历）
- [ ] 亮色/暗色模式切换正常（设置中切换后复查）
- [ ] 响应式布局正常（缩放/设备模拟）
- [ ] 所有交互动效正常（hover、transition 抽样）

### 4.2 质量验收
- [ ] Stylelint 检查零错误（`npm run lint`）
- [ ] 无重复选择器（人工或脚本扫描）
- [ ] 无重复属性定义（同规则内）
- [ ] CSS 文件体积减少 20%+（对比构建产物）

### 4.3 性能验收
- [ ] 首屏 CSS 加载时间 < 100ms（Lighthouse/Performance）
- [ ] 无样式闪烁 (FOUC)（刷新观察）
- [ ] 动画帧率 >= 60fps（Performance 录制）

---

## 五、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 样式清理影响现有功能 | 高 | 逐个页面测试验证 |
| Stylelint规则过严 | 中 | 逐步启用规则 |
| 媒体查询合并影响优先级 | 中 | 保留必要的作用域 |

---

## 六、后续维护建议

1. **代码审查**：PR必须通过Stylelint检查
2. **定期审计**：每月检查CSS体积和重复率
3. **文档更新**：新增样式规则及时更新文档
4. **性能监控**：持续监控CSS加载性能
