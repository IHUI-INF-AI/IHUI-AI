<template>
  <el-dialog
    v-model="visible"
    title="登录"
    width="400px"
    :show-close="showClose"
    @close="handleClose"
  >
    <div class="login-stub">
      <p>请通过单点登录进入系统计</p>
      <p v-if="showClose" class="tip">关闭后可使用游客模式浏览。</p>
    </div>
    <template #footer>
      <el-button v-if="showClose" @click="handleClose">关闭</el-button>
      <el-button type="primary" @click="handleSuccess">已登录</el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed } from 'vue'

export default {
  name: 'LoginDialog',
  props: {
    show: { type: Boolean, default: false },
    showClose: { type: Boolean, default: true }
  },
  emits: ['callback', 'success'],
  setup(props, { emit }) {
    const visible = computed({
      get: () => props.show,
      set: (v) => { if (!v) emit('callback') }
    })
    const handleClose = () => emit('callback')
    const handleSuccess = () => emit('success')
    return { visible, handleClose, handleSuccess }
  }
}
</script>

<style scoped lang="scss">
.login-stub { 
  padding: 24px 0; 
  text-align: center;
  font-family: 'HarmonyOS Sans SC';
  
  p {
    color: #333333;
    font-size: 14px;
    line-height: 1.6;
  }
  
  .tip { 
    margin-top: 12px; 
    font-size: 13px; 
    color: #999999; 
  }
}
</style>
