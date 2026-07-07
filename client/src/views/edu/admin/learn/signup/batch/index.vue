<template>
  <el-drawer class="sign-up-drawer" v-model="dialogModel" direction="rtl" :before-close="drawerClose" destroy-on-close>
    <template #header>
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
    </template>
    <div class="topic-list-wrapper">
      <member-list :is-component="true" :cancel-callback="cancelSignUpSelectMember" :select-callback="signUpSelectMember" />
    </div>
  </el-drawer>
</template>

<script>
// @ts-nocheck
import {computed, ref} from "vue";
import MemberList from "@/views/edu/admin/member/list/index.vue";
import {confirm, error, success} from "@/util/tipsUtils";
import { learnApi } from '@/api/edu/admin-api'
const { batchSignUp } = learnApi;

export default {
  name: "BatchSignup",
  components: {
    MemberList
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

    const cancelSignUpSelectMember = () => {
      dialogModel.value = false
      props.drawerClose && props.drawerClose()
    }
    const signUpSelectMember = (memberList) => {
      if(!memberList || !memberList.length) {
        error("请选择会员");
        return;
      }

      confirm("确认为所选的会员报名？", "批量报名", () => {
        const memberIdList = []
        for (const m of memberList) {
          memberIdList.push(m.id)
        }

        batchSignUp({lessonIdList: [props.topic.id], memberIdList: memberIdList}, resp => {
          success("报名成功")
          cancelSignUpSelectMember()
        })
      })
    }

    return {
      cancelSignUpSelectMember,
      signUpSelectMember,
      signUpParam,
      signUpTotal,
      signUpList,
      signUpLoading,
      // signUpCurrentChange,
      // signUpSizeChange,
      // signUpStatusMap,
      dialogModel
    }
  }
}
</script>

<style scoped lang="scss">

</style>
