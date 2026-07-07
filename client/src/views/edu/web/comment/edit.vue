<template>
  <div class="comment-input">
    <div class="comment-input-body">
      <a v-if="!isLogin" @click="showLoginDialog" class="login-btm" href="javascript:void(0);">登录</a>
      <el-input v-model="commentContent" @focus="showLoginDialog" type="textarea" :rows="3"
                :placeholder="isLogin ? (replyMemberName ? '回复 ' + replyMemberName : '你的神评是我们交流的开始~') : (replyMemberName ? '登录后可回复评论~' : '登录后可发言评论~')"
                class="comment-input-textarea"></el-input>
    </div>
    <div class="comment-input-footer">
      <div class="comment-input-express">
        <!--        <a href="javascript:void(0);">-->
        <!--          <i class="el-icon-warning-outline icon-dark"></i>-->
        <!--          <span class="footer-text">表情</span>-->
        <!--        </a>-->
      </div>
      <div>
        <div class="comment-input-pic">
        <!--          <a href="javascript:void(0);">-->
        <!--            <i class="el-icon-picture-outline-round icon-dark" style="font-size: 21px;"></i>-->
        <!--            <span class="footer-text">图片</span>-->
        <!--          </a>-->
        </div>
      </div>
      <el-tooltip v-model="isOutOfLimit" :manual="true" class="item" effect="dark" content="输入数字已达上限" placement="top-end">
        <a class="comment-input-send" href="javascript:void(0);">
          <div class="reply-toast-wrap"></div>
          <div class="comment-send-container">
            <div class="comment-send-button" @click="submit">{{replyMemberName ? '回复' : '发表评论'}}</div>
          </div>
        </a>
      </el-tooltip>
      <span class="comment-input-fonts">0/300</span>
    </div>
  </div>
</template>

<script>
import {inject, ref} from "vue"
  import {getToken} from "@/util/tokenUtils";
  import {getUser} from "@/util/userUtils";
  import {error} from "@/util/tipsUtils";

  export default {
    name: "commentEdit",
    props: {
      submitCallback: {
        type: Function,
        required: true
      },
      parentItem: {
        type: Object,
        default: () => {}
      },
      commentId: {
        type: Number,
        default: 0
      }
    },
    setup(props) {
      let replyMemberName = ref("")
      const showLoginFlag = inject("showLogin")
      const isLogin = ref(!!getToken())
      const isOutOfLimit = ref(false)
      const commentContent = ref("")
      if (props.parentItem && props.parentItem.member) {
        replyMemberName = ref(props.parentItem.member.name)
      }
      const showLoginDialog = function() {
        // 没登录显示登陆框
        if (!getToken()) {
          showLoginFlag.value = true
          isLogin.value = false
        } else {
          showLoginFlag.value = false
          isLogin.value = true
        }
      }
      const getMember = function() {
        return getUser();
      }
      const submit = function() {
        showLoginDialog();
        if (!isLogin.value) {
          return;
        }
        if (!commentContent.value) {
          error("请输入评论内容");
          return
        }
        const res = {
          content: commentContent.value,
          commentId: props.commentId
        }
        props.submitCallback(res, props.parentItem);
        commentContent.value = "";
      }
      return {
        replyMemberName,
        // 是否显示登陆        showLoginFlag,
        // 是否登陆
        isLogin,
        // 是否超出字数限制
        isOutOfLimit,
        // 评论内容
        commentContent,
        getMember,
        submit,
        showLoginDialog
      }
    }
  }
</script>

<style lang="scss" scoped>
  .comment-input {
    border-radius: 6px;
    padding: 18px;
    background-color: #fafafa;
    .comment-input-body {
      width: 100%;
      display: inline-block;
      //max-height: 60px;
      .login-btm {
        color: var(--el-color-primary);
        float: left;
        margin-right: 8px;
        font-size: 18px;
        font-weight: 700;
      }
      .comment-input-textarea {
        float: left;
        border: 0;
        outline: 0;
        resize: none;
        overflow: auto;
        font-size: 14px;
        color: #000;
        letter-spacing: 0;
        line-height: 20px;
        height: 120px;
      }
      :deep(.el-textarea__inner)  {
        float: left;
        border: 0;
        outline: 0;
        resize: none;
        overflow: auto;
        font-size: 14px;
        color: #000;
        letter-spacing: 0;
        line-height: 20px;
        height: 120px;
        background: #ffffff;
        padding: 10px 10px;
      }
    }
    .comment-input-footer {
      margin-top: 12px;
      height: 36px;
      vertical-align: baseline;
      .comment-input-express, .comment-input-pic {
        position: relative;
        float: left;
        margin-right: 30px;
        margin-top: 13px;
        height: 20px;
        font-size: 21px;
        top: 3px;
      }
      .comment-input-send {
        display: inline-block;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
        text-decoration: none;
        float: right;
        text-align: center;
        vertical-align: middle;
        font-size: 14px;
        color: #fff;
        letter-spacing: 0;
        line-height: 36px;
        .comment-send-container {
          overflow: hidden;
          border-radius: 6px;
          width: 116px;
          height: 36px;
        }
        .comment-send-button {
          background: -o-linear-gradient(45deg, #8833ff 0, var(--el-color-primary) 100%);
          background: linear-gradient(45deg, #8833ff, var(--el-color-primary));
          filter: progid:DXImageTransform.Microsoft.gradient(GradientType=1, startColorstr=#8833ff, endColorstr=var(--el-color-primary));
          width: 116px;
          height: 36px;
        }
      }
      .comment-input-fonts {
        float: right;
        font-size: 14px;
        color: hsla(0,0%,100%,.38);
        letter-spacing: 0;
        margin-right: 12px;
        line-height: 36px;
      }
      .footer-text {
        font-size: 12px;
        letter-spacing: 0;
        line-height: 20px;
        margin-left: 2px;
        position: relative;
        top: -3px;
        opacity: .38;
      }
      .icon-dark {
        font-style: normal;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        font-size: 21px;
        color: var(--el-color-primary);
        opacity: 1;
      }
    }
  }
</style>
<style lang="scss">
  body {
    height: 100%;
  }
  .comment-input-textarea textarea  {
    float: left;
    border: 0;
    outline: 0;
    resize: none;
    overflow: auto;
    font-size: 14px;
    color: #000;
    letter-spacing: 0;
    line-height: 20px;
    height: 60px;
    background: hsla(0,0%,100%,0);
  }
  .el-textarea__inner {
    padding: 0;
  }
</style>
