<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="form-inline">
        <div class="mb-4">
          <div class="flex">
            <Input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字" />
            <Search class="h-4 w-4 cursor-pointer el-input__icon search-btn" @click="search" />
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
          <div>
            <Select size="small" v-model="searchParam.status" @change="search">
              <SelectOption label="全部" value=""></SelectOption>
              <SelectOption label="未发布" value="unpublished"></SelectOption>
              <SelectOption label="已发布" value="published"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">分类</label>
          <div>
            <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
          </div>
        </div>
        <div class="mb-4" v-if="!isComponent">
          <Button size="sm" variant="default" @click="edit()">
            <Plus class="h-4 w-4" />
            新增
          </Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div v-if="dataLoading">加载中...</div>
      <Table class="custom-table" style="border-radius: 15px;">
        <TableBody>
          <template v-for="(row, index) in list" :key="row.id ?? index">
            <TableRow :style="{ background: 'transparent', border: '1px solid rgba(0, 0, 0, 0.08)' }">
              <TableCell v-if="isComponent" class="w-[45px]" style="border-radius: 15px;">
                <input type="checkbox" :checked="multipleSelection.includes(row)" @change="toggleRow(row)" />
              </TableCell>
              <TableCell style="border-radius: 20px;">
                <button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button>
              </TableCell>
              <TableCell>
                <div class="content-item-warp"  style="border-bottom: 1px solid white;">
                  <a class="image" v-if="row.image && row.image.trim()">
                    <img :src="row.image">
                  </a>
                  <div class="article-card-bone">
                    <!-- 父容器添加 flex 布局，控制子元素在同一行 -->
                    <div class="top-and-middle-container">
                      <div class="top-row">
                        <a class="title">{{row.name}}</a>
                        <span class="label create-time">{{row.createTime}}</span>
                      </div>
                      <div class="middle-row">
                        <div class="status" :class="row.status">{{statusMap[row.status]}}</div>
                      </div>
                    </div>

                    <div class="bottom-row">
                      <ul class="count">
                        <li>学习 {{row.learnNum || 0}}</li>
                        <li>点赞 {{row.likeNum || 0}}</li>
                        <li>收藏 {{row.favoriteNum || 0}}</li>
                        <li>评论 {{row.commentNum || 0}}</li>
                      </ul>
                      <div class="article-action-list" v-if="!isComponent">
                        <User class="h-4 w-4 cursor-pointer icon-label" title="批量报名" @click="batchShowSignUpListDrawer(row)" />
                        <Notebook class="h-4 w-4 cursor-pointer icon-label" title="报名记录" @click="showSignUpListDrawer(row)" />
                        <ChatDotRound class="h-4 w-4 cursor-pointer icon-label" title="查看评论" @click="commentView(row)" />
                        <Edit class="h-4 w-4 cursor-pointer icon-label" title="编辑" @click="edit(row.id)" />
                        <Delete class="h-4 w-4 cursor-pointer icon-label" title="删除" @click="remove(row)" />
                      </div>
                    </div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
            <tr v-if="expandedRows.has(index)">
              <td colspan="99">
                <Card class="box-card">
                  <CardHeader>
                    <div class="clearfix">
                      <span>基础信息</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                  <div class="table-wrapper">
                    <table class="fl-table" style="width: 100%;">
                      <tbody>
                        <tr><td style="width: 120px;">编号：</td><td>{{row.code}}</td></tr>
                        <tr><td>名称：</td><td>{{row.name}}</td></tr>
                        <tr><td>开始时间：</td><td>{{row.startTime}}</td></tr>
                        <tr><td>结束时间：</td><td>{{row.endTime}}</td></tr>
                        <tr><td style="vertical-align: top;">详情：</td><td><div v-html="row.introduction"></div></td></tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                </Card>
                <Card v-if="!isComponent" style="margin-top: 20px;">
                  <CardHeader>
                    <div class="clearfix">
                      <span>课程章节</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                  <div v-if="row.chapterList">
                    <Table class="custom-table" style="width: 100%;">
                      <TableBody>
                        <template v-for="(chapter, chapterIndex) in row.chapterList" :key="chapterIndex">
                          <TableRow>
                            <TableCell>
                              <button @click="toggleChapterExpand(index + '-' + chapterIndex)">{{ chapterExpandedRows.has(index + '-' + chapterIndex) ? '▼' : '▶' }}</button>
                            </TableCell>
                            <TableCell>{{ chapter.title }}</TableCell>
                          </TableRow>
                          <tr v-if="chapterExpandedRows.has(index + '-' + chapterIndex)">
                            <td colspan="99">
                              <Table class="custom-table" style="width: 100%;">
                                <TableBody>
                                  <TableRow v-for="(section, sIndex) in chapter.chapterSectionList" :key="sIndex">
                                    <TableCell>{{ section.title }}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </td>
                          </tr>
                        </template>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                </Card>
              </td>
            </tr>
          </template>
        </TableBody>
      </Table>
    </div>
    <signup-record v-if="signUpDrawer" :drawer-close="signUpDrawerClose" :show-drawer="signUpDrawer" :topic="selectTopic"/>
    <batch-signup-record v-if="batchSignUpDrawer" :drawer-close="batchSignUpDrawerClose" :show-drawer="batchSignUpDrawer" :topic="selectTopic"/>
    <comment-drawer topic-type="lesson" :drawer-close="drawerClose" :show-drawer="drawer" :topic="selectTopic"/>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <Button size="sm" variant="outline" @click="cancelCallback">取 消</Button>
        <Button size="sm" variant="default" @click="selectSelectionChange">确 定</Button>
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
import BatchSignupRecord from "@/views/edu/admin/learn/signup/batch/index.vue";
import {Plus, Search, User, Notebook, ChatDotRound, Edit, Delete} from '@/lib/lucide-fallback';

import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "LessonIndex",
  components: {
    Button,
    Card,
    CardHeader,
    CardContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Input,
    Select,
    SelectOption,
    SignupRecord,
    BatchSignupRecord,
    Page,
    CommentDrawer,
    Plus,
    Search,
    User,
    Notebook,
    ChatDotRound,
    Edit,
    Delete
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
      status: "",
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
    const expandedRows = ref(new Set())
    const chapterExpandedRows = ref(new Set())
    const toggleExpand = (index) => {
      if (expandedRows.value.has(index)) {
        expandedRows.value.delete(index)
      } else {
        expandedRows.value.add(index)
      }
    }
    const toggleChapterExpand = (key) => {
      if (chapterExpandedRows.value.has(key)) {
        chapterExpandedRows.value.delete(key)
      } else {
        chapterExpandedRows.value.add(key)
      }
    }
    const toggleRow = (row) => {
      const idx = multipleSelection.value.indexOf(row)
      if (idx === -1) {
        multipleSelection.value.push(row)
      } else {
        multipleSelection.value.splice(idx, 1)
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

    const batchSignUpDrawer = ref(false)
    const batchSignUpDrawerClose = (done) => {
      batchSignUpDrawer.value = false
      done()
    }
    const batchShowSignUpListDrawer = (item) => {
      batchSignUpDrawer.value = true
      selectTopic.value = item
    }
    return {
      batchSignUpDrawer,
      batchSignUpDrawerClose,
      batchShowSignUpListDrawer,
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
      showSignUpListDrawer,
      expandedRows,
      chapterExpandedRows,
      toggleExpand,
      toggleChapterExpand,
      toggleRow,
      multipleSelection
    };
  }
};
</script>

<style scoped lang="scss">
  .app-container {
    margin: 20px;
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
          margin-bottom: 20px;
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
          border-radius: 15px;
          overflow: hidden;
          position: relative;
          border: none; /* 取消所有边框 */
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
            border-radius: 15px;
            overflow: hidden;
            // 新增父容器样式：flex 布局强制子元素在同一行
            .top-and-middle-container {
              display: flex;       // 启用 flex 布局
              align-items: center; // 垂直居中对齐
              width: 100%;         // 占满父容器宽度
              gap: 10px;           // 两个区域之间的间距（可选）
            }
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
              margin-top: 15px;
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
              margin-top: 20px;
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
                margin-right: 40px;
                line-height: 20px;
                flex: 1 0 auto;
                justify-content: flex-end;

                .icon-label {
                  display: inline-flex;
                  align-items: center;
                  justify-content: center;
                  margin-bottom: 5px;
                  width: 28px;
                  color: #5445A7;
                  height: 28px;
                  font-size: large;
                  border-radius: 50%;
                  transition: all 0.3s;

                  background-color: #f5f7fa; // 背景色

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
    :deep(.el-table tbody tr > td){
      background-color: transparent;
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
