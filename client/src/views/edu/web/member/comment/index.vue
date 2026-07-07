<template>
  <div class="content-container" :style="'min-height: ' + clientHeight + 'px'">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="comment"/>
      </el-col>
      <el-col :span="20">
        <div class="personal-container" v-if="typeList">
          <div class="status-menu">
            <el-menu :default-active="defaultMenuActive" class="el-menu-demo" mode="horizontal" :ellipsis="false" @select="handleSelectMenu">
              <el-menu-item index="">全部</el-menu-item>
              <el-menu-item v-for="item in typeList" :key="item" :index="item">{{typeMap[item]}}</el-menu-item>
            </el-menu>
          </div>
          <div v-loading="commentListLoading">
            <el-empty v-if="!commentList || !commentList.length"/>
            <el-row class="row" :style="'height: ' + (clientHeight - 90) + 'px'" v-else>
              <el-col :span="12">
                <div class="comment-list-wrapper" @scroll="commentListScrollEvent">
                  <div class="comment-load-more-wrapper">
                    <template v-for="item in commentList" :key="item.id">
                      <div class="comment-item-wrapper" :class="{'select' : selectComment.id === item.id}">
                        <comment-item :item="item" :member="member" :comment-id="selectComment.id" :submit-callback="submitCallback" @click="selectCommentHandle(item)"/>
                      </div>
                    </template>
                    <div v-if="noMoreComment" class="load-more-no-more-tips">我是有底线的</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="comment-sub-list-wrapper" v-if="selectComment && selectComment.id">
                  <div class="comment-item-wrapper-select">
                    <comment-item :member="member" :item="selectComment" :submit-callback="submitCallback" :delete-callback="deleteCallback" :comment-id="selectComment.id"/>
                  </div>
                  <div class="comment-count">全部&nbsp;{{selectComment && selectComment.replyList && selectComment.replyList.length || 0}}&nbsp;条回收</div>
                  <el-empty v-if="!selectComment.replyList || !selectComment.replyList.length"/>
                  <div class="reply-list" v-else>
                    <template v-for="item in selectComment.replyList" :key="item.id">
                      <comment-item :member="member" :item="item" :submit-callback="submitCallback" :comment-id="selectComment.id"/>
                    </template>
                  </div>
                </div>
              </el-col>
            </el-row>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
  import router from "@/router"
  import commentItem from "./commentItem.vue"
  import memberMenu from "../menu/index.vue"
  import {getMemberInfo} from "@/api/edu/web/member"
  import {error} from "@/util/tipsUtils";
  import {getMemberCommentList, getTypeList} from "@/api/edu/web/comment";
  import {getTopicList} from "@/api/edu/web/topic";
import {getToken} from "@/util/tokenUtils";

  export default {
    name: "memberComment",
    components: {
      memberMenu,
      commentItem
    },
    setup() {
      const showLoginFlag = inject("showLogin")
      const showLoginClose = inject("showLoginClose")
      if (!getToken()) {
        showLoginFlag.value = true
        showLoginClose.value = false
        return
      }
      const typeMap = {
        lesson: "课程",
        news: "新闻",
        article: "文章",
        question: "问题",
        answer: "回答",
        dynamic: "动态",
        channel: "直播",
        resource: "知识库",
        // learn_topic: "专题",
        // learn_map: "学习地图"
      }
      const commentListLoading = ref(true)
      const typeList = ref([])
      const defaultMenuActive = ref("")
      getTypeList(res => {
        typeList.value = res
      })
      const member = ref({})
      const param = ref({
        topicId: "",
        topicType: "",
        current: 1,
        size: 20
      })
      const commentList = ref([])
      const selectComment = ref({})
      const noMoreComment = ref(false)
      const loadCommentList = () => {
        commentListLoading.value = true
        getMemberCommentList(param.value, res => {
          if (!res || !res.list || !res.list.length) {
            if (res.total > param.value.size) {
              noMoreComment.value = true
            }
            param.value.current = param.value.current - 1
            commentListLoading.value = false
            return
          }
          if (res.list.length < param.value.size) {
            noMoreComment.value = true
          }
          const topicIdMap = {}
          for (const e of res.list) {
            if (!topicIdMap[e.topicType]) {
              topicIdMap[e.topicType] = []
            }
            topicIdMap[e.topicType].push(e.topicId)
            commentList.value.push(e)
          }
          for (const me in topicIdMap) {
            getTopicList(me, topicIdMap[me], res => {
              for (const r of res) {
                for (const v of commentList.value) {
                  if (v.topicId === r.id && me === v.topicType) {
                    r.name = r.name || r.title || r.content
                    v.topic = r;
                  }
                }
              }
              commentListLoading.value = false
            })
          }
          if (!selectComment.value || !selectComment.value.id) {
            if (res.list && res.list.length) {
              selectComment.value = res.list[0]
            }
          } else {
            for (const re of res.list) {
              if (selectComment.value.id === re.id) {
                selectComment.value = re;
                break
              }
            }
          }
        })
      }
      const handleSelectMenu = (val) => {
        param.value.topicType = val
        commentList.value = []
        selectComment.value = {}
        loadCommentList()
      }
      const load = function() {
        const obj = getMemberInfo(res => {
          member.value = res
          if (!res) {
            error("请先登录")
            router.push({path: "/edu"})
          }
          loadCommentList()
        })
        if (!obj) {
          error("请先登录")
          router.push({path: "/edu"})
        }
      }
      load()
      const selectCommentHandle = (item) => {
        selectComment.value = item
      }
      const submitCallback = () => {
        loadCommentList()
      }
      const deleteCallback = () => {
        loadCommentList()
      }
      const commentListScrollEvent = (e) => {
        let scrollTop = e.srcElement.scrollTop
        let clientHeight = e.srcElement.offsetHeight
        let scrollHeight = e.srcElement.scrollHeight
        // 滚动到底部，逻辑代码
        if (scrollTop + clientHeight >= scrollHeight) {
          if (!noMoreComment.value) {
            param.value.current = param.value.current + 1
            loadCommentList()
          }
        }
      }
      let clientHeight = document.documentElement.clientHeight - 50;
      if (clientHeight < 600) {
        clientHeight = 600;
      }
      return {
        typeList,
        typeMap,
        clientHeight,
        member,
        commentList,
        selectComment,
        selectCommentHandle,
        defaultMenuActive,
        handleSelectMenu,
        submitCallback,
        deleteCallback,
        commentListScrollEvent,
        noMoreComment,
        commentListLoading
      }
    }
  }
</script>

<style lang="scss" scoped>
  .personal-container {
    background-color: #FFFFFF;
    margin: 20px;
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .row {
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
  .status-menu {
    padding-bottom: 10px;
    .el-menu-demo {
      // 使用全局统一的水平菜单样式
      margin-left: 30px;
    }
  }
  .comment-list-wrapper {
    overflow-x: hidden;
    overflow-y: auto;
    height: 100%;
    &::-webkit-scrollbar { width: 0 }
    -ms-overflow-style: none;
    overflow: -moz-scrollbars-none;
    .comment-load-more-wrapper {
      border-right: 1px solid #f0f0f0;
      .load-more-no-more-tips {
        color: #cccccc;
        text-align: center;
        font-size: 14px;
        padding: 20px 0;
      }
      .comment-item-wrapper {
        cursor: pointer;
        position: relative;
        &:after {
          content: " ";
          height: 1px;
          background-color: #f0f0f0;
          position: absolute;
          bottom: 0;
          right: 30px;
          left: 30px;
        }
        &:last-child:after {
          height: 0;
        }
        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 0;
          background: #1a1a1a;
          border-radius: 0 2px 2px 0;
          transition: height 0.2s ease;
        }
        &:hover {
          background-color: rgba(0, 0, 0, 0.04);
          &::before {
            height: 60%;
          }
        }
      }
      .select {
        background-color: rgba(0, 0, 0, 0.04);
        &::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: #1a1a1a;
          border-radius: 0 2px 2px 0;
        }
      }
    }
  }
  .comment-sub-list-wrapper {
    overflow: hidden;
    overflow-y: auto;
    height: 100%;
    &::-webkit-scrollbar { width: 0 }
    -ms-overflow-style: none;
    overflow: -moz-scrollbars-none;
    .comment-item-wrapper-select {
      position: relative;
      margin-top: 20px;
    }
    .comment-count {
      padding-left: 30px;
      padding-right: 48px;
      margin: 8px 0;
    }
    .reply-list {
      position: relative;
      padding-left: 30px;
      .comment-item {
        padding: 12px 30px 12px 0;
      }
    }
  }
</style>
<style>
  body {
    background-color: #fafafa;
    height: 100%;
  }
</style>
