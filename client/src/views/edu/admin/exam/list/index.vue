<template>
  <div class="app-container">
    <div class="header">
      <form class="demo-form-inline flex flex-wrap items-end gap-4" @submit.prevent>
        <div class="mb-4">
          <Input size="small" class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字"></Input>
          <Button size="sm" className="search-btn" variant="default" @click="search">搜索</Button>
        </div>
        <div class="mb-4 status">
          <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
          <div>
            <Select size="small" v-model="searchParam.isShow" @change="search">
              <SelectOption label="全部" value=""></SelectOption>
              <SelectOption label="未发布" value="unpublished"></SelectOption>
              <SelectOption label="已发布" value="published"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">分类</label>
          <div>
            <Select size="small" v-model="selectedCid" @change="search" clearable>
              <SelectOption v-for="item in flatCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
            </Select>
          </div>
        </div>
        <div class="mb-4">
          <Button size="sm" variant="default" @click="edit()">
            <Plus class="h-4 w-4" />
            新增
          </Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div v-if="dataLoading" class="loading-text">加载中...</div>
      <Table v-show="!dataLoading" class="custom-table w-full">
        <TableBody>
          <template v-for="(row, index) in list" :key="row.id ?? index">
            <TableRow>
              <TableCell>
                <button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button>
              </TableCell>
              <TableCell>
                <div class="content-item-warp">
                  <a class="image" v-if="row.image && row.image.trim()">
                    <img :src="row.image">
                  </a>
                  <div class="article-card-bone">
                    <div class="title-wrap">
                      <a class="title">{{row.name}}</a>
                      <span class="label create-time">{{row.createTime}}</span>
                    </div>
                    <div class="abstruct">
                      <div class="status">{{statusMap[row.status]}}</div>
                    </div>
                    <div class="count-wrapper">
                      <ul class="count">
                        <li>考试人次 {{row.signUpNum || 0}}</li>
                        <li>点赞 {{row.likeNum || 0}}</li>
                        <li>收藏 {{row.favoriteNum || 0}}</li>
                        <li>评论 {{row.commentNum || 0}}</li>
                      </ul>
                      <div class="article-action-list">
                        <span class="icon-label" @click="showSignUpListDrawer(row)">报名记录</span>
                        <span class="icon-label" @click="commentView(row)">查看评论</span>
                        <span class="icon-label" @click="edit(row.id)">编辑</span>
                        <span class="icon-label" @click="remove(row)">删除</span>
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
                <Card style="margin-top: 20px;">
                  <CardHeader>
                    <div class="clearfix">
                      <span>章节</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                  <div>
                    <Table class="custom-table w-full">
                      <TableBody>
                        <template v-for="(chapter, cIndex) in row.chapterList" :key="chapter.id ?? cIndex">
                          <TableRow>
                            <TableCell>
                              <button @click="toggleExpand(`${index}-${cIndex}`)">{{ expandedRows.has(`${index}-${cIndex}`) ? '▼' : '▶' }}</button>
                            </TableCell>
                            <TableCell>{{chapter.title}}</TableCell>
                          </TableRow>
                          <tr v-if="expandedRows.has(`${index}-${cIndex}`)">
                            <td colspan="99">
                              <Table class="custom-table w-full">
                                <TableBody>
                                  <TableRow v-for="(section, sIndex) in chapter.chapterSectionList" :key="section.id ?? sIndex">
                                    <TableCell>{{section.title}}</TableCell>
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
    <Teleport to="body">
      <Transition name="drawer-slide">
        <div v-if="signUpDrawer" class="drawer-mask" @click.self="signUpDrawerClose">
          <div class="drawer-panel sign-up-drawer">
            <div class="drawer-header">
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
            </div>
            <div class="drawer-body">
              <div class="topic-list-wrapper">
        <div v-if="signUpLoading" class="loading-text">加载中...</div>
        <Table v-show="!signUpLoading" class="w-full">
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>报名时间</TableHead>
              <TableHead>完成时间</TableHead>
              <TableHead>状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(row, index) in signUpList" :key="row.id ?? index">
              <TableCell>{{ row.member && row.member.name }}</TableCell>
              <TableCell>{{ row.createTime }}</TableCell>
              <TableCell>{{ row.completedTime || "--" }}</TableCell>
              <TableCell>{{ signUpStatusMap[row.status] }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <page :total="signUpTotal" :current-change="signUpCurrentChange" :size-change="signUpSizeChange" :page-size="signUpParam.size"></page>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
    <comment-drawer topic-type="exam" :drawer-close="drawerClose" :show-drawer="drawer" :topic="selectTopic"/>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
import {ref, computed} from "vue"
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

import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "ExamListIndex",
  components: {
    Card,
    CardHeader,
    CardContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    CommentDrawer,
    Page,
    Plus,
    Button,
    Input,
    Select,
    SelectOption
  },
  setup() {
    const expandedRows = ref(new Set())
    const toggleExpand = (key) => {
      if (expandedRows.value.has(key)) {
        expandedRows.value.delete(key)
      } else {
        expandedRows.value.add(key)
      }
    }
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const selectCidList = ref([])
    const categoryOptions = ref([])
    const examIdList = ref([])
    const flatCategoryOptions = computed(() => {
      const result = []
      const flatten = (nodes, parentPath = '') => {
        for (const node of nodes) {
          const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
          result.push({ label, value: node.value || node.id })
          if (node.children && node.children.length) { flatten(node.children, label) }
        }
      }
      flatten(categoryOptions.value || [])
      return result
    })
    const selectedCid = computed({
      get: () => { const arr = selectCidList.value; return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : '' },
      set: (val) => { selectCidList.value = [val] }
    })
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
    const drawerClose = () => {
      drawer.value = false
    }
    const commentView = (item) => {
      drawer.value = true
      selectTopic.value = item
    }
    // 查看报名记录
    const signUpDrawer = ref(false)
    const signUpDrawerClose = () => {
      signUpDrawer.value = false
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
      flatCategoryOptions,
      selectedCid,
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
      signUpStatusMap,
      expandedRows,
      toggleExpand
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
                color: hsl(var(--primary));
              }
            }
          }
        }
      }
    }
  }
  .image {
    height: 60px;
    display: inline-block;
  }
  .search-input {
    width: 242px;
  }
}
.drawer-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}
.drawer-panel.sign-up-drawer {
  width: calc(100% - 210px);
  height: 100%;
  background: hsl(var(--background));
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.drawer-header {
  flex-shrink: 0;
}
.drawer-body {
  flex: 1;
  overflow: auto;
}
.drawer-slide-enter-active, .drawer-slide-leave-active {
  transition: opacity 0.3s ease;
}
.drawer-slide-enter-active .drawer-panel, .drawer-slide-leave-active .drawer-panel {
  transition: transform 0.3s ease;
}
.drawer-slide-enter-from, .drawer-slide-leave-to {
  opacity: 0;
}
.drawer-slide-enter-from .drawer-panel, .drawer-slide-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
<style lang="scss">
  .custom-table table tr:last-child {
    td {
      border: 0;
    }
  }
</style>
