<template>
  <div>
    <div v-if="viscosity === true" style="position: sticky; top: 0; z-index: var(--z-dropdown); padding: 0 10px;" class="tab-bar" :style="{ background: backgroundColor || 'var(--el-bg-color)' }">
      <div :style="{ height: statusBarHeight }"></div>
      <div style="display: flex; align-items: center; position: relative" :style="{ height: titleBarHeight}">
        <div v-if="dual" class="back back-right-moved" :style="{ width: paddingRightWidth }">
          <div class="back-box">
            <img class="backi-img" v-if="image != ''" style="padding: 0 10px;width: 20px;height: 20px;" :src="image" @click="packClick" alt="back" loading="lazy" />
          </div>
          <div class="back-s"></div>
          <div class="back-img">
            <div style="padding: 10px 0;">
              <img
                v-if="showFenLei"
                class="back-img-mm"
                @click="handleNavClick"
                :src="newFenLeiSrc"
                alt="menu"
                loading="lazy"
              />
            </div>
            <div style="padding: 10px 0;">
              <img v-if="sheZhi" class="back-img-mm" src="https://file.aizhs.top/sys-mini/shezhi.png"
              alt="settings" @click="onPackClick" loading="lazy" />
            </div>
          </div>
        </div>

        <div v-else class="back-bak back-right-moved">
          <div style="padding: 10px 0;">
            <img v-if="image" style="width: 17px; height: 24px;" :src="image" @click="packClick" alt="back" loading="lazy" />
          </div>
          <div style="padding: 10px 0;">
            <img
              v-if="showFenLei"
              @click="handleNavClick" style="width: 20px;height: 20px;"
              :src="fenLeiSrc" alt="menu" loading="lazy" />
          </div>
          <div style="padding: 10px 0;">
            <img
              v-if="showMenu"
              @click="handleNavClick" style="width: 20px;height: 20px;"
              :src="menuSrc" alt="menu" loading="lazy" />
          </div>
          <div style="padding: 10px 0;">
            <img v-if="study" style="width: 24px;height: 24px;margin-top: 0.5px;" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add.png"
                 alt="study" @click="emit('toAdd')" loading="lazy" />
          </div>
          <div style="padding: 10px 0;">
            <img v-if="sheZhi" class="back-img-mm" src="https://file.aizhs.top/sys-mini/shezhi.png"
            alt="settings" @click="onPackClick" loading="lazy" />
          </div>
          <div v-if="showFeedback && checkFeedbackPermission()" class="feedback-btn-nav" @click="handleFeedback">
            <span>{{ t('hardcoded.index.反馈') }}</span>
          </div>
        </div>
        <div v-if="aigc">
          <div style="padding: 10px 0;">
            <img src="https://file.aizhs.top/sys-mini/default/drawer_menu4.png" style="height: 22px;width: 22px;margin-top: 0;display: block;" class="back-img-mm aigc" @click="toAigc" alt="aigc" loading="lazy" />
          </div>
        </div>
        
        <div v-if="plazaPage" class="plaza-buttons" style="display: flex; align-items: center; margin-left: 0;">
          <img v-if="kaifaSrc !== 'https://file.aizhs.top/sys-mini/xtk/add_kf.png'" @click.stop="toSet" class="kaifa" :src="kaifaSrc" style="opacity: 0.6; width: 25px; height: 25px; margin-right: 8px;" alt="kaifa" loading="lazy" />
          <div v-else @click.stop="toSet" class="btn_join_switch" style="display: flex; align-items: center; justify-content: center;margin-right: 10px;">
            <img src="https://file.aizhs.top/sys-mini/default/step_add.svg" style="width: 21px; height: 21px;" alt="add" loading="lazy" />
          </div> 
          <div v-if="!showSetPath" class="btn_join_switch" @click="setshowBottom" style="display: flex; align-items: center; justify-content: center;">
            <img src="https://file.aizhs.top/sys-mini/default/switch_shen.svg" style="width: 21px; height: 22px;margin-bottom: -1px;" alt="switch" loading="lazy" />
          </div>
        </div>
        
        <div class="center-row-absolute">
          <div class="title">{{ title }}</div>
          <div class="search_part" v-if="isShowSearch" @click.stop="searchClick">
            <img class="bar_search" src="https://file.aizhs.top/sys-mini/xtk/search.png" :alt="t('hardcoded.index.搜索')" loading="lazy" />
          </div>
          <div class="search_part" v-if="showUser" @click.stop="navigateToUser">
            <img class="bar_search" :src="userIcon || 'https://file.aizhs.top/sys-mini/daixaodiming.png'" style="margin: 0;border-radius: var(--global-border-radius);" alt="user" loading="lazy" />
          </div>
        </div>
      </div>
    </div>
    <div v-else :style="{ height: topBarHeight, background: backgroundColor || 'var(--el-bg-color)' }">
      <div :style="{ height: statusBarHeight }"></div>
      <div style="display: flex; justify-content: space-between; align-items: center"
        :style="{ height: titleBarHeight, paddingRight: paddingRightWidth }">
        <div :style="{ width: paddingRightWidth }">
          <img v-if="image" style="width: 15px; height: 15px" :src="image" @click="packClick" alt="back" loading="lazy" />
        </div>
        <div style="width: 100%; text-align: center; font-size: 16px" :style="{ color: color }">{{ title }}</div>
      </div>
    </div>
    
    <div v-if="showFontPopup" class="font-popup-overlay" @click="showFontPopup = false">
      <div class="font-popup-content" @click.stop>
        <div class="font-popup-header">
          <span class="font-popup-title">{{ t('hardcoded.index.选择字体') }}</span>
          <span class="font-popup-close" @click="showFontPopup = false">✕</span>
        </div>
        <div class="font-list">
          <div 
            v-for="(font, index) in fontList" 
            :key="index"
            class="font-item" 
            :class="{ 'font-item-active': currentFont.name === font.name }"
            @click="selectFont(font)"
          >
            <span class="font-name">{{ font.name }}</span>
            <span v-if="currentFont.name === font.name" class="font-check">✓</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

import { ref, onMounted } from 'vue'
import { useCleanup } from '@/composables/useCleanup'

const _props = defineProps({
  title: {
    type: String,
    default: ''
  },
  image: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: 'var(--el-text-color-primary)'
  },
  backgroundColor: {
    type: String,
    default: 'var(--el-bg-color)'
  },
  viscosity: {
    type: Boolean,
    default: false
  },
  showFenLei: {
    type: Boolean,
    default: false
  },
  showMenu: {
    type: Boolean,
    default: false
  },
  sheZhi: {
    type: Boolean,
    default: false
  },
  study: {
    type: Boolean,
    default: false
  },
  aigc: {
    type: Boolean,
    default: false
  },
  plazaPage: {
    type: Boolean,
    default: false
  },
  dual: {
    type: Boolean,
    default: false
  },
  isShowSearch: {
    type: Boolean,
    default: false
  },
  showUser: {
    type: Boolean,
    default: false
  },
  showFeedback: {
    type: Boolean,
    default: false
  },
  userIcon: {
    type: String,
    default: ''
  },
  kaifaSrc: {
    type: String,
    default: ''
  },
  showSetPath: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['packClick', 'handleNavClick', 'onPackClick', 'toAdd', 'toAigc', 'toSet', 'setshowBottom', 'searchClick', 'navigateToUser', 'handleFeedback', 'fontChange'])

const statusBarHeight = ref('0px')
const titleBarHeight = ref('44px')
const topBarHeight = ref('44px')
const paddingRightWidth = ref('60px')

const fenLeiSrc = ref('https://file.aizhs.top/sys-mini/xtk/fenlei.png')
const newFenLeiSrc = ref('https://file.aizhs.top/sys-mini/xtk/fenlei.png')
const menuSrc = ref('https://file.aizhs.top/sys-mini/xtk/menu.png')

const showFontPopup = ref(false)
const currentFont = ref({ name: t('data.index.默认'), value: '' })
const fontList = ref([
  { name: t('data.index.默认1'), value: '' },
  { name: t('data.index.微软雅黑2'), value: 'Microsoft YaHei' },
  { name: t('data.index.宋体3'), value: 'SimSun' },
  { name: t('data.index.黑体4'), value: 'SimHei' },
  { name: t('data.index.楷体5'), value: 'KaiTi' }
])

let resizeRafId: number | null = null
const handleResize = () => {
  if (typeof window !== 'undefined') {
    if (resizeRafId !== null) return
    resizeRafId = requestAnimationFrame(() => {
      resizeRafId = null
      const isMobile = window.innerWidth < 768
      statusBarHeight.value = isMobile ? '20px' : '0px'
      titleBarHeight.value = isMobile ? '44px' : '60px'
      topBarHeight.value = isMobile ? '64px' : '60px'
      paddingRightWidth.value = isMobile ? '60px' : '100px'
    })
  }
}

const packClick = () => {
  emit('packClick')
}

const handleNavClick = () => {
  emit('handleNavClick')
}

const onPackClick = () => {
  emit('onPackClick')
}

const toAigc = () => {
  emit('toAigc')
}

const toSet = () => {
  emit('toSet')
}

const setshowBottom = () => {
  emit('setshowBottom')
}

const searchClick = () => {
  emit('searchClick')
}

const navigateToUser = () => {
  emit('navigateToUser')
}

const handleFeedback = () => {
  emit('handleFeedback')
}

interface FontOption {
  name: string
  value: string
}

const selectFont = (font: FontOption) => {
  currentFont.value = font
  showFontPopup.value = false
  emit('fontChange', font)
}

const checkFeedbackPermission = () => {
  return true
}

const cleanup = useCleanup()
cleanup.add(() => {
  if (resizeRafId !== null) {
    cancelAnimationFrame(resizeRafId)
    resizeRafId = null
  }
})

onMounted(() => {
  handleResize()
  if (typeof window !== 'undefined') {
    cleanup.addEventListener(window, 'resize', handleResize as EventListener)
  }
})
</script>

<style scoped lang="scss">
.tab-bar {
  width: 100%;
  box-sizing: border-box;
  border-bottom: var(--unified-border-bottom);
}

.back-right-moved {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  z-index: calc(var(--z-base) + 9);
}

.back-bak {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  align-items: center;
  z-index: calc(var(--z-base) + 9);
}

.back-box {
  display: flex;
  align-items: center;
}

.backi-img {
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.1);
  }
}

.back-img {
  display: flex;
  align-items: center;
  gap: 5px;
}

.back-img-mm {
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.1);
  }
}

.center-row-absolute {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 10px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.search_part .bar_search_wrapper {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  border-radius: var(--global-border-radius);
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }
}

.bar_search {
  width: 20px;
  height: 20px;
}

.plaza-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kaifa {
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: scale(1.1);
  }
}

.btn_join_switch {
  cursor: pointer;
  padding: 5px;
  border-radius: var(--global-border-radius);
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }
}

.feedback-btn-nav {
  padding: 5px 10px;
  background: var(--el-text-color-primary);
  color: var(--el-color-white, white);
  border-radius: var(--global-border-radius);
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.05);
  }
}

.font-popup-overlay {
  position: fixed;
  inset: 0;
  background-color: rgb(var(--el-color-black-rgb), 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}

.font-popup-content {
  background-color: var(--el-bg-color-page, white);
  border-radius: var(--global-border-radius);
  padding: 20px;
  min-width: 300px;
  max-width: 90%;
}

.font-popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: var(--unified-border-bottom);
}

.font-popup-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.font-popup-close {
  font-size: 24px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  transition: color 0.2s;
  
  &:hover {
    color: var(--el-text-color-primary);
  }
}

.font-list {
  max-height: 300px;
  overflow-y: auto;
}

.font-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 15px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &.font-item-active {
    background-color: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }
}

.font-name {
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.font-check {
  font-size: 18px;
  color: var(--el-color-primary);
  font-weight: 700;
}

@media (width <= 767px) {
  .title {
    font-size: 16px;
    max-width: 150px;
  }
  
  .feedback-btn-nav {
    font-size: 12px;
    padding: 4px 8px;
  }
}
</style>
