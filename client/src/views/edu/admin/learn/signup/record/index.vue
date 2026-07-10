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
                      <span class="title-text">{{topic.name || topic.title || topic.content}}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="drawer-body">
            <div class="topic-list-wrapper">
      <div v-if="signUpLoading">加载中...</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>姓名</TableHead>
            <TableHead>真实姓名</TableHead>
            <TableHead>公司</TableHead>
            <TableHead>报名时间</TableHead>
            <TableHead>进度</TableHead>
            <TableHead>完成时间</TableHead>
            <TableHead>状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in signUpList" :key="index">
            <TableCell>{{ row.member?.name || '未知用户' }}</TableCell>
            <TableCell>{{ row.member?.realname || '' }}</TableCell>
            <TableCell>{{ row.member && row.member.memberCompanyList && row.member.memberCompanyList[0].name }}</TableCell>
            <TableCell>{{ row.createTime }}</TableCell>
            <TableCell>{{ row.progress || 0 }} %</TableCell>
            <TableCell>{{ row.completedTime || "--" }}</TableCell>
            <TableCell>{{ signUpStatusMap[row.status] }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <page class="page-bar" :total="signUpTotal" :current-change="signUpCurrentChange" :size-change="signUpSizeChange" :page-size="signUpParam.size"></page>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import page from "@/components/Page/index.vue"
import {computed, ref} from "vue";
import { learnApi } from '@/api/edu/admin-api'
const { getSignUpList } = learnApi;
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

export default {
  name: "SignupRecordIndex",
  components: {
    page,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell
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
    const loadSignUpList = () => {
      signUpLoading.value = true
      getSignUpList(signUpParam.value, res => {
        signUpList.value = res.list
        signUpTotal.value = res.total
        signUpLoading.value = false
      })
    }
    const signUpCurrentChange = (currentPage) => {
      signUpParam.value.current = currentPage;
      loadSignUpList();
    }
    const signUpSizeChange = (s) => {
      signUpParam.value.size = s;
      loadSignUpList();
    }
    signUpParam.value.current = 1
    signUpParam.value.lessonId = ref(props.topic.id)
    loadSignUpList()
    const signUpStatusMap = {
      "signed_up": "已报名",
      "cancel_sign_up": "取消报名",
      "completed": "已完成"
    }
    const closePanel = () => {
      dialogModel.value = false
      props.drawerClose && props.drawerClose()
    }
    return {
      signUpParam,
      signUpTotal,
      signUpList,
      signUpLoading,
      signUpCurrentChange,
      signUpSizeChange,
      signUpStatusMap,
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
