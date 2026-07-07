<template>
  <div class="app-container">
    <div class="header">
      <el-form :inline="true" :model="searchParam" class="demo-form-inline">
        <el-form-item label="">
          <el-input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></el-input>
          <el-button size="small" class="search-btn" type="primary" @click="search">搜索</el-button>
        </el-form-item>
        <el-form-item label="状态" class="status">
          <el-select size="small" v-model="searchParam.isShow" @change="search">
            <el-option label="全部" value=""></el-option>
            <el-option label="未发布" value="unpublished"></el-option>
            <el-option label="已发布" value="published"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
        </el-form-item>
        <el-form-item>
          <el-button size="small" type="primary" @click="edit()">
            <el-icon><Plus /></el-icon>
            新增
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="content">
      <el-table v-loading="dataLoading" :show-header="false" class="custom-table" ref="multipleTable" :data="list" style="width: 100%" @expand-change="expandChange">
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
            <el-card style="margin-top: 20px;">
              <template #header>
                <div class="clearfix">
                  <span>章节</span>
                </div>
              </template>
              <div>
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
                <div class="title-wrap">
                  <a class="title">{{scope.row.name}}</a>
                  <span class="label create-time">{{scope.row.createTime}}</span>
                </div>
                <div class="abstruct">
                  <div class="status">{{statusMap[scope.row.status]}}</div>
                </div>
                <div class="count-wrapper">
                  <ul class="count">
                    <li>考试人次 {{scope.row.signUpNum || 0}}</li>
                    <li>点赞 {{scope.row.likeNum || 0}}</li>
                    <li>收藏 {{scope.row.favoriteNum || 0}}</li>
                    <li>评论 {{scope.row.commentNum || 0}}</li>
                  </ul>
                  <div class="article-action-list">
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
    <el-drawer class="sign-up-drawer" v-model="signUpDrawer" direction="rtl" :before-close="signUpDrawerClose" destroy-on-close>
      <template #header>
        <div class="work-item-box">
          <div class="item-content">
            <div class="content-main">
              <div class="main-title">
                <div class="title-box two-line">
                  <span class="title-text">{{selectTopic.name || selectTopic.title || selectTopic.content}}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div class="topic-list-wrapper">
        <el-table v-loading="signUpLoading" :data="signUpList" style="width: 100%">
          <el-table-column label="姓名">
            <template #default="scope">
              {{scope.row.member && scope.row.member.name}}
            </template>
          </el-table-column>
          <el-table-column label="报名时间" prop="createTime"></el-table-column>
          <el-table-column label="完成时间" prop="completedTime">
            <template #default="scope">
              {{scope.row.completedTime || "--"}}
            </template>
          </el-table-column>
          <el-table-column label="状态">
            <template #default="scope">
              {{signUpStatusMap[scope.row.status]}}
            </template>
          </el-table-column>
        </el-table>
        <page :total="signUpTotal" :current-change="signUpCurrentChange" :size-change="signUpSizeChange" :page-size="signUpParam.size"></page>
      </div>
    </el-drawer>
    <comment-drawer topic-type="exam" :drawer-close="drawerClose" :show-drawer="drawer" :topic="selectTopic"/>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
// @ts-nocheck
import {ref} from "vue"
import router from "@/router"
import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = examApi
// const { findList, getExamChapterList, deleteExam } = examApi
const { findList, deleteExam, getAllExamList } = examApi
import Page from "@/components/Page/index.vue"
import CommentDrawer from "../../comment/commentDrawer.vue";
const { getSignUpList } = examApi;
import {confirm, success} from "@/util/tipsUtils";
import {Plus} from '@/lib/lucide-fallback';

export default {
  name: "ExamListIndex",
  components: {
    CommentDrawer,
    Page,
    Plus
  },
  setup() {
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const selectCidList = ref([])
    const categoryOptions = ref([])
    const examIdList = ref([])
    const searchParam = ref({
      keyword: "",
      cid: "",
      isShow: "",
      size: 20,
      current: 1,
      neqStatusList: ["deleted"]
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
          getAllExamList({examId: listElement.id}, (r) => {
          //   getExamChapterList({examId: listElement.id}, (r) => {
            if (r && r.list) {
              listElement.chapterList = r.list
            }
          })
        }
        list.value = res.list;
        total.value = res.total;
      }).catch(() => {
        dataLoading.value = false
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
      examIdList.value = [];
      if (val && val.length > 0) {
        for (const valElement of val) {
          examIdList.value.push(valElement.id);
        }
      }
    }
    // 编辑
    const edit = (id) => {
      router.push({path: "/admin/edu/exam/exam/edit", query: { id : id }})
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
    // 查看报名记录
    const signUpDrawer = ref(false)
    const signUpDrawerClose = (done) => {
      signUpDrawer.value = false
      done()
    }
    const signUpLoading = ref(false)
    const signUpList = ref([])
    const signUpTotal = ref(0)
    const signUpParam = ref({
      current: 1,
      size: 20
    })
    const loadSignUpList = () => {
      signUpLoading.value = true
      getSignUpList(signUpParam.value, res => {
        signUpList.value = res.list
        signUpTotal.value = res.total
        signUpLoading.value = false
      })
    }
    const signUpCurrentChange = (currentPage) => {
      signUpParam.value.current = currentPage;
      loadSignUpList();
    }
    const signUpSizeChange = (s) => {
      signUpParam.value.size = s;
      loadSignUpList();
    }
    const showSignUpListDrawer = (item) => {
      signUpDrawer.value = true
      selectTopic.value = item
      signUpParam.value.current = 1
      signUpParam.value.examId = item.id
      loadSignUpList()
    }
    const signUpStatusMap = {
      "signed_up": "已报名",
      "cancel_sign_up": "取消报名",
      "completed": "已完成"
    }
    const remove = (item) => {
      confirm("确认删除该考试？", "提示", () => {
          deleteExam({id: item.id}, () => {
            success("删除成功");
            loadList();
          })
      })
    }
    return {
      remove,
      list,
      total,
      searchParam,
      selectCidList,
      categoryOptions,
      examIdList,
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
      signUpDrawer,
      signUpParam,
      signUpTotal,
      signUpList,
      signUpLoading,
      signUpDrawerClose,
      signUpCurrentChange,
      signUpSizeChange,
      showSignUpListDrawer,
      signUpStatusMap
    }
  }
};
</script>

<style scoped lang="scss">
.app-container {
  margin: 20px;
  .content {
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
            cursor: text;
          }
          .create-time {
            color: #999;
            line-height: 24px;
            margin-left: 12px;
            flex-shrink: 0;
          }
        }
        .content {
          word-break: break-word;
          overflow-wrap: break-word;
          margin: 8px 0 4px 0;
          font-size: 12px;
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
  .search-input {
    width: 242px;
  }
  .el-table-column--selection .cell{
    padding-left: 14px;
    padding-right: 14px;
  }
  :deep(.el-table tbody tr:hover > td){
    background-color: transparent;
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
  .el-table.custom-table table tr:last-child {
    td {
      border: 0;
    }
  }
  .el-table::before {
    height: 0;
  }
</style>
