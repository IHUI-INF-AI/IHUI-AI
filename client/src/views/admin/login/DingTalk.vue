<!--
  Admin 端 - 钉钉扫码登录回调页
  迁移自 H:\edu client\admin\admin\src\views\login\dingTalk.vue
  - 接收钉钉 OAuth 回调（code + state）
  - 调用后端 /auth/dingtalk 换取 token
  - 成功 → 跳 /admin/home；失败 → 跳 /403
-->
<template>
  <div class="dingtalk-login-callback" />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { dingTalkLogin } from '@/api/auth'
import { setToken, setRefreshToken } from '@/utils/auth'

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  const loading = ElMessage.info({ message: '正在登录...', duration: 0 })
  try {
    const res: any = await dingTalkLogin({ code, state })
    setToken(res?.value)
    setRefreshToken(res?.refreshToken)
    loading.close()
    ElMessage.success('登录成功')
    router.push('/admin/home')
  } catch (e) {
    console.error(e)
    loading.close()
    ElMessage.error('钉钉登录失败')
    router.push('/403')
  }
})
</script>

<style lang="scss" scoped>
.dingtalk-login-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
