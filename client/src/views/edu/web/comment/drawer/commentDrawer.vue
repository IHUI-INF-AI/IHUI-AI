<template>
  <el-drawer custom-class="custom-drawer" :size="'50%'" :withHeader="false" v-model="dialogModel" direction="rtl" :before-close="drawerClose" destroy-on-close>
    <template #title>
      <div class="work-item-box">
        <div v-if="topic.image && topic.image.trim()" class="item-cover" :style="'background-image: url(&quot;' + topic.image + '&quot;);'"></div>
        <div class="item-content">
          <div class="content-main">
            <div class="main-title">
              <div class="title-box two-line">
                <span class="title-text">{{topic.name || topic.title || topic.content}}</span>
              </div>
            </div>
          </div>
          <div class="content-info">
            <span class="info-item">{{typeMap[topicType]}}</span>
            <span class="info-item">{{topic.createTime}}</span>
          </div>
        </div>
      </div>
    </template>
    <div class="topic-comment-list-wrapper">
      <comment-list :topic-type="topicType" :topic-id="topic.id"/>
    </div>
  </el-drawer>
</template>

<script>
  import CommentList from "@/views/edu/web/comment/list";
  import {computed} from "vue";
  export default {
    name: "commentDrawer",
    components: {
      CommentList
    },
    props: {
      topic: {
        type: Object,
        required: true
      },
      topicType: {
        type: String,
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
      const typeMap = {
        channel: "直播",
        lesson: "课程",
        news: "新闻",
        article: "文章",
        question: "问题",
        answer: "回答",
        dynamic: "动态",
        resource: "知识库"
      }
      return {
        typeMap,
        dialogModel
      }
    }
  }
</script>

<style lang="scss">
  .custom-drawer {
    margin-top: 60px;
    height: calc(100% - 60px);
    box-shadow: none;
    padding-top: 20px;
    .el-drawer__header {
      align-items: end;
    }
    &:focus {
      outline: none;
    }
    .el-drawer__close-btn {
      &:focus {
        outline: none;
      }
      &:hover {
        color: var(--el-color-primary);
      }
    }
    .work-item-box {
      margin: 0;
      border: 0;
      font: inherit;
      vertical-align: baseline;
      display: flex;
      align-items: center;
      width: 100%;
      border-bottom: none;
      .item-cover {
        position: relative;
        width: 80px;
        height: 80px;
        margin-right: 16px;
        border-radius: 6px;
        border: 1px solid #f0f0f0;
        cursor: pointer;
        background-repeat: no-repeat;
        background-size: cover;
        background-position: 50%;
      }
      .item-content {
        overflow: hidden;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 80px;
        .content-main {
          .main-title {
            .title-box {
              flex: 1 0 0;
              display: -webkit-box;
              overflow: hidden;
              text-overflow: ellipsis;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              white-space: normal;
              word-break: break-word;
              word-wrap: break-word;
              .title-text {
                line-height: 24px;
                font-size: 16px;
                color: #222;
                cursor: pointer;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
            }
          }
        }
        .content-info {
          font-size: 12px;
          line-height: 16px;
          color: #999;
          .info-item {
            margin-right: 8px;
          }
        }
      }
    }
    .topic-comment-list-wrapper {
      margin: 0 20px;
    }
  }
</style>
