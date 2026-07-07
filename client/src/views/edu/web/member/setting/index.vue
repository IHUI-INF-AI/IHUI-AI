<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="setting"/>
      </el-col>
      <el-col :span="20">
        <div class="setting-container" v-if="member">
          <div class="setting-item">
            <div class="setting-item-wrapper">
              <div class="setting-item-label">绑定手机</div>
              <div class="setting-item-content">
                <div>当前已绑定{{member.mobile}}</div>
                <el-button link class="setting-item-button" @click="mobileDialogVisible = true">更换手机</el-button>
              </div>
            </div>
            <el-dialog title="修改手机" v-model="mobileDialogVisible" width="30%" :before-close="hideMobileDialog">
              <div>
                <el-input placeholder="新手机号" v-model="memberMobile"/>
              </div>
              <template #footer>
                <span class="dialog-footer">
                  <el-button @click="hideMobileDialog">取消</el-button>
                  <el-button type="primary" @click="submitMobile">确定</el-button>
                </span>
              </template>
            </el-dialog>
          </div>
          <div class="setting-item">
            <div class="setting-item-wrapper">
              <div class="setting-item-label">联系邮箱</div>
              <div class="setting-item-content">{{member.email}}
                <el-button link class="setting-item-button" @click="emailDialogVisible = true">修改邮箱</el-button>
              </div>
            </div>
            <el-dialog title="修改邮箱" v-model="emailDialogVisible" width="30%" :before-close="hideEmailDialog">
              <div>
                <el-input placeholder="邮箱" v-model="memberEmail"/>
              </div>
              <template #footer>
                <span class="dialog-footer">
                  <el-button @click="hideEmailDialog">取消</el-button>
                  <el-button type="primary" @click="submitEmail">确定</el-button>
                </span>
              </template>
            </el-dialog>
          </div>
          <div class="setting-item">
            <div class="setting-item-wrapper">
              <div class="setting-item-label">登录密码</div>
              <div class="setting-item-content">
                <div class="wrapper">
                  <div class="desc-container-wrapper"></div>
                </div>
                <el-button link class="setting-item-button" @click="passwordDialogVisible = true">修改</el-button>
              </div>
            </div>
            <el-dialog title="修改密码" v-model="passwordDialogVisible" width="30%" :before-close="hidePasswordDialog">
              <div>
                <el-input placeholder="旧密码" v-model="memberOldPassword"/>
                <el-input placeholder="新密码" v-model="memberPassword"/>
              </div>
              <template #footer>
                <span class="dialog-footer">
                  <el-button @click="hidePasswordDialog">取消</el-button>
                  <el-button type="primary" @click="submitPassword">确定</el-button>
                </span>
              </template>
            </el-dialog>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
  import memberMenu from "../menu/index.vue"
  import {updateMobile, updateEmail, updatePassword, getMemberInfo} from "@/api/edu/web/member";
  import {success, error} from "@/util/tipsUtils";
import {getToken, removeToken} from "@/util/tokenUtils";
import {deleteUser} from "@/util/userUtils";

  export default {
    name: "memberSetting",
    components: {
      memberMenu
    },
    setup() {
      const showLoginFlag = inject("showLogin")
      const showLoginClose = inject("showLoginClose")
      if (!getToken()) {
        showLoginFlag.value = true
        showLoginClose.value = false
        return
      }
      const member = ref({})
      const mobileDialogVisible = ref(false)
      const emailDialogVisible = ref(false)
      const passwordDialogVisible = ref(false)
      const memberMobile = ref("")
      const memberEmail = ref("")
      const memberPassword = ref("")
      const memberOldPassword = ref("")
      const load = function() {
        getMemberInfo(res => {
          member.value = res
          memberEmail.value = member.value.email
          memberMobile.value = member.value.mobile
        })
      }
      load()
      const hideMobileDialog = function() {
        mobileDialogVisible.value = false
      }
      const submitMobile = function() {
        if (!memberMobile.value) {
          error("请输入手机号");
          return
        }
        updateMobile({id: member.value.id, mobile: memberMobile.value}, () => {
          success("修改成功");
          member.value.mobile = memberMobile.value
          mobileDialogVisible.value = false
          removeToken();
          deleteUser();
        })
      }
      const hideEmailDialog = function() {
        emailDialogVisible.value = false
      }
      const submitEmail = function() {
        if (!memberEmail.value) {
          error("请输入邮箱");
          return
        }
        updateEmail({id: member.value.id, email: memberEmail.value}, () => {
          success("修改成功");
          member.value.email = memberEmail.value
          emailDialogVisible.value = false
        })
      }
      const hidePasswordDialog = function() {
        passwordDialogVisible.value = false
      }
      const submitPassword = function() {
        if (!memberOldPassword.value) {
          error("请输入旧密码");
          return
        }
        if (!memberPassword.value) {
          error("请输入新密码");
          return
        }
        updatePassword({id: member.value.id, oldPassword: memberOldPassword.value, password: memberPassword.value}, () => {
          success("修改成功");
          member.value.password = memberPassword.value
          passwordDialogVisible.value = false
          removeToken();
          deleteUser();
        })
      }
      return {
        member,
        mobileDialogVisible,
        emailDialogVisible,
        passwordDialogVisible,
        memberMobile,
        memberEmail,
        memberPassword,
        memberOldPassword,
        hideMobileDialog,
        submitMobile,
        hideEmailDialog,
        submitEmail,
        hidePasswordDialog,
        submitPassword,
      }
    }
  }
</script>

<style lang="scss" scoped>
  .setting-container {
    background-color: #FFFFFF;
    margin: 20px;
    padding: 16px 48px;
    /*height: calc(100% - 40px);*/
    display: flex;
    flex-direction: column;
    flex: 1;
    .setting-item:last-child {
      border: 0;
    }
    .setting-item {
      padding: 24px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      line-height: 20px;
      border-bottom: 1px solid #f0f0f0;
      .setting-item-wrapper {
        flex: 1;
        display: flex;
        .setting-item-label {
          flex: none;
          width: 142px;
          display: flex;
          align-items: center;
        }
        .setting-item-content {
          flex: 1;
          color: #666;
          display: flex;
          justify-content: space-between;
          word-break: break-all;
        }
        .setting-item-button {
          padding: 0;
          line-height: 20px;
          margin-left: 10px;
        }
      }
    }
  }
  .row {
    height: 100%;
    .el-col {
      height: 100%;
    }
  }
  .el-menu-item {
    height: 80px;
    .el-icon-close {
      display: none;
      position: absolute;
      right: 5px;
      top: 50%;
      transform: translateY(-50%);
      color: #999;
    }
  }
  .el-menu-item:focus, .el-menu-item:hover {
    height: 80px;
    em {
      display: none;
    }
    .el-icon-close {
      display: block;
    }
  }
  .el-menu-item:focus{
    em {
      display: block;
    }
    .el-icon-close {
      display: none;
    }
  }
  body {
    background-color: #fafafa;
    height: 100%;
  }
</style>
<style>
  body {
    background-color: #fafafa;
    height: 100%;
  }
</style>
