<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="exam-sign-up"/>
      </el-col>
      <el-col :span="20">
        <div class="record-box">
          <el-table size="small" v-loading="dataLoading" :data="examSignUpList" style="width: 100%" :default-expand-all="true" @expand-change="expandChange">
            <el-table-column type="expand">
              <template #default="scope">
                <el-menu size="small" v-if="defaultOpenedIndexList && defaultOpenedIndexList.length" class="el-menu-vertical" :default-openeds="defaultOpenedIndexList">
                  <el-sub-menu class="paper-list" size="small" :index="index + ''" v-for="(chapter, index) in scope.row.chapterSectionList" :key="chapter.id">
                    <template #title>
                      <div class="slot-title">{{chapter.title}}</div>
                    </template>
                    <el-menu-item @click="gotoPaperDetail(scope.row.id, scope.row.signUp.id, chapterSection.id)" :index="index + '-' + i" v-for="(chapterSection, i) in chapter.chapterSectionList" :key="chapterSection.id">
                      <template #title>
                        <div class="paper">
                          <div class="paper-header">
                            <div class="message-item-content">
                              <el-icon><Document /></el-icon>
                              {{chapterSection.title}}
                            </div>
                            <div class="message-item-tips">
                              <span v-if="!examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id]">未进行答案</span>
                              <span v-else-if="examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].status !== 'draft'">点击查看答题详情</span>
                              <span v-else>未提交答案</span>
                            </div>
                          </div>
                          <div class="paper-body" v-if="examChapterSectionRecordMap && examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id] && examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].paper">
                            <el-row>
                              <el-col :span="8">
                                <div class="answer-item">
                                  <div class="answer-info-label">试卷状态：</div>
                                  <div class="answer-info-value">
                                    {{statusMap[examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].status]}}
                                  </div>
                                </div>
                                <div class="answer-item">
                                  <div class="answer-info-label">试卷类型：</div>
                                  <div class="answer-info-value">
                                    {{paperTypeMap[examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].paper.type]}}
                                  </div>
                                </div>
                                <div class="answer-item">
                                  <div class="answer-info-label">试卷难度</div>
                                  <div class="answer-info-value">
                                    <el-rate :disabled="true" v-model="examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].paper.difficulty" :colors="colors"></el-rate>
                                  </div>
                                </div>
                              </el-col>
                              <el-col :span="8">
                                <div class="answer-item">
                                  <div class="answer-info-label">题目数量：</div>
                                  <div class="answer-info-value">{{examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].paper.questionList.length || 0}}</div>
                                </div>
                                <div class="answer-item">
                                  <div class="answer-info-label">试卷总分页</div>
                                  <div class="answer-info-value">{{examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].paper.score || 0}}</div>
                                </div>
                                <div class="answer-item">
                                  <div class="answer-info-label">合格分数量</div>
                                  <div class="answer-info-value">{{examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].paper.passScore || 0}}</div>
                                </div>
                              </el-col>
                              <el-col :span="8">
                                <div class="answer-item">
                                  <div class="answer-info-label">开始时间：</div>
                                  <div class="answer-info-value">
                                    {{examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].startTime}}
                                  </div>
                                </div>
                                <div class="answer-item">
                                  <div class="answer-info-label">提交时间线</div>
                                  <div class="answer-info-value">
                                    {{examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].endTime}}
                                  </div>
                                </div>
                                <div class="answer-item">
                                  <div class="answer-info-label">试卷得分页</div>
                                  <div class="answer-info-value" style="color: green;font-size: 20px;font-weight: 500;">{{examChapterSectionRecordMap[scope.row.id + '_' + scope.row.signUp.id + '_' + chapterSection.id].score || 0}}</div>
                                </div>
                              </el-col>
                            </el-row>
                          </div>
                        </div>
                      </template>
                    </el-menu-item>
                  </el-sub-menu>
                </el-menu>
              </template>
            </el-table-column>
            <el-table-column prop="index" label="编号" width="80">
              <template #default="scope">
                {{ scope.$index + 1 }}
              </template>
            </el-table-column>
            <el-table-column prop="signUp.id" label="报名ID" width="80"></el-table-column>
            <el-table-column prop="name" label="名称">
              <template #default="scope">
                <span @click="gotoDetail(scope.row)">{{scope.row.name}}</span>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="状态" width="100">
              <template #default="scope">
                <span style="width: 80px;" :style="scope.row.signUp.status  === 'cancel_sign_up' ? 'color: #F56C6C': scope.row.signUp.status  === 'completed' ? 'color: #67c23a' : 'color: #07c160'">{{signUpStatusMap[scope.row.signUp.status]}}</span>
              </template>
            </el-table-column>
            <el-table-column prop="createTime" label="报名时间" width="180"></el-table-column>
          </el-table>
        </div>
        <page style="padding: 20px;" :total="total" :page-size="param.size" :current-change="currentChange" :size-change="sizeChange"></page>
      </el-col>
    </el-row>
  </div>
</template>

<script>
  import {ref} from "vue"
  import router from "@/router"
  import memberMenu from "../../menu/index.vue"
  import {getExamChapterList, getExamSignUpList, getExamRecordList} from "@/api/edu/web/exam"
  import Page from "@/components/Page";
  import {warning} from "@/util/tipsUtils";
  import { Document } from '@/lib/lucide-fallback';

  export default {
    name: "memberExamRecord",
    components: {
      Page,
      memberMenu,
      Document
    },
    setup() {
      const defaultOpenedIndexList = ref([])
      const examChapterSectionRecordMap = ref({})
      const loadExamRecordList = (item) => {
        getExamRecordList({examId: item.id, signUpId: item.signUp.id}, res => {
          if (res && res.length) {
            for (const r of res) {
              r.paper = JSON.parse(r.paper)
              r.answer = JSON.parse(r.answer)
              examChapterSectionRecordMap.value[r.examId + "_" + item.signUp.id + "_" + r.examChapterSectionId] = r
            }
          }
        })
      }
      // 获取考试记录
      const total = ref(0)
      const dataLoading = ref(true)
      const examSignUpList = ref([])
      const param = ref({
        current: 1,
        size: 20
      })
      const signUpStatusMap = {
        signed_up: "进行",
        completed: "已完成",
        cancel_sign_up: "取消报名"
      }
      const load = function() {
        dataLoading.value = true
        getExamSignUpList(param.value, res => {
          total.value = res.total
          // for (const signUp of res.list) {
          //   examSignUpList.value.push(signUp)
          // }
          examSignUpList.value = res.list
          dataLoading.value = false
        })
      }
      load()
      const expandChange = (row, expandedRows) => {
        // 展开
        if(expandedRows.length > 0) {
          if (!(row.chapterSectionList && row.chapterSectionList.length)) {
            getExamChapterList({examId: row.id}, r => {
              row.chapterSectionList = r.list
              if (r.list && r.list.length) {
                for (let i = 0; i < r.list.length; i++) {
                  defaultOpenedIndexList.value.push(i + "");
                }
              }
            })
            loadExamRecordList(row)
          }
        }
      }
      const gotoDetail = function(item) {
        router.push({path: "/edu/exam/detail", query: {id: item.id}})
      }
      const gotoPaperDetail = (examId, signUpId, examChapterSectionId) => {
        if (!examChapterSectionRecordMap.value[examId + "_" + signUpId + "_" + examChapterSectionId]) {
          warning("请先答题")
        } else if (examChapterSectionRecordMap.value[examId + "_" + signUpId + "_" + examChapterSectionId].status !== "draft") {
          const { href } = router.resolve({path: "/edu/exam/paper/detail", query: {examId: examId, signUpId: signUpId, examChapterSectionId: examChapterSectionId}});
          window.open(href, "_blank");
        } else {
          warning("请先提交答卷")
        }
      }
      const currentChange = (current) => {
        param.value.current = current
        load();
      }
      const sizeChange = (size) => {
        param.value.size = size
        load();
      }
      const paperTypeMap = {
        "normal": "静态试卷",
        "random": "随机试卷",
        "mock": "模拟试卷",
      }
      const statusMap = {
        "draft": "草稿",
        "submitted": "待批",
        "passed": "已通过",
        "failed": "未通过",
        "deleted": "已删除"
      }
      return {
        param,
        examSignUpList,
        defaultOpenedIndexList,
        examChapterSectionRecordMap,
        gotoDetail,
        gotoPaperDetail,
        signUpStatusMap,
        expandChange,
        currentChange,
        sizeChange,
        dataLoading,
        total,
        paperTypeMap,
        statusMap
      }
    }
  }
</script>

<style lang="scss" scoped>
.content-container {
  .row {
    height: 100%;
    .el-col {
      height: 100%;
      .record-box {
        background-color: #FFFFFF;
        margin: 20px;
        :deep(.el-table__expanded-cell) {
          background: #fafafa;
          &:hover {
            background: #fafafa;
          }
          .el-sub-menu__title {
            background: #fafafa;
          }
          .el-menu-item {
            height: auto;
            &:hover, &:focus {
              background-color: #ffffff;
            }
            .paper {
              .paper-header {
                .message-item-content {
                  display: contents;
                  &:hover {
                    color: var(--el-color-primary);
                  }
                }
                .message-item-tips {
                  display: inline-block;
                  color: #999999;
                  font-size: 12px;
                  float: right;
                }
              }
              .paper-body {
                background: #f7f7f7;
                padding: 10px 20px;
                margin-bottom: 20px;
                color: #000;
                .answer-item {
                  line-height: 30px;
                  .answer-info-label {
                    display: inline-block;
                  }
                  .answer-info-value {
                    display: inline-block;
                    :deep(.el-rate) {
                      line-height: 16px;
                    }
                  }
                }
              }
            }
          }
        }
        .el-menu-vertical {
          border: 0;
        }
      }
    }
  }
}
</style>
