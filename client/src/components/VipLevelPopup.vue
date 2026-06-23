<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sanitizeHtml } from '@/utils/htmlSanitizer'

const { t } = useI18n()
const router = useRouter()

const props = defineProps<{
  isShow?: boolean
  btnFlag?: boolean
  userInfoDatas?: Record<string, unknown>
}>()

const emit = defineEmits<{
  (e: 'openPopup'): void
}>()

const showPopup = ref(true)
const benefits = computed(() => [
  { id: 1, content: t('vipLevelPopup.benefitLevel1') },
  { id: 2, content: t('vipLevelPopup.benefitLevel2') },
  { id: 3, content: t('vipLevelPopup.benefitLevel3') },
  { id: 4, content: t('vipLevelPopup.benefitLevel4') },
  { id: 5, content: t('vipLevelPopup.benefitLevel5') },
  { id: 6, content: t('vipLevelPopup.benefitLevel6') },
  { id: 7, content: t('vipLevelPopup.benefitLevel7') },
  { id: 8, content: t('vipLevelPopup.benefitLevel8') },
  { id: 9, content: t('vipLevelPopup.benefitLevel9') },
  { id: 10, content: t('vipLevelPopup.benefitLevel10') },
])

function close() {
  router.back()
}

function handleOpen() {
  emit('openPopup')
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
        <div class="avatar-area">
          <div class="view-content" style="position: absolute; left: 0; top: 10px; display: flex; align-items: center">
            <img src="https://file.aizhs.top/sys-mini/default/zuan.png" style="width: 55px; height: 55px" alt="zuan" loading="lazy" />
            <img src="https://file.aizhs.top/sys-mini/default/zuan_title.png" style="width: 55px; height: 55px" alt="zuan_title" loading="lazy" />
          </div>
          <div style="position: absolute; left: 0; bottom: 5px; display: flex; align-items: center; flex-direction: column; color: var(--color-red)">
            <div>{{ t('cmpVipLevelPopup.vipLevelMechanism') }}</div>
            <div>{{ t('cmpVipLevelPopup.yuanToPoint') }}</div>
          </div>
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
          <img style="width: 122px; position: absolute; right: 0; bottom: 5px" src="https://file.aizhs.top/sys-mini/saomaa.jpg" alt="scan" loading="lazy" />
        </div>
        <div class="benefit-item level-info" style="margin-bottom: 3px">
          <span class="level-text">{{ t('vipLevelPopup.level0Desc') }}</span>
        </div>
        <div class="benefits-list" @touchmove="handleTouchMove">
          <div v-for="item in benefits" :key="item.id" class="benefit-item">
            <span class="benefit-number">{{ item.id }}.</span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="benefit-content" v-html="sanitizeHtml(item.content)" />
          </div>
        </div>

        <div class="footer-image">
          <img style="width: 174px" src="https://file.aizhs.top/sys-mini/yejiao.png" alt="footer" loading="lazy" />
        </div>
        <button class="bottom-button" @click="handleOpen">{{ t('vipLevelPopup.goActivate') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.introduce-popup {
  transform: translateZ(0);
  top: 0;
  left: 0;
  width: 93%;
  height: auto;
  z-index: var(--z-base);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  perspective: 1200px;
  background-image: var(--color-gradient-purple-yellow);
  box-shadow: var(--global-box-shadow);
  margin: 20px auto 0;
  border-radius: var(--global-border-radius);
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
}

.popup-content.popup-show {
  transform: translateY(0) rotateX(0deg);
  opacity: 1;
}

.popup-container {
  width: 100%;
  height: 100%;
  padding: 10px 5px;
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

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.level-text {
  color: var(--color-purple-8d83ff);
  font-size: 12px;
}

.level-info {
  border: none;
  padding: 4px;
}

.benefits-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
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

.bottom-button {
  width: 178px;
  height: 32px;
  background-color: var(--color-white);
  border-radius: var(--global-border-radius);
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
  font-size: 24px;
  font-weight: bold;
  color: var(--color-gray-333);
  border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
  background-image: linear-gradient(to bottom, var(--el-color-white), var(--el-fill-color-lighter));
  cursor: pointer;
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
}
</style>
