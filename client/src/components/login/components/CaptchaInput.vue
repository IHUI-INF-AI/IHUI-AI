<template>
  <div class="captcha-input">
    <el-input
      :id="id"
      :model-value="modelValue"
      @update:model-value="updateValue"
      :placeholder="t('auth.captchaPlaceholder')"
      size="large"
      clearable
      class="captcha-field"
    >
      <template #prefix>
        <el-icon class="input-icon"><Key /></el-icon>
      </template>
    </el-input>

    <div class="captcha-image" role="button" :aria-label="t('auth.clickToRefresh')" @click="handleRefresh">
      <img
        :src="captchaUrl"
        :alt="t('auth.captchaAlt')"
        class="captcha-img"
        @error="handleImageError"
      />
      <div class="refresh-overlay">
        <el-icon class="refresh-icon"><Refresh /></el-icon>
        <span class="refresh-text">{{ t('auth.clickToRefresh') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Key, Refresh } from '@element-plus/icons-vue'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { getCaptcha } from '@/api/services/auth.service'

interface CaptchaInputProps {
  modelValue: string
  id?: string
}

interface CaptchaInputEmits {
  'update:modelValue': [value: string]
  refresh: [uuid: string]
}

const _props = defineProps<CaptchaInputProps>()
const emit = defineEmits<CaptchaInputEmits>()
const { t } = useI18n()

const captchaUrl = ref('')
const loading = ref(false)
const captchaUuid = ref<string>('')

const updateValue = (value: string) => {
  emit('update:modelValue', value)
}

const loadCaptcha = async () => {
  if (loading.value) return

  try {
    loading.value = true

    // 调用后端API获取验证码
    const response = await getCaptcha() as unknown as Record<string, unknown>

    // 支持多种后端响应格式:
    //   1) 标准风格: { code: 200, msg, img, uuid }
    //   2) 统一封装: { success: true, data: { img, uuid } }
    //   3) 直接返回: { img, uuid }
    let captchaData: Record<string, unknown> = response
    if (response && typeof response === 'object' && 'data' in response && response.data && typeof response.data === 'object' && ('img' in (response.data as Record<string, unknown>) || 'uuid' in (response.data as Record<string, unknown>))) {
      captchaData = response.data as Record<string, unknown>
    }

    const isSuccess =
      captchaData?.code === 200 ||
      captchaData?.msg === '操作成功' ||
      captchaData?.success === true ||
      captchaData?.img ||
      captchaData?.captchaImage ||
      captchaData?.image

    if (isSuccess) {
      // 获取验证码图片（base64格式）
      const imgData: string | undefined = (captchaData.img || captchaData.captchaImage || captchaData.image) as string | undefined
      // 获取UUID（用于登录时提交）
      const uuidRaw: string = (captchaData.uuid || captchaData.captchaId || `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`) as string
      const uuid = typeof uuidRaw === 'string' ? uuidRaw : String(uuidRaw)

      if (imgData) {
        // 如果图片数据已经是完整的 data URI，直接使用
        if (imgData.startsWith('data:')) {
          captchaUrl.value = imgData
        } else {
          // 如果是 base64 字符串, 添加前缀
          captchaUrl.value = `data:image/png;base64,${imgData}`
        }
        captchaUuid.value = uuid
        emit('refresh', uuid)
      } else {
        throw new Error(t('error.captcha_input.验证码图片数据为空'))
      }
    } else {
      throw new Error(String(captchaData?.msg || '获取验证码失败'))
    }
  } catch (error) {
    logger.error('[CaptchaInput] Failed to load captcha', error instanceof Error ? error : new Error(String(error)))
    // 兜底: 使用 SVG 占位
    captchaUrl.value = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjQwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iNDAiIGZpbGw9IiNmNWY1ZjUiLz48dGV4dCB4PSI1MCIgeT0iMjUiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7nlKjmiLfliqDovb3vvIE8L3RleHQ+PC9zdmc+`
  } finally {
    loading.value = false
  }
}

const handleRefresh = () => {
  loadCaptcha()
}

const handleImageError = () => {
  logger.warn(t('common.errors.loadFailed'))
  setTimeout(() => {
    loadCaptcha()
  }, 1000)
}

onMounted(() => {
  loadCaptcha()
})
</script>

<style scoped lang="scss">
.captcha-input {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.captcha-field {
  flex: 1;
}

.captcha-image {
  position: relative;
  width: 120px;
  height: 40px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.3s ease;

  &:hover {
    border: var(--el-border-width-primary) solid var(--el-color-primary);

    .refresh-overlay {
      opacity: 1;
    }
  }
}

.captcha-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.refresh-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-black-60);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  color: var(--el-bg-color-page);
}

.refresh-icon {
  font-size: 16px;
  margin-bottom: 2px;
}

.refresh-text {
  font-size: 12px;
  line-height: 1;
}

.input-icon {
  color: var(--el-text-color-placeholder);
}

@media (width <= 768px) {
  .captcha-input {
    flex-direction: column;
    gap: 8px;
  }

  .captcha-image {
    width: 100%;
    height: 36px;
  }
}
</style>
