<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="form-inline">
        <el-form-item label="">
          <el-input size="small" @keydown.enter="search" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字">
            <template #suffix>
              <el-icon class="el-input__icon search-btn" @click="search"><Search /></el-icon>
            </template>
          </el-input>
        </el-form-item>
<!--        <el-form-item label="状态" class="select">-->
<!--          <el-select size="small" v-model="searchParam.status" @change="search">-->
<!--            <el-option label="全部" value=""></el-option>-->
<!--            <el-option label="未发布" value="unpublished"></el-option>-->
<!--            <el-option label="已发布" value="published"></el-option>-->
<!--            <el-option label="已删除" value="deleted"></el-option>-->
<!--          </el-select>-->
<!--        </el-form-item>-->
        <el-form-item label="分类" class="select">
          <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
        </el-form-item>
<!--        <el-form-item v-if="!isComponent">-->
<!--          <el-button size="small" type="primary" @click="edit()">-->
<!--            <el-icon style="vertical-align: middle">-->
<!--              <Plus />-->
<!--            </el-icon>-->
<!--            <span style="vertical-align: middle">新增</span>-->
<!--          </el-button>-->
<!--        </el-form-item>-->
      </el-form>
    </div>
    <div class="content">
      <el-table v-loading="dataLoading" :show-header="false" class="custom-table" ref="multipleTable" :data="list" @expand-change="expandChange" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" v-if="isComponent"/>
        <el-table-column type="expand">
          <template #default="scope">
            <el-card class="box-card">
              <template #header>
                <div class="clearfix">
                  <span>基础信息</span>
                </div>
              </template>
              <div class="table-wrapper">
                <table class="fl-table" style="width: 100%;">
                  <tbody>
                    <tr><td style="width: 120px;">编号：</td><td>{{scope.row.code}}</td></tr>
                    <tr><td>名称：</td><td>{{scope.row.name}}</td></tr>
                    <tr><td>开始时间：</td><td>{{scope.row.startTime}}</td></tr>
                    <tr><td>结束时间：</td><td>{{scope.row.endTime}}</td></tr>
                    <tr><td style="vertical-align: top;">详情：</td><td><div v-html="scope.row.introduction"></div></td></tr>
                  </tbody>
                </table>
              </div>
            </el-card>
            <el-card v-if="!isComponent" style="margin-top: 20px;">
              <template #header>
                <div class="clearfix">
                  <span>课程章节</span>
                </div>
              </template>
              <div v-if="scope.row.chapterList">
                <el-table class="custom-table" :data="scope.row.chapterList" :show-header="false" style="width: 100%;">
                  <el-table-column type="expand">
                    <template #default="props">
                      <el-table class="custom-table" :data="props.row.chapterSectionList" :show-header="false" style="width: 100%;">
                        <el-table-column prop="title" label="标题"></el-table-column>
                        <!--                          <el-table-column prop="phrase" label="简介"></el-table-column>-->
                      </el-table>
                    </template>
                  </el-table-column>
                  <el-table-column prop="title" label="标题"></el-table-column>
                  <!--                    <el-table-column prop="phrase" label="简介"></el-table-column>-->
                </el-table>
              </div>
            </el-card>
          </template>
        </el-table-column>
        <el-table-column>
          <template #default="scope">
            <div class="content-item-warp">
              <a class="image" v-if="scope.row.image && scope.row.image.trim()">
                <img :src="scope.row.image">
              </a>
              <div class="article-card-bone">
                <div class="top-row">
                  <a class="title">{{scope.row.name}}</a>
                  <span class="label create-time">{{scope.row.createTime}}</span>
                </div>
                <div class="middle-row">
                  <div class="status" :class="scope.row.status">{{statusMap[scope.row.status]}}</div>
                </div>
                <div class="bottom-row">
                  <ul class="count">
                    <li>学习 {{scope.row.learnNum || 0}}</li>
                    <li>点赞 {{scope.row.likeNum || 0}}</li>
                    <li>收藏 {{scope.row.favoriteNum || 0}}</li>
                    <li>评论 {{scope.row.commentNum || 0}}</li>
                  </ul>
                  <div class="article-action-list" v-if="!isComponent">
                    <span class="icon-label" @click="showSignUpListDrawer(scope.row)">报名记录</span>
                    <span class="icon-label" @click="commentView(scope.row)">查看评论</span>
                    <span class="icon-label" @click="edit(scope.row.id)">编辑</span>
                    <span class="icon-label" @click="remove(scope.row)">删除</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <signup-record v-if="signUpDrawer" :drawer-close="signUpDrawerClose" :show-drawer="signUpDrawer" :topic="selectTopic"/>
    <comment-drawer topic-type="lesson" :drawer-close="drawerClose" :show-drawer="drawer" :topic="selectTopic"/>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <el-button size="small" @click="cancelCallback">取 消</el-button>
        <el-button size="small" type="primary" @click="selectSelectionChange">确 定</el-button>
      </div>
    </template>
  </div>
</template>

<script>
// @ts-nocheck
import router from "@/router"
import Page from "@/components/Page/index.vue"
import CommentDrawer from "@/views/edu/admin/comment/commentDrawer.vue";
import {ref} from "vue"
import {confirm, error, info, success} from "@/util/tipsUtils";
import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = learnApi
const { findList, getLessonChapterList, removeLesson } = learnApi
import SignupRecord from "@/views/edu/admin/learn/signup/record/index.vue";
import {Search} from '@/lib/lucide-fallback';

export default {
  name: "LessonIndex",
  components: {
    SignupRecord,
    Page,
    CommentDrawer,
    Search
  },
  props: {
    cancelCallback: {
      type: Function,
      default: () => {}
    },
    selectCallback: {
      type: Function,
      default: () => {}
    },
    isComponent: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const selectCidList = ref([])
    const categoryOptions = ref([])
    const lessonIdList = ref([])
    const searchParam = ref({
      keyword: "",
      cid: "",
      status: "deleted",
      size: 20,
      current: 1
    })
    const statusMap = {
      unpublished: "未发布",
      published: "已发布",
      deleted: "已删除"
    }
    // 加载分类
    const loadCategory = () => {
      findCategoryList(0, true, (res) => {if (res) { categoryOptions.value = toTree(res);}})
    }
    // 加载列表
    const loadList = () => {
      dataLoading.value = true
      findList(searchParam.value, (res) => {
        dataLoading.value = false
        if (!res) {return;}
        for (const listElement of res.list) {
          listElement.chapterList = [];
          getLessonChapterList({lessonId: listElement.id}, (r) => {
            if (r && r.list) {
              listElement.chapterList = r.list
            }
          })
        }
        list.value = res.list;
        total.value = res.total;
      })
    }
    loadList();
    loadCategory();
    // 搜索
    const search = () => {
      if (selectCidList.value && selectCidList.value.length > 0) {
        searchParam.value.cid = selectCidList.value[selectCidList.value.length - 1];
      }
      loadList();
    }
    // 选择列表项
    const selectItem = (val) => {
      lessonIdList.value = [];
      if (val && val.length > 0) {
        for (const valElement of val) {
          lessonIdList.value.push(valElement.id);
        }
      }
    }
    // 编辑
    const edit = (id) => {
      router.push({path: "/admin/edu/learn/lesson/edit", query: { id : id }})
    }
    const currentChange = (currentPage) => {
      searchParam.value.current = currentPage;
      loadList();
    }
    const sizeChange = (s) => {
      searchParam.value.size = s;
      loadList();
    }
    const expandChange = (row, expandedRows) => {
      // 展开
      if(expandedRows.length>0){
      }
    }
    // 查看评论
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
    const multipleSelection = ref([])
    const handleSelectionChange = (val) => {
      multipleSelection.value = val;
    }
    const selectSelectionChange = () => {
      if (!multipleSelection.value.length) {
        error("请选择课程")
      }
      props.selectCallback && props.selectCallback(multipleSelection.value)
    }
    const remove = (item) => {
      confirm("确认删除该课程？", "提示", () => {
        removeLesson({id: item.id}, () => {
          success("删除成功")
          loadList();
        })
      })
    }
    const signUpDrawer = ref(false)
    const signUpDrawerClose = (done) => {
      signUpDrawer.value = false
      done()
    }
    const showSignUpListDrawer = (item) => {
      signUpDrawer.value = true
      selectTopic.value = item
    }
    return {
      list,
      total,
      searchParam,
      selectCidList,
      categoryOptions,
      lessonIdList,
      search,
      selectItem,
      edit,
      currentChange,
      sizeChange,
      expandChange,
      dataLoading,
      statusMap,
      commentView,
      selectTopic,
      drawer,
      drawerClose,
      info,
      handleSelectionChange,
      selectSelectionChange,
      remove,
      signUpDrawer,
      signUpDrawerClose,
      showSignUpListDrawer
    };
  }
};
</script>

<style scoped lang="scss">
  .app-container {
    margin: 10px;
    .header {
      .form-inline {
        .search-input {
          width: 242px;
          :deep(.el-input__inner){
            height: 34px;
            line-height: 34px;
            border-color: #f3f5f8;
            &:focus, &:hover {
              border-color: #f3f5f8;
            }
          }
          :deep(.el-input__icon){
            height: 34px;
            line-height: 34px;
            cursor: pointer;
            &:hover {
              color: var(--el-color-primary);
            }
          }
        }
        .select {
          :deep(.el-form-item__label){
            font-size: 12px;
          }
          :deep(.el-input__inner){
            height: 34px;
            line-height: 34px;
            border-color: #f3f5f8;
          }
        }
        :deep(.el-form-item){
          margin-bottom: 10px;
        }
      }
    }
    .content {
      :deep(.custom-table table tr:last-child){
        td {
          border: 0;
        }
      }
      .custom-table {
        width: 100%;
        .content-item-warp {
          position: relative;
          display: flex;
          .image {
            width: 180px;
            max-width: 130px;
            height: 80px;
            margin-right: 20px;
            position: relative;
            overflow: hidden;
            border-radius: 4px;
            border: 1px solid #e8e8e8;
            cursor: default;
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
            .top-row {
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
                cursor: text;
              }
              .create-time {
                color: #999;
                line-height: 24px;
                margin-left: 12px;
                flex-shrink: 0;
                font-size: 12px;
              }
            }
            .content {
              word-break: break-word;
              overflow-wrap: break-word;
              margin: 8px 0 4px 0;
              font-size: 12px;
            }
            .middle-row {
              line-height: 20px;
              margin-top: 8px;
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
              .published {
                background: #67c23a;
                color: #ffffff;
              }
              .unpublished {
                background: #e6a23c;
                color: #ffffff;
              }
              .deleted {
                background: #f56c6c;
                color: #ffffff;
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
            .bottom-row {
              margin-top: 10px;
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              .count {
                line-height: 20px;
                position: relative;
                li {
                  display: inline-block;
                  margin-right: 20px;
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
                  line-height: 20px;
                  display: flex;
                  color: #222;
                  font-weight: 400;
                  margin-left: 20px;
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
    .el-table th.is-leaf, .el-table td {
      border: 0;
    }
    .el-table th.is-leaf, .el-table td:nth-child(1) {
      min-width: 100px;
    }
    .image {
      height: 60px;
      display: inline-block;
    }
    .el-table-column--selection .cell{
      padding-left: 14px;
      padding-right: 14px;
    }
    :deep(.el-table tbody tr:hover > td){
      background-color: transparent;
    }
    :deep(.el-table__empty-block){
      line-height: 400px;
      .el-table__empty-text {
        line-height: 400px;
      }
    }
  }
  :deep(.sign-up-drawer){
    width: calc(100% - 210px);
    .topic-list-wrapper {
      padding: 10px;
    }
  }
</style>
<style lang="scss">
  .el-table::before {
    height: 0;
  }
</style>
