<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const { t } = useI18n()
const router = useRouter()

const props = defineProps<{
  isShow?: boolean
  userInfoDatas?: Record<string, unknown>
}>()

const isServicePopupVisible = ref(false)
const showPopup = ref(true)
const benefits = ref([
  { id: 1, content: t('vipPrivateAdvisory.benefit1'), color: 'var(--color-rgba-255--79--79-0-6-)' },
  { id: 2, content: t('vipPrivateAdvisory.benefit2'), color: 'var(--color-rgba-255--79--79-0-7-)' },
  { id: 3, content: t('vipPrivateAdvisory.benefit3'), color: 'var(--color-rgba-255--79--79-0-8-)' },
  { id: 4, content: t('vipPrivateAdvisory.benefit4'), color: 'var(--color-rgba-255--79--79-0-9-)' },
  { id: 5, content: t('vipPrivateAdvisory.benefit5'), color: 'var(--color-rgba-255--79--79-1-)' },
])

function close() {
  isServicePopupVisible.value = false
  router.back()
}

function handleTouchMove(e: Event) {
  e.stopPropagation()
}

function showServicePopup() {
  isServicePopupVisible.value = true
}

function hideServicePopup() {
  isServicePopupVisible.value = false
}
</script>

<template>
  <div class="introduce-popup blur-background" @click="close">
    <div class="popup-content" :class="{ 'popup-show': showPopup }" @click.stop>
      <div class="popup-container">
        <div class="header-images">
          <img style="width: 185px; height: 22px" src="https://file.aizhs.top/sys-mini/headertitley.png" alt="title" loading="lazy" />
          <img style="width: 144px; height: 13px" src="https://file.aizhs.top/sys-mini/headertitlet.png" alt="subtitle" loading="lazy" />
        </div>
        <div class="avatar-area">
          <img
            style="width: 122px; margin-top: 10px; position: absolute; left: 0; top: 10px; display: flex; align-items: center"
            src="https://file.aizhs.top/sys-mini/xizi-logo.jpg"
            alt="xizi"
            loading="lazy"
          />
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
              />
            </div>
          </div>
          <img style="width: 122px; position: absolute; right: 0; bottom: 5px" src="https://file.aizhs.top/sys-mini/saomaa.jpg" alt="scan" />
        </div>
        <div>
          <img style="width: 100%; margin-bottom: 5px" src="https://file.aizhs.top/sys-mini/celance.jpg" alt="celance" loading="lazy" />
        </div>

        <div class="benefits-list" @touchmove="handleTouchMove">
          <div
            v-for="item in benefits"
            :key="item.id"
            class="benefit-item"
            style="font-size: 16px"
          >
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="benefit-content" :style="{ color: item.color }" v-html="sanitizeHtml(item.content)" />
          </div>
        </div>

        <div class="bottom-buttons">
          <button class="bottom-button" @click="showServicePopup">{{ t('vipPrivateAdvisory.joinUs') }}</button>
        </div>
      </div>
    </div>

    <div v-if="isServicePopupVisible" class="service-mask" @click="hideServicePopup">
      <div class="service-popup-content" @click.stop>
        <div style="display: flex; flex-direction: column; align-items: center">
          <img class="card-image" src="https://file.aizhs.top/sys-mini/default/mingpian.png" alt="名片" loading="lazy" />
          <img class="card-image2" src="https://file.aizhs.top/sys-mini/erweima.png" alt="二维码" loading="lazy" />
          <img style="margin-top: 8px; margin-bottom: 10px" src="https://file.aizhs.top/sys-mini/text-tip.jpg" alt="tip" loading="lazy" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.introduce-popup {
  transform: translateZ(0);
  top: 0;
  left: 0;
  width: 93%;
  height: calc(100vh - 82px);
  z-index: var(--z-base);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  perspective: 1200px;
  margin: 0 auto;
  border-radius: var(--global-border-radius);
}

.popup-content {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transform: translateY(100vh) rotateX(5deg);
  transition: all 0.3s ease-in-out;
  opacity: 0.8;
  background: url("https://file.aizhs.top/sys-mini/default/sdh_back.jpg") no-repeat;
  background-size: 100%;
  background-position: bottom;
}

.popup-content.popup-show {
  transform: translateY(0) rotateX(0deg);
  opacity: 1;
}

.popup-container {
  width: 100%;
  height: 100%;
  padding: 10px 5px 0;
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

.avatar-area {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
  padding-top: 10px;
  padding-bottom: 5px;
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
}

.avatar-image {
  width: 100%;
  height: 100%;
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

.benefit-content {
  flex: 1;
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
  color: var(--color-black);
  border: var(--unified-border);
  cursor: pointer;
  animation: bounce 0.5s ease-in-out infinite;
}

@keyframes bounce {
  0% { box-shadow: none; transform: translate(1px, 1px); }
  50% { transform: translate(0, 0); }
  100% { box-shadow: none; transform: translate(1px, 1px); }
}

.service-mask {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-max);
  background-color: var(--color-black-40);
  backdrop-filter: blur(3px);
}

.service-popup-content {
  padding: 10px;
  position: relative;
  border-radius: var(--global-border-radius);
  opacity: 1;
  background: var(--color-white-40);
  backdrop-filter: blur(10px);
  box-shadow: none;
}

.card-image {
  width: 100%;
  height: calc(50vh - 60px);
  display: block;
  margin: 0 auto 8px;
  border-radius: var(--global-border-radius);
  overflow: hidden;
}

.card-image2 {
  width: 100%;
  height: calc(50vh - 74px);
  display: block;
  margin: 0 auto;
  border-radius: var(--global-border-radius);
  overflow: hidden;
}
</style>
