<template>
  <el-drawer class="sign-up-drawer" v-model="dialogModel" direction="rtl" :before-close="drawerClose" destroy-on-close>
    <template #header>
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
    </template>
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
  </el-drawer>
</template>

<script>
// @ts-nocheck
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
    return {
      signUpParam,
      signUpTotal,
      signUpList,
      signUpLoading,
      signUpCurrentChange,
      signUpSizeChange,
      signUpStatusMap,
      dialogModel
    }
  }
}
</script>

<style scoped lang="scss">

</style>
