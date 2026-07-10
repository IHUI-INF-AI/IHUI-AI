<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="visible" class="drawer-mask" @click.self="handleClose">
        <div class="drawer-panel" style="width: 40%">
          <div class="drawer-header">
            <span class="drawer-title">{{ drawerTitle }}</span>
          </div>
          <div class="drawer-body">
            <div class="comment-drawer-stub">
              <Empty description="评论管理（占位组件，原 commentDrawer 待完整迁移）" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { ref, watch } from 'vue'
import { Empty } from '@/components/ui/empty'
export default {
  name: 'CommentDrawer',
  components: { Empty },
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
    const handleClose = () => {
      props.drawerClose && props.drawerClose()
      visible.value = false
    }
    return { visible, drawerTitle, handleClose }
  }
}
</script>
<style scoped lang="scss">
.comment-drawer-stub {
  padding: 20px;
}
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}
.drawer-panel {
  height: 100%;
  background: hsl(var(--background));
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.drawer-header {
  flex-shrink: 0;
  padding: 0 20px;
  border-bottom: 1px solid hsl(var(--border));
}
.drawer-body {
  flex: 1;
  overflow: auto;
}
.drawer-slide-enter-active, .drawer-slide-leave-active {
  transition: opacity 0.3s ease;
}
.drawer-slide-enter-active .drawer-panel, .drawer-slide-leave-active .drawer-panel {
  transition: transform 0.3s ease;
}
.drawer-slide-enter-from, .drawer-slide-leave-to {
  opacity: 0;
}
.drawer-slide-enter-from .drawer-panel, .drawer-slide-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
