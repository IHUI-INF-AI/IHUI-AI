<template>
  <div
    class="feature-card ihui-ai-card-hover"
    :class="[animationClass, { 'is-navigating': isNavigating }]"
    :style="{ animationDelay: `${animationDelay}s` }"
    @click="handleClick"
  >
    <el-icon class="feature-icon" aria-hidden="true">
      <component :is="iconComponent" />
    </el-icon>
    <span>{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, h, type VNode } from 'vue'

defineOptions({
  name: 'HomeFeatureCard',
  inheritAttrs: false,
})

interface Props {
  iconIndex: number
  label: string
  animationClass?: string
  animationDelay?: number
  isNavigating?: boolean
  onClick?: (event?: MouseEvent) => void
}

const props = withDefaults(defineProps<Props>(), {
  animationClass: 'ihui-ai-fade-in-left-animation',
  animationDelay: 0.1,
  isNavigating: false,
})

// SVG 图标组件映射 - 简洁清晰设计（已移除所有无用装饰）
const iconComponents: Record<number, () => VNode> = {
  // 0: AI模型整合 - 神经网络节点连接
  0: () =>
    h(
      'svg',
      {
        class: 'linear-icon',
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
      },
      [
        h('circle', {
          cx: '12',
          cy: '8',
          r: '2.5',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          fill: 'none',
        }),
        h('circle', {
          cx: '7',
          cy: '14',
          r: '2',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          fill: 'none',
        }),
        h('circle', {
          cx: '17',
          cy: '14',
          r: '2',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          fill: 'none',
        }),
        h('path', {
          d: 'M12 10.5v2M9.5 12.5l-1.5 1M14.5 12.5l1.5 1',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      ]
    ),
  // 1: AI应用商店 - 购物袋
  1: () =>
    h(
      'svg',
      {
        class: 'linear-icon',
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
      },
      [
        h('path', {
          d: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M3 6h18',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
        }),
        h('path', {
          d: 'M9 10a3 3 0 1 1 6 0v8H9V10z',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      ]
    ),
  // 2: AIGC创作 - 分层创意
  2: () =>
    h(
      'svg',
      {
        class: 'linear-icon',
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
      },
      [
        h('path', {
          d: 'M12 2L2 7l10 5 10-5-10-5z',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M2 17l10 5 10-5M2 12l10 5 10-5',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      ]
    ),
  // 4: 智汇AI教育 - 打开的书本
  4: () =>
    h(
      'svg',
      {
        class: 'linear-icon',
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
      },
      [
        h('path', {
          d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M10 7h6M10 11h6M10 15h4',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
        }),
      ]
    ),
  // 5: AI动态及导航 - 指南针
  5: () =>
    h(
      'svg',
      {
        class: 'linear-icon',
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
      },
      [
        h('circle', {
          cx: '12',
          cy: '12',
          r: '10',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M12 2v4M12 18v4M2 12h4M18 12h4',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
        }),
        h('path', {
          d: 'M12 8l4 4-4 4',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
      ]
    ),
  // 6: AI在线文档编辑 - 文档
  6: () =>
    h(
      'svg',
      {
        class: 'linear-icon',
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
      },
      [
        h('path', {
          d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M14 2v6h6M10 13h4M10 17h6',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
        }),
      ]
    ),
  // 7: MCP框架 - 四象限框架
  7: () =>
    h(
      'svg',
      {
        class: 'linear-icon',
        viewBox: '0 0 24 24',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
      },
      [
        h('rect', {
          x: '3',
          y: '3',
          width: '7',
          height: '7',
          rx: '1.5',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('rect', {
          x: '14',
          y: '3',
          width: '7',
          height: '7',
          rx: '1.5',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('rect', {
          x: '3',
          y: '14',
          width: '7',
          height: '7',
          rx: '1.5',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('rect', {
          x: '14',
          y: '14',
          width: '7',
          height: '7',
          rx: '1.5',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
        }),
        h('path', {
          d: 'M10 6.5h4M6.5 10v4M14 17.5h-4M17.5 14v-4',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
        }),
      ]
    ),
}

const iconComponent = computed(() => {
  return iconComponents[props.iconIndex] || iconComponents[0]
})

const handleClick = (event?: MouseEvent) => {
  if (props.onClick) {
    props.onClick(event)
  }
}
</script>

<style scoped lang="scss">
.feature-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: clamp(16px, 2vw, 22px);
  background: var(--el-fill-color-lighter);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.3s;
  border: none;
  min-height: 120px;
  box-shadow: none;
  text-align: center;

  &.is-navigating {
    opacity: 0.6;
    pointer-events: none;
  }

  .feature-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: var(--global-border-radius);
    background: var(--el-fill-color-light);
    color: var(--el-color-primary);
    }

  .feature-icon .linear-icon {
    width: 28px;
    height: 28px;
    stroke: currentcolor;
    fill: none;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  span {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    letter-spacing: 0.2px;
  }
}

/* 暗色模式支持 */
:global(.dark) .feature-card,
:global(.theme-dark) .feature-card {
  background: var(--color-white-4);
  box-shadow: none;

  &:hover {
    background: var(--color-white-6);
  }

  .feature-icon {
    background: var(--color-white-5);
    }
}

/* 响应式调整 */
@media (width <= 1024px) {
  .feature-card {
    padding: clamp(14px, 2.5vw, 20px);
    min-height: 110px;

    .feature-icon {
      width: 52px;
      height: 52px;

      .linear-icon {
        width: 26px;
        height: 26px;
      }
    }

    span {
      font-size: 14px;
    }
  }
}

@media (width <= 480px) {
  .feature-card {
    padding: 14px;
    min-height: 100px;

    .feature-icon {
      width: 48px;
      height: 48px;

      .linear-icon {
        width: 24px;
        height: 24px;
      }
    }

    span {
      font-size: 13px;
    }
  }
}
</style>
