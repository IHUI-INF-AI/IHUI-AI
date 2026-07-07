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
      </el-form>
    </div>
    <div class="content">
      <el-table v-loading="dataLoading" class="custom-table" ref="multipleTable" :data="list" style="width: 100%" @expand-change="expandChange">
        <el-table-column type="expand">
          <template #default="scope">
            <el-card style="margin-top: 20px;">
              <template #header>
                <div class="clearfix">
                  <span>章节</span>
                </div>
              </template>
              <div>
                <el-table :default-expand-all="true" class="custom-table" :data="scope.row.chapterList" :show-header="false" style="width: 100%;">
                  <el-table-column type="expand">
                    <template #default="props">
                      <el-table class="custom-table" :data="props.row.chapterSectionList" :show-header="false" style="width: 100%;">
                        <el-table-column prop="title" label="标题"></el-table-column>
                        <el-table-column label="操作" width="100">
                          <template #default="s">
                            <el-button link @click="showRecordListDrawer(s.row)">答题记录</el-button>
                          </template>
                        </el-table-column>
                      </el-table>
                    </template>
                  </el-table-column>
                  <el-table-column prop="title" label="标题"></el-table-column>
                </el-table>
              </div>
            </el-card>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="考试标题"></el-table-column>
        <el-table-column align="center" label="报名人数">
          <template #default="scope">
            {{scope.row.signUpNum || 0}}
          </template>
        </el-table-column>
        <el-table-column align="right" label="状态">
          <template #default="scope">
            {{statusMap[scope.row.status]}}
          </template>
        </el-table-column>
      </el-table>
    </div>
    <el-drawer class="custom-drawer" v-model="recordListDrawer" direction="rtl" :before-close="drawerClose" destroy-on-close>
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
            <div class="content-info">
              <div class="answer-box">
                <el-row v-if="selectTopic.paper">
                  <el-col :span="8">
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
                        <el-rate :disabled="true" v-model="selectTopic.paper.difficulty" :colors="colors"></el-rate>
                      </div>
                    </div>
                  </el-col>
                  <el-col :span="8">
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
                  </el-col>
                  <el-col :span="8">
                  </el-col>
                </el-row>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div class="topic-comment-list-wrapper">
        <el-table v-loading="paperRecordLoading" :data="paperRecordList" style="width: 100%">
          <el-table-column label="姓名">
            <template #default="scope">
              {{scope.row.member && scope.row.member.name}}
            </template>
          </el-table-column>
          <el-table-column label="开始时间" prop="startTime"></el-table-column>
          <el-table-column label="提交时间" prop="endTime"></el-table-column>
          <el-table-column label="得分">
            <template #default="scope">
              {{scope.row.score || 0}}
            </template>
          </el-table-column>
          <el-table-column label="得分">
            <template #default="scope">
              <el-button link @click="showDetail(scope.row)">答题详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        <page :total="paperRecordTotal" :current-change="paperRecordCurrentChange" :size-change="paperRecordSizeChange" :page-size="paperRecordParam.size"></page>
      </div>
      <el-drawer v-if="detailDrawer" :append-to-body="true" v-model="detailDrawer" direction="rtl" :before-close="hideDetail" destroy-on-close class="detail-drawer">
        <template #header>
          <div>
            {{detailItem.member && detailItem.member.name}} <span style="color: #999999;font-size: 12px;">(报名id：{{detailItem.signUpId}})</span>
          </div>
        </template>
        <paper-detail v-if="detailDrawer" :exam-chapter-section-id="detailItem.examChapterSectionId" :exam-id="detailItem.examId" :sign-up-id="detailItem.signUpId"/>
      </el-drawer>
    </el-drawer>
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

export default {
  name: "ExamAnswerListIndex",
  components: {
    PaperDetail,
    Page
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
      detailDrawer
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
  .el-table th.is-leaf, .el-table td {
    border: 0;
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
:deep(.el-table__inner-wrapper::before){
  content: normal;
}
</style>
<style lang="scss">
  .custom-table table tr:last-child {
    td {
      border: 0;
    }
  }
  .el-table::before {
    height: 0;
  }
  .detail-drawer {
    width: calc(100% - 210px);
  }
</style>
