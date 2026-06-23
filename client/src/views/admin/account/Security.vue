<template>
  <div class="admin-form-page" v-loading="loading">
    <h2 class="page-title">{{ t('adminSecurity.accountSecurity') }}</h2>
    <el-form :model="form" label-width="120px" class="form-wrap">
      <el-form-item :label="t('account.label.loginPassword')">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item :label="t('account.label.twoFactor')">
        <el-switch v-model="form.twoFactor" />
      </el-form-item>
      <el-form-item :label="t('account.label.securityEmail')"><el-input v-model="form.securityEmail" /></el-form-item>
      <el-form-item :label="t('account.label.securityMobile')"><el-input v-model="form.securityMobile" /></el-form-item>
      <el-form-item :label="t('account.label.loginLog')">
        <el-button @click="onViewLog">{{ t('adminSecurity.viewLog') }}</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSave">{{ t('common.save') }}</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin'
const loading = ref(false)
const form = ref({ password: '', twoFactor: false, securityEmail: '', securityMobile: '' })
async function load() {
  loading.value = true
  try { form.value = (await adminApi.accountSecurity() as any)?.data || form.value } finally { loading.value = false }
}
function onViewLog() { ElMessage.info(t('common.messages.viewLoginLog')) }
function onSave() { ElMessage.success(t('common.messages.saved')) }
onMounted(load)
</script>

<style scoped lang="scss">
:where(.admin-form-page) {
  .page-title { margin: 0 0 16px; font-size: 22px; color: var(--el-text-color-primary); }
  .form-wrap { max-width: 600px; background: var(--el-bg-color); padding: 24px; border-radius: var(--global-border-radius); }
}
</style>
