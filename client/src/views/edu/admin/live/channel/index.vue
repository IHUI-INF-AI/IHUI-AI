<template>
  <div class="app-container">
    <div v-if="routerAlive">
      <div class="header">
        <form @submit.prevent class="demo-form-inline">
          <div class="mb-4 text-left search-form-item">
            <Input class="search-input" size="small" v-model="searchParam.keyword" placeholder="请输入名称关键字"></Input>
            <Button className="search-btn" size="sm" variant="default" @click="search" style="margin-left: 20px;">搜索</Button>
          </div>
          <div class="mb-4 status">
            <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
            <div>
              <Select size="small" v-model="searchParam.status" @change="search">
                <SelectOption label="全部" value=""></SelectOption>
                <SelectOption label="未开播" value="inactive"></SelectOption>
                <SelectOption label="直播中" value="active"></SelectOption>
                <SelectOption label="禁播中" value="forbid"></SelectOption>
              </Select>
            </div>
          </div>
          <div class="mb-4">
            <label class="mb-1 block text-sm font-medium text-foreground">分类</label>
            <div>
              <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
            </div>
          </div>
          <div class="mb-4 text-left">
            <Button size="sm" variant="default" @click="edit()" style="margin-left: 20px;">
              <Plus class="h-4 w-4" />
              新增
            </Button>
          </div>
        </form>
      </div>
      <div class="content">
        <div v-if="dataLoading" class="loading-div">加载中...</div>
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
                        <a class="title">{{ row.name }}</a>
                        <span class="label create-time">{{ row.startTime }}</span>
                      </div>
                      <div class="abstruct">
                        <div class="status">{{ statusMap[row.status] }}</div>
                      </div>
                      <div class="count-wrapper">
                        <ul class="count">
                          <li>预约 {{ row.subscriptionNum || 0 }}</li>
                          <li>观看 {{ row.watchNum || 0 }}</li>
                          <li>点赞 {{ row.likeNum || 0 }}</li>
                          <li>收藏 {{ row.favoriteNum || 0 }}</li>
                          <li>评论 {{ row.commentNum || 0 }}</li>
                        </ul>
                        <div class="article-action-list">
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
                  <Card class="box-card" style="margin-bottom: 20px;">
                    <CardHeader>
                      <div class="clearfix">
                        <span>直播流信息</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="table-wrapper">
                      <table class="fl-table" style="width: 100%;">
                        <tr><td style="width: 120px;">流名称：</td><td>{{ row.stream ? row.stream.streamName : "" }}</td></tr>
                        <tr><td style="width: 120px;">推流地址：</td><td>{{ row.stream ? row.stream.pushUrl : "" }}</td></tr>
                        <tr><td style="width: 120px;">拉流地址：</td><td>{{ row.stream ? row.stream.pullUrl : "" }}</td></tr>
                        <tr><td style="width: 120px;">创建时间：</td><td>{{ row.createTime }}</td></tr>
                      </table>
                    </div>
                  </CardContent>
                  </Card>
                  <Card class="box-card">
                    <CardHeader>
                      <div class="clearfix">
                        <span>详情</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="table-wrapper">
                      <div v-html="row.introduction"></div>
                    </div>
                  </CardContent>
                  </Card>
                </td>
              </tr>
            </template>
          </TableBody>
        </Table>
      </div>
      <comment-drawer topic-type="channel" :drawer-close="drawerClose" :show-drawer="drawer" :topic="selectTopic"/>
      <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
    </div>
    <router-view v-if="!routerAlive"/>
  </div>
</template>

<script>
// @ts-nocheck
import {ref, watch} from "vue"
import {useRoute} from "vue-router"
import router from "@/router"
import { liveApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = liveApi
import Page from "@/components/Page/index.vue"
const { findList, removeChannel } = liveApi
import {confirm, success} from "@/util/tipsUtils";
import commentDrawer from "../../comment/commentDrawer.vue"
import {Plus} from '@/lib/lucide-fallback';

import { Card, CardHeader, CardContent } from '@/components/ui/card'
import Button from '@/components/ui/Button.vue'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "LiveChannelIndex",
  components: {
    Button,
    Card,
    CardHeader,
    CardContent,
    Page,
    commentDrawer,
    Plus,
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
    Input,
    Select,
    SelectOption
  },
  setup() {
    // 监听路由
    const route = useRoute()
    const routerAlive = ref(route.fullPath === "/live/channel")
    watch(() => route.fullPath, () => {
      routerAlive.value = route.fullPath === "/live/channel";
    })
    // 变量
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const expandedRows = ref(new Set())
    const toggleExpand = (index) => {
      if (expandedRows.value.has(index)) {
        expandedRows.value.delete(index)
      } else {
        expandedRows.value.add(index)
      }
    }
    const selectCidList = ref([])
    const categoryOptions = ref([])
    const searchParam = ref({
      keyword: "",
      cid: "",
      status: "",
      size: 20,
      current: 1
    })
    const statusMap = {
      inactive : "未开播",
      active : "直播中",
      forbid : "禁播中",
      deleted : "已删除"
    }
    // 加载分类
    const loadCategory = () => {
      findCategoryList(0, true, (res) => {if (res) { categoryOptions.value = toTree(res);}})
    }
    // 加载列表
    const loadList = () => {
      dataLoading.value = true
      findList(searchParam.value, (res) => {
        if (!res) {return;}
        for (const listElement of res.list) {
          listElement.chapterList = [];
        }
        list.value = res.list;
        total.value = res.total;
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
    // 编辑
    const edit = (id) => {
      routerAlive.value = false
      router.push({path: "/admin/edu/live/channel/edit", query: { id : id }})
    }
    // 删除
    const remove = (item) => {
      confirm("确认删除 " + item.name + " ?", "提示", () => {
        removeChannel(item.id, () => {
          success("删除成功")
          loadList()
        })
      }, () => {
      });
    }
    // 分页
    const currentChange = (currentPage) => {
      searchParam.value.current = currentPage;
      loadList();
    }
    const sizeChange = (s) => {
      searchParam.value.size = s;
      loadList();
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
      routerAlive,
      list,
      total,
      searchParam,
      selectCidList,
      categoryOptions,
      statusMap,
      search,
      edit,
      remove,
      currentChange,
      sizeChange,
      dataLoading,
      commentView,
      selectTopic,
      drawer,
      drawerClose,
      expandedRows,
      toggleExpand,
    };
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
      text-align: right;
      min-width: 100px;
    }
    .image {
      height: 60px;
      display: inline-block;
    }
    .search-input {
      width: 242px;
    }
    
    .header {
      :deep(.demo-form-inline) {
        // 给搜索按钮添加左边距（与输入框分开）
        .el-form-item.search-form-item,
        .el-form-item.text-left:first-child {
          .el-form-item__content {
            display: flex;
            align-items: center;
            
            // 给按钮添加左边距，确保与输入框分开
            .el-button.search-btn {
              margin-left: 20px;
            }
          }
        }
        
        // 给新增按钮添加左边距
        .el-form-item.text-left:last-child {
          .el-form-item__content {
            margin-left: 20px;
          }
        }
      }
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
  .el-table.custom-table table tr:last-child {
    td {
      border: 0;
    }
  }
  .el-table::before {
    height: 0;
  }
</style>
