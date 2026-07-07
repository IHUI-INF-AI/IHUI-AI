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
      <el-table v-loading="signUpLoading" :data="signUpList" style="width: 100%">
        <el-table-column label="姓名">
          <template #default="scope">
            {{scope.row.member?.name || '未知用户'}}
          </template>
        </el-table-column>
        <el-table-column label="真实姓名">
          <template #default="scope">
            {{scope.row.member?.realname || ''}}
          </template>
        </el-table-column>
        <el-table-column label="公司">
          <template #default="scope">
            {{scope.row.member && scope.row.member.memberCompanyList && scope.row.member.memberCompanyList[0].name }}
          </template>
        </el-table-column>
        <el-table-column label="报名时间" prop="createTime"></el-table-column>
        <el-table-column label="进度">
          <template #default="scope">
            {{scope.row.progress || 0 }} %
          </template>
        </el-table-column>
        <el-table-column label="完成时间" prop="completedTime">
          <template #default="scope">
            {{scope.row.completedTime || "--"}}
          </template>
        </el-table-column>
        <el-table-column label="状态">
          <template #default="scope">
            {{signUpStatusMap[scope.row.status]}}
          </template>
        </el-table-column>
      </el-table>
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

export default {
  name: "SignupRecordIndex",
  components: {
    page
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
