<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div v-if="dialogModel" class="drawer-mask" @click.self="closePanel">
        <div class="drawer-panel sign-up-drawer">
          <div class="drawer-header">
            <div class="work-item-box">
              <div class="item-content">
                <div class="content-main">
                  <div class="main-title">
                    <div class="title-box two-line">
                      <span class="title-text">批量报名</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="drawer-body">
            <div class="topic-list-wrapper">
      <lesson-index :is-component="true" :cancel-callback="cancelSignUpSelectLesson" :select-callback="signUpSelectLesson" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import {computed, ref} from "vue";
import {confirm, error, success} from "@/util/tipsUtils";
import { learnApi } from '@/api/edu/admin-api'
const { batchSignUp } = learnApi;
import LessonIndex from "@/views/edu/admin/learn/lesson/index.vue";

export default {
  name: "BatchSignupLesson",
  components: {
    LessonIndex,
  },
  props: {
    topic: {
      type: Object,
      required: true
    },
    showDrawer: {
      type: Boolean,
      required: true
    },
    drawerClose: {
      type: Function,
      required: true
    }
  },
  setup(props, context) {
    const dialogModel = computed({
      get() {
        return props.showDrawer;
      },
      set(val) {
        context.emit('update:showDrawer', val);
      },
    });
    // 查看报名记录
    const signUpLoading = ref(false)
    const signUpList = ref([])
    const signUpTotal = ref(0)
    const signUpParam = ref({
      current: 1,
      size: 20,
      lessonId: 0
    })
    // const loadSignUpList = () => {
    //   signUpLoading.value = true
    //   getSignUpList(signUpParam.value, res => {
    //     signUpList.value = res.list
    //     signUpTotal.value = res.total
    //     signUpLoading.value = false
    //   })
    // }
    // const signUpCurrentChange = (currentPage) => {
    //   signUpParam.value.current = currentPage;
    //   loadSignUpList();
    // }
    // const signUpSizeChange = (s) => {
    //   signUpParam.value.size = s;
    //   loadSignUpList();
    // }
    // signUpParam.value.current = 1
    // signUpParam.value.lessonId = ref(props.topic.id)
    // loadSignUpList()
    // const signUpStatusMap = {
    //   "signed_up": "已报名",
    //   "cancel_sign_up": "取消报名",
    //   "completed": "已完成"
    // }

    const cancelSignUpSelectLesson = () => {
      dialogModel.value = false
      props.drawerClose && props.drawerClose()
    }
    const signUpSelectLesson = (lessonList) => {
      if(!lessonList || !lessonList.length) {
        error("请选择会员");
        return;
      }

      confirm("确认为会员报名所选课程？", "批量报名", () => {
        const lessonIdList = []
        for (const m of lessonList) {
          lessonIdList.push(m.id)
        }

        batchSignUp({lessonIdList: lessonIdList, memberIdList: [props.topic.id]}, resp => {
          success("报名成功")
          cancelSignUpSelectLesson()
        })
      })
    }

    const closePanel = () => {
      dialogModel.value = false
      props.drawerClose && props.drawerClose()
    }
    return {
      cancelSignUpSelectLesson,
      signUpSelectLesson,
      signUpParam,
      signUpTotal,
      signUpList,
      signUpLoading,
      // signUpCurrentChange,
      // signUpSizeChange,
      // signUpStatusMap,
      dialogModel,
      closePanel
    }
  }
}
</script>

<style scoped lang="scss">
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}
.drawer-panel {
  width: calc(100% - 210px);
  height: 100%;
  background: hsl(var(--background));
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.drawer-header {
  flex-shrink: 0;
}
.drawer-body {
  flex: 1;
  overflow: auto;
}
.drawer-body .topic-list-wrapper {
  padding: 10px;
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
