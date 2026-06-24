<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElLoading } from 'element-plus'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
import { useCleanup } from '@/composables/useCleanup'
import { getUserToken } from '@/utils/request'

async function authFetch(url: string | URL, options: RequestInit = {}): Promise<Response> {
  const token = getUserToken()
  return fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}

const { t } = useI18n()

const router = useRouter()

const props = defineProps<{
  isShow?: boolean
  dataInfo?: Record<string, unknown>
  userInfoDatas?: Record<string, unknown>
}>()

const showPopup = ref(true)
const benefits = ref([
  { id: 1, content: t('cmpVipIntroducePopupAlt.feature1') },
  { id: 2, content: t('cmpVipIntroducePopupAlt.feature2') },
  { id: 3, content: t('cmpVipIntroducePopupAlt.feature3') },
  { id: 4, content: t('cmpVipIntroducePopupAlt.feature4') },
  { id: 5, content: t('cmpVipIntroducePopupAlt.feature5') },
  { id: 6, content: t('cmpVipIntroducePopupAlt.feature6') },
  { id: 7, content: t('cmpVipIntroducePopupAlt.feature7') },
  { id: 8, content: t('cmpVipIntroducePopupAlt.feature8') },
  { id: 9, content: t('cmpVipIntroducePopupAlt.feature9') },
  { id: 10, content: t('cmpVipIntroducePopupAlt.feature10') },
])
const moreBenefitsText = ref(t('cmpVipIntroducePopupAlt.benefitsCount'))

const cleanup = useCleanup()

function close() {
  router.back()
}

async function handleOpen() {
  const loadingInstance = ElLoading.service({ text: '支付中...', background: 'var(--color-black-30)' })
  try {
    const response = await authFetch('/api/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: props.dataInfo?.amount,
        id: props.dataInfo?.id,
        type: 1,
        payType: 2,
      }),
    })
    await response.json()
    cleanup.addTimer(() => {
      loadingInstance.close()
      close()
      ElMessage.success(t('cmpVipIntroducePopupAlt.paySuccess'))
    }, 1000)
  } catch {
    loadingInstance.close()
    ElMessage.error(t('cmpVipIntroducePopupAlt.payFailed'))
  }
}

function handleTouchMove(e: Event) {
  e.stopPropagation()
}

onMounted(() => {
  // init
})
</script>

<template>
  <div class="introduce-popup blur-background" @click="close">
    <div class="popup-content" :class="{ 'popup-show': showPopup }" @click.stop>
      <div class="popup-container">
        <div class="header-images">
          <img style="width: 185px; height: 22px" src="https://file.aizhs.top/sys-mini/headertitley.png" alt="title" loading="lazy" />
          <img style="width: 144px; height: 13px" src="https://file.aizhs.top/sys-mini/headertitlet.png" alt="subtitle" loading="lazy" />
        </div>
        <div class="avatar-row">
          <img style="width: 118px" src="https://file.aizhs.top/sys-mini/cps.jpg" alt="cps" loading="lazy" />
          <div class="avatar-section-wrapper">
            <img
              v-if="(props.userInfoDatas as any)?.isVIP == 1 && (props.userInfoDatas as any)?.identityTypy == 0"
              class="avatar-section-top"
              src="https://file.aizhs.top/sys-mini/danshuzhiq.png"
              alt="vip"
              loading="lazy"
            />
            <img
              v-else-if="(props.userInfoDatas as any)?.isVIP == 1 && (props.userInfoDatas as any)?.identityTypy == 1"
              class="avatar-section-top"
              src="https://file.aizhs.top/sys-mini/danshuzhiq.png"
              alt="vip"
              loading="lazy"
            />
            <img
              v-else-if="(props.userInfoDatas as any)?.isVIP == 0 && (props.userInfoDatas as any)?.identityTypy == 0"
              class="avatar-section-top"
              src="https://file.aizhs.top/sys-mini/pt-head.png"
              alt="normal"
              loading="lazy"
            />
            <div class="avatar-section">
              <img
                :src="(props.userInfoDatas as any)?.avatar || 'https://file.aizhs.top/sys-mini/daixaodiming.png'"
                class="avatar-image"
                alt="avatar"
                loading="lazy"
              />
            </div>
          </div>
          <img style="width: 122px" src="https://file.aizhs.top/sys-mini/saomaa.jpg" alt="scan" loading="lazy" />
        </div>

        <div class="benefits-list" @touchmove="handleTouchMove">
          <div v-for="item in benefits" :key="item.id" class="benefit-item">
            <span class="benefit-number">{{ item.id }}.</span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="benefit-content" v-html="sanitizeHtml(item.content)" />
          </div>
        </div>

        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="more-benefits" v-html="sanitizeHtml(moreBenefitsText)" />

        <div class="footer-image">
          <img style="width: 174px" src="https://file.aizhs.top/sys-mini/yejiao.png" alt="footer" loading="lazy" />
        </div>
        <div class="bottom-buttons">
          <button class="bottom-button" @click="handleOpen">{{ t('vipIntroducePopupAlt.joinUs') }}</button>
          <button class="bottom-button dark-button" @click="close">{{ t('vipIntroducePopupAlt.consultAgain') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.introduce-popup {
  transform: translateZ(0);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: var(--z-max);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  perspective: 1200px;
}

.popup-content {
  position: relative;
  width: 100%;
  height: auto;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transform: translateY(100vh) rotateX(5deg);
  transition: all 0.3s ease-in-out;
  opacity: 0.8;
  background-image: var(--color-gradient-purple-yellow);
  box-shadow: var(--global-box-shadow);
}

.popup-content.popup-show {
  transform: translateY(0) rotateX(0deg);
  opacity: 1;
}

.popup-container {
  width: 100%;
  height: 100%;
  padding: 20px 15px;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: var(--z-base);
  box-sizing: border-box;
}

.header-images {
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.avatar-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.benefits-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  -webkit-overflow-scrolling: touch;
}

.benefit-item {
  display: flex;
  align-items: flex-start;
  border: var(--unified-border);
  padding: 4px;
  border-radius: var(--global-border-radius);
  font-size: 14px;
  color: var(--color-gray-1f2937);
}

.benefit-number {
  font-weight: bold;
  padding-right: 4px;
}

.benefit-content {
  flex: 1;
}

.more-benefits {
  text-align: center;
  font-size: 13px;
  color: var(--color-red-d94646);
}

.bottom-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.bottom-button {
  width: 178px;
  height: 40px;
  background-color: var(--color-white);
  border-radius: var(--global-border-radius);
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px auto;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-gray-333);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
  background-image: linear-gradient(to bottom, var(--el-color-white), var(--el-fill-color-lighter));
  cursor: pointer;
}

.dark-button {
  background-color: var(--color-gray-333);
  background-image: none;
  color: var(--color-white);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
}

.footer-image {
  width: 100%;
  text-align: center;
  padding-bottom: 5px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.avatar-section-wrapper {
  display: inline-block;
  position: relative;
}

.avatar-section-top {
  top: -13%;
  z-index: var(--z-header);
  position: absolute;
  width: 77px;
}

.avatar-section {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
}
</style>
