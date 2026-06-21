<template>
  <div class="login-footer">
    <p class="footer-text">
      {{ isRegisterMode ? t('login.hasAccount') : t('login.noAccount') }}
      <a href="#" class="toggle-link" @click.prevent="toggleMode">
        {{ isRegisterMode ? t('login.goLogin') : t('login.goRegister') }}
      </a>
    </p>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isRegisterMode: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-mode'): void
}>()

const { t } = useI18n()

const toggleMode = () => {
  emit('toggle-mode')
}
</script>

<style scoped lang="scss">
.login-footer {
  margin-top: 24px;
  text-align: center;
}

.footer-text {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.toggle-link {
  color: var(--el-color-primary);
  text-decoration: none;
  margin-left: 4px;

  &:hover {
    text-decoration: underline;
  }
}
</style>
