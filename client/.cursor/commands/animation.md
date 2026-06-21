# 添加动画效果

为组件添加流畅的动画和过渡效果。

## 指令

请为以下代码添加动画效果：

{{selection}}

### 动画类型

1. **Vue Transition**
```vue
<template>
  <Transition name="fade" mode="out-in">
    <component :is="currentComponent" />
  </Transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

2. **列表动画**
```vue
<TransitionGroup name="list" tag="ul">
  <li v-for="item in items" :key="item.id">
    {{ item.name }}
  </li>
</TransitionGroup>

<style>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-active {
  position: absolute;
}
</style>
```

3. **CSS 动画**
```css
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.bounce {
  animation: bounce 1s ease infinite;
}
```

4. **Tailwind 动画**
```html
<div class="animate-pulse">加载中...</div>
<div class="animate-bounce">弹跳</div>
<div class="animate-spin">旋转</div>
<div class="transition-all duration-300 hover:scale-105">
  悬停缩放
</div>
```

### 输出

1. 添加动画后的代码
2. 动画效果说明
3. 性能优化建议
