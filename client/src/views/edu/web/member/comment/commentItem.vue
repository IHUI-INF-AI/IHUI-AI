<template>
  <div class="comment-item">
    <div class="comment-item-header">
      <div class="comment-item-avatar">
        <div class="byte-avatar byte-avatar-circle">
          <span class="byte-avatar-image">
            <img :src="item.member && item.member.avatar">
          </span>
        </div>
      </div>
      <span class="comment-item-title">{{item.member && item.member.name}}</span>
      <div class="comment-item-header-extra" v-if="item['toMember'] && item['toMember'].id">
        {{'  回复  ' + (item['toMember'].name || '')}}
      </div>
      <div class="comment-item-header-extra" v-else>
        评论了{{topicType[item.topicType]}}
        <span class="extra-title">
                    <a class="comment-item-header-extra-title" @click="goto(item)" v-if="item.topic" target="_blank" :title="item.topic.name">{{item.topic.name}}</a>
                  </span>
      </div>
    </div>
    <div class="comment-item-body">
      <div class="comment-item-content-wrap">
        <div class="two-line-wrap">
          <div class="comment-item-content">{{item.content}}</div>
        </div>
      </div>
      <div class="comment-item-footer">
        <div class="comment-item-timer">{{item.createTime}}</div>
        <div class="comment-item-actions">
          <div class="comment-item-actions-item">
            <div class="byte-spin">
              <div class="byte-spin-container">
                <div class="byte-spin-content" @click="commentLike(item)" :class="{'show-active' : item.like && item.like.status}">
                  <el-icon><Pointer /></el-icon> {{item.likeCount || 0}}
                </div>
              </div>
            </div>
          </div>
          <div class="comment-item-actions-item" v-if="item.member && member.id !== item.member.id">
            <div class="byte-spin">
              <div class="byte-spin-container">
                <div class="byte-spin-content" @click="showReply(item)" :class="{'show-active' : item.showReplyInput}">
                  <el-icon><ChatDotRound /></el-icon> 回复
                </div>
              </div>
            </div>
          </div>
          <div class="comment-item-actions-item" v-if="item.member && member.id === item.member.id">
            <div class="byte-spin">
              <div class="byte-spin-container">
                <div class="byte-spin-content" @click="delComment">
                  <el-icon><Delete /></el-icon> 删除
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="comment-reply-input" v-if="item.showReplyInput">
        <edit :submit-callback="replySubmitCallback" :parent-item="item" :comment-id="commentId"/>
      </div>
    </div>
  </div>
</template>

<script>
  import {like} from "@/api/edu/web/comment/like";
  import {deleteComment, deleteReplyComment, saveReplyComment} from "@/api/edu/web/comment";
  import edit from "../../comment/edit.vue"
  import {confirm, success} from "@/util/tipsUtils";
  import router from "@/router";
  export default {
    name: "commentItem",
    components: {
      edit
    },
    props: {
      item: {
        type: Object
      },
      member: {
        type: Object
      },
      commentId: {
        type: Number
      },
      submitCallback: {
        type: Function,
        default: () => {}
      },
      deleteCallback: {
        type: Function,
        default: () => {}
      }
    },
    setup(props) {
      const topicType = {
        lesson: "课程",
        news: "新闻",
        article: "文章",
        question: "问题",
        answer: "回答",
        dynamic: "动",
        channel: "直播",
        resource: "知识",
      }
      const commentLike = (item) => {
        if (item.toMember && item.toMember.id) {
          like(item, "reply_comment", res => {
            item.like = res.like
          })
        } else {
          like(item, "comment", res => {
            item.like = res.like
          })
        }
      }
      const showReply = (item) => {
        item.showReplyInput = !item.showReplyInput
      }
      const replySubmitCallback = function(param, parentItem) {
        if (!parentItem) {
          return
        }
        saveReplyComment({
          commentId: param.commentId,
          content: param.content,
          replyCommentId: parentItem.id,
          toMemberId: parentItem.member.id
        }, () => {
          parentItem.showReplyInput = false
          parentItem.showReply = true
          props.submitCallback()
        })
      }
      const delComment = () => {
        confirm("确定删除该评论", "提示", () => {
          if (props.item.toMember && props.item.toMember.id) {
            deleteReplyComment({id : props.item.id}, () => {
              success("删除成功")
              props.submitCallback()
            })
          } else {
            deleteComment({id : props.item.id}, () => {
              success("删除成功")
              props.submitCallback()
            })
          }
        })
      }
      const goto = (item) => {
        switch (item.topicType) {
        case "lesson":
          router.push({path: "/edu/learn/detail", query: {id: item.topicId}})
          break;
        case "channel":
          router.push({path: "/edu/live/detail", query: {id: item.topicId}})
          break;
        case "article":
          router.push({path: "/edu/article/detail", query: {id: item.topicId}})
          break;
        case "resource":
          router.push({path: "/edu/resource/detail", query: {id: item.topicId}})
          break;
        case "question":
          router.push({path: "/edu/ask/question", query: {id: item.topicId}})
          break;
        case "answer":
          router.push({path: "/edu/ask/question", query: {id: item.topic.question.id}})
          break;
        case "dynamic":
          router.push({path: "/edu/circle/detail", query: {id: item.topic.circleId}})
          break;
        case "news":
          router.push({path: "/edu/news/detail", query: {id: item.topicId}})
          break;
        }
      }
      return {
        topicType,
        commentLike,
        showReply,
        replySubmitCallback,
        delComment,
        goto
      }
    }
  }
</script>

<style lang="scss" scoped>
  .comment-item {
    display: flex;
    align-items: flex-start;
    padding: 20px 32px 20px 30px;
    text-align: left;
    flex-direction: column;
    .comment-item-header {
      display: flex;
      width: 100%;
      overflow: hidden;
      align-items: center;
      font-size: 13px;
      .comment-item-avatar {
        display: inline-block;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex-shrink: 0;
        flex-basis: 28px;
        cursor: pointer;
        margin-right: 8px;
        .byte-avatar {
          display: inline-block;
          position: relative;
          background-color: #c2c6cc;
          white-space: nowrap;
          color: #fff;
          overflow: hidden;
          width: 28px;
          height: 28px;
          line-height: 0;
          .byte-avatar-image {
            display: inline-block;
            img {
              width: 28px;
              height: 28px;
            }
          }
        }
        .byte-avatar-circle {
          border-radius: 100%;
        }
      }
      .comment-item-title {
        color: #666666;
        font-size: 13px;
        white-space: nowrap;
        cursor: pointer;
      }
      .comment-item-header-extra {
        flex: 1;
        color: #999999;
        white-space: nowrap;
        display: flex;
        margin-left: 8px;
        overflow: hidden;
        text-overflow: ellipsis;
        .extra-title {
          color: #666666;
          margin-left: 4px;
          display: flex;
          overflow: hidden;
          text-overflow: ellipsis;
          .comment-item-header-extra-title {
            color: #666666;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            cursor: pointer;
            &:hover {
              color: var(--el-color-primary);
            }
          }
        }
      }
    }
    .comment-item-body {
      width: 100%;
      flex: 1;
      .comment-item-content-wrap {
        display: flex;
        flex-direction: column;
        margin-top: 8px;
        .two-line-wrap {
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          .comment-item-content {
            font-size: 15px;
            line-height: 24px;
            color: #222222;
            display: inline;
          }
        }
      }
      .comment-item-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        .comment-item-timer {
          font-size: 14px;
          line-height: 20px;
          color: #999999;
          white-space: nowrap;
        }
        .comment-item-actions {
          display: flex;
          align-items: center;
          color: #222222;
          .comment-item-actions-item {
            margin-right: 32px;
            cursor: pointer;
            white-space: nowrap;
            height: 20px;
            text-align: right;
            &:hover {
              color: var(--el-color-primary);
            }
            &:last-child {
              margin-right: 0;
            }
            .byte-spin {
              line-height: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              .byte-spin-container {
                display: inline-block;
                position: relative;
                width: 100%;
                .byte-spin-content {
                  position: relative;
                  span,
                  div {
                    display: flex;
                    align-items: center;
                  }
                }
                .byte-spin-content.show-active {
                  color: var(--el-color-primary);
                }
              }
            }
          }
        }
      }
    }
  }
</style>
