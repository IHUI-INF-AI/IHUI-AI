<template>
  <div class="two-factor-auth">
    <div class="tfa-header">
      <h3 class="tfa-title">{{ t('settings.twoFactor.title') }}</h3>
      <p class="tfa-desc">{{ t('settings.twoFactor.description') }}</p>
    </div>

    <div class="tfa-status" v-if="!isSetupMode">
      <div class="status-indicator" :class="{ enabled: status.enabled }">
        <el-icon :size="24">
          <CircleCheck v-if="status.enabled" />
          <CircleClose v-else />
        </el-icon>
        <span>{{ status.enabled ? t('settings.twoFactor.enabled') : t('settings.twoFactor.disabled') }}</span>
      </div>

      <div class="tfa-actions">
        <el-button
          v-if="!status.enabled"
          type="primary"
          @click="startSetup"
        >
          {{ t('settings.twoFactor.enable') }}
        </el-button>
        <el-button
          v-else
          type="danger"
          plain
          @click="handleDisable"
        >
          {{ t('settings.twoFactor.disable') }}
        </el-button>
      </div>
    </div>

    <div class="tfa-setup" v-else>
      <el-steps :active="currentStep" align-center>
        <el-step :title="t('settings.twoFactor.step1')" />
        <el-step :title="t('settings.twoFactor.step2')" />
        <el-step :title="t('settings.twoFactor.step3')" />
      </el-steps>

      <div class="setup-content">
        <div v-if="currentStep === 0" class="step-qr">
          <p class="step-desc">{{ t('settings.twoFactor.scanQR') }}</p>
          <div class="qr-container">
            <img v-if="setupData.qrCodeUrl" :src="qrCodeImage" alt="QR Code" class="qr-code" />
          </div>
          <div class="secret-key">
            <span class="label">{{ t('settings.twoFactor.secretKey') }}:</span>
            <code class="secret">{{ setupData.secret }}</code>
            <el-button text size="small" @click="copySecret">
              {{ t('common.copy') }}
            </el-button>
          </div>
        </div>

        <div v-if="currentStep === 1" class="step-verify">
          <p class="step-desc">{{ t('settings.twoFactor.enterCode') }}</p>
          <div class="code-input">
            <input
              v-for="i in 6"
              :key="i"
              type="text"
              maxlength="1"
              class="code-digit"
              v-model="verifyCode[i - 1]"
              @input="handleCodeInput($event, i - 1)"
              @keydown="handleCodeKeydown($event, i - 1)"
              :ref="(el: Element | ComponentPublicInstance | null) => { if (el && el instanceof HTMLInputElement) codeInputs[i - 1] = el }"
            />
          </div>
          <p v-if="verifyError" class="verify-error">{{ verifyError }}</p>
        </div>

        <div v-if="currentStep === 2" class="step-backup">
          <p class="step-desc">{{ t('settings.twoFactor.backupCodesDesc') }}</p>
          <div class="backup-codes">
            <code
              v-for="(code, index) in setupData.backupCodes"
              :key="index"
              class="backup-code"
            >
              {{ code }}
            </code>
          </div>
          <el-button text @click="downloadBackupCodes">
            {{ t('settings.twoFactor.downloadBackupCodes') }}
          </el-button>
        </div>
      </div>

      <div class="setup-actions">
        <el-button v-if="currentStep > 0" @click="prevStep">
          {{ t('common.previous') }}
        </el-button>
        <el-button
          v-if="currentStep < 2"
          type="primary"
          @click="nextStep"
          :disabled="currentStep === 1 && verifyCode.join('').length < 6"
        >
          {{ t('common.next') }}
        </el-button>
        <el-button
          v-if="currentStep === 2"
          type="success"
          @click="completeSetup"
        >
          {{ t('settings.twoFactor.complete') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type ComponentPublicInstance } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { TwoFactorService, type TwoFactorSetup, type TwoFactorStatus } from '@/utils/twoFactorService'

const { t } = useI18n()

const status = ref<TwoFactorStatus>({ enabled: false, hasBackupCodes: false })
const isSetupMode = ref(false)
const currentStep = ref(0)
const setupData = ref<TwoFactorSetup>({
  secret: '',
  qrCodeUrl: '',
  backupCodes: [],
  enabled: false,
})
const verifyCode = ref<string[]>(['', '', '', '', '', ''])
const verifyError = ref('')
const codeInputs = ref<HTMLInputElement[]>([])

const qrCodeImage = computed(() => {
  if (!setupData.value.qrCodeUrl) return ''
  const size = 200
  const chartUrl = `https://chart.googleapis.com/chart?chs=${size}x${size}&cht=qr&chl=${encodeURIComponent(setupData.value.qrCodeUrl)}&choe=UTF-8`
  return chartUrl
})

const loadStatus = () => {
  status.value = TwoFactorService.getStatus()
}

const startSetup = async () => {
  const email = 'user@example.com'
  setupData.value = await TwoFactorService.setup(email)
  isSetupMode.value = true
  currentStep.value = 0
  verifyCode.value = ['', '', '', '', '', '']
  verifyError.value = ''
}

const handleCodeInput = (event: Event, index: number) => {
  const input = event.target as HTMLInputElement
  const value = input.value.replace(/\D/g, '')
  verifyCode.value[index] = value

  if (value && index < 5) {
    codeInputs.value[index + 1]?.focus()
  }
}

const handleCodeKeydown = (event: KeyboardEvent, index: number) => {
  if (event.key === 'Backspace' && !verifyCode.value[index] && index > 0) {
    codeInputs.value[index - 1]?.focus()
  }
}

const copySecret = async () => {
  try {
    await navigator.clipboard.writeText(setupData.value.secret)
    ElMessage.success(t('common.copied'))
  } catch {
    ElMessage.error(t('common.copyFailed'))
  }
}

const nextStep = async () => {
  if (currentStep.value === 1) {
    const code = verifyCode.value.join('')
    const result = await TwoFactorService.verify(code, setupData.value.secret)

    if (!result.success) {
      verifyError.value = result.message
      return
    }
    verifyError.value = ''
  }

  currentStep.value++
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const completeSetup = async () => {
  await TwoFactorService.enable(setupData.value)
  isSetupMode.value = false
  loadStatus()
  ElMessage.success(t('settings.twoFactor.enableSuccess'))
}

const handleDisable = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.twoFactor.disableConfirm'),
      t('settings.twoFactor.disableTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    )

    await TwoFactorService.disable()
    loadStatus()
    ElMessage.success(t('settings.twoFactor.disableSuccess'))
  } catch {
    // 用户取消
  }
}

const downloadBackupCodes = () => {
  const content = `IHUI AI - Two-Factor Authentication Backup Codes

Keep these codes safe. Each code can only be used once.

${setupData.value.backupCodes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

Generated: ${new Date().toLocaleString()}
`

  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ihui-backup-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadStatus()
})
</script>

<style scoped lang="scss">
.two-factor-auth {
  padding: 20px;
  background: var(--el-bg-color);
  border-radius: var(--global-border-radius);
}

.tfa-header {
  margin-bottom: 20px;

  .tfa-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px;
    color: var(--el-text-color-primary);
  }

  .tfa-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    margin: 0;
  }
}

.tfa-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: var(--global-border-radius);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-color-danger);

  &.enabled {
    color: var(--el-color-success);
  }
}

.tfa-setup {
  margin-top: 20px;
}

.setup-content {
  margin: 24px 0;
  min-height: 200px;
}

.step-qr {
  text-align: center;

  .step-desc {
    margin-bottom: 16px;
    color: var(--el-text-color-secondary);
  }

  .qr-container {
    display: inline-block;
    padding: 16px;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    margin-bottom: 16px;
  }

  .qr-code {
    width: 200px;
    height: 200px;
  }

  .secret-key {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;

    .label {
      color: var(--el-text-color-secondary);
    }

    .secret {
      padding: 4px 8px;
      background: var(--el-fill-color);
      border-radius: var(--global-border-radius);
      font-family: monospace;
    }
  }
}

.step-verify {
  text-align: center;

  .step-desc {
    margin-bottom: 24px;
    color: var(--el-text-color-secondary);
  }

  .code-input {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .code-digit {
    width: 48px;
    height: 56px;
    text-align: center;
    font-size: 24px;
    font-weight: 600;
    border: 2px solid var(--el-border-color);
    border-radius: var(--global-border-radius);
    outline: none;
    transition: border-color 0.3s;

    &:focus {
      border: var(--el-border-width-primary) solid var(--el-color-primary);
    }
  }

  .verify-error {
    margin-top: 12px;
    color: var(--el-color-danger);
  }
}

.step-backup {
  text-align: center;

  .step-desc {
    margin-bottom: 16px;
    color: var(--el-text-color-secondary);
  }

  .backup-codes {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-width: 400px;
    margin: 0 auto 16px;
  }

  .backup-code {
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: var(--global-border-radius);
    font-family: monospace;
    font-size: 14px;
  }
}

.setup-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding-top: 16px;
  border-top: var(--unified-border);
}
</style>
