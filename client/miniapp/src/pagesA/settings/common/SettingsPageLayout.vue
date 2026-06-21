<template>
  <view class="settings-layout">
    <SettingsNavBar
      :title="title"
      :statusBarHeightPx="statusBarHeightPx"
      :backToHome="backToHome"
    />
    <scroll-view
      class="settings-content"
      scroll-y
      :style="{ height: contentHeight, paddingTop: navBarTotalPx }"
    >
      <slot></slot>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SettingsNavBar from './SettingsNavBar.vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  backToHome: {
    type: Boolean,
    default: false
  }
})

const statusBarHeightPx = ref('0px')
const navBarTotalPx = ref('64px')
const contentHeight = ref('0px')

onMounted(() => {
  try {
    const sys = uni.getSystemInfoSync()
    const statusBarHeight = sys.statusBarHeight || 0
    const titleBarHeight = 44
    const navTotalPx = statusBarHeight + titleBarHeight
    statusBarHeightPx.value = statusBarHeight + 'px'
    navBarTotalPx.value = navTotalPx + 'px'
    const windowH = sys.windowHeight || sys.screenHeight || 0
    contentHeight.value = windowH + 'px'
  } catch (e) {
    statusBarHeightPx.value = '20px'
    navBarTotalPx.value = '64px'
    contentHeight.value = '100vh'
  }
})
</script>

<style lang="scss" scoped>
.settings-layout {
  width: 100%;
}

.settings-content {
  width: 100%;
  box-sizing: border-box;
}
</style>
