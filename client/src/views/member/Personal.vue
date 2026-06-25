<template>
  <MemberLayout active="personal">
    <div class="member-personal-page" v-loading="loading">
      <h2 class="page-title">{{ t('memberPersonal.title') }}</h2>
      <el-form :model="form" label-width="100px" class="profile-form">
        <el-form-item :label="t('memberPersonal.avatar')">
          <el-avatar :src="form.avatar" :size="80" />
          <el-upload
            class="upload-avatar"
            action="/api/v1/auth/profile/avatar"
            :show-file-list="false"
            :before-upload="handleBeforeUpload"
          >
            <el-button size="small" style="margin-left: 16px">{{ t('memberPersonal.changeAvatar') }}</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item :label="t('memberPersonal.nickName')">
          <el-input v-model="form.nickName" />
        </el-form-item>
        <el-form-item :label="t('memberPersonal.realName')">
          <el-input v-model="form.realName" />
        </el-form-item>
        <el-form-item :label="t('memberPersonal.gender')">
          <el-radio-group v-model="form.gender">
            <el-radio value="male">{{ t('memberPersonal.male') }}</el-radio>
            <el-radio value="female">{{ t('memberPersonal.female') }}</el-radio>
            <el-radio value="unknown">{{ t('memberPersonal.secret') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('memberPersonal.birthday')">
          <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item :label="t('memberPersonal.school')">
          <el-input v-model="form.school" />
        </el-form-item>
        <el-form-item :label="t('memberPersonal.profession')">
          <el-input v-model="form.profession" />
        </el-form-item>
        <el-form-item :label="t('memberPersonal.bio')">
          <el-input v-model="form.bio" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">{{ t('common.save') }}</el-button>
        </el-form-item>
      </el-form>
    </div>
  </MemberLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElMessage } from 'element-plus'
import MemberLayout from '@/components/member/Layout.vue'
import { memberApi } from '@/api/learn/member'

const loading = ref(false)
const saving = ref(false)
const form = ref<any>({
  avatar: '',
  nickName: '',
  realName: '',
  gender: 'unknown',
  birthday: '',
  school: '',
  profession: '',
  bio: '',
})

async function load() {
  loading.value = true
  try {
    const res: any = await memberApi.profile()
    form.value = { ...form.value, ...(res.data || {}) }
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await memberApi.updateProfile(form.value)
    ElMessage.success(t('common.messages.saveSuccess'))
  } catch (_e) {
    // 保存失败时给用户明确反馈，避免「点保存没反应」
    ElMessage.error(t('common.errors.saveFailed'))
  } finally {
    saving.value = false
  }
}

function handleBeforeUpload(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  memberApi.uploadAvatar(fd).then((res: any) => {
    form.value.avatar = res.data?.url
  }).catch(() => { ElMessage.error(t('common.errors.uploadFailed')) })
  return false
}

onMounted(load)
</script>

<style lang="scss" scoped>
:where(.member-personal-page) {
  width: 100%;
}

:where(.page-title) {
  margin: 0 0 24px;
  font-size: 20px;
  font-weight: 600;
}

:where(.profile-form) {
  max-width: 640px;
}

:where(.upload-avatar) {
  display: inline-block;
}
</style>
