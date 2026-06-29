<template>
  <div class="error-page">
    <div class="error-icon">⚠️</div>
    <div class="error-title">出错了</div>
    <div class="error-message">{{ errorMessage }}</div>
    <button class="back-btn" @click="goBack">返回</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const errorMessage = ref('分享链接无效')

onMounted(() => {
  const message = route.query.message
  if (message) {
    errorMessage.value = message
  }
})

function goBack() {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    router.push('/')
  }
}
</script>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 40px;
  background: #f5f5f5;
}

.error-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.error-title {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
}

.error-message {
  font-size: 14px;
  color: #999;
  text-align: center;
  margin-bottom: 40px;
}

.back-btn {
  padding: 12px 40px;
  background: #9A99F3;
  color: #fff;
  border-radius: 5px;
  font-size: 14px;
  border: none;
  cursor: pointer;
  
  &:hover {
    background: #8a89e3;
  }
}
</style>
