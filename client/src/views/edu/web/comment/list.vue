<template>
  <div class="comment-box">
    <edit :submit-callback="submitCallback"/>
    <el-empty  v-if="!(list && list.length)"/>
    <div class="comment-list" v-else>
      <template v-for="item in list" :key="item.id">
      <div class="comment-list-item" v-if="item.member">
        <div class="comment-list-header">
          <el-image class="comment-list-header-head-ico" :src="item.member.avatar || ''">
            <template #error>
              <div class="image-slot">
<!--                <el-icon><PictureRounded/></el-icon>-->
              </div>
            </template>
          </el-image>
          <div class="comment-list-header-info">
            <div class="comment-list-header-name">
              <a href="javascript:void(0);">{{item.member.name || ''}}</a>
            </div>
            <div class="comment-list-header-time">{{friendlyDate(item.createTime)}}</div>
          </div>
        </div>
        <div class="comment-list-body">
          <div class="comment-list-body-content">
            <div class="comment-list-content-text">
              <span>{{item.content}}</span>
            </div>
          </div>
          <div class="img-area"></div>
          <div class="comment-list-body-interaction">
            <a href="javascript:void(0);" @click="showReply(item)" :class="{'show-active' : item.showReplyInput}">
              <el-icon class="interaction-icon"><ChatDotRound /></el-icon>
              <span class="interaction-text">{{!item.showReplyInput ? '回复' : '收起'}}</span>
            </a>
            <a href="javascript:void(0);" @click="commentLike(item)" :class="{'show-active' : item.like && item.like.status}">
              <el-icon class="interaction-icon"><Pointer /></el-icon>
              <span class="interaction-text"><span style="color: #cccccc;">{{item.likeCount}}</span></span>
            </a>
          </div>
          <div class="comment-reply-input" v-if="item.showReplyInput">
            <edit :submit-callback="replySubmitCallback" :parent-item="item" :comment-id="item.id"/>
          </div>
          <div class="reply-lists" :class="{'noExtend': !item.showReply}" v-if="item['replyList'] && item['replyList'].length">
            <template v-for="reply in item['replyList']" :key="reply.id">
              <div class="reply-item" v-if="item.showReply && reply.member">
                <div class="reply-body">
                  <span class="user-nick-name">{{reply.member.name || ''}}{{reply['toMember'] && reply['replyCommentId'] !== 0 ? '  回复  ' + (reply['toMember'].name || '') : ''}}: </span>
                  <span>{{reply.content}}</span>
                </div>
                <div class="reply-footer">
                  <span class="reply-time">{{friendlyDate(reply.createTime)}} · </span>
                  <a class="reply-btn" :class="{'show-active' : reply.showReplyInput}" href="javascript:void(0);" @click="showReply(reply)">{{!reply.showReplyInput ? '回复' : '收起'}}</a>
                  <a> · </a>
                  <a class="reply-like" href="javascript:void(0);" @click="replyCommentLike(reply)" :class="{'show-active' : reply.like && reply.like.status}"><span style="color: #cccccc;">{{reply.likeCount}}</span></a>
                </div>
                <div class="reply-input" v-if="reply.showReplyInput">
                  <edit :submit-callback="replySubmitCallback" :parent-item="reply" :comment-id="item.id"/>
                </div>
              </div>
            </template>
            <div v-if="item.showReply" @click="item.showReply = false">
              <a class="close-more-reply" href="javascript:void(0);">
                收起回复<el-icon><ArrowUp /></el-icon>
              </a>
            </div>
            <div v-else @click="item.showReply = true">
              <a class="get-more-reply" href="javascript:void(0);">
                全部{{item['replyList'].length}}条回复<el-icon><ArrowDown /></el-icon>
              </a>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<script>
import {inject, ref, markRaw} from "vue"
  import edit from "./edit.vue"
  import {ArrowUp, ArrowDown} from '@/lib/lucide-fallback'
  import {getCommentList, saveComment, saveReplyComment} from "@/api/edu/web/comment"
  import {like} from "@/api/edu/web/comment/like"
  import {friendlyDate} from "@/util/dateUtils"
import {getToken} from "@/util/tokenUtils";
  export default {
    name: "commentList",
    components: {
      edit
    },
    props: {
      topicId: {
        type: Number,
        required: true
      },
      topicType: {
        type: String,
        required: true
      },
      topicMemberId: {
        type: Number,
        default: 0
      }
    },
    setup(props) {
      let showListBox = ref(true)
      const list = ref([])
      const currentReplyCommentId = ref(0)
      const subCommentFormat = function(subList) {
        if (subList && subList.length) {
          for (let i = 0; i < subList.length; i++) {
            const comment = subList[i];
            comment.showReplyInput = false;
            if (!comment.likeCount) {
              comment.likeCount = ""
            }
          }
        }
      }
      const load = function() {
        getCommentList({topicId: props.topicId, topicType: props.topicType}, res => {
          if (res && res.list && res.list.length) {
            for (let i = 0; i < res.list.length; i++) {
              const comment = res.list[i];
              comment.showReply = currentReplyCommentId.value === comment.id;
              comment.showReplyInput = false;
              if (!comment.likeCount) {
                comment.likeCount = ""
              }
              subCommentFormat(comment["replyList"]);
            }
            list.value = res.list
          }
        })
      }
      load()
      const listBoxArrow = function() {
        showListBox.value = !showListBox.value;
      }
      const showReply = function(item) {
        item.showReplyInput = !item.showReplyInput
        currentReplyCommentId.value = item.id
      }
      // 提交评论回调
      const submitCallback = function(param) {
        saveComment({
          topicId: props.topicId,
          topicType: props.topicType,
          topicMemberId: props.topicMemberId,
          content: param.content
        }, () => {
          load()
        })
      }
      const replySubmitCallback = function(param, parentItem) {
        if (!parentItem) {
          return
        }
        saveReplyComment({
          commentId: param.commentId,
          content: param.content,
          replyCommentId: parentItem.id,
          toMemberId: parentItem.member.id,
        }, () => {
          parentItem.showReplyInput = false
          parentItem.showReply = true
          load()
        })
      }
      const showLoginFlag = inject("showLogin")
      const commentLike = function(item) {
        // 没有登录
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        like(item, "comment")
      }
      const replyCommentLike = function(item) {
        // 没有登录
        if (!getToken()) {
          showLoginFlag.value = true
          return
        }
        like(item, "reply_comment")
      }
      return {
        showListBox,
        // 评论列表
        list,
        currentReplyCommentId,
        subCommentFormat,
        friendlyDate,
        listBoxArrow,
        showReply,
        submitCallback,
        replySubmitCallback,
        commentLike,
        replyCommentLike,
        ArrowUp: markRaw(ArrowUp),
        ArrowDown: markRaw(ArrowDown)
      }
    }
  }
</script>

<style lang="scss" scoped>
  .comment-list {
    margin-top: 30px;
    .comment-list-item {
      padding-bottom: 40px;
      .comment-list-header {
        height: 48px;
        margin-bottom: 15px;
        position: relative;
        display: inline-block;
        .comment-list-header-head-ico {
          width: 48px;
          height: 48px;
          line-height: 48px;
          border-radius: 24px;
          display: inline-block;
          cursor: pointer;
          background-position: 50%;
          background-size: 100%;
          background-color: #f0f0f0;
        }
        .comment-list-header-info {
          display: inline-block;
          position: relative;
          top: -7px;
          margin-left: 15px;
          .comment-list-header-name {
            font-weight: 500;
            font-size: 14px;
            color: #000;
            text-align: justify;
            vertical-align: baseline;
            margin-top: 5px;
            cursor: pointer;
            a {
              color: #000;
            }
            .vip-name {
              font-size: 14px;
              color: #ebba73;
            }
            .vip-level-img {
              width: 17px;
              position: relative;
              margin-left: 9px;
              cursor: pointer;
              vertical-align: middle;
              padding-bottom: 1.5px;
              display: inline-block;
            }
          }
          .comment-list-header-time {
            font-size: 12px;
            color: #999;
            text-align: justify;
            vertical-align: baseline;
            margin-top: 10px;
          }
        }
      }
      .comment-list-body {
        margin-left: 63px;
        font-size: 14px;
        color: #000;
        word-wrap: break-word;
        .comment-list-body-content {
          .comment-list-content-text {

          }
        }
        .img-area {
          margin-top: 15px;
        }
        .comment-list-body-interaction {
          margin-top: 15px;
          position: relative;
          height: 20px;
          a {
            cursor: pointer;
            text-decoration: none;
            font-size: 12px;
            color: #999;
            margin-right: 18px;
          }
          .interaction-icon {
            color: #666;
            font-size: 14px;
            vertical-align: middle;
          }
          .interaction-text {
            vertical-align: middle;
            font-size: 14px;
          }
        }
        .comment-reply-input {
          margin-top: 15px;
          display: block;
        }
        .reply-input {
          margin-bottom: 18px;
          margin-top: 12px;
        }
        .reply-lists {
          display: block;
          margin-top: 15px;
          background: #fafafa;
          border-radius: 6px;
          .reply-item {
            padding: 18px;
            .reply-body {
              margin-bottom: 6px;
              word-wrap: break-word;
              span {
                font-size: 14px;
                line-height: 20px;
              }
              .user-nick-name {
                color: #999;
                white-space: pre;
                font-weight: 500;
              }
            }
            .reply-footer {
              height: 17px;
              span, a {
                line-height: 17px;
                font-size: 12px;
                color: #999;
              }
            }
          }
          .close-more-reply {
            width: 100%;
            font-size: 12px;
            color: var(--el-color-primary);
            text-align: center;
            display: block;
            height: 41px;
            line-height: 41px;
            cursor: pointer;
          }
          .get-more-reply {
            margin-bottom: 10px;
            display: inline-block;
            font-size: 12px;
            color: var(--el-color-primary);
            text-align: center;
          }
        }
        .noExtend {
          display: inline-block;
          background: #ffffff;
        }
      }
    }
  }
  .show-active, a:hover {
    color: var(--el-color-primary);
    i {
      color: var(--el-color-primary);
    }
  }
</style>
<style lang="scss">
  body {
    height: 100%;
  }
</style>
