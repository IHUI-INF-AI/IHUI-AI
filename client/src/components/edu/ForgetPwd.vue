<template>
  <div class="register">
    <div class="login-content">
      <div class="login-password">
        <h1 style="text-align: center;padding: 40px;"></h1>
        <el-menu :default-active="menuActiveIndex" class="el-menu" mode="horizontal">
          <el-menu-item index="1">忘记密码</el-menu-item>
        </el-menu>
        <div v-if="menuType === 'authCode'">
          <el-input v-model="authCodeForm.username" placeholder="请输入邮箱手机号码" class="input-text username input-with-select"></el-input>
          <div class="login-btn">
            <el-button size="small" :loading="registerLoading" @click="getAuthCode">确定</el-button>
          </div>
        </div>
        <div v-if="menuType === 'submitAuthCode'">
          <div class="input-tips">验证码已发送至<span style="font-weight: 500;color: #07c160;">{{authCodeForm.username}}</span></div>
          <el-input v-model="authCodeForm.authCode" placeholder="请输入验证码"></el-input>
          <div class="login-btn">
            <el-button size="small" :loading="registerLoading" @click="checkAuthCode">确定</el-button>
          </div>
        </div>
        <div v-if="menuType === 'password'">
          <div style="margin-top: 20px;">
            <div class="input-wrap-password">
              <el-input v-model="authCodeForm.password" :type="passwordType" class="input-text" placeholder="请输入登录密码" maxlength="40"/>
              <div class="password-look-btn" @click="showPasswordChange">
                <i class="iconfont" :class="{'icon-eye-close': !showPassword, 'icon-eye-open': showPassword}"></i>
              </div>
            </div>
            <div class="input-wrap-password">
              <el-input v-model="authCodeForm.confirmPassword" :type="passwordType" class="input-text" placeholder="再次输入登录密码" maxlength="40"/>
              <div class="password-look-btn" @click="showPasswordChange">
                <i class="iconfont" :class="{'icon-eye-close': !showPassword, 'icon-eye-open': showPassword}"></i>
              </div>
            </div>
            <div class="login-btn">
              <el-button size="small" :loading="registerLoading" @click="submitPwd">确定</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {getPwdAuthCode, checkPwdAuthCode, resetPwd} from "@/api/edu/web/member";
import {reactive, ref} from "vue";
import {error, info, success} from "@/util/tipsUtils";
import router from "@/router";

export default {
  name: "ForgetPwd",
  setup() {
    const menuActiveIndex = ref("1");
    const menuType = ref("authCode");
    const showPassword = ref(false);
    const passwordType = ref("password");
    const authCodeForm = reactive({
      username: "",
      authCode: "",
      password: "",
      confirmPassword: ""
    });
    // 显示密码
    const showPasswordChange = () => {
      showPassword.value = !showPassword.value;
      if (showPassword.value) {
        passwordType.value = "text";
      } else {
        passwordType.value = "password";
      }
    };
    const registerLoading = ref(false)
    // 获取验证书
    const getAuthCode = () => {
      if (!authCodeForm.username) {
        error("请输入邮箱手机号码");
        return;
      }
      registerLoading.value = true;
      // 获取验证码
      getPwdAuthCode(authCodeForm.username, () => {
        menuType.value = "submitAuthCode";
        registerLoading.value = false;
        if (authCodeForm.username.indexOf("@") === -1) {
          info("暂不发送短信，统一验证码为23456");
        }
      }).catch(() => {
        registerLoading.value = false
      })
    };
    // 提交验证书
    const checkAuthCode = () => {
      if (!authCodeForm.authCode) {
        error("请输入验证码")
        return;
      }
      registerLoading.value = true;
      checkPwdAuthCode(authCodeForm, () => {
        menuType.value = "password";
        registerLoading.value = false
      }).catch(() => {
        registerLoading.value = false
      })
    }
    // 提交密码
    const submitPwd = () => {
      if (!authCodeForm.password) {
        error("请输入密码")
        return;
      }
      if (!authCodeForm.confirmPassword) {
        error("请再次输入密码")
        return;
      }
      if (authCodeForm.confirmPassword !== authCodeForm.password) {
        error("两次密码不一致")
        return;
      }
      registerLoading.value = true;
      resetPwd(authCodeForm, () => {
        success("修改密码成功")
        registerLoading.value = false
        router.push({path: '/edu'})
      }).catch(() => {
        registerLoading.value = false
      })
    }
    return {
      // 变量
      menuActiveIndex,
      menuType,
      showPassword,
      passwordType,
      checkAuthCode,
      submitPwd,
      authCodeForm,
      showPasswordChange,
      getAuthCode,
      registerLoading
    };
  }
}
</script>

<style lang="scss">
  .register {
    padding-bottom: 13px;
    min-width: 424px;
    width: 60%;
    max-width: 424px;
    margin: 70px auto 0;
    border-radius: 8px;
    .el-dialog__body {
      padding: 0;
    }
    .login-content {
      width: 100%;
      margin: 0 auto;
      .login-password {
        padding: 0 48px;
        .input-tips {
          margin: 20px 0 10px;
        }
      }
      .el-menu {
        background: rgba(255,255,255, 0);
        border: none;
        li {
          height: 42px;
          line-height: 42px;
          text-align: center;
          font-size: 14px;
          font-weight: 500;
          color: #999;
        }
        li:hover, li:focus {
          background: rgba(255,255,255, 0);
          color: #999;
        }
        li.is-active {
          color: var(--el-color-primary);
          border-color: var(--el-color-primary);;
        }
      }
      .username {
        margin-top: 20px;
        input {
          //margin-bottom: 10px;
        }
      }
      .input-text {
        input {
          height: 42px;
          outline: none;
          width: 100%;
          background: none;
          border: none;
          //border-bottom: 1px solid #d8d8d8;
          font-size: 14px;
          padding-left: 0;
          color: #000;
          border-radius: 0;
        }
        .el-input-group__append {
          height: auto;
        }
      }
      .input-wrap-password {
        position: relative;
        font-size: 14px;
      }
      .password-look-btn {
        position: absolute;
        right: 10px;
        top: 10px;
        .iconfont {
          font-style: normal;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-size: 20px;
          display: block;
          background-size: contain;
          width: 24px;
          height: 24px;
        }
        .icon-eye-close {
          background-image: url("@/assets/edu/login/eye-close.png");
        }
        .icon-eye-open {
          background-image: url("@/assets/edu/login/eye-open.png");
        }
      }
      .login-btn {
        width: 100%;
        margin: 10px 0;
      }
    }
    .el-input-group__prepend {
      border: none;
      width: 86px;
    }
    .el-input-group__prepend, .el-input-group__append {
      border-radius: 0;;
      width: 66px;
      background: rgba(255,255,255, 0);
      height: 42px;
      border-right: none;
      border-top: none;
      border-left: none;
      margin-bottom: 10px;
      padding: 0;
      .el-select {
        height: 42px;
        margin: 0 0 10px;
        input {
          border: none;
          margin: 0;
        }
      }
      .el-input__suffix-inner {
        height: 20px;
        border-right: 1px solid #eee;
      }
      .el-input--suffix {
        height: 42px;
        border-bottom: 1px solid #ccc;
      }
      .el-select:hover, .el-select:focus {
        color: #000;
        border-bottom: 1px solid #ccc;
      }
    }
    .el-input-group__append{
      text-align: center;
    }
  }
</style>
