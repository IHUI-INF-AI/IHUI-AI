<template>
  <el-alert :title="message" type="warning" :closable="false" show-icon class="security-alert" />
</template>

<script setup lang="ts">
interface SecurityAlertProps {
  message: string
}

defineProps<SecurityAlertProps>()
</script>

<style scoped lang="scss">
.security-alert {
  margin-bottom: 24px;
  max-width: 400px;

  :deep(.el-alert__content) {
    font-size: 14px;
  }
}

@media (width <= 768px) {
  .security-alert {
    margin-bottom: 16px;
  }
}
</style>
