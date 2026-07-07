<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="article"/>
      </el-col>
      <el-col :span="20">
        <div class="article-box" v-if="articleList">
          <el-tabs v-model="activeTabName" @tab-click="tabClickHandle">
            <el-tab-pane label="我的文章" name="first" v-loading="articleLoading">
              <el-empty v-if="!articleList || !articleList.length"/>
              <div class="card" v-for="item in articleList" :key="item.id" @click="goto('/edu/article/detail', item.id)">
                <h2 class="title">{{item.title}}</h2>
                <span class="time">{{item.createTime}}</span>
                <div class="content">
                  <div class="cover" v-if="item.image.trim()">
                    <div class="cover-inner">
                      <img :src="item.image"/>
                    </div>
                  </div>
                  <div class="inner">
                    <div class="rich-text">
                      <p v-html="item.content"></p>
                    </div>
                    <el-button link class="more">阅读全文</el-button>
                  </div>
                </div>
                <div class="actions">
                  <el-button link class="action"><el-icon><View /></el-icon> 浏览 {{item.watchNum || 0}} </el-button>
                  <el-button link class="action"><el-icon><Pointer /></el-icon> 点赞 {{item.likeNum || 0}} </el-button>
                  <el-button link class="action"><el-icon><ChatDotRound /></el-icon> 评论 {{item.commentNum || 0}}</el-button>
                  <el-button link class="action"><el-icon><Star /></el-icon> 收藏 {{item.favoriteNum || 0}} </el-button>
                  <el-button link class="action float-right" @click.stop="deleteArticle(item)">删除</el-button>
                  <el-button link class="action float-right" @click.stop="edit(item)">编辑</el-button>
                </div>
              </div>
              <page style="padding: 20px;" :total="total" :page-size="params.size" :current-change="currentChange" :size-change="sizeChange"></page>
              <article-edit :item="selectArticle" v-if="dialogVisible" v-model="dialogVisible" :cancel-callback="cancelArticleDialog" :submit-callback="submitArticle"/>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {inject, ref} from "vue"
import MemberMenu from "@/views/edu/web/member/menu";
import {getMemberArticleList, removeArticle} from "@/api/edu/web/content/article";
import ArticleEdit from "@/views/edu/web/article/edit";
import {confirm, success} from "@/util/tipsUtils";
import Page from "@/components/Page";
import router from "@/router";
import {getToken} from "@/util/tokenUtils";
export default {
  name: "MemberArticleIndex",
  components: {
    Page,
    ArticleEdit,
    MemberMenu
  },
  setup() {
    const showLoginFlag = inject("showLogin")
    const showLoginClose = inject("showLoginClose")
    if (!getToken()) {
      showLoginFlag.value = true
      showLoginClose.value = false
      return
    }
    const activeTabName = "first"
    const tabClickHandle = (tab, event) => {
    }
    const params = ref({
      current: 1,
      size: 20
    })
    const articleLoading = ref(true)
    const articleList = ref([])
    const total = ref(0)
    const loadArticleList = () => {
      articleLoading.value = true
      getMemberArticleList(params.value, res => {
        articleList.value = res.list
        total.value = res.total
        articleLoading.value = false
      })
    }
    loadArticleList()
    const dialogVisible = ref(false)
    const cancelArticleDialog = () => {
      dialogVisible.value = false
    }
    const submitArticle = () => {
      dialogVisible.value = false
      params.value.current = 1
      loadArticleList();
    }
    const selectArticle = ref({})
    const edit = (item) => {
      selectArticle.value = item
      dialogVisible.value = true
    }
    const deleteArticle = (item) => {
      confirm("确认删除文章 " + item.title + " 吗？", "提示", () => {
        removeArticle(item.id, () => {
          success("删除成功")
          loadArticleList()
        })
      }, () => {
      })
    }
    const currentChange = (currentPage) => {
      params.value.current = currentPage;
      loadArticleList();
    }
    const sizeChange = (s) => {
      params.value.size = s;
      loadArticleList();
    }
    const goto = (path, id) => {
      if (id) {
        router.push({ path: path, query: { id: id } })
      } else {
        router.push({ path })
      }
    }
    const toggleMore = (item) => {
      item.showMore = !item.showMore
    }
    return {
      articleList,
      activeTabName,
      params,
      total,
      tabClickHandle,
      articleLoading,
      dialogVisible,
      cancelArticleDialog,
      submitArticle,
      selectArticle,
      edit,
      deleteArticle,
      currentChange,
      sizeChange,
      goto,
      toggleMore
    }
  }
}
</script>

<style scoped lang="scss">
.content-container{
  .article-box {
    background-color: #FFFFFF;
    margin: 20px;
    :deep(.el-tabs__nav-scroll) {
      padding: 0 20px;
    }
    :deep(.el-tabs__nav-wrap:after) {
      height: 0;
    }
    .card {
      background: #fff;
      box-sizing: border-box;
      border-radius: 0;
      overflow: visible;
      overflow: initial;
      position: relative;
      padding: 20px;
      margin-bottom: 0;
      -webkit-box-shadow: none;
      box-shadow: none;
      border-bottom: 1px solid #f0f2f7;
      cursor: pointer;
      &:first-child {
        padding-top: 0;
        .time {
          top: 0;
        }
      }
      &:hover {
        .title {
          color: var(--el-color-primary);
        }
      }
      .title {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.9;
        color: #121212;
        margin-top: -4px;
        margin-bottom: -4px;
        cursor: pointer;
        width: calc(100% - 142px);
        &:hover {
          color: var(--el-color-primary);
        }
      }
      .time {
        position: absolute;
        top: 20px;
        right: 20px;
        color: #999;
      }
      .content {
        cursor: pointer;
        transition: color .14s ease-out;
        line-height: 1.97;
        .cover {
          position: relative;
          width: 190px;
          height: 105px;
          margin-top: -2px;
          margin-right: 18px;
          margin-bottom: 4px;
          float: left;
          overflow: hidden;
          background-position: 50%;
          background-size: cover;
          border-radius: 6px;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          .cover-inner {
            position: absolute;
            top: 50%;
            left: 0;
            height: 100%;
            width: 100%;
            -webkit-transform: translateY(-50%);
            transform: translateY(-50%);
            overflow: hidden;
            img {
              position: absolute;
              top: 50%;
              left: 50%;
              height: 100%;
              width: 100%;
              -o-object-fit: cover;
              object-fit: cover;
              -webkit-transform: translate3d(-50%,-50%,0);
              transform: translate3d(-50%,-50%,0);
            }
          }
          &:after {
            content: "";
            position: absolute;
            z-index: 1;
            display: block;
            width: 100%;
            height: 100%;
            background: rgba(18,18,18,.02);
          }
        }
        .inner {
          margin-bottom: -4px;
          overflow: hidden;
          max-height: 100px;
          margin-top: 16px;
          .rich-text {
            pointer-events: none;
            line-height: 1.9;
            cursor: pointer;
            display: -webkit-box;
            white-space: normal;
            word-break: break-word;
            -webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .more {
            display: inline-block;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
            margin-left: 4px;
            color: #175199;
            height: auto;
            padding: 0;
            line-height: inherit;
            background-color: transparent;
            border: none;
            border-radius: 0;
          }
          .more {
            float: right;
            margin-top: -26px;
            position: relative;
            background: #fff;
            &::after {
              content: "";
              position: absolute;
              display: block;
              top: 0;
              left: -30px;
              width: 30px;
              height: 100%;
              background: linear-gradient(
                      270deg, #fff, hsla(0, 0%, 100%, .2));
            }
          }
        }
        &:hover {
          .inner {
            .more {
              color: var(--el-color-primary);
            }
          }
        }
      }
      .show-more {
        .inner {
          height: auto;
          max-height: none;
          .rich-text {
            -webkit-line-clamp: inherit;
          }
        }
      }
      .actions {
        align-items: center;
        padding: 10px 20px;
        margin: 0 -20px -10px;
        color: #646464;
        clear: both;
        background: #fff;
        .action {
          margin-left: 24px;
          font-size: 14px;
          color: #646464;
          cursor: text;
          &:first-child {
            margin-left: 0;
          }
        }
        .float-right {
          float: right;
          cursor: pointer;
          &:hover {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .answer-item {
      .content {
        .inner {
          max-height: 52px;
          .rich-text {
            -webkit-line-clamp: 2;
          }
        }
      }
    }
  }
}
</style>
