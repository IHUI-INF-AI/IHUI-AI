<!--
  Admin 端 - 企业微信扫码登录回调页
  迁移自 H:\edu client\admin\admin\src\views\login\workWeChat.vue
  - 接收企业微信 OAuth 回调（code + state + appid）
  - 调用后端 /auth/workwechat 换取 token
  - 成功 → 跳 /admin/home；失败 → 跳 /403
-->
<template>
  <div class="workwechat-login-callback" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { workWeChatLogin } from '@/api/auth/auth'
import { setToken, setRefreshToken } from '@/utils/auth'

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  const appId = String(route.query.appid || '')
  const loading = ElMessage.info({ message: '正在登录...', duration: 0 })
  try {
    const res: any = await workWeChatLogin({ code, state, appId })
    setToken(res?.value)
    setRefreshToken(res?.refreshToken)
    loading.close()
    ElMessage.success('登录成功')
    router.push('/admin/home')
  } catch (e) {
    console.error(e)
    loading.close()
    ElMessage.error('企业微信登录失败')
    router.push('/403')
  }
})
</script>

<style lang="scss" scoped>
.workwechat-login-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
