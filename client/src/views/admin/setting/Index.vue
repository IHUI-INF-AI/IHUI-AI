<template>
  <div class="admin-setting-page" v-loading="loading">
    <el-tabs v-model="active" class="setting-tabs">
      <el-tab-pane :label="t('setting.label.baseSettings')" name="base">
        <el-form :model="form" label-width="120px" class="setting-form">
          <el-form-item :label="t('setting.label.siteName')">
            <el-input v-model="form.siteName" :placeholder="t('setting.placeholder.siteName')" />
          </el-form-item>
          <el-form-item :label="t('setting.label.siteLogo')">
            <el-input v-model="form.logo" :placeholder="t('setting.placeholder.logo')" />
          </el-form-item>
          <el-form-item :label="t('setting.label.siteDescription')">
            <el-input v-model="form.description" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item :label="t('setting.label.icp')">
            <el-input v-model="form.icp" :placeholder="t('setting.placeholder.icp')" />
          </el-form-item>
          <el-form-item :label="t('setting.label.contactEmail')">
            <el-input v-model="form.email" placeholder="contact@example.com" />
          </el-form-item>
          <el-form-item :label="t('setting.label.contactPhone')">
            <el-input v-model="form.phone" placeholder="400-xxx-xxxx" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSave">{{ t('adminSettingIndex.saveSettings') }}</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane :label="t('setting.label.seoSettings')" name="seo">
        <el-form :model="form" label-width="120px" class="setting-form">
          <el-form-item :label="t('setting.label.pageTitle')">
            <el-input v-model="form.title" />
          </el-form-item>
          <el-form-item :label="t('setting.label.keywords')">
            <el-input v-model="form.keywords" />
          </el-form-item>
          <el-form-item :label="t('setting.label.pageDescription')">
            <el-input v-model="form.metaDescription" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSave">{{ t('common.save') }}</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
      <el-tab-pane :label="t('setting.label.paySettings')" name="pay">
        <el-form :model="form" label-width="120px" class="setting-form">
          <el-form-item :label="t('setting.label.wechatPay')">
            <el-switch v-model="form.wxpay" />
          </el-form-item>
          <el-form-item :label="t('setting.label.alipay')">
            <el-switch v-model="form.alipay" />
          </el-form-item>
          <el-form-item label="PayPal">
            <el-switch v-model="form.paypal" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="onSave">{{ t('common.save') }}</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/admin'

const active = ref('base')
const loading = ref(false)
const form = reactive({
  siteName: '',
  logo: '',
  description: '',
  icp: '',
  email: '',
  phone: '',
  title: '',
  keywords: '',
  metaDescription: '',
  wxpay: true,
  alipay: true,
  paypal: false,
})

const reload = async () => {
  loading.value = true
  try {
    const res = await adminApi.settingBase()
    Object.assign(form, res.data || {})
  } finally {
    loading.value = false
  }
}

const onSave = async () => {
  await adminApi.settingBaseSave(form)
  ElMessage.success('保存成功')
}

onMounted(reload)
</script>

<style scoped lang="scss">
:where(.admin-setting-page) {
  background: var(--global-bg-card);
  padding: 20px;
  border-radius: var(--global-border-radius);

  .setting-form {
    max-width: 640px;
    margin-top: 16px;
  }
}
</style>
