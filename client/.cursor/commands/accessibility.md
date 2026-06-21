# 无障碍检查

检查并改进代码的可访问性（A11y）。

## 指令

请检查以下代码的无障碍性：

{{selection}}

### 检查标准

遵循 WCAG 2.1 指南

1. **可感知**
   - 图片 alt 文本
   - 颜色对比度
   - 字体大小可调整

2. **可操作**
   - 键盘可访问
   - 焦点可见
   - 无时间限制

3. **可理解**
   - 清晰的标签
   - 错误提示明确
   - 一致的导航

4. **健壮性**
   - 语义化 HTML
   - ARIA 属性正确

### 常见问题修复

```vue
<!-- 之前 -->
<div @click="handleClick">点击</div>

<!-- 之后 -->
<button 
  @click="handleClick"
  aria-label="操作说明"
>
  点击
</button>

<!-- 图片 -->
<img :src="url" alt="图片描述" />

<!-- 表单 -->
<label for="username">用户名</label>
<input 
  id="username" 
  type="text"
  aria-required="true"
  aria-describedby="username-hint"
/>
<span id="username-hint">请输入您的用户名</span>
```

### 输出

1. 发现的问题列表
2. 修复后的代码
3. 额外改进建议
