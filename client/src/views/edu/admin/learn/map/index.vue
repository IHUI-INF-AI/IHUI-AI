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
              <SelectOption label="已删除" value="deleted"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4">
          <Button size="sm" variant="default" @click="edit()">
            <Plus />新增
          </Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div v-if="dataLoading">加载中...</div>
      <Table class="custom-table" style="width: 100%">
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
                      <a class="title">{{row.title}}</a>
                      <span class="label create-time">{{row.createTime}}</span>
                    </div>
                    <div class="status-wrapper">
                      <div class="status" :class="row.status">{{statusMap[row.status]}}</div>
                    </div>
                    <div class="count-wrapper">
                      <ul class="count">
                        <li>学习 {{row.learnNum || 0}}</li>
                        <li>点赞 {{row.likeNum || 0}}</li>
                        <li>收藏 {{row.favoriteNum || 0}}</li>
                        <li>评论 {{row.commentNum || 0}}</li>
                      </ul>
                      <div class="article-action-list">
                        <span class="icon-label" @click="info('敬请期待')">报名记录</span>
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
                        <tr><td style="width: 120px;">名称：</td><td>{{row.title}}</td></tr>
                        <tr><td style="vertical-align: top;">详情：</td><td><div v-html="row.description"></div></td></tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                </Card>
                <Card style="margin-top: 20px;">
                  <CardHeader>
                    <div class="clearfix">
                      <span>关联专题</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                  <div>
                    <Table class="custom-table" style="width: 100%;">
                      <TableBody>
                        <TableRow v-for="(topic, tIndex) in row.topicList" :key="tIndex">
                          <TableCell>{{ topic.title }}</TableCell>
                        </TableRow>
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
    <comment-drawer topic-type="learn_map" :drawer-close="drawerClose" :show-drawer="drawer" :topic="selectTopic"/>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
// @ts-nocheck
import router from "@/router"
import Page from "@/components/Page/index.vue"
import CommentDrawer from "@/views/edu/admin/comment/commentDrawer.vue";
import {ref, markRaw} from "vue"
import {Plus, Search} from '@/lib/lucide-fallback'
import { learnApi } from '@/api/edu/admin-api'
const { findList, removeMap } = learnApi
import {confirm, info, success} from "@/util/tipsUtils";

import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "LearnMapIndex",
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
    Page,
    CommentDrawer,
    Plus,
    Search
  },
  setup() {
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const topicIdList = ref([])
    const searchParam = ref({
      keyword: "",
      cid: "",
      status: "",
      size: 20,
      current: 1
    })
    const statusMap = {
      unpublished: "未发布",
      published: "已发布",
      deleted: "已删除"
    }
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
    // 搜索
    const search = () => {
      loadList();
    }
    // 选择列表项
    const selectItem = (val) => {
      topicIdList.value = [];
      if (val && val.length > 0) {
        for (const valElement of val) {
          topicIdList.value.push(valElement.id);
        }
      }
    }
    // 编辑
    const edit = (id) => {
      router.push({path: "/admin/edu/learn/map/edit", query: { id : id }})
    }
    const remove = (item) => {
      confirm("确认删除该地图？", "提示", () => {
        removeMap({id: item.id}, () => {
          success("删除成功")
          loadList();
        })
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
    const expandChange = (row, expandedRows) => {
      // 展开
      if(expandedRows.length>0){
      }
    }
    const expandedRows = ref(new Set())
    const toggleExpand = (index) => {
      if (expandedRows.value.has(index)) {
        expandedRows.value.delete(index)
      } else {
        expandedRows.value.add(index)
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
    return {
      list,
      total,
      searchParam,
      topicIdList,
      search,
      selectItem,
      edit,
      remove,
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
      Plus: markRaw(Plus),
      expandedRows,
      toggleExpand
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
            color: hsl(var(--primary));
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
        position: relative;
        display: flex;
        .image {
          min-width: 130px;
          width: 180px;
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
              font-size: 12px;
            }
          }
          .content {
            word-break: break-word;
            overflow-wrap: break-word;
            margin: 8px 0 4px 0;
            font-size: 12px;
          }
          .status-wrapper {
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
          .count-wrapper {
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
                  color: hsl(var(--primary));
                }
              }
            }
          }
        }
      }
    }
    :deep(.el-table__empty-block){
      line-height: 400px;
      .el-table__empty-text {
        line-height: 400px;
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
}
</style>
<style lang="scss">
  .el-table::before {
    height: 0;
  }
</style>
