<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></el-input>
          <el-button size="small" class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item label="状态" class="status">
          <el-select size="small" v-model="searchParam.status" @change="search">
            <el-option label="全部" value=""></el-option>
            <el-option label="草稿" value="draft"></el-option>
            <el-option label="已发布" value="published"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
        </el-form-item>
      </el-form>
    </div>
    <div class="content" v-loading="dataLoading">
      <div class="content-list">
        <el-empty v-if="!list || !list.length"/>
        <div class="content-item" v-for="item in list" :key="item.id + ''">
          <div class="content-item-warp">
            <a class="image">
              <img :src="item.image">
            </a>
            <div class="article-card-bone">
              <div class="title-wrap">
                <a class="title">{{item.title}}</a>
                <span class="label create-time">{{item.createTime}}</span>
              </div>
              <div class="abstruct">
                <div class="status">{{statusMap[item.status]}}</div>
                <div class="divider"></div>
                <div class="status" v-if="item.member">
                  <img :src="item.member.avatar" style="width: 20px;vertical-align: text-top;border-radius: 10px;"/>
                  {{item.member.name}}
                </div>
                <div class="status" v-else>
                  未知用户
                </div>
              </div>
              <div class="count-wrapper">
                <ul class="count">
                  <li>下载 {{item.downloadNum || 0}}</li>
                  <li>收藏 {{item.favoriteNum || 0}}</li>
                  <li>点赞 {{item.likeNum || 0}}</li>
                  <li>评论 {{item.commentNum || 0}}</li>
                </ul>
                <div class="article-action-list">
                  <span class="icon-label" @click="downloadView">下载用户</span>
                  <span class="icon-label" @click="commentView(item)">查看评论</span>
                  <span class="icon-label" @click="published(item)">{{item.status === 'published' ? '取消发布' : '发布'}}</span>
                  <span class="icon-label" @click="remove(item)">删除</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <comment-drawer :topic="selectTopic" :show-drawer="drawer" topic-type="resource" :drawer-close="drawerClose"/>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref} from "vue"
  import { resourceApi } from '@/api/edu/admin-api'
const { deleteResource, findList, publishedResource } = resourceApi
  import Page from "@/components/Page/index.vue"
  import {confirm, info, success} from "@/util/tipsUtils";
  const { findCategoryList, toTree } = resourceApi;
  import CommentDrawer from "@/views/edu/admin/comment/commentDrawer.vue";

  export default {
    name: "ResourceList",
  components: {
    CommentDrawer,
    Page
  },
  setup() {
    const statusMap = {
      "draft": "草稿",
      "published": "已发布"
    }
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const searchParam = ref({
      keyword: "",
      status: "",
      cid: "",
      size: 20,
      current: 1
    })
    const selectCidList = ref([])
    const categoryOptions = ref([])
    // 加载列表
    const loadList = () => {
      dataLoading.value = true
      findList(searchParam.value, (res) => {
        dataLoading.value = false
        if (!res) {return;}
        for (const listElement of res.list) {
          listElement.chapterList = [];
        }
        list.value = res.list;
        total.value = res.total;
      })
    }
    loadList();
    // 加载分类
    const loadCategory = () => {
      findCategoryList(0, true, (res) => {if (res) {categoryOptions.value = toTree(res);}})
    }
    loadCategory();
    // 搜索
    const search = () => {
      if (selectCidList.value && selectCidList.value.length > 0) {
        searchParam.value.cid = selectCidList.value[selectCidList.value.length - 1];
      }
      loadList();
    }
    // 删除
    const remove = (item) => {
      confirm("确认删除知识 " + item.title + " 吗？", "提示", () => {
        deleteResource(item.id, () => {
          success("删除成功")
          loadList()
        })
      }, () => {
      })
    }
    const currentChange = (currentPage) => {
      searchParam.value.current = currentPage;
      loadList();
    }
    const sizeChange = (s) => {
      searchParam.value.size = s;
      loadList();
    }
    const selectTopic = ref({})
    const drawer = ref(false)
    const drawerClose = (done) => {
      drawer.value = false
      done()
    }
    const commentView = (item) => {
      drawer.value = true
      selectTopic.value = item
    }
    const published = (item) => {
      const p = {status: "published", id: item.id}
      if(item.status === "published") {
        p.status = "draft"
      }
      publishedResource(p, () => {
        success(item.status === "published" ? "取消发布成功" : "发布成功")
        loadList();
      })
    }
    const downloadView = () => {
      info("敬请期待")
    }
    return {
      list,
      total,
      searchParam,
      search,
      currentChange,
      sizeChange,
      remove,
      commentView,
      selectTopic,
      drawer,
      drawerClose,
      statusMap,
      selectCidList,
      categoryOptions,
      published,
      downloadView,
      dataLoading
    };
  }
};
</script>

<style scoped lang="scss">
  .app-container {
    margin: 20px;
    .content-list {
      margin: 0;
      padding: 0;
      border: 0;
      font: inherit;
      vertical-align: baseline;
      .content-item {
        padding: 24px 12px;
        line-height: 1;
        font-size: 14px;
        color: #666;
        border-bottom: 1px solid #e8e8e8;
        position: relative;
        background: #ffffff;
        &:last-child {
          border-bottom: 0;
        }
        .content-item-warp {
          position: relative;
          display: flex;
          .image {
            width: 168px;
            min-width: 168px;
            height: 108px;
            margin-right: 24px;
            position: relative;
            overflow: hidden;
            border-radius: 4px;
            border: 1px solid #e8e8e8;
            img {
              width: 100%;
              height: 100%;
              transition: all .5s ease-out .1s;
              -o-object-fit: cover;
              object-fit: cover;
              -o-object-position: center;
              object-position: center;
              &:hover {
                transform: matrix(1.04,0,0,1.04,0,0);
                -webkit-backface-visibility: hidden;
                backface-visibility: hidden;
              }
            }
          }
          .article-card-bone {
            width: 100%;
            display: flex;
            flex-direction: column;
            min-width: 0;
            .title-wrap {
              display: flex;
              justify-content: space-between;
              margin-top: 0;
              .title {
                font-size: 16px;
                overflow: hidden;
                white-space: nowrap;
                text-overflow: ellipsis;
                line-height: 24px;
                font-weight: 600;
                display: block;
                color: #222;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
              .create-time {
                color: #999;
                line-height: 24px;
                margin-left: 12px;
                flex-shrink: 0;
              }
            }
            .abstruct {
              line-height: 20px;
              margin-top: 20px;
              height: 20px;
              display: flex;
              align-items: flex-end;
              .status {
                color: #999;
                border: none;
                background-color: #f5f5f5;
                padding: 0 8px;
                line-height: 20px;
                font-size: 12px;
                border-radius: 2px;
                white-space: nowrap;
                display: inline-block;
                box-sizing: border-box;
                transition: all .3s;
                margin-right: 8px;
              }
              .article-card .byte-tag-simple {
                margin-right: 8px;
              }
              .divider {
                width: 1px;
                height: 12px;
                margin: 4px 10px 4px 4px;
                background: #bfbfbf;
              }
              .icon {
                margin-right: 8px;
                svg {
                  vertical-align: bottom;
                  &:focus {
                    outline: none;
                  }
                }
              }
            }
            .count-wrapper {
              margin-top: 24px;
              display: flex;
              justify-content: space-between;
              .count {
                line-height: 20px;
                position: relative;
                li {
                  display: inline-block;
                  margin-right: 24px;
                  &:after {
                    content: "\ff65";
                    font-size: 20px;
                    margin: 0 8px;
                    line-height: 0;
                    position: absolute;
                    top: 10px;
                    color: #666;
                  }
                  &:last-child:after {
                    content: ""
                  }
                }
              }
              .article-action-list {
                display: flex;
                line-height: 20px;
                flex: 1 0 auto;
                justify-content: flex-end;
                .icon-label {
                  cursor: pointer;
                  font-size: 14px;
                  line-height: 20px;
                  display: flex;
                  color: #222;
                  font-weight: 400;
                  margin-left: 24px;
                  &:first-child {
                    margin-left: 0;
                  }
                  &:hover {
                    color: var(--el-color-primary);
                  }
                }
              }
            }
          }
        }
      }
    }
    .search-input {
      width: 242px;
    }
  }
</style>
