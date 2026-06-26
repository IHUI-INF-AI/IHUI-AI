<template>
  <div class="native-empty" role="status" aria-live="polite">
    <div v-if="showIcon" class="native-empty__icon" aria-hidden="true">
      <svg
        width="64"
        height="41"
        viewBox="0 0 64 41"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(0 1)" fill="none" fill-rule="evenodd">
          <ellipse cx="32" cy="33" rx="32" ry="7" fill="var(--el-empty-fill-1, #f5f7fa)" />
          <g stroke="var(--el-empty-fill-3, #dcdfe6)" fill="var(--el-empty-fill-2, #fafafa)">
            <path d="M55 12.76L44.854 1.258C44.367.474 43.656 0 42.907 0H21.093c-.749 0-1.46.474-1.947 1.257L9 12.761V22h46v-9.24z" />
            <path d="M41.613 15.931c0-1.605.994-2.93 2.227-2.931H55v18.137C55 33.26 53.68 35 52.05 35h-40.1C10.32 35 9 33.259 9 31.137V13h11.16c1.233 0 2.227 1.323 2.227 2.928v.022c0 1.605 1.005 2.901 2.237 2.901h14.752c1.232 0 2.237-1.308 2.237-2.913v-.007z" fill="var(--el-empty-fill-4, #f5f7fa)" />
          </g>
        </g>
      </svg>
    </div>
    <p v-if="resolvedDescription" class="native-empty__description">
      {{ resolvedDescription }}
    </p>
    <div v-if="$slots.default" class="native-empty__bottom">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  /** Element Plus 原生 ElEmpty 接口: description 可以是 string, 也可以通过 slot 传入 */
  description?: string
  /** Element Plus 原生 ElEmpty 接口: 隐藏图片 */
  imageSize?: number
  /** 扩展: 是否显示图标 (默认 true) */
  showIcon?: boolean
  /** 扩展: i18n key, 优先于 description */
  descriptionKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  imageSize: 64,
  showIcon: true,
  descriptionKey: '',
})

// 解决 template ref warning
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _slots = useSlots()
void _slots

const { t, te } = useI18n({ useScope: 'global' })

// 优先使用 i18n key, 再用 description 字符串, 最后空字符串
const resolvedDescription = computed(() => {
  if (props.descriptionKey && te(props.descriptionKey)) {
    return t(props.descriptionKey)
  }
  if (props.descriptionKey) {
    return props.descriptionKey
  }
  return props.description
})
</script>

<style scoped lang="scss">
.native-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  box-sizing: border-box;
}

.native-empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  color: var(--el-text-color-placeholder);
}

.native-empty__description {
  margin: 0 0 8px 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  max-width: 360px;
  word-break: break-word;
}

.native-empty__bottom {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 暗色模式适配: 使用 :where() 降低特异性, 不依赖 !important */
:where(html.dark) .native-empty__description {
  color: var(--el-text-color-secondary);
}
</style>
