<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { checkLoginStatus } from './utils/auth'

onLaunch(() => {
  // 应用启动：检查登录态、恢复用户信息
  checkLoginStatus()
})

onShow(() => {
  // 应用从后台进入前台
})

onHide(() => {
  // 应用从前台进入后台
})
</script>

<style lang="scss">
@import './uni.scss';

/* 全局基础样式 */
page {
  background-color: $uni-bg-color;
  color: $uni-text-color;
  font-size: $uni-font-size-base;
  font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica,
    Segoe UI, Arial, Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

view,
text {
  box-sizing: border-box;
}

/* 安全区底部留白 */
.safe-area-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
