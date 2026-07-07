<template>
  <el-drawer
    v-model="visible"
    :title="drawerTitle"
    direction="rtl"
    size="40%"
    :before-close="handleClose"
  >
    <div class="comment-drawer-stub">
      <el-empty description="评论管理（占位组件，原 commentDrawer 待完整迁移）" />
    </div>
  </el-drawer>
</template>

<script>
// @ts-nocheck
import { ref, watch } from 'vue'
export default {
  name: 'CommentDrawer',
  props: {
    topicType: { type: String, default: '' },
    topic: { type: Object, default: () => ({}) },
    showDrawer: { type: Boolean, default: false },
    drawerClose: { type: Function, default: () => {} }
  },
  setup(props) {
    const visible = ref(props.showDrawer)
    const drawerTitle = ref('评论管理')
    watch(() => props.showDrawer, (val) => {
      visible.value = val
    })
    const handleClose = (done) => {
      props.drawerClose && props.drawerClose()
      done()
    }
    return { visible, drawerTitle, handleClose }
  }
}
</script>
<style scoped lang="scss">
.comment-drawer-stub {
  padding: 20px;
}
</style>
