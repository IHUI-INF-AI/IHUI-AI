<template>
  <div class="admin-setting-page" v-loading="loading">
    <el-tabs v-model="active" class="setting-tabs">
      <el-tab-pane :label="t('setting.label.userAgreement')" name="user">
        <div class="editor-toolbar">
          <el-button type="primary" @click="onSave">{{ t('common.save') }}</el-button>
        </div>
        <el-input v-model="content" type="textarea" :rows="20" :placeholder="t('setting.placeholder.userAgreement')" />
      </el-tab-pane>
      <el-tab-pane :label="t('setting.label.privacyPolicy')" name="privacy">
        <div class="editor-toolbar">
          <el-button type="primary" @click="onSave">{{ t('common.save') }}</el-button>
        </div>
        <el-input v-model="content" type="textarea" :rows="20" :placeholder="t('setting.placeholder.privacyPolicy')" />
      </el-tab-pane>
      <el-tab-pane :label="t('setting.label.serviceTerms')" name="service">
        <div class="editor-toolbar">
          <el-button type="primary" @click="onSave">{{ t('common.save') }}</el-button>
        </div>
        <el-input v-model="content" type="textarea" :rows="20" :placeholder="t('setting.placeholder.serviceTerms')" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin/admin'

const active = ref('user')
const loading = ref(false)
const content = ref('')

const reload = async () => {
  loading.value = true
  try {
    const res = await adminApi.settingBase()
    content.value = (res.data as any)?.[active.value] || ''
  } finally {
    loading.value = false
  }
}

const onSave = async () => {
  await adminApi.settingBaseSave({ [active.value]: content.value })
  ElMessage.success(t('common.messages.saveSuccess'))
}

onMounted(reload)
</script>

<style scoped lang="scss">
:where(.admin-setting-page) {
  background: var(--global-bg-card);
  padding: 20px;
  border-radius: var(--global-border-radius);

  .editor-toolbar {
    margin-bottom: 12px;
  }
}
</style>
