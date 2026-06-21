<template>
  <MemberLayout active="setting">
    <div class="member-setting-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberSetting.title') }}</h2>

      <el-tabs v-model="activeTab">
        <el-tab-pane :label="t('memberSetting.tabPassword')" name="password">
          <el-form :model="passwordForm" label-width="100px" class="form-block">
            <el-form-item :label="t('memberSetting.oldPassword')">
              <el-input v-model="passwordForm.oldPwd" type="password" show-password />
            </el-form-item>
            <el-form-item :label="t('memberSetting.newPassword')">
              <el-input v-model="passwordForm.newPwd" type="password" show-password />
            </el-form-item>
            <el-form-item :label="t('memberSetting.confirmPassword')">
              <el-input v-model="passwordForm.confirm" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="changePassword">{{ t('memberSetting.changePassword') }}</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="t('memberSetting.tabPhone')" name="phone">
          <el-form :model="phoneForm" label-width="100px" class="form-block">
            <el-form-item :label="t('memberSetting.phoneNumber')">
              <el-input v-model="phoneForm.phone" />
            </el-form-item>
            <el-form-item :label="t('memberSetting.verifyCode')">
              <el-input v-model="phoneForm.code" style="max-width: 200px" />
              <el-button @click="sendPhoneCode">{{ t('memberSetting.getCode') }}</el-button>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="bindPhone">{{ t('memberSetting.bind') }}</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="t('memberSetting.tabEmail')" name="email">
          <el-form :model="emailForm" label-width="100px" class="form-block">
            <el-form-item :label="t('memberSetting.email')">
              <el-input v-model="emailForm.email" />
            </el-form-item>
            <el-form-item :label="t('memberSetting.verifyCode')">
              <el-input v-model="emailForm.code" style="max-width: 200px" />
              <el-button @click="sendEmailCode">{{ t('memberSetting.getCode') }}</el-button>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="bindEmail">{{ t('memberSetting.bind') }}</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane :label="t('memberSetting.tabNotice')" name="notice">
          <el-form label-width="120px" class="form-block">
            <el-form-item :label="t('memberSetting.emailNotice')">
              <el-switch v-model="notice.emailNotice" />
            </el-form-item>
            <el-form-item :label="t('memberSetting.smsNotice')">
              <el-switch v-model="notice.smsNotice" />
            </el-form-item>
            <el-form-item :label="t('memberSetting.msgNotice')">
              <el-switch v-model="notice.msgNotice" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveNotice">{{ t('common.save') }}</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElMessage } from 'element-plus'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/member'

const loading = ref(false)
const activeTab = ref('password')
const passwordForm = ref({ oldPwd: '', newPwd: '', confirm: '' })
const phoneForm = ref({ phone: '', code: '' })
const emailForm = ref({ email: '', code: '' })
const notice = ref({ emailNotice: true, smsNotice: false, msgNotice: true })

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.setting()
    notice.value = { ...notice.value, ...(res.data || {}) }
  } finally {
    loading.value = false
  }
}

async function changePassword() {
  if (passwordForm.value.newPwd !== passwordForm.value.confirm) {
    ElMessage.warning(t('memberSetting.pwdMismatch'))
    return
  }
  try {
    await memberApi.changePassword({
      oldPwd: passwordForm.value.oldPwd,
      newPwd: passwordForm.value.newPwd,
    })
    ElMessage.success(t('memberSetting.pwdChanged'))
  } catch (_e) {
    ElMessage.error(t('common.operationFailed'))
  }
}

function sendPhoneCode() {
  ElMessage.success(t('memberSetting.codeSent'))
}

async function bindPhone() {
  try {
    await memberApi.bindPhone(phoneForm.value)
    ElMessage.success(t('memberSetting.bound'))
  } catch (_e) {
    ElMessage.error(t('common.operationFailed'))
  }
}

function sendEmailCode() {
  ElMessage.success(t('memberSetting.codeSent'))
}

async function bindEmail() {
  try {
    await memberApi.bindEmail(emailForm.value)
    ElMessage.success(t('memberSetting.bound'))
  } catch (_e) {
    ElMessage.error(t('common.operationFailed'))
  }
}

async function saveNotice() {
  try {
    await memberApi.updateSetting(notice.value)
    ElMessage.success(t('memberSetting.saved'))
  } catch (_e) {
    ElMessage.error(t('common.operationFailed'))
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-setting-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.form-block) {
  max-width: 640px;
  padding: 16px 0;
}
</style>
