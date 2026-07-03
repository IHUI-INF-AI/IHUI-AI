<template>
  <div
    v-if="open"
    class="sa-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="sa-dialog-title"
    :aria-busy="loading ? 'true' : 'false'"
    @click.self="onCancel"
  >
    <div class="sa-panel" role="document">
      <header class="sa-head">
        <h2 id="sa-dialog-title" class="sa-title">{{ title }}</h2>
        <button
          type="button"
          class="sa-close"
          :aria-label="t('sensitiveAction.closeLabel')"
          @click="onCancel"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div v-if="error" class="sa-state sa-state-error" role="alert">
        <span aria-hidden="true">!</span>
        <span>{{ error }}</span>
      </div>

      <div v-if="step === 'request' || !challenge" class="sa-section">
        <p class="sa-desc">
          {{ description || defaultDescription }}
        </p>
        <div class="sa-actions">
          <button
            type="button"
            class="sa-btn sa-btn-primary"
            :disabled="loading"
            @click="onRequest"
          >
            <span class="sa-btn-text">{{ t('sensitiveAction.sendCode') }}</span>
          </button>
        </div>
      </div>

      <div v-else-if="step === 'verify'" class="sa-section">
        <p class="sa-desc">
          {{ t('sensitiveAction.codeSentPrefix') }} <strong>{{ channelLabel }}</strong> {{ t('sensitiveAction.codeSentSuffix', { ttl: ttlSeconds }) }}
        </p>
        <fieldset class="sa-fieldset">
          <legend class="sa-label">{{ t('sensitiveAction.enterCode') }}</legend>
          <input
            id="sa-code-input"
            ref="codeInputRef"
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="sa-input"
            :aria-invalid="error ? 'true' : 'false'"
            :aria-describedby="error ? 'sa-error-msg' : undefined"
            @input="onCodeInput"
            @keydown.enter="onVerify"
          />
        </fieldset>
        <div class="sa-actions">
          <button
            type="button"
            class="sa-btn sa-btn-secondary"
            :disabled="loading || resendCooldown > 0"
            @click="onRequest"
          >
            <span class="sa-btn-text">
              {{ resendCooldown > 0 ? t('sensitiveAction.resendWithCooldown', { n: resendCooldown }) : t('sensitiveAction.resend') }}
            </span>
          </button>
          <button
            type="button"
            class="sa-btn sa-btn-primary"
            :disabled="loading || code.length < 4"
            @click="onVerify"
          >
            <span class="sa-btn-text">{{ t('sensitiveAction.confirm') }}</span>
          </button>
        </div>
      </div>

      <div v-else-if="step === 'success'" class="sa-section">
        <p class="sa-desc sa-desc-success" role="status">
          {{ t('sensitiveAction.verifySuccess') }}
        </p>
        <div class="sa-actions">
          <button
            type="button"
            class="sa-btn sa-btn-primary"
            @click="onProceed"
          >
            <span class="sa-btn-text">{{ t('sensitiveAction.continueAction') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSecurityAudit } from '@/composables/useSecurityAudit'
import type { ChallengeInfo } from '@/composables/useSecurityAudit'
import { useA11y } from '@/composables/useA11y'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
  userId: string
  action: string
  title?: string
  description?: string
  channel?: string
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'verified', payload: { token: string; expires_at: number; channel: string }): void
}>()

const { requestVerification, confirmVerification } = useSecurityAudit()
const { announce, focusFirst } = useA11y()

const step = ref<'request' | 'verify' | 'success'>('request')
const challenge = ref<ChallengeInfo | null>(null)
const code = ref('')
const error = ref<string | null>(null)
const loading = ref(false)
const ttlSeconds = ref(0)
const resendCooldown = ref(0)
const codeInputRef = ref<HTMLInputElement | null>(null)

const channelLabel = computed(() => {
  const map: Record<string, string> = {
    sms: t('sensitiveAction.channelSms'),
    email: t('sensitiveAction.channelEmail'),
    totp: t('sensitiveAction.channelTotp'),
    password: t('sensitiveAction.channelPassword'),
    push: t('sensitiveAction.channelPush'),
  }
  return map[challenge.value?.channel || ''] || challenge.value?.channel || ''
})

const defaultDescription = computed(() =>
  t('sensitiveAction.defaultDescription', { action: props.title || props.action }),
)

let cooldownTimer: number | undefined
let ttlTimer: number | undefined

const clearTimers = () => {
  if (cooldownTimer) {
    window.clearInterval(cooldownTimer)
    cooldownTimer = undefined
  }
  if (ttlTimer) {
    window.clearInterval(ttlTimer)
    ttlTimer = undefined
  }
}

const startResendCooldown = (sec = 60) => {
  resendCooldown.value = sec
  cooldownTimer = window.setInterval(() => {
    if (resendCooldown.value > 0) resendCooldown.value -= 1
    if (resendCooldown.value <= 0 && cooldownTimer) {
      window.clearInterval(cooldownTimer)
      cooldownTimer = undefined
    }
  }, 1000)
}

const startTtlCountdown = () => {
  if (!challenge.value) return
  const expiresAt = challenge.value.expires_at
  ttlSeconds.value = Math.max(0, Math.floor((expiresAt - Date.now() / 1000)))
  ttlTimer = window.setInterval(() => {
    const left = Math.max(0, Math.floor(expiresAt - Date.now() / 1000))
    ttlSeconds.value = left
    if (left <= 0 && ttlTimer) {
      window.clearInterval(ttlTimer)
      ttlTimer = undefined
      error.value = t('sensitiveAction.codeExpired')
    }
  }, 1000)
}

const focusCodeInput = async () => {
  await nextTick()
  codeInputRef.value?.focus()
}

const reset = () => {
  step.value = 'request'
  challenge.value = null
  code.value = ''
  error.value = null
  loading.value = false
  clearTimers()
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      reset()
      announce(t('sensitiveAction.needVerification', { action: props.title || props.action }), { politeness: 'assertive' })
      nextTick(() => focusFirst(codeInputRef))
    } else {
      clearTimers()
    }
  },
)

onMounted(() => {
  if (props.open) {
    nextTick(() => focusFirst(codeInputRef))
  }
})

onUnmounted(() => {
  clearTimers()
})

const onRequest = async () => {
  if (loading.value) return
  error.value = null
  loading.value = true
  try {
    const ch = await requestVerification(props.userId, props.action, props.channel)
    if (!ch) {
      error.value = t('sensitiveAction.requestFailed')
      return
    }
    challenge.value = ch
    step.value = 'verify'
    startResendCooldown(60)
    startTtlCountdown()
    announce(t('sensitiveAction.codeSentWithTtl', { ttl: ch.ttl_seconds }), { politeness: 'polite' })
    focusCodeInput()
  } catch (e: unknown) {
    error.value = (e instanceof Error ? e.message : '') || t('sensitiveAction.applyFailed')
  } finally {
    loading.value = false
  }
}

const onCodeInput = () => {
  code.value = code.value.replace(/\D/g, '').slice(0, 6)
  if (error.value) error.value = null
}

const onVerify = async () => {
  if (loading.value || code.value.length < 4) return
  if (!challenge.value) return
  error.value = null
  loading.value = true
  try {
    const challengeId = challenge.value.challenge_id
    const res = await confirmVerification(props.userId, challengeId, code.value)
    if (!res) {
      error.value = t('sensitiveAction.verifyFailedRetry')
      return
    }
    if (!res.verified) {
      error.value = t('sensitiveAction.codeError')
      return
    }
    step.value = 'success'
    announce(t('sensitiveAction.verifySuccessAnnounce'), { politeness: 'assertive' })
  } catch (e: unknown) {
    error.value = (e instanceof Error ? e.message : '') || t('sensitiveAction.verifyFailed')
  } finally {
    loading.value = false
  }
}

const onProceed = () => {
  if (!challenge.value) return
  emit('verified', {
    token: 'verified',
    expires_at: challenge.value.expires_at,
    channel: challenge.value.channel,
  })
  reset()
}

const onCancel = () => {
  reset()
  emit('cancel')
}
</script>

<style scoped lang="scss">
@layer components {
  .sa-dialog {
    position: fixed;
    inset: 0;
    background: var(--el-overlay-color);
    z-index: var(--z-popover);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .sa-panel {
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: var(--global-box-shadow);
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
  }

  .sa-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: var(--unified-border-bottom);
  }

  .sa-title {
    font-size: 17px;
    font-weight: 700;
    margin: 0;
    color: var(--el-text-color-primary);
  }

  .sa-close {
    width: 32px;
    height: 32px;
    border: var(--unified-border);
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    color: var(--el-text-color-primary);
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
  }

  .sa-close:hover {
    border-color: var(--border-unified-color-hover);
  }

  .sa-section {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .sa-desc {
    margin: 0;
    font-size: 14px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
  }

  .sa-desc-success {
    color: var(--el-color-success);
    font-weight: 600;
  }

  .sa-state {
    margin: 12px 20px 0;
    padding: 10px 14px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sa-state-error {
    border-color: var(--el-color-danger);
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
  }

  .sa-state-error span[aria-hidden] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border: var(--unified-border);
    color: var(--el-color-danger);
    border-radius: var(--global-border-radius);
    font-weight: 700;
  }

  .sa-fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .sa-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-text-color-regular);
  }

  .sa-input {
    height: 40px;
    padding: 0 14px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-size: 18px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    letter-spacing: 4px;
    text-align: center;
    transition: border-color 0.2s;
  }

  .sa-input:hover {
    border-color: var(--border-unified-color-hover);
  }

  .sa-input:focus-visible {
    outline: 2px solid var(--el-color-primary);
    outline-offset: 1px;
    border-color: var(--border-unified-color-hover);
  }

  .sa-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }

  .sa-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 18px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .sa-btn:hover:not(:disabled) {
    border-color: var(--border-unified-color-hover);
  }

  .sa-btn-primary {
    // 2026-07-04 修复: 反相配对双模式覆盖, 原 background: var(--el-text-color-primary) + color: var(--el-bg-color) 在暗色模式下文字不可见
    /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
    background: #1a1a1a;
    color: #fff;
    /* stylelint-enable color-no-hex */

    border-color: transparent;

    html.dark & {
      /* stylelint-disable color-no-hex -- 反相配对 (背景/文字互为黑白), 无对应 token */
      background: #fff;
      color: #1a1a1a;
      /* stylelint-enable color-no-hex */

      border-color: transparent;
    }
  }

  .sa-btn-secondary {
    background: var(--el-bg-color);
    color: var(--el-text-color-primary);
  }

  .sa-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
