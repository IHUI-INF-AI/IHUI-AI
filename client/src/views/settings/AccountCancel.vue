<template>
  <div class="account-cancel">
    <SettingsPageLayout title="账号注销/注销说明">
      <div class="account-cancel__inner">
        <!-- 浅红提醒区 -->
        <div class="account-cancel__notice">
          <div class="account-cancel__notice-title">【重要提醒】账号注销后将无法恢复</div>
          <div class="account-cancel__notice-desc">注销后账号内的所有数据将被永久删除，包括但不限于个人信息、资产、订单、内容、会员权益等。</div>
        </div>
        <!-- 注销后果区（结合本平台） -->
        <div class="account-cancel__consequences">
          <div class="account-cancel__consequences-intro">注销后您将失去以下内容与权益，相关数据将按国家个人信息保护相关法规处理，一经操作无法逆转，请务必仔细阅读并确认：</div>
          <div class="account-cancel__consequence">
            <span class="account-cancel__item-num">1. 个人信息与账号：</span>昵称、头像、绑定手机号、个人资料等将被<span class="account-cancel__highlight">永久清除</span>，账号将<span class="account-cancel__highlight">永久冻结</span>，无法再次登录或复用。
          </div>
          <div class="account-cancel__consequence">
            <span class="account-cancel__item-num">2. 会员/VIP 权益：</span>本平台已开通的会员、VIP 及特权将同步终止，剩余有效期<span class="account-cancel__highlight">不予折现</span>，未使用的会员权益（折扣、专属内容等）<span class="account-cancel__highlight">全部作废</span>，<span class="account-cancel__highlight">不予补发</span>、<span class="account-cancel__highlight">不予退还</span>。
          </div>
          <div class="account-cancel__consequence">
            <span class="account-cancel__item-num">3. 账户与资产：</span>账户余额、充值记录将<span class="account-cancel__highlight">清零</span>，优惠券、积分等未使用权益失效；充值记录<span class="account-cancel__highlight">永久删除</span>，<span class="account-cancel__highlight">无法查询</span>。
          </div>
          <div class="account-cancel__consequence">
            <span class="account-cancel__item-num">4. 订单与学习：</span>历史订单、购买记录将被<span class="account-cancel__highlight">永久删除</span>，<span class="account-cancel__highlight">无法查询</span>、无法补打凭证或办理售后；已购课程、学习进度、笔记等将清空，<span class="account-cancel__highlight">无法恢复</span>。
          </div>
          <div class="account-cancel__consequence">
            <span class="account-cancel__item-num">5. AI 与创作：</span>本平台内 AI 对话记录、创作内容（文章/视频/音频/草稿）、收藏与关注等将<span class="account-cancel__highlight">永久删除</span>，<span class="account-cancel__highlight">无法恢复</span>、无法导出。
          </div>
          <div class="account-cancel__consequence">
            <span class="account-cancel__item-num">6. 分销与收益：</span>分销推广数据、收益与佣金明细将<span class="account-cancel__highlight">清零</span>，未提现收益<span class="account-cancel__highlight">自动作废</span>，绑定关系解除，<span class="account-cancel__highlight">无法恢复</span>或补办。
          </div>
          <div class="account-cancel__consequence">
            <span class="account-cancel__item-num">7. 消息与互动：</span>站内消息、系统通知、评论与回复等将<span class="account-cancel__highlight">永久清除</span>，<span class="account-cancel__highlight">无法查询</span>、<span class="account-cancel__highlight">无法恢复</span>。
          </div>
          <div class="account-cancel__consequence account-cancel__consequence--remind">
            <span>提交注销申请后，</span><span>账号将被</span><span class="account-cancel__highlight">正式、永久注销</span><span>，所有数据将</span><span class="account-cancel__highlight">彻底清除</span><span>，</span><span class="account-cancel__highlight">无任何恢复渠道</span><span>。</span>
          </div>
          <div class="account-cancel__consequences-footer">
            <span class="account-cancel__highlight account-cancel__highlight--sentence">以上所有内容及权益，一经注销均永久无法恢复，不存在任何补救措施，请您结合自身情况，谨慎决定是否提交注销申请，避免造成不必要的损失。</span>
          </div>
        </div>
        <!-- 底部操作区 -->
        <div class="account-cancel__footer">
          <div class="account-cancel__confirm-block">
            <div class="account-cancel__confirm-label account-cancel__confirm-label--highlight">请对照下方文字，在输入框中完整输入以确认：</div>
            <div class="account-cancel__confirm-ref account-cancel__confirm-ref--highlight">{{ confirmSentence }}</div>
            <el-input
              v-model="confirmText"
              placeholder="请完整输入上方文字"
              size="large"
              class="account-cancel__confirm-input"
            />
            <div v-if="confirmText.length > 0 && !confirmTextMatch" class="account-cancel__confirm-error">输入内容与上方不一致，请核对后重新输入</div>
            <div v-else-if="confirmTextMatch" class="account-cancel__confirm-ok">✓ 已确认</div>
          </div>
          <div
            class="account-cancel__phone-block"
            :class="{ 'account-cancel__phone-block--disabled': !confirmTextMatch }"
          >
            <div class="account-cancel__confirm-label">请输入您绑定的手机号（用于校验身份）</div>
            <el-input
              v-model="inputPhone"
              placeholder="请输入绑定手机号"
              :disabled="!confirmTextMatch"
              maxlength="11"
              size="large"
              class="account-cancel__confirm-input"
            />
            <div v-if="!boundPhone" class="account-cancel__confirm-error">当前未获取到绑定手机号，请确保已登录且账号已绑定手机号</div>
            <div v-else-if="inputPhone.length > 0 && !phoneMatch" class="account-cancel__confirm-error">输入的手机号与绑定手机号不一致，请核对后重新输入</div>
            <div v-else-if="phoneMatch" class="account-cancel__confirm-ok">✓ 手机号一致</div>
          </div>
          <div class="account-cancel__code-row">
            <el-input
              v-model="smsCode"
              placeholder="请输入短信验证码"
              maxlength="6"
              size="large"
              class="account-cancel__code-input"
            />
            <el-button
              size="large"
              :disabled="countdown > 0 || !phoneMatch || !confirmTextMatch"
              class="account-cancel__code-btn"
              @click="onGetCode"
            >
              {{ countdown > 0 ? countdown + 's' : '获取验证码' }}
            </el-button>
          </div>
          <el-button
            type="danger"
            size="large"
            :disabled="!canSubmit"
            class="account-cancel__submit"
            @click="onSubmit"
          >
            提交注销申请
          </el-button>
        </div>
      </div>
    </SettingsPageLayout>
    <!-- 最后确认弹窗 -->
    <el-dialog
      v-model="showConfirmModal"
      title="最后确认"
      width="90%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      class="account-cancel__dialog"
    >
      <p class="account-cancel__dialog-msg">账号注销后所有数据将被永久删除，且无法恢复。您确定要提交注销申请吗？</p>
      <template #footer>
        <el-button @click="showConfirmModal = false">取消</el-button>
        <el-button
          type="danger"
          :disabled="confirmCountdown > 0"
          :loading="cancelLoading"
          @click="onFinalConfirm"
        >
          {{ confirmCountdown > 0 ? `确定注销 (${confirmCountdown}s)` : '确定注销' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import SettingsPageLayout from './SettingsPageLayout.vue'
import { sendTextMsg, sendTextMsgNew } from '@/api/auth'
import { deleteAccount } from '@/api/settings'
import { useAuthStore, useUserStore } from '@/stores/auth'
import { useCleanup } from '@/composables/useCleanup'

const CONFIRM_SENTENCE = '我已仔细阅读并知晓账号注销的所有后果，自愿申请注销账号'

const router = useRouter()
const userStore = useUserStore()
const authStore = useAuthStore()
const cleanup = useCleanup()

const boundPhone = ref('')
const inputPhone = ref('')
const confirmSentence = ref(CONFIRM_SENTENCE)
const confirmText = ref('')
const smsCode = ref('')
const countdown = ref(0)
let countdownHandle: { cancel: () => void } | null = null
const showConfirmModal = ref(false)
const submitting = ref(false)
const confirmCountdown = ref(5)
let confirmCountdownHandle: { cancel: () => void } | null = null
const cancelLoading = ref(false)

const phoneMatch = computed(() => {
  const input = (inputPhone.value || '').trim().replace(/\s/g, '')
  const bound = (boundPhone.value || '').trim().replace(/\s/g, '')
  if (!bound) return false
  return input.length >= 11 && input === bound
})

const confirmTextMatch = computed(() => {
  return confirmText.value.trim() === CONFIRM_SENTENCE
})

const canSubmit = computed(() => {
  return phoneMatch.value && confirmTextMatch.value && smsCode.value.trim().length >= 4
})

onMounted(() => {
  const phone = userStore.user?.phone || ''
  boundPhone.value = (phone || '').trim()
})

watch(showConfirmModal, (val) => {
  if (val) {
    confirmCountdown.value = 5
    if (confirmCountdownHandle) confirmCountdownHandle.cancel()
    confirmCountdownHandle = cleanup.addCancellableInterval(() => {
      confirmCountdown.value--
      if (confirmCountdown.value <= 0 && confirmCountdownHandle) {
        confirmCountdownHandle.cancel()
        confirmCountdownHandle = null
      }
    }, 1000)
  } else if (confirmCountdownHandle) {
    confirmCountdownHandle.cancel()
    confirmCountdownHandle = null
  }
})

function getErrMsg(e: unknown, fallback: string): string {
  const err = e as { data?: { msg?: string; message?: string }; msg?: string; message?: string }
  return err?.data?.msg || err?.data?.message || err?.msg || err?.message || fallback
}

async function onGetCode() {
  if (countdown.value > 0) return
  if (!phoneMatch.value) {
    ElMessage.info('请先输入与绑定一致的手机号')
    return
  }
  if (!confirmTextMatch.value) {
    ElMessage.info('请先完整输入确认语后再获取验证码')
    return
  }
  const phone = (inputPhone.value || '').trim()
  if (!phone || phone.length < 11) {
    ElMessage.info('请输入正确的手机号')
    return
  }
  try {
    await sendTextMsg(phone, '2', '')
    countdown.value = 60
    ElMessage.info('验证码已发送')
    if (countdownHandle) countdownHandle.cancel()
    countdownHandle = cleanup.addCancellableInterval(() => {
      countdown.value--
      if (countdown.value <= 0 && countdownHandle) {
        countdownHandle.cancel()
        countdownHandle = null
      }
    }, 1000)
  } catch (e) {
    ElMessage.info(getErrMsg(e, '发送失败'))
  }
}

async function onSubmit() {
  if (!phoneMatch.value) {
    ElMessage.info('请输入与绑定一致的手机号')
    return
  }
  if (!confirmTextMatch.value) {
    ElMessage.info('请完整输入确认语后再提交')
    return
  }
  if (smsCode.value.trim().length < 4) {
    ElMessage.info('请输入短信验证码')
    return
  }
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  const phone = (inputPhone.value || '').trim()
  const code = (smsCode.value || '').trim()
  try {
    const res = await sendTextMsgNew(phone, code) as unknown as Record<string, unknown>
    const resData = (res?.data as Record<string, unknown>) || res
    const codeNum = resData?.code
    const isSuccess = codeNum === 200 || codeNum === 0 || codeNum === '200'
    if (!isSuccess) {
      const msg = (resData?.msg as string) || (resData?.message as string) || '验证码错误，请核对后重试'
      ElMessage.info(msg)
      return
    }
    showConfirmModal.value = true
  } catch (e) {
    ElMessage.info(getErrMsg(e, '验证码校验失败，请重试'))
  } finally {
    submitting.value = false
  }
}

async function onFinalConfirm() {
  if (confirmCountdown.value > 0) return
  showConfirmModal.value = false
  const loading = ElLoading.service({ text: '提交中...' })
  cancelLoading.value = true
  try {
    const code = (smsCode.value || '').trim()
    await deleteAccount(code, '用户主动注销账号')
    loading.close()
    try {
      await authStore.logout()
    } catch {
      // 静默处理
    }
    ElMessage.info('账号已注销')
    setTimeout(() => {
      router.replace({ name: 'login' })
    }, 1500)
  } catch (e) {
    loading.close()
    ElMessage.info(getErrMsg(e, '注销失败，请重试'))
  } finally {
    cancelLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
@use '@/styles/_breakpoints.scss' as bp;

.account-cancel {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
}

.account-cancel__inner {
  padding: 12px 12px 16px;

  @include bp.min-width('tablet') {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px 0 24px;
  }
}

/* 浅红提醒区 */
.account-cancel__notice {
  background-color: var(--el-color-danger-light-9);
  border: 1px solid var(--el-color-danger-light-5);
  border-radius: 8px;
  padding: 16px 14px;
  box-sizing: border-box;
  margin-bottom: 12px;
}

.account-cancel__notice-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-color-danger-dark-2);
  line-height: 1.5;
  margin-bottom: 10px;
}

.account-cancel__notice-desc {
  font-size: 14px;
  color: var(--el-color-danger);
  line-height: 1.6;
  opacity: 0.95;
}

/* 注销后果区 */
.account-cancel__consequences {
  background-color: var(--el-bg-color);
  border-radius: 8px;
  padding: 14px;
  box-sizing: border-box;
  border: 1px solid var(--el-border-color-lighter);
}

.account-cancel__consequences-intro {
  font-size: 13px;
  color: var(--el-text-color-primary);
  line-height: 1.7;
  margin-bottom: 12px;
}

.account-cancel__consequence {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.8;
  margin-bottom: 10px;
}

.account-cancel__consequence--remind {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-extra-light);
}

.account-cancel__item-num {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.account-cancel__highlight {
  color: var(--el-color-danger-dark-2);
  font-weight: 600;
}

.account-cancel__highlight--sentence {
  display: block;
  color: var(--el-color-danger-dark-2);
  font-weight: 600;
  font-size: 13px;
  line-height: 1.7;
}

.account-cancel__consequences-footer {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

/* 底部操作区 */
.account-cancel__footer {
  margin-top: 16px;
  padding: 12px 0 24px;
  box-sizing: border-box;
}

.account-cancel__confirm-block {
  margin-bottom: 14px;
}

.account-cancel__phone-block {
  margin-bottom: 14px;
}

.account-cancel__phone-block--disabled {
  opacity: 0.6;
  pointer-events: none;
}

.account-cancel__confirm-label {
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
  line-height: 1.5;
}

.account-cancel__confirm-label--highlight {
  font-size: 14px;
  font-weight: 600;
  color: #1565c0;
  background-color: #e3f2fd;
  padding: 8px 10px;
  border-radius: 4px;
  margin-bottom: 8px;
}

.account-cancel__confirm-ref {
  font-size: 13px;
  color: #333;
  line-height: 1.6;
  padding: 8px;
  background-color: #f8f8f8;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid #eee;
}

.account-cancel__confirm-ref--highlight {
  font-size: 14px;
  font-weight: 600;
  color: #0d47a1;
  background-color: #e3f2fd;
  border: 1px solid #90caf9;
  padding: 10px;
}

.account-cancel__confirm-input {
  width: 100%;
}

.account-cancel__confirm-error {
  font-size: 12px;
  color: #e64340;
  margin-top: 6px;
  line-height: 1.4;
}

.account-cancel__confirm-ok {
  font-size: 12px;
  color: #07c160;
  margin-top: 6px;
  line-height: 1.4;
}

.account-cancel__code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.account-cancel__code-input {
  flex: 1;
}

.account-cancel__code-btn {
  flex-shrink: 0;
  color: #e64340;
  background-color: #fff;
  border: 1px solid #e64340;
}

.account-cancel__code-btn.is-disabled {
  color: #999;
  border-color: #ddd;
}

.account-cancel__submit {
  width: 100%;
  height: 44px;
  font-size: 15px;
  margin-bottom: 10px;
}

.account-cancel__dialog {
  max-width: 420px;
}

.account-cancel__dialog-msg {
  font-size: 14px;
  color: #333;
  line-height: 1.6;
  margin: 0;
}
</style>
