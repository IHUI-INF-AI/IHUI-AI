<template>
  <div class="change-phone">
    <SettingsPageLayout title="更换手机号">
      <div class="change-phone__inner">
        <!-- 说明区 -->
        <div class="change-phone__intro">
          <div class="change-phone__intro-title">更换说明</div>
          <div class="change-phone__intro-desc">为保障账号安全，需先验证当前绑定的手机号，再绑定新号码；流程简单，几步即可完成。</div>
        </div>

        <!-- 第一步：验证当前手机号 -->
        <div v-if="step === 1" class="change-phone__form">
          <div class="change-phone__section">
            <div class="change-phone__section-label">1. 验证当前手机号</div>
            <div class="change-phone__phone-display">{{ maskedPhone }}</div>
            <div class="change-phone__code-row">
              <el-input
                v-model="oldCode"
                placeholder="请输入当前手机号收到的验证码"
                maxlength="6"
                size="large"
                class="change-phone__code-input"
              />
              <el-button
                size="large"
                :disabled="oldCountdown > 0"
                class="change-phone__code-btn"
                @click="onGetOldCode"
              >
                {{ oldCountdown > 0 ? oldCountdown + 's' : '获取验证码' }}
              </el-button>
            </div>
          </div>
          <el-button
            type="primary"
            size="large"
            :disabled="!canVerifyOld"
            class="change-phone__submit"
            @click="onVerifyOld"
          >
            下一步
          </el-button>
        </div>

        <!-- 第二步：绑定新手机号 -->
        <div v-if="step === 2" class="change-phone__form">
          <div class="change-phone__step-done-tip">当前手机号 {{ maskedPhone }} 已通过验证</div>
          <div class="change-phone__section">
            <div class="change-phone__section-label">2. 绑定新手机号</div>
            <div class="change-phone__code-row">
              <el-input
                v-model="newPhone"
                placeholder="请输入新手机号"
                maxlength="11"
                size="large"
                class="change-phone__code-input"
              />
            </div>
            <div class="change-phone__code-row">
              <el-input
                v-model="newCode"
                placeholder="请输入新手机号收到的验证码"
                maxlength="6"
                size="large"
                class="change-phone__code-input"
              />
              <el-button
                size="large"
                :disabled="newCountdown > 0"
                class="change-phone__code-btn"
                @click="onGetNewCode"
              >
                {{ newCountdown > 0 ? newCountdown + 's' : '获取验证码' }}
              </el-button>
            </div>
          </div>
          <el-button
            type="primary"
            size="large"
            :disabled="!canSubmitNew"
            :loading="submitting"
            class="change-phone__submit"
            @click="onSubmit"
          >
            确认更换
          </el-button>
        </div>

        <!-- 底部提示：更换后的影响 -->
        <div class="change-phone__notice">
          <div class="change-phone__notice-title">【更换后影响】</div>
          <div class="change-phone__notice-desc">更换成功后，登录、找回密码、消息通知等将使用新手机号；旧手机号将无法再用于本账号登录，请确认后再操作。</div>
        </div>
      </div>
    </SettingsPageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import SettingsPageLayout from './SettingsPageLayout.vue'
import { sendTextMsg, sendTextMsgNew, editPhone } from '@/api/auth'
import { useUserStore } from '@/stores/auth'
import { useCleanup } from '@/composables/useCleanup'

const router = useRouter()
const userStore = useUserStore()
const cleanup = useCleanup()

const currentPhone = ref('')
const oldCode = ref('')
const newPhone = ref('')
const newCode = ref('')
const oldCountdown = ref(0)
const newCountdown = ref(0)
let oldCountdownHandle: { cancel: () => void } | null = null
let newCountdownHandle: { cancel: () => void } | null = null
const step = ref(1)
const submitting = ref(false)

const maskedPhone = computed(() => {
  const p = (currentPhone.value || '').trim()
  if (!p || p.length < 11) return '未绑定'
  return p.slice(0, 3) + '****' + p.slice(-4)
})

const canVerifyOld = computed(() => {
  return oldCode.value.trim().length === 6
})

const canSubmitNew = computed(() => {
  return (
    /^1\d{10}$/.test((newPhone.value || '').trim()) &&
    (newCode.value || '').trim().length === 6
  )
})

onMounted(() => {
  const phone = userStore.user?.phone || ''
  currentPhone.value = (phone || '').trim()
})

function getErrMsg(e: unknown, fallback: string): string {
  const err = e as { data?: { msg?: string; message?: string }; msg?: string; message?: string }
  return err?.data?.msg || err?.data?.message || err?.msg || err?.message || fallback
}

function startOldCountdown() {
  oldCountdown.value = 60
  if (oldCountdownHandle) oldCountdownHandle.cancel()
  oldCountdownHandle = cleanup.addCancellableInterval(() => {
    oldCountdown.value--
    if (oldCountdown.value <= 0 && oldCountdownHandle) {
      oldCountdownHandle.cancel()
      oldCountdownHandle = null
    }
  }, 1000)
}

function startNewCountdown() {
  newCountdown.value = 60
  if (newCountdownHandle) newCountdownHandle.cancel()
  newCountdownHandle = cleanup.addCancellableInterval(() => {
    newCountdown.value--
    if (newCountdown.value <= 0 && newCountdownHandle) {
      newCountdownHandle.cancel()
      newCountdownHandle = null
    }
  }, 1000)
}

async function onGetOldCode() {
  if (oldCountdown.value > 0) return
  const p = (currentPhone.value || '').trim()
  if (!p || p.length < 11) {
    ElMessage.info('当前未绑定手机号')
    return
  }
  try {
    await sendTextMsg(p, '2', '')
    startOldCountdown()
    ElMessage.info('验证码已发送')
  } catch (e) {
    ElMessage.info(getErrMsg(e, '发送失败'))
  }
}

async function onVerifyOld() {
  if (!canVerifyOld.value) {
    ElMessage.info('请输入6位验证码')
    return
  }
  const p = (currentPhone.value || '').trim()
  const code = (oldCode.value || '').trim()
  try {
    const res = await sendTextMsgNew(p, code) as unknown as Record<string, unknown>
    const resData = (res?.data as Record<string, unknown>) || res
    const codeNum = resData?.code
    const isSuccess = codeNum === 200 || codeNum === 0 || codeNum === '200'
    if (!isSuccess) {
      const msg = (resData?.msg as string) || (resData?.message as string) || '验证码错误，请核对后重试'
      ElMessage.info(msg)
      return
    }
    ElMessage.success('验证通过')
    step.value = 2
  } catch (e) {
    ElMessage.info(getErrMsg(e, '验证码校验失败，请重试'))
  }
}

async function onGetNewCode() {
  if (newCountdown.value > 0) return
  const phone = (newPhone.value || '').trim()
  if (!/^1\d{10}$/.test(phone)) {
    ElMessage.info('请先输入正确的新手机号')
    return
  }
  try {
    await sendTextMsg(phone, '2', '')
    startNewCountdown()
    ElMessage.info('验证码已发送')
  } catch (e) {
    ElMessage.info(getErrMsg(e, '发送失败'))
  }
}

async function onSubmit() {
  if (!canSubmitNew.value) {
    if (!/^1\d{10}$/.test((newPhone.value || '').trim())) {
      ElMessage.info('请输入正确的新手机号')
      return
    }
    if ((newCode.value || '').trim().length !== 6) {
      ElMessage.info('请输入6位验证码')
      return
    }
    return
  }
  const newPhoneVal = (newPhone.value || '').trim()
  const newCodeVal = (newCode.value || '').trim()
  const uuid = userStore.user?.uuid || userStore.userUuid || ''
  if (!uuid) {
    ElMessage.info('未获取到用户信息，请重新登录')
    return
  }
  if (submitting.value) return
  submitting.value = true
  const loading = ElLoading.service({ text: '提交中...' })
  try {
    const res = await editPhone(newPhoneVal, newCodeVal, uuid) as unknown as Record<string, unknown>
    loading.close()
    const resData = (res?.data as Record<string, unknown>) || res
    const code = resData?.code
    if (code !== 200 && code !== '200' && code !== 0) {
      const msg = (resData?.msg as string) || (resData?.message as string) || '更换失败'
      ElMessage.info(msg)
      return
    }
    try {
      userStore.updateUserInfo({ phone: newPhoneVal })
    } catch {
      // 静默处理
    }
    ElMessage.success('更换成功')
    setTimeout(() => {
      router.back()
    }, 800)
  } catch (e) {
    loading.close()
    ElMessage.info(getErrMsg(e, '操作失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

.change-phone {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
}

.change-phone__inner {
  padding: 12px 12px 16px;

  @include bp.min-width('tablet') {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px 0 24px;
  }
}

/* 说明区 */
.change-phone__intro {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
}

.change-phone__intro-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.change-phone__intro-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

/* 核心操作区 */
.change-phone__form {
  background-color: var(--el-bg-color);
  border-radius: var(--global-border-radius);
  padding: 14px;
  margin-bottom: 12px;
  border: 1px solid var(--el-border-color-lighter);
  box-sizing: border-box;
}

.change-phone__section {
  margin-bottom: 16px;
}

.change-phone__step-done-tip {
  font-size: 13px;
  color: var(--el-color-success);
  margin-bottom: 12px;
  padding: 8px 0;
}

.change-phone__section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
}

.change-phone__phone-display {
  font-size: 15px;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.change-phone__code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.change-phone__code-row:last-child {
  margin-bottom: 0;
}

.change-phone__code-input {
  flex: 1;
}

.change-phone__code-btn {
  flex-shrink: 0;
  color: var(--el-color-success);
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-color-success);
}

.change-phone__code-btn.is-disabled {
  color: var(--el-text-color-placeholder);
  border-color: var(--el-border-color);
}

.change-phone__submit {
  width: 100%;
  height: 44px;
  font-size: 15px;
  margin-top: 4px;
}

/* 底部提示：更换后影响 */
.change-phone__notice {
  background-color: var(--el-color-success-light-9);
  border: 1px solid var(--el-color-success-light-5);
  border-radius: var(--global-border-radius);
  padding: 14px;
  box-sizing: border-box;
}

.change-phone__notice-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-success);
  margin-bottom: 6px;
}

.change-phone__notice-desc {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.6;
}

/* 暗色模式适配 */
:where(html.dark) {
  .change-phone {
    background-color: var(--el-bg-color);
  }

  .change-phone__intro {
    border-color: var(--el-border-color);
  }

  .change-phone__form {
    border-color: var(--el-border-color);
  }

  .change-phone__code-btn {
    background-color: var(--el-bg-color);
  }
}
</style>
