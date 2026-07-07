<template>
  <div class="content-container">
    <el-row class="message-container">
      <el-col :span="8">
        <div class="search-box">
          <el-input size="small" placeholder="搜索会员" v-model="params.keyword" class="input-with-select">
            <template #append>
              <el-button size="small" :icon="Search" @click="search"></el-button>
            </template>
          </el-input>
          <div class="search-list" v-if="showMemberLayer" @scroll="authMemberListScrollEvent">
            <div class="member-item" @click="loadLetterMember(item.id)" v-for="item in authMemberList" :key="item.id">
              <div class="message-item-head">
                <img v-if="item.avatar" :src="item.avatar" alt="">
              </div>
              <div class="message-item-content">
                <div class="message-item-user">
                  <span>{{item.name}}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="message-list" @scroll="memberListScrollEvent">
          <el-menu class="el-menu-vertical">
            <el-menu-item @click="selectMember(item)" style="padding: 16px 20px;" v-for="(item, index) in messageMemberList" :class="{'active': item.sender.id === defaultActive}" :default-active="defaultActive" :index="(item.sender.id).toString()" :key="index">
              <div class="message-item-head">
                <img :src="item.sender.avatar" alt="" style="width: 48px; height: 48px; background-color: rgb(238, 238, 238);">
              </div>
              <template #title>
                <div class="message-item-content">
                  <div class="message-item-left">
                    <div class="message-item-user">
                      <span>{{item.sender.name}}</span>
                      <em>{{item.createTime}}</em>
                    </div>
                  </div>
                  <div class="message-item-left-msg">{{item.content}}</div>
                </div>
              </template>
              <div @click.stop="removeMember(index)">
                <el-icon class="el-icon-close"><Close /></el-icon>
              </div>
            </el-menu-item>
          </el-menu>
        </div>
      </el-col>
      <el-col :span="16">
        <div class="message-empty" v-if="!messageMember.sender" :style="'min-height: ' + clientHeight + 'px'">
          <el-icon class="el-icon-chat-line-square"><ChatLineSquare /></el-icon>
          <div class="empty-hint">你还未选中或发起聊天，快去跟好友聊一聊吧~</div>
        </div>
        <div class="message-im-box" v-else :style="'height: ' + clientHeight + 'px'">
          <div class="message-im-box-header">
            <b>{{messageMember.sender.name}}</b>
          </div>
          <div class="message-im-talk-box-body" id="chat-box" v-loading="chatLoading">
            <span class="get-more-button" v-if="notMoreMessage" style="cursor: auto;">没有更多历史消息框</span>
            <span class="get-more-button" v-else @click="loadMoreMessage">查看更多历史消息</span>
            <div v-for="item in messageList" :key="item.id">
              <div class="pgc-message-stamp">{{item.createTime}}</div>
              <div class="info-item-container">
                <div class="pgc-info-item normal info-item">
                  <div class="pgc-info-item-head" :class="{'head-right': item.sender && item.sender.id === currentUserId}">
                    <div class="img-avatar">
                      <img alt="" :src="item.sender ? item.sender.avatar : ''" style="width: 40px; height: 40px;">
                      <div class="img-avatar-bg"></div>
                    </div>
                  </div>
                  <div class="pgc-info-item-body" :class="{'body-right': item.sender && item.sender.id === currentUserId}">
                    <div class="pgc-info-item-inner-body">
                      <span class="pgc-info-item-content">
                        <span>
                          <span>{{item.content}}</span>
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="message-im-talk-box">
            <el-input v-model="message.content" :show-word-limit="true" type="textarea" placeholder="请输" :rows="4" class="editor" maxlength="300" style="resize:none;"></el-input>
            <div class="toolbar">
              <el-button @click="submitMessage" :disabled="message.content.trim().length === 0">发送</el-button>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
  import {ref, markRaw} from "vue"
  import {Search, Close, ChatLineSquare} from '@/lib/lucide-fallback'
  import {
    getMemberList,
    getLetterList,
    sendPrivateLetter,
    getLetterMember,
    getNewLetterList
  } from "@/api/edu/web/message";
  import {error} from "@/util/tipsUtils";
  import {useRoute} from "vue-router";
  import {getUser} from "@/util/userUtils";
  import {getAuthMemberList} from "@/api/edu/web/member";

  export default {
    name: "privateLetter",
    setup() {
      const scrollBottom = () => {
        setTimeout(function() {
          const p = document.getElementById("chat-box");
          p.scrollTop = p.scrollHeight;
        }, 0)
      }
      const memberParam = ref({
        current: 1,
        size: 20
      })
      const letterParam = ref({
        current: 1,
        size: 20,
        senderId: 0,
        id: 0
      })
      const newLetterParam = ref({
        current: 1,
        size: 20,
        senderId: 0,
        id: 0
      })
      const messageMemberListTotal = ref(0)
      const messageMemberList = ref([])
      const messageList = ref([])
      const messageMember = ref({})
      const notMoreMessage = ref(false)
      const currentUserId = ref(0)
      const message = ref({
        receiverId: 0,
        content: ""
      })
      const alreadyMemberList = []
      const noMoreMemberList = ref(false)
      const loadMemberList = function() {
        getMemberList(memberParam.value, res => {
          for (const member of res.list) {
            if (alreadyMemberList.indexOf(member.sender.id) === -1) {
              messageMemberList.value.push(member);
              alreadyMemberList.push(member.sender.id)
            }
          }
          if (res.list.length < memberParam.value.size) {
            noMoreMemberList.value = true;
          } else {
            noMoreMemberList.value = false;
          }
          messageMemberListTotal.value = res.total;
        })
      }
      loadMemberList()
      const chatLoading = ref(true)
      const loadLetterList = function() {
        chatLoading.value = true
        getLetterList(letterParam.value, res => {
          if (res.list && res.list.length) {
            for (let i = 0; i < res.list.length; i++) {
              messageList.value.unshift(res.list[i]);
              letterParam.value.id = res.list[i].id
            }
            notMoreMessage.value = res.list.length < letterParam.value.size;
            currentUserId.value = res.currentUserId;
            newLetterParam.value.id = res.list[0].id
          } else {
            notMoreMessage.value = true
          }
          scrollBottom()
          chatLoading.value = false
        })
      }
      // 定时获取最新聊
      const loadNewLetterList = () => {
        getNewLetterList(newLetterParam.value, res => {
          if (res.list && res.list.length) {
            for (let i = 0; i < res.list.length; i++) {
              messageList.value.push(res.list[i]);
              newLetterParam.value.id = res.list[i].id
              scrollBottom()
            }
            if (res.list.length === newLetterParam.value.size) {
              newLetterParam.value.current = newLetterParam.value.current + 1
              loadNewLetterList()
            }
          }
        })
      }
      let chatInterval;
      // eslint-disable-next-line no-unused-vars
      const loadNewChat = () => {
        chatInterval = setInterval(function () {
          loadNewLetterList()
        }, 10000)
      }
      const defaultActive = ref("")
      const selectMember = function(item) {
        messageMember.value = item
        newLetterParam.value.senderId = item.sender.id
        newLetterParam.value.current = 1
        newLetterParam.value.id = 0
        letterParam.value.senderId = item.sender.id
        letterParam.value.current = 1
        letterParam.value.id = 0
        messageList.value = []
        loadLetterList()
        defaultActive.value = item.sender.id
        // 定时获取最新聊        loadNewChat()
      }
      const showMemberLayer = ref(false)
      const loadLetterMember = (id) => {
        showMemberLayer.value = false
        getLetterMember({memberId: id}, res => {
          let memberId = 0
          const member = getUser();
          if (res.receiver) {
            memberId = res.receiver.id
            if (member.id === res.receiver.id) {
              return;
            }
          } else if(res.sender) {
            memberId = res.sender.id
            if (member.id === res.sender.id) {
              return;
            }
          }
          if (alreadyMemberList.indexOf(memberId) === -1) {
            alreadyMemberList.push(memberId)
            messageMemberList.value.unshift(res);
          }
          selectMember(res)
        })
      }
      const route = useRoute()
      if (route.query.memberId) {
        loadLetterMember(route.query.memberId)
      }
      const loadMoreMessage = function() {
        letterParam.value.current = 1;
        loadLetterList();
      }
      const submitMessage = function() {
        if (!message.value.content) {
          error("请输入内容");
          return
        }
        message.value.receiverId = messageMember.value.sender.id;
        sendPrivateLetter(message.value, res => {
          loadNewLetterList()
          message.value.content = ""
          for (const m of messageMemberList.value) {
            if (m.sender.id === res.senderId || m.sender.id === res.receiverId) {
              m.content = res.content
              m.createTime = res.createTime
            }
          }
          scrollBottom()
        })
      }
      let clientHeight = document.documentElement.clientHeight - 220;
      if (clientHeight < 600) {
        clientHeight = 600;
      }
      const params = ref({
        size: 20,
        current: 1,
        keyword: ""
      })
      const authMemberList = ref([])
      const noMoreAuthMemberList = ref(false)
      const loadAuthMemberList = () => {
        getAuthMemberList(params.value, res => {
          authMemberList.value.push(...res.list)
          if (res.list.length < params.value.size) {
            noMoreAuthMemberList.value = true;
          }
        })
      }
      const search = () => {
        showMemberLayer.value = true
        if (!params.value.keyword) {
          error("请输入关键字")
          return
        }
        authMemberList.value = []
        loadAuthMemberList()
      }
      const removeMember = (index) => {
        messageMemberList.value.splice(index, 1);
        messageMember.value = {}
        if (chatInterval) {
          clearInterval(chatInterval);
        }
      }
      const authMemberListScrollEvent = (e) => {
        let scrollTop = e.srcElement.scrollTop
        let clientHeight = e.srcElement.offsetHeight
        let scrollHeight = e.srcElement.scrollHeight
        // 滚动到底部，逻辑代码
        if (scrollTop + clientHeight >= scrollHeight) {
          if (!noMoreAuthMemberList.value) {
            params.value.current = params.value.current + 1
            loadAuthMemberList()
          }
        }
      }
      const memberListScrollEvent = (e) => {
        let scrollTop = e.srcElement.scrollTop
        let clientHeight = e.srcElement.offsetHeight
        let scrollHeight = e.srcElement.scrollHeight
        // 滚动到底部，逻辑代码
        if (scrollTop + clientHeight >= scrollHeight) {
          if (!noMoreMemberList.value) {
            memberParam.value.current = memberParam.value.current + 1
            loadMemberList()
          } else {
            loadMemberList()
          }
        }
      }
      return {
        Search: markRaw(Search),
        Close: markRaw(Close),
        ChatLineSquare: markRaw(ChatLineSquare),
        clientHeight,
        memberParam,
        letterParam,
        messageMemberListTotal,
        messageMemberList,
        messageList,
        messageMember,
        notMoreMessage,
        currentUserId,
        message,
        selectMember,
        loadMoreMessage,
        submitMessage,
        search,
        showMemberLayer,
        authMemberList,
        loadLetterMember,
        params,
        defaultActive,
        removeMember,
        authMemberListScrollEvent,
        memberListScrollEvent,
        chatLoading
      }
    }
  }
</script>

<style lang="scss" scoped>
  .search-box {
    margin: 20px;
    .search-list {
      position: absolute;
      width: 100%;
      margin-left: -20px;
      background: #fff;
      z-index: 99;
      min-height: 500px;
      height: calc(100% - 10px);
      margin-top: 10px;
      overflow: auto;
      .member-item {
        height: 40px;
        margin: 10px 0;
        padding: 5px 20px;
        cursor: pointer;
        &:hover {
          background: #fafafa;
        }
        .message-item-head {
          width: 40px;
          height: 40px;
          background-color: rgb(238, 238, 238);
          border-radius: 50%;
          img {
            width: 100%;
            height: 100%;
            background-color: rgb(238, 238, 238);
          }
        }
        .message-item-content {
          padding-left: 50px;
          .message-item-user {
            line-height: 40px;
            font-size: 18px;
          }
        }
      }
    }
  }
  .content-container {
    border: 1px solid #f0f0f0;
  }
  .message-empty {
    position: relative;
    flex-grow: 1;
    height: 100%;
    text-align: center;
    color: #999;
    line-height: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-left: 1px solid #f0f0f0;
  }
  .el-icon-chat-line-square {
    font-size: 100px;
  }
  .row {
    height: 100%;
    .el-col {
      height: inherit;
    }
  }
  .message-item-head {
    position: absolute;
    width: 48px;
    height: 48px;
    img {
      border-radius: 50%;
      display: block;
      width: 48px;
      height: 48px;
      background-color: rgb(238, 238, 238);
    }
  }
  .message-item-content {
    padding-left: 64px;
  }
  .message-item-left {
    font-size: 14px;
    color: #222;
    letter-spacing: 0;
    // margin-top: -2px;
    line-height: 20px;
    .message-item-user {
      position: relative;
      display: flex;
      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      em {
        flex: 1 1 auto;
        text-align: right;
        margin-left: 12px;
        font-size: 12px;
        color: #999;
        letter-spacing: 0;
        white-space: nowrap;
        font-style:normal;
      }
    }
  }
  .message-item-left-msg {
    font-size: 14px;
    line-height: 20px;
    color: #999;
    letter-spacing: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 8px;
    padding-right: 12px;
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
  .el-menu-item:hover {
    height: 80px;
    em {
      display: none;
    }
    .el-icon-close {
      display: block;
    }
  }
  .message-list {
    overflow: scroll;
    height: calc(100% - 80px);
  }
  .message-list::-webkit-scrollbar {
    display: none;/*隐藏滚动条*/
  }
  .el-menu-vertical {
    border: 0;
    .active {
      background: #eef2ff;
    }
  }
  .message-im-box {
    z-index: 10;
    border: 0 solid #f0f0f0;
    background-color: #fff;
    position: relative;
    flex-grow: 1;
    bottom: 0;
    width: auto;
    box-shadow: none;
    border-left: 1px solid #f0f0f0;
    height: 100%;
    overflow-x: hidden;
    .message-im-box-header {
      margin: 0;
      border: 0;
      font: inherit;
      vertical-align: baseline;
      line-height: 51px;
      height: 51px;
      padding: 0 48px 0 32px;
      border-bottom: 1px solid #f0f0f0;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .message-im-talk-box-body {
      overflow: auto;
      position: relative;
      width: calc(100% + 15px);
      height: calc(100% - 213px);
      overflow-y: scroll;
      .get-more-button {
        padding: 0;
        border: 0;
        vertical-align: baseline;
        display: inline-block;
        position: relative;
        left: 50%;
        transform: translatex(-50%);
        font-size: 14px;
        color: #999;
        width: 150px;
        height: 30px;
        line-height: 30px;
        margin: 24px 0 0;
        text-align: center;
        cursor: pointer;
      }
      .pgc-message-stamp {
        padding: 0;
        border: 0;
        font: inherit;
        vertical-align: baseline;
        margin: 24px 0;
        font-size: 12px;
        color: #999;
        letter-spacing: 0;
        line-height: 14px;
        text-align: center;
      }
      .info-item-container {
        display: inline;
        position: relative;
        .pgc-info-item {
          padding: 0;
          border: 0;
          font: inherit;
          vertical-align: baseline;
          position: relative;
          margin: 24px 32px;
          .pgc-info-item-head {
            margin: 0;
            padding: 0;
            border: 0;
            font: inherit;
            vertical-align: baseline;
            position: absolute;
            width: 40px;
            height: 40px;
            .img-avatar {
              margin: 0;
              padding: 0;
              border: 0;
              font: inherit;
              vertical-align: baseline;
              position: relative;
              border-radius: 50%;
              display: inline-block;
              height: 100%;
              width: 100%;
              img {
                border-radius: 50%;
                display: inline-block;
                width: 40px;
                height: 40px;
              }
            }
          }
          .head-right {
            right: 0;
          }
          .pgc-info-item-body {
            margin: 0;
            border: 0;
            font: inherit;
            vertical-align: baseline;
            padding-left: 52px;
            padding-right: 64px;
            position: relative;
            .pgc-info-item-inner-body{
              margin: 0;
              padding: 0;
              border: 0;
              font: inherit;
              vertical-align: baseline;
              display: inline-block;
              position: relative;
              .pgc-info-item-content {
                margin: 0;
                border: 0;
                font: inherit;
                vertical-align: baseline;
                position: relative;
                background-color: #fafafa;
                border-radius: 0 10px 10px 10px;
                padding: 14px 16px;
                font-size: 14px;
                line-height: 20px;
                color: #222;
                letter-spacing: 0;
                display: inline-block;
                white-space: normal;
                word-break: break-all;
                box-shadow: none;
                span {
                  margin: 0;
                  padding: 0;
                  border: 0;
                  font: inherit;
                  vertical-align: baseline;
                }
                .pgc-info-item-extra {
                  margin: 0;
                  border: 0;
                  font: inherit;
                  vertical-align: baseline;
                  position: absolute;
                  top: 50%;
                  right: -34px;
                  color: #999;
                  transform: translateY(-20px);
                  opacity: 0;
                  height: 30px;
                  width: 30px;
                  text-align: center;
                  padding: 10px 0 0;
                }
              }
            }
          }
          .body-right {
            text-align: right;
            padding-right: 52px;
            padding-left: 64px;
            .pgc-info-item-inner-body {
              .pgc-info-item-content {
                border-radius: 10px 0 10px 10px;
              }
            }
          }
        }
      }
    }
    .message-im-talk-box {
      box-sizing: border-box;
      height: 156px;
      padding: 12px 16px 38px;
      background: #fff;
      font-size: 14px;
      color: #505050;
      border-top: 1px solid #f0f0f0;
      .editor {
        .textarea {
          width: 100%;
          height: 100%;
          border: none;
          padding: 0;
          margin: 0;
          resize: none;
          outline: none;
          vertical-align: middle;
          font-size: 14px;
          color: #505050;
          letter-spacing: 0;
          border: 0;
        }
      }
      .toolbar {
        display: block;
        color: #999;
        position: relative;
        line-height: 32px;
        margin-top: 8px;
        span {
          margin: 0;
          padding: 0;
          border: 0;
          font: inherit;
          vertical-align: baseline;
        }
        .message-box-hint {
          margin: 0;
          padding: 0;
          border: 0;
          font: inherit;
          vertical-align: baseline;
          position: absolute;
          top: 0;
          right: 76px;
        }
        .el-button {
          padding: 8px 16px;
          position: absolute;
          right: 0;
        }
      }
    }
  }
  :deep(.el-textarea .el-input__count) {
    left: 5px;
    bottom: -30px;
  }
  :deep(textarea) {
    resize: none;
    border: 0;
  }
  .message-list {
    :deep(.el-menu-item:focus) {
      background-color: #ffffff;
    }
    :deep(.el-menu-item.is-active) {
      background-color: #eef2ff;
    }
  }
</style>
