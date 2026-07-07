<template>
  <div class="content-container" v-loading="listLoading">
    <div class="msg-list">
      <el-empty v-if="!(list && list.length)"/>
      <template v-for="item in list" :key="item.id">
      <div class="msg-item" v-if="item.member">
        <a class="msg-item-avatar" target="_blank">
          <img :src="item.member.avatar || ''" class="msg-item-avatar-item" v-if="item.member.avatar"/>
        </a>
        <div class="msg-item-content">
          <div class="msg-item-header">
            <span class="msg-item-nickname">
              <a target="_blank">{{item.member.name || ''}}</a>
            </span>
            <span class="msg-item-action">评论了我的{{typeMap[item.topicType]}}</span>
          </div>
          <div class="msg-item-body">
            <a class="msg-related-work msg-item-source" @click="gotoTopic(item)" target="_blank" v-if="item.topic && item.topicType !== 'comment' && item.topicType !== 'answer'">
              <div class="small-cover video" v-if="item.topic && item.topic.image">
                <span class="small-cover-filter" :style="'background-image: url(&quot;'+ item.topic.image +'&quot;);'"></span>
                <img class="small-cover-img" :src="item.topic.image">
                <span class="small-cover-play" v-if="item.topicType === 'channel' || item.topicType === 'lesson'">
                  <el-icon><VideoPlay /></el-icon>
                </span>
              </div>
              <div class="msg-related-work-content">
                <p>
                  <span class="msg-related-work-text">{{item.topic.content}}</span>
                </p>
                <p></p>
              </div>
            </a>
            <a class="msg-related-work msg-item-source" @click="gotoTopic(item)" target="_blank" v-if="item.topic && item.topicType === 'comment'">
              <div class="msg-related-work-content">
                <p>
                  <span class="msg-related-work-tag-text">我的评论：</span>
                  <span class="msg-related-work-text">{{item.topic.content}}</span>
                </p>
                <p></p>
              </div>
            </a>
            <a class="msg-related-work msg-item-source" @click="gotoTopic(item)" target="_blank" v-if="item.topic && item.topicType === 'answer'">
              <div class="msg-related-work-content">
                <p class="msg-related-work-ref-text">{{item.topic.parentTopic.content}}</p>
                <p><span class="msg-related-work-text">答：{{item.topic.content}}</span></p>
              </div>
            </a>
          </div>
          <div class="msg-item-footer">
            <div class="btn-wrap">
              <span class="time">{{item.createTime}}</span>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<script>
import {ref} from "vue"
// VideoPlay icon removed - not used in this component
import {getNoticeList} from "@/api/edu/web/message";
import {getTopicList, gotoTopic} from "@/api/edu/web/topic";

export default {
  name: "noticeLike",
  setup() {
    const typeMap = {
      lesson: "课程",
      channel: "直播",
      comment: "评论",
      resource: "知识库",
      question: "问题",
      answer: "回答",
      circle: "社区",
      article: "文章",
      news: "新闻",
      dynamic: "动态",
    }
    const params = ref({
      current: 1,
      size: 20,
      keyword: "",
      type: "comment"
    })
    const list = ref([])
    const total = ref(0)
    const listLoading = ref(true)
    const loadList = function() {
      listLoading.value = true
      getNoticeList(params.value, res => {
        list.value = res.list;
        total.value = res.total;
        listLoading.value = false
        const topicIdMap = {}
        for (const e of res.list) {
          if (!topicIdMap[e.topicType]) {
            topicIdMap[e.topicType] = []
          }
          topicIdMap[e.topicType].push(e.topicId)
        }
        for (const me in topicIdMap) {
          getTopicList(me, topicIdMap[me], res => {
            for (const r of res) {
              for (const v of list.value) {
                if (v.topicId === r.id && me === v.topicType) {
                  r.content = r.name || r.title || r.content
                  if (r.question) {
                    r.question.content = r.question.title
                    r.parentTopic = r.question
                  }
                  v.topic = r;
                }
              }
            }
            listLoading.value = false
          })
        }
      }).catch(() => {
        listLoading.value = false
      })
    }
    loadList()
    return {
      listLoading,
      list,
      total,
      typeMap,
      gotoTopic
    }
  }
}
</script>

<style lang="scss" scoped>
.content-container {
  .msg-list {
    .msg-item {
      display: flex;
      align-items: stretch;
      padding: 24px 0;
      font-size: 14px;
      line-height: 20px;
      box-shadow: inset 0 -1px 0 #f0f0f0;
      min-width: 0;
      flex: 1 0 calc(100% - 24px);
      margin: 0 12px;
      &:last-child {
        box-shadow: none;
      }
      .msg-item-avatar {
        flex: 0 0 auto;
        width: 20px;
        height: 20px;
        margin-right: 16px;
        position: relative;
        display: block;
        .msg-item-avatar-item {
          width: 100%;
          height: 100%;
          border: 1px solid #f0f0f0;
          border-radius: 50%;
          position: absolute;
          font-size: 20px;
        }
      }
      .msg-item-content {
        flex: 1 1 0;
        min-width: 0;
        .msg-item-header {
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          white-space: nowrap;
          .msg-item-nickname {
            text-overflow: ellipsis;
            overflow-x: hidden;
            flex-shrink: 1;
            margin-right: 8px;
          }
          .msg-item-action {
            flex-shrink: 0;
            color: #666;
            margin-right: 8px;
          }
        }
        .msg-item-body {
          font-size: 16px;
          line-height: 24px;
          margin-bottom: 12px;
          word-break: break-all;
          .msg-item-body {
            font-size: 16px;
            line-height: 24px;
            margin-bottom: 12px;
            word-break: break-all;
          }
          .msg-item-source {
            background: #fafafa;
            margin: 12px 0;
            .msg-related-work-ref-text {
              margin-bottom: 4px;
              color: #666;
              font-size: 12px;
            }
          }
          .msg-related-work {
            border-radius: 6px;
            display: flex;
            align-items: stretch;
            color: #222;
            font-size: 14px;
            line-height: 20px;
            flex: 1;
            min-width: 0;
            .small-cover {
              position: relative;
              overflow: hidden;
              border-radius: 6px;
              border: 1px solid #f0f0f0;
              flex-shrink: 0;
              cursor: pointer;
              width: 48px;
              height: 48px;
              margin-right: -2px;
              .small-cover-filter{
                position: absolute;
                width: 100%;
                height: 100%;
                left: 0;
                filter: blur(12px);
                background-position: 50%;
                background-size: cover;
              }
              .small-cover-img {
                -o-object-fit: contain;
                object-fit: contain;
                position: relative;
                left: 50%;
                transform: translateX(-50%);
                z-index: 1;
                width: auto;
                transition: all .5s ease-out .1s;
                height: 100%;
              }
              .small-cover-play {
                position: absolute;
                left: 50%;
                top: 50%;
                height: 20px;
                width: 20px;
                transform: translate(-50%,-50%);
                background: rgba(0,0,0,.6);
                border-radius: 50%;
                color: #fff;
                font-size: 7px;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: none;
                z-index: 99;
              }
            }
            .msg-related-work-content {
              display: flex;
              flex-direction: column;
              justify-content: space-around;
              white-space: nowrap;
              min-width: 0;
              padding: 14px 16px;
              flex: 1;
              >p {
                overflow-x: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                .msg-related-work-tag-text {
                  color: #666;
                }
              }
            }
          }
        }
        .msg-item-footer {
          margin-top: 12px;
          .btn-wrap {
            display: flex;
            white-space: nowrap;
            .time {
              overflow-x: hidden;
              text-overflow: ellipsis;
              min-width: 0;
              margin-right: 16px;
              color: #666;
              flex: 1 0 0;
            }
          }
        }
      }
    }
  }
}
</style>
