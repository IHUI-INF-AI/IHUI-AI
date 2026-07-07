<template>
  <div class="content-container">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/'}">首页</el-breadcrumb-item>
      <el-breadcrumb-item>{{'搜索'}}</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="search-input-wrap">
      <div class="search-input-main">
        <el-input v-model="param.word" placeholder="输入关键词进行搜索">
          <template #append>
            <el-button :icon="Search" @click="searchFn" />
          </template>
        </el-input>
      </div>
    </div>
    <div class="content-tips">
      共找<span class="primary-color">{{total}}</span> " <span class="primary-color">{{param.word}}</span> " 相关内容
    </div>
    <el-row :gutter="20" class="row">
      <el-col :span="18">
        <div class="content" v-if="showResultFlag">
          <div class="content-tags">
            <el-tabs v-model="activeTabName" @tab-click="tabChangeHandle">
              <el-tab-pane :label="typeMap[type]" :name="type" v-for="type in typeList" :key="type"/>
            </el-tabs>
          </div>
          <div class="content-list" v-loading="itemListLoading" :style="'min-height: ' + clientHeight + 'px;'">
            <el-empty v-if="!itemList || !itemList.length" :style="'min-height: ' + clientHeight + 'px;'"/>
            <div v-else class="search-item" v-for="item in itemList" :key="item.id">
              <div class="search-item-header" v-if="item.topic">
                <div class="search-item-type" :style="'background:' + typeColorMap[item.topicType] + ';'">
                  {{typeMap[item.topicType]}}
                </div>
                <div class="search-item-title">
                  <a target="_blank" @click="gotoTopic(item)">
                    <div v-html="item.topic.title"></div>
                  </a>
                </div>
              </div>
              <div class="search-item-body" v-if="item.topic">
                <a class="img-box" v-if="item.topic.image && item.topic.image.trim()">
                  <img :src="item.topic.image" :alt="item.topic.title">
                </a>
                <div class="content-box">
                  <div class="desc" v-html="item.topic.description" :style="item.topic.tags ? '-webkit-line-clamp: 3;height: 66px;' : ''"></div>
                  <div class="tags">
                    <div class="tag" v-for="tag in item.topic.tags" :key="tag">{{tag}}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="itemList && itemList.length">
            <page class="page-bar" :total="total" @size-change="sizeChange" @current-change="currentChange" :current-page="param.current" :page-size="param.size"/>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="hot-search" v-if="hotSearchList && hotSearchList.length">
          <h5 class="title">热门搜索</h5>
          <div class="hot-word-list" v-loading="hotSearchListLoading">
            <el-empty v-if="!hotSearchList || !hotSearchList.length"/>
            <div v-else class="hot-word-item" v-for="(item, index) in hotSearchList" :key="index">
              <span class="order">{{index + 1}}</span>
              <router-link :title="item.name" target="_blank" class="hot-word-text" :to="{path:'/search', query:{keyword: item.name}}">
                <span class="hot-word">{{item.name}}</span>
              </router-link>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {ref, watch} from "vue"
import Page from "@/components/Page/index";
import {useRoute} from "vue-router";
import {getHotWordList, getSearchContentList, getSearchTypeList} from "@/api/edu/web/search";
import {getTopicList, gotoTopic} from "@/api/edu/web/topic";
import {Search, ArrowRight} from '@/lib/lucide-fallback';
import {markRaw} from "vue";

export default {
    name: "searchList",
    computed: {
      Search() {
        return Search
      }
    },
    components: { Page},
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight);
      const route = useRoute()
      watch(() => route.query.keyword, () => {
        window.location.reload();
      })
      const activeTabName = ref("all")
      const typeList = ref(["all"])
      const typeMap = {
        all: "综合",
        lesson: "课程",
        channel: "直播",
        article: "文章",
        news: "新闻",
        resource: "资源",
        circle: "社区",
        question: "问题",
        member: "会员"
      }
      const typeColorMap = {
        lesson: "#07c160",
        channel: "#2a2b3d",
        article: "#1f5869",
        news: "#3ab2ba",
        resource: "#5f383c",
        circle: "#81b446",
        question: "#c13261",
        member: "#d7b799"
      }
      getSearchTypeList(res => {
        typeList.value.push(...res)
      })
      const hotParams = {
        current: 1,
        size: 10
      }
      const hotSearchList = ref([])
      const hotSearchListLoading = ref(true)
      getHotWordList(hotParams, res => {
        hotSearchListLoading.value = false
        hotSearchList.value = res.list
      }).catch(() => {
        hotSearchListLoading.value = false
      })
      const param = ref({
        word: "",
        current: 1,
        size: 10,
        topicType: ""
      })
      param.value.word = route.query.keyword
      const itemListLoading = ref(true)
      const itemList = ref([])
      const total = ref(0)
      const load = function() {
        if (!param.value.word) {
          itemListLoading.value = false;
          return;
        }
        itemListLoading.value = true
        getSearchContentList(param.value, res => {
          const keywords = res.keywords
          itemList.value = res.list
          total.value = res.total
          if (!(res.list && res.list.length)) {
            itemListLoading.value = false
            return;
          }
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
                for (const v of itemList.value) {
                  if (v.topicId === r.id && me === v.topicType) {
                    r.title = r.name || r.title || r.content
                    r.description = r.phrase || r.description || r.introduction || r.content

                    // 格式化关键词
                    if (keywords && keywords.length) {
                      let subFlag = true;
                      for (let i = 0; i < keywords.length; i++) {
                        const k = keywords[i];
                        if (!k) {
                          continue;
                        }
                        r.title = r.title.replaceAll(k, "<span style='color: red;'>" + k + "</span>")
                        const subIndex = r.description.indexOf(k)
                        if (subIndex > -1 && subFlag) {
                          subFlag = false;
                          const firstLength = r.description.substring(0, subIndex).length
                          if (firstLength > 10) {
                            r.description = "..." + r.description.substring(subIndex - 4, r.description.length)
                          }
                        }
                        r.description = r.description.replaceAll(k, "<span style='color: red;'>" + k + "</span>")
                      }
                    }

                    if (r.tags && r.tags.length) {
                      r.tags = r.tags.split(",");
                    }
                    if (r.question) {
                      r.parentTopic = r.question
                    }
                    v.topic = r;
                  }
                }
              }
              itemListLoading.value = false
            })
          }
        }).catch(() => {
          itemListLoading.value = false
        })
      }
      load()
      const tabChangeHandle = (value) => {
        if (value.paneName === "all") {
          param.value.topicType = ""
        } else {
          param.value.topicType = value.paneName;
        }
        load()
      }
      const sizeChange = function(val) {
        param.value.size = val;
        load();
      }
      const currentChange = function(val) {
        param.value.current = val;
        load();
      }
      let clientHeight = document.documentElement.clientHeight - 288;
      if (clientHeight < 600) {
        clientHeight = 600;
      }
      const showResultFlag = ref(false)
      const searchFn = function () {
        showResultFlag.value = true
        param.value.current = 1;
        load()
      }
      return {
        activeTabName,
        typeList,
        typeMap,
        tabChangeHandle,
        hotSearchListLoading,
        hotSearchList,
        itemListLoading,
        itemList,
        param,
        total,
        sizeChange,
        currentChange,
        clientHeight,
        gotoTopic,
        typeColorMap,
        searchFn,
        showResultFlag,
        ArrowRight: ArrowRightIcon
      }
    }
  }
</script>

<style lang="scss" scoped>
  .content-container {
    padding-top: 20px;
    margin: 0 10px;
    .search-input-wrap {
      width: 588px;
      margin-bottom: 10px;
      margin-top: 20px;
      .search-input-main {
        .el-input {
          height: 42px;
          display: -webkit-flex;
          display: flex;
          -webkit-justify-content: space-between;
          justify-content: space-between;
          -webkit-align-items: center;
          align-items: center;
          :deep(.el-input__wrapper) {
            display: inline-block;
            outline: none;
            .el-input__inner {
              height: 40px;
            }
          }
          :deep(.el-input__wrapper.is-focus) {
            box-shadow: 0 0 0 1px var(--el-input-border-color,var(--el-border-color)) inset;
          }
          :deep(.el-input-group__append) {
            background-color: var(--el-color-primary);
            color: #FFFFFF;
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 100%;
            border-radius: var(--el-input-border-radius);
            padding: 0;
            white-space: nowrap;
            border-left: 0;
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
            box-shadow: 0 1px 0 0 var(--el-color-primary) inset,0 -1px 0 0 var(--el-color-primary) inset,-1px 0 0 0 var(--el-color-primary) inset;
            width: 72px;
          }
        }
      }
    }
    .content-tips {
      width: 100%;
      margin-top: 20px;
      margin-bottom: 10px;
      color: #666666;
      font-size: 12px;
      display: none;
      .primary-color {
        color: var(--el-color-primary);
      }
    }
    .content {
      background-color: #FFFFFF;
      border-radius: 6px;
      :deep(.el-tabs__item.is-top) {
        padding: 0 10px;
      }
      :deep(.el-tabs__nav-wrap:after) {
        height: 0;
      }
      .content-list {
        background-color: #FFFFFF;
        .content-item {
          margin: 0 0 20px 0;;
        }
      }
    }
    .search-item {
      border-bottom: 1px solid #f5f5f5;
      position: relative;
      background: #fff;
      padding: 15px 10px;
      margin-bottom: 0;
      -webkit-box-sizing: inherit;
      box-sizing: inherit;
      &:last-child {
        border-bottom: 0;
      }
      .search-item-header {
        line-height: 24px;
        .search-item-type {
          line-height: 24px;
          display: inline-block;
          padding: 0 8px;
          background: var(--el-color-primary);
          border-radius: 6px;
          color: #fff;
          font-size: 12px;
          margin-right: 10px;
        }
        .search-item-title {
          line-height: 24px;
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: inline-block;
          font-size: 16px;
          color: #212121;
          vertical-align: middle;
          max-width: calc(100% - 60px);
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
      .search-item-body {
        width: 100%;
        display: flex;
        margin-top: 10px;
        .img-box {
          position: relative;
          float: left;
          border-radius: 6px;
          overflow: hidden;
          width: 160px;
          height: 90px;
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
        }
        .content-box {
          position: relative;
          font-size: 16px;
          -webkit-box-sizing: inherit;
          box-sizing: inherit;
          width: calc(100% - 32px);
          .desc {
            overflow: hidden;
            text-overflow: ellipsis;
            -webkit-box-orient: vertical;
            display: -webkit-box;
            -webkit-line-clamp: 4;
            font-size: 12px;
            color: #666666;
            line-height: 22px;
            :deep(img) {
              display: none;
            }
          }
          .tags {
            .tag {
              padding: 0 8px;
              background: #f1f1f1;
              display: inline-block;
              margin-right: 10px;
              border-radius: 10px;
              color: #666666;
              font-size: 12px;
            }
          }
        }
      }
    }
    .hot-search {
      background: #fff;
      padding: 15px;
      border-radius: 6px;
      .title {
        color: #000;
        font-size: 18px;
        margin-bottom: 10px;
      }
      .hot-word-list {
        .hot-word-item {
          margin: 10px 0;
          display: inline-flex;
          width: 100%;
          .hot-word-text {
            height: 22px;
            line-height: 22px;
            font-size: 16px;
            color: #000;
            width: calc(100% - 30px);
            &:hover{
              color: var(--el-color-primary);
            }
            .hot-word {
              overflow: hidden;
              width: 100%;
              -o-text-overflow: ellipsis;
              text-overflow: ellipsis;
              white-space: nowrap;
              display: inherit;
            }
          }
          .order {
            width: 20px;
            text-align: center;
            margin-right: 10px;
            border-radius: 6px;
            background: gray;
            color: #ffffff;
          }
          &:nth-child(2) {
            .order {
              color: #ffffff;
              background: red;
            }
          }
          &:nth-child(3) {
            .order {
              color: #ffffff;
              background: pink;
            }
          }
          &:nth-child(4) {
            .order {
              color: #ffffff;
              background: green;
            }
          }
        }
      }
    }
    .page-bar {
      padding: 10px 0 20px;
    }
  }
</style>
