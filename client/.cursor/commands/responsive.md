# 响应式适配

为代码添加响应式设计支持。

## 指令

请为以下代码添加响应式适配：

{{selection}}

### 响应式策略

1. **断点定义**
```scss
// Tailwind 默认断点
$breakpoints: (
  'sm': 640px,   // 手机横屏
  'md': 768px,   // 平板
  'lg': 1024px,  // 小屏笔记本
  'xl': 1280px,  // 桌面
  '2xl': 1536px, // 大屏
);
```

2. **Tailwind CSS 方式**
```vue
<div class="
  px-4 py-2
  md:px-6 md:py-4
  lg:px-8 lg:py-6
  
  text-sm
  md:text-base
  lg:text-lg
  
  grid grid-cols-1
  md:grid-cols-2
  lg:grid-cols-3
">
  <!-- 内容 -->
</div>
```

3. **CSS 媒体查询**
```scss
.container {
  padding: 16px;
  
  @media (min-width: 768px) {
    padding: 24px;
  }
  
  @media (min-width: 1024px) {
    padding: 32px;
  }
}
```

4. **Vue 响应式检测**
```typescript
import { useBreakpoints } from '@vueuse/core'

const breakpoints = useBreakpoints({
  mobile: 0,
  tablet: 768,
  desktop: 1024,
})

const isMobile = breakpoints.smaller('tablet')
const isDesktop = breakpoints.greater('desktop')
```

### 输出

1. 响应式适配后的代码
2. 各断点的预览效果说明
3. 额外的适配建议
