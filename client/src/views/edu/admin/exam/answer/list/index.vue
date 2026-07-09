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
            <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
          </div>
        </div>
      </form>
    </div>
    <div class="content">
      <div v-if="dataLoading" class="loading-text">加载中...</div>
      <Table v-show="!dataLoading" class="custom-table w-full">
        <TableHeader>
          <TableRow>
            <TableHead></TableHead>
            <TableHead>考试标题</TableHead>
            <TableHead class="text-center">报名人数</TableHead>
            <TableHead class="text-right">状态</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="(row, index) in list" :key="row.id ?? index">
            <TableRow>
              <TableCell>
                <button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button>
              </TableCell>
              <TableCell>{{ row.name }}</TableCell>
              <TableCell class="text-center">{{ row.signUpNum || 0 }}</TableCell>
              <TableCell class="text-right">{{ statusMap[row.status] }}</TableCell>
            </TableRow>
            <tr v-if="expandedRows.has(index)">
              <td colspan="99">
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
                            <TableCell>{{ chapter.title }}</TableCell>
                          </TableRow>
                          <tr v-if="expandedRows.has(`${index}-${cIndex}`)">
                            <td colspan="99">
                              <Table class="custom-table w-full">
                                <TableBody>
                                  <TableRow v-for="(section, sIndex) in chapter.chapterSectionList" :key="section.id ?? sIndex">
                                    <TableCell>{{ section.title }}</TableCell>
                                    <TableCell class="w-[100px]"><Button variant="link" @click="showRecordListDrawer(section)">答题记录</Button></TableCell>
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
      <div v-if="recordListDrawer" class="fixed inset-0 z-50">
        <div class="absolute inset-0 bg-black/50" @click="recordListDrawer = false" />
        <div class="absolute right-0 top-0 h-full bg-background shadow-lg custom-drawer flex flex-col" style="width: calc(100% - 210px)">
          <div class="border-b p-4 flex-shrink-0">
            <div class="work-item-box">
              <div class="item-content">
                <div class="content-main">
                  <div class="main-title">
                    <div class="title-box two-line">
                      <span class="title-text">{{selectTopic.name || selectTopic.title || selectTopic.content}}</span>
                    </div>
                  </div>
                </div>
                <div class="content-info">
                  <div class="answer-box">
                    <div class="flex flex-wrap" v-if="selectTopic.paper">
                      <div class="w-1/3">
                        <div class="answer-item">
                          <div class="answer-info-label">试卷标题：</div>
                          <div class="answer-info-value">
                            {{selectTopic.paper.title}}
                          </div>
                        </div>
                        <div class="answer-item">
                          <div class="answer-info-label">试卷类型：</div>
                          <div class="answer-info-value">
                            {{paperTypeMap[selectTopic.paper.type]}}
                          </div>
                        </div>
                        <div class="answer-item">
                          <div class="answer-info-label">试卷难度：</div>
                          <div class="answer-info-value">
                            <div class="flex gap-1">
                              <svg v-for="i in 5" :key="i" :class="['h-4 w-4', i <= selectTopic.paper.difficulty ? 'text-yellow-400' : 'text-muted-foreground']" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.783 1.401 8.168L12 18.896l-7.335 3.865 1.401-8.168L.132 9.21l8.2-1.192z"/></svg>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="w-1/3">
                        <div class="answer-item" v-if="selectTopic.paper && selectTopic.paper.questionList">
                          <div class="answer-info-label">题目数量：</div>
                          <div class="answer-info-value">{{selectTopic.paper.questionList.length || 0}}</div>
                        </div>
                        <div class="answer-item">
                          <div class="answer-info-label">试卷总分：</div>
                          <div class="answer-info-value">{{selectTopic.paper.score || 0}}</div>
                        </div>
                        <div class="answer-item">
                          <div class="answer-info-label">合格分数：</div>
                          <div class="answer-info-value">{{selectTopic.paper.passScore || 0}}</div>
                        </div>
                      </div>
                      <div class="w-1/3">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="overflow-auto flex-1">
            <div class="topic-comment-list-wrapper">
              <div v-if="paperRecordLoading" class="loading-text">加载中...</div>
              <Table v-show="!paperRecordLoading" class="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>得分</TableHead>
                    <TableHead>得分</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="(row, index) in paperRecordList" :key="row.id ?? index">
                    <TableCell>{{ row.member && row.member.name }}</TableCell>
                    <TableCell>{{ row.startTime }}</TableCell>
                    <TableCell>{{ row.endTime }}</TableCell>
                    <TableCell>{{ row.score || 0 }}</TableCell>
                    <TableCell><Button variant="link" @click="showDetail(row)">答题详情</Button></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <page :total="paperRecordTotal" :current-change="paperRecordCurrentChange" :size-change="paperRecordSizeChange" :page-size="paperRecordParam.size"></page>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
    <Teleport to="body">
      <div v-if="detailDrawer" class="fixed inset-0 z-[60]">
        <div class="absolute inset-0 bg-black/50" @click="detailDrawer = false" />
        <div class="absolute right-0 top-0 h-full bg-background shadow-lg detail-drawer flex flex-col" style="width: calc(100% - 210px)">
          <div class="flex items-center justify-between border-b p-4 flex-shrink-0">
            <div>
              {{detailItem.member && detailItem.member.name}} <span style="color: #999999;font-size: 12px;">(报名id：{{detailItem.signUpId}})</span>
            </div>
            <button @click="detailDrawer = false" class="text-muted-foreground hover:text-foreground text-2xl leading-none flex-shrink-0">&times;</button>
          </div>
          <div class="overflow-auto flex-1">
            <paper-detail v-if="detailDrawer" :exam-chapter-section-id="detailItem.examChapterSectionId" :exam-id="detailItem.examId" :sign-up-id="detailItem.signUpId"/>
          </div>
        </div>
      </div>
    </Teleport>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
// @ts-nocheck
import {ref} from "vue"
import router from "@/router"
import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = examApi
const { findList, getExamChapterList } = examApi
import Page from "@/components/Page/index.vue"
import {info} from "@/util/tipsUtils";
const { getRecordList, getPaper } = examApi;
import PaperDetail from "@/views/edu/admin/exam/answer/detail/index.vue";

import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "ExamAnswerListIndex",
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
    PaperDetail,
    Page,
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
    const searchParam = ref({
      keyword: "",
      cid: "",
      isShow: "",
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
          getExamChapterList({examId: listElement.id}, (r) => {
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
      if(expandedRows.length>0) {
      }
    }
    // 查看评论
    const selectTopic = ref({})
    const recordListDrawer = ref(false)
    const drawerClose = (done) => {
      recordListDrawer.value = false
      done()
    }
    const paperRecordLoading = ref(false)
    const paperRecordList = ref([])
    const paperRecordTotal = ref(0)
    const paperRecordParam = ref({
      current: 1,
      size: 20
    })
    const loadRecordList = () => {
      paperRecordLoading.value = true
      getRecordList(paperRecordParam.value, res => {
        paperRecordList.value = res.list
        paperRecordTotal.value = res.total
        paperRecordLoading.value = false
      })
    }
    const paperRecordCurrentChange = (currentPage) => {
      paperRecordParam.value.current = currentPage;
      loadRecordList();
    }
    const paperRecordSizeChange = (s) => {
      paperRecordParam.value.size = s;
      loadRecordList();
    }
    const showRecordListDrawer = (item) => {
      recordListDrawer.value = true
      selectTopic.value = item
      getPaper(item.paperId, res => {
        selectTopic.value.paper = res;
      })
      paperRecordParam.value.current = 1
      paperRecordParam.value.examChapterSectionId = item.id
      loadRecordList()
    }
    const paperTypeMap = {
      "normal": "静态试卷",
      "random": "随机试卷",
      "mock": "模拟试卷",
    }
    const paperStatusMap = {
      "draft": "草稿",
      "submitted": "待批改",
      "passed": "已通过",
      "failed": "未通过",
      "deleted": "已删除"
    }
    const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
    const detailDrawer = ref(false)
    const detailItem = ref({})
    const showDetail = (item) => {
      detailDrawer.value = true
      detailItem.value = item
    }
    const hideDetail = (done) => {
      detailDrawer.value = false
      done()
    }
    return {
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
      showRecordListDrawer,
      selectTopic,
      recordListDrawer,
      drawerClose,
      info,
      paperTypeMap,
      paperStatusMap,
      colors,
      paperRecordLoading,
      paperRecordList,
      paperRecordTotal,
      paperRecordParam,
      paperRecordCurrentChange,
      paperRecordSizeChange,
      showDetail,
      hideDetail,
      detailItem,
      detailDrawer,
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
  .image {
    height: 60px;
    display: inline-block;
  }
  .search-input {
    width: 242px;
  }
  :deep(.custom-drawer){
    width: calc(100% - 210px);
    .el-drawer__header {
      align-items: end;
    }
    &:focus {
      outline: none;
    }
    .el-drawer__close-btn {
      &:focus {
        outline: none;
      }
      &:hover {
        color: var(--el-color-primary);
      }
    }
    .work-item-box {
      margin: 0;
      border: 0;
      font: inherit;
      vertical-align: baseline;
      display: flex;
      align-items: center;
      width: 100%;
      border-bottom: none;
      .item-cover {
        position: relative;
        width: 80px;
        height: 80px;
        margin-right: 16px;
        border-radius: 4px;
        border: 1px solid #e8e8e8;
        cursor: pointer;
        background-repeat: no-repeat;
        background-size: cover;
        background-position: 50%;
      }
      .item-content {
        overflow: hidden;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: auto;
        .content-main {
          .main-title {
            .title-box {
              flex: 1 0 0;
              display: -webkit-box;
              overflow: hidden;
              text-overflow: ellipsis;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              white-space: normal;
              word-break: break-word;
              word-wrap: break-word;
              .title-text {
                line-height: 24px;
                font-size: 16px;
                color: #222;
                cursor: pointer;
                &:hover {
                  color: var(--el-color-primary);
                }
              }
            }
          }
        }
        .content-info {
          font-size: 12px;
          line-height: 16px;
          color: #999;
          .info-item {
            margin-right: 8px;
          }
          .answer-box {
            margin-top: 10px;
            line-height: 28px;
            .answer-item {
              .answer-info-label {
                display: inline-block;
              }
              .answer-info-value {
                display: inline-block;
                :deep(.el-rate){
                  line-height: 16px;
                }
              }
            }
          }
        }
      }
    }
    .topic-comment-list-wrapper {
      margin: 0 20px;
    }
  }
}
</style>
<style lang="scss">
  .custom-table table tr:last-child {
    td {
      border: 0;
    }
  }
  .detail-drawer {
    width: calc(100% - 210px);
  }
</style>
