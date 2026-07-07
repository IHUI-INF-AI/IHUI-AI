<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="favorites"/>
      </el-col>
      <el-col :span="20">
        <div class="favorites-container" v-if="activeTabName">
          <el-tabs v-model="activeTabName" @tab-click="tabChangeHandle">
            <el-empty v-if="!typeList || !typeList.length"/>
            <el-tab-pane :label="typeMap[type]" :name="type" v-for="type in typeList" :key="type">
              <el-empty v-if="!itemList || !itemList.length"/>
              <div class="favorites-list">
                <div class="favorites-card" v-for="item in itemList" :key="item.id">
                  <a v-if="item.image && item.image.trim()" target="_blank" @click="gotoTopic(item)" class="favorites-cover">
                    <img :src="item.image" :alt="item.name" class="">
                    <div class="tag-wrapper"></div>
                  </a>
                  <div class="favorites-meta">
                    <div class="meta-title">
                      <a target="_blank" @click="gotoTopic(item)"   class="name ellipsis">
                        {{item.name || item.title || item.content}}
                      </a>
                    </div>
                    <div class="meta-status">
                      <div>
                        <span class="pubdate is-success">{{item.createTime}}</span>
                      </div>
                    </div>
                    <div class="meta-view">
                      <el-button @click="delFavorite(item.id)">取消收藏</el-button>
                    </div>
                    <div class="meta-footer">
                      <div title="播放" class="view-stat">
                        <el-icon><VideoPlay /></el-icon> 播放
                        <span class="icon-text click-text">{{item.learnNum || 0}}</span>
                      </div>
                      <div title="点赞" class="view-stat">
                        <el-icon><Pointer /></el-icon> 点赞
                        <span class="icon-text">{{item.likeNum || 0}}</span>
                      </div>
                      <div title="收藏" class="view-stat">
                        <el-icon><Star /></el-icon> 收藏
                        <span class="icon-text">{{item.favoriteNum || 0}}</span>
                      </div>
                      <div title="评论" class="view-stat">
                        <el-icon><ChatLineRound /></el-icon> 评论
                        <span class="icon-text">{{item.commentNum || 0}}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
          <div class="page-bar">
            <page :size-change="sizeChange" :current-change="currentChange" :current-page="param.current" :page-size="param.size" :total="total"/>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref, markRaw} from "vue"
import {ChatLineRound} from '@/lib/lucide-fallback'
  import memberMenu from "../menu/index.vue"
  import {deleteFavorite, getFavoriteTypeList, getMemberFavoritePageList} from "@/api/edu/web/comment/favorite"
  import {getTopicList, gotoTopic} from "@/api/edu/web/topic"
  import {success} from "@/util/tipsUtils";
  import Page from "@/components/Page/index";
import {getToken} from "@/util/tokenUtils";
  export default {
    name: "memberFavorite",
    components: {
      Page,
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
      const activeTabName = ref("");
      const typeList = ref([])
      getFavoriteTypeList(res => {
        typeList.value = res
        activeTabName.value = res[0]
      })
      const param = ref({
        current: 1,
        size: 10,
        topicType: "lesson"
      })
      const total = ref(0)
      const itemList = ref([])
      const load = () => {
        getMemberFavoritePageList(param.value, res => {
          total.value = res.total
          const topicIdList = []
          for (const e of res.list) {
            topicIdList.push(e.topicId)
          }
          if (topicIdList && topicIdList.length) {
            getTopicList(param.value.topicType, topicIdList, res => {
              for (const e of res) {
                e.topicId = e.id
                e.topicType = param.value.topicType
              }
              itemList.value = res
            })
          } else {
            itemList.value = []
          }
        })
      }
      load()
      const sizeChange = (val) => {
        param.value.size = val;
        load();
      }
      const currentChange = (val) => {
        param.value.current = val;
        load();
      }
      const delFavorite = (id) => {
        deleteFavorite({topicId: id, topicType: "lesson"}, () => {
          success("取消收藏成功")
          load()
        })
      }
      const tabChangeHandle = function(tab) {
        param.value.topicType = tab.paneName
        load()
      }
      return {
        param,
        total,
        itemList,
        sizeChange,
        currentChange,
        delFavorite,
        typeList,
        typeMap,
        activeTabName,
        tabChangeHandle,
        gotoTopic,
        ChatLineRound: markRaw(ChatLineRound)
      }
    }
  }
</script>

<style lang="scss" scoped>
  .el-icon-chat-line-square {
    font-size: 100px;
  }
  .favorites-container {
    background-color: #FFFFFF;
    margin: 20px 0;
    :deep(.el-tabs--top .el-tabs__item.is-top:nth-child(2)) {
      padding-left: 20px;
    }
    :deep(.el-tabs__nav-wrap:after) {
      height: 0;
    }
  }
  .favorites-list {
    padding: 0 20px;
    .favorites-card {
      border-bottom: 1px solid #e7e7e7;
      position: relative;
      width: 100%;
      min-height: 96px;
      border-radius: 6px;
      background: #fff;
      padding: 24px 0;
      margin-bottom: 0;
      -webkit-box-sizing: inherit;
      box-sizing: inherit;
      .favorites-cover {
        position: relative;
        float: left;
        border-radius: 6px;
        overflow: hidden;
        width: 154px;
        height: 96px;
        margin-right: 24px;
        -webkit-box-sizing: inherit;
        box-sizing: inherit;
        img {
          width: 100%;
          height: 100%;
          border-radius: 6px;
          -webkit-box-sizing: inherit;
          box-sizing: inherit;
          border-style: none;
        }
        .duration {
          position: absolute;
          bottom: 0;
          right: 0;
          height: 20px;
          line-height: 20px;
          padding: 0 4px;
          color: #fff;
          background: rgba(0,0,0,.5);
          border-radius: 6px 0 6px 0;
          -webkit-box-sizing: inherit;
          box-sizing: inherit;
        }
        .tag {
          display: -webkit-box;
          display: -webkit-flex;
          display: -ms-flexbox;
          display: flex;
          -webkit-box-orient: horizontal;
          -webkit-box-direction: reverse;
          -webkit-flex-direction: row-reverse;
          -ms-flex-direction: row-reverse;
          flex-direction: row-reverse;
          top: 4px;
          right: 4px;
          position: absolute;
          -webkit-box-sizing: inherit;
          box-sizing: inherit;
        }
      }
      .meta-title {
        height: 24px;
        line-height: 24px;
        -webkit-box-sizing: inherit;
        box-sizing: inherit;
        a {
          text-decoration: none;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: inline-block;
          max-width: 420px;
          font-size: 16px;
          color: #212121;
          line-height: 20px;
          vertical-align: middle;
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
      .meta-status {
        padding: 16px 0 20px 0;
        font-size: 14px;
        color: #505050;
        line-height: 16px;
        display: -webkit-box;
        display: -webkit-flex;
        display: -ms-flexbox;
        display: flex;
        -webkit-box-sizing: inherit;
        box-sizing: inherit;
        .pubdate {
          display: inline-block;
          font-weight: 400;
          vertical-align: middle;
          font-size: 14px;
          line-height: 16px;
          padding-right: 24px;
          -webkit-box-sizing: inherit;
          box-sizing: inherit;
        }
      }
      .meta-view {
        position: absolute;
        top: 50%;
        margin-top: -16px;
        color: #99a2aa;
        right: 0;
        display: -webkit-box;
        display: -webkit-flex;
        display: -ms-flexbox;
        display: flex;
        -webkit-box-sizing: inherit;
        box-sizing: inherit;
        .bili-btn {
          display: inline-block;
          text-align: center;
          cursor: pointer;
          display: -webkit-box;
          display: -webkit-flex;
          display: -ms-flexbox;
          display: flex;
          width: 84px;
          height: 32px;
          -webkit-box-align: center;
          -webkit-align-items: center;
          -ms-flex-align: center;
          align-items: center;
          border: 1px solid #e7e7e7;
          border-radius: 2px;
          font-size: 14px;
          color: #505050;
          line-height: 18px;
          padding: 0;
          -webkit-box-pack: center;
          -webkit-justify-content: center;
          -ms-flex-pack: center;
          justify-content: center;
          margin-right: 12px;
          -webkit-box-sizing: inherit;
          box-sizing: inherit;
        }
      }
      .meta-footer {
        position: relative;
        font-size: 16px;
        -webkit-box-sizing: inherit;
        box-sizing: inherit;
        .view-stat {
          display: inline-block;
          float: left;
          color: #99a2aa;
          display: -webkit-box;
          display: -webkit-flex;
          display: -ms-flexbox;
          display: flex;
          -webkit-box-align: center;
          -webkit-align-items: center;
          -ms-flex-align: center;
          align-items: center;
          margin-right: 25px;
          -webkit-box-sizing: inherit;
          box-sizing: inherit;
          .icon-text {
            vertical-align: top;
            margin-left: 5px;
            -webkit-box-sizing: inherit;
            box-sizing: inherit;
          }
        }
      }
      .favorites-meta {
        float: left;
        -webkit-box-sizing: inherit;
        box-sizing: inherit;

      }
    }
    .favorites-card:last-child {
      border-bottom: 0;
    }
  }
  .page-bar {
    padding: 20px;
  }
</style>
