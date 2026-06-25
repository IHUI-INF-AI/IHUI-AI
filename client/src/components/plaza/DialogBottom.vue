<template>
  <div class="dialog-bottom">
    <div class="title-body">
      <img class="welcome-img" src="https://file.aizhs.top/sys-mini/xtk/Welcome.png" alt="Welcome" loading="lazy" />
      <img class="brand-img" src="https://file.aizhs.top/sys-mini/xtk/iHuiInfAI.png" alt="iHui AI" loading="lazy" />
    </div>
    <img class="header-logo" :src="userInfo.avatar || 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'" alt="用户头像" />
    <div class="user-name">{{ userInfo.nickname }}</div>
    <div class="logo-text">{{ t('dialogBottom.slogan') }}</div>
    <div class="btn-body">
      <div class="card-left card-body" @click="toSet">
        <img class="left-icon" src="https://file.aizhs.top/sys-mini/xtk/plaza_win_left.png" alt="" loading="lazy" />
        <span class="left-text">{{ t('dialogBottom.findExpert') }}</span>
      </div>
      <img class="or-img" src="https://file.aizhs.top/sys-mini/xtk/image_or.png" alt="" loading="lazy" />
      <div class="card-right card-body" @click="toDev">
        <img class="right-icon" src="https://file.aizhs.top/sys-mini/xtk/plaza_win_right.png" alt="" loading="lazy" />
        <span class="right-text">{{ t('dialogBottom.iAmDeveloper') }}</span>
      </div>
    </div>
    <div class="bottom-text" @click="showNoticeModal = true">{{ t('dialogBottom.developerNotice') }}</div>

    <el-dialog v-model="showNoticeModal" :title="t('dialogBottom.developerNotice')" width="500px">
      <div class="notice-body">
        <div class="notice-section">
          <strong>{{ t('dialogBottom.responsibilityTitle') }}</strong>
          <p>{{ t('dialogBottom.responsibilityContent') }}</p>
        </div>
        <div class="notice-section">
          <strong>{{ t('dialogBottom.ipTitle') }}</strong>
          <p>{{ t('dialogBottom.ipContent') }}</p>
        </div>
        <div class="notice-section">
          <strong>{{ t('dialogBottom.tradeTitle') }}</strong>
          <p>{{ t('dialogBottom.tradeContent') }}</p>
        </div>
        <div class="notice-section">
          <strong>{{ t('dialogBottom.privacyTitle') }}</strong>
          <p>{{ t('dialogBottom.privacyContent') }}</p>
        </div>
        <div class="notice-section">
          <strong>{{ t('dialogBottom.standardTitle') }}</strong>
          <p>{{ t('dialogBottom.standardContent') }}</p>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showNoticeModal = false">{{ t('dialogBottom.agree') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

defineOptions({ name: 'DialogBottom' })

const emit = defineEmits<{
  (e: 'toSet'): void
  (e: 'toDev'): void
}>()

const userInfo = ref<any>({})
const showNoticeModal = ref(false)

onMounted(() => {
  try {
    userInfo.value = JSON.parse(localStorage.getItem('data') || '{}')
  } catch {
    userInfo.value = {}
  }
})

function toSet() { emit('toSet') }
function toDev() { emit('toDev') }
</script>

<style scoped>
.dialog-bottom {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: var(--z-dropdown);
  border-radius: var(--global-border-radius) 35px 0 0;
  background: var(--color-rgba-255-255-250-1-);
  padding: 5px 12px 0;
  display: flex; flex-direction: column; align-items: center;
}
.title-body { display: flex; align-items: flex-end; padding-top: 12px; margin-bottom: 8px; }
.welcome-img { width: 205px; height: 34px; margin-right: 8px; }
.brand-img { width: 140px; height: 20px; }

.header-logo {
  width: 75px; height: 75px; border-radius: 50%; object-fit: cover;
  margin-bottom: 8px; flex-shrink: 0;
}
.user-name { font-size: 15px; font-weight: bold; color: var(--color-black); margin-bottom: 4px; }

.logo-text {
  font-size: 15px; font-weight: bold; letter-spacing: 0.29em;
  color: var(--color--8f81ff); margin-bottom: 8px;
}

.btn-body {
  display: flex; width: 100%; justify-content: space-between;
  align-items: center; margin-bottom: 8px;
}

.card-body {
  width: 144px; height: 70px; border-radius: var(--global-border-radius); padding-top: 4px;
  display: flex; flex-direction: column; justify-content: center;
  align-items: center; cursor: pointer;
}

.card-left {
  background: var(--color-gradient-card-left);
  box-shadow: var(--global-box-shadow);
}
.left-icon { width: 33px; height: 33px; }
.left-text { font-size: 20px; font-weight: 600; letter-spacing: 0.28em; color: var(--color-black); }
.or-img { width: 46px; height: 20px; }

.card-right {
  background: var(--color-gradient-card-right);
  box-shadow: var(--global-box-shadow);
}
.right-icon { width: 36px; height: 32px; }
.right-text { font-size: 20px; font-weight: 500; letter-spacing: 0.28em; color: var(--color-white); }

.bottom-text {
  font-family: Silkscreen; font-size: 10px; color: var(--color-rgba-0-0-0-0-4-);
  cursor: pointer; margin-bottom: 12px;
}
.notice-body { padding: 12px; }
.notice-section { margin-bottom: 16px; }
.notice-section strong { display: block; margin-bottom: 4px; font-size: 14px; }
.notice-section p { font-size: 13px; color: var(--color-gray-666); line-height: 1.6; }
</style>
