<template>
  <button
    type="button"
    class="password-toggle-icon"
    :aria-label="visible ? t('login.hidePassword') : t('login.showPassword')"
    @click="handleClick"
  >
    <Eye v-if="!visible" class="icon" :size="18" />
    <EyeOff v-else class="icon" :size="18" />
  </button>
</template>

<script setup lang="ts">
import { Eye, EyeOff } from '@/lib/lucide-fallback'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'toggle'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleClick = () => {
  emit('toggle')
}
</script>

<style scoped lang="scss">
.password-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  border-radius: var(--global-border-radius);
  transition: color 0.2s ease, background-color 0.2s ease;
  
  &:hover {
    color: var(--el-color-primary);
    background: var(--el-fill-color-light);
  }
  
  &:focus {
    outline: none;
    }
  
  .icon {
    display: block;
  }
}
</style>

