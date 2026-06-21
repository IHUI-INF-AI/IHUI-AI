<template>
  <view class="privacy-policy-container">
    <navigation-bars 
      color="black" 
      backgroundColor="#fff" 
      :viscosity="true" 
      title="隐私政策" 
      :showBack="true"
      image="/static/images/back.svg"
      @pack="onBackClick" 
    />
    
    <view class="webview-wrapper">
      <web-view :src="privacyPolicyUrl"></web-view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue"

const privacyPolicyUrl = ref('https://upload.aizhs.top/yszc.html')

function onBackClick() {
  uni.navigateBack({
    delta: 1
  })
}
</script>

<style lang="scss" scoped>
.privacy-policy-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.webview-wrapper {
  flex: 1;
  width: 100%;
}
</style>
