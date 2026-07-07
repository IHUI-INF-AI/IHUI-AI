<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="exam-record"/>
      </el-col>
      <el-col :span="20" v-loading="listLoading">
        <el-empty style="background: #ffffff;border-radius: 6px;" v-if="!(paperRecordList && paperRecordList.length)"/>
        <div v-else class="wrong-question-list">
          <div class="wrong-question" v-for="item in paperRecordList" :key="item.id">
            <div class="question-title" @click="gotoDetail(item)">
              {{item.paper.title}}
            </div>
            <div class="question-body">
              <div class="answer-box">
                <el-row v-if="item.paper">
                  <el-col :span="8">
                    <div class="answer-item">
                      <div class="answer-info-label">答卷状态：</div>
                      <div class="answer-info-value">
                        <span :class="item.status">{{statusMap[item.status]}}</span>
                      </div>
                    </div>
                    <div class="answer-item">
                      <div class="answer-info-label">试卷类型：</div>
                      <div class="answer-info-value">
                        {{paperTypeMap[item.paper.type]}}
                      </div>
                    </div>
                    <div class="answer-item">
                      <div class="answer-info-label">试卷难度</div>
                      <div class="answer-info-value">
                        <el-rate :disabled="true" v-model="item.paper.difficulty" :colors="colors"></el-rate>
                      </div>
                    </div>
                  </el-col>
                  <el-col :span="8">
                    <div class="answer-item" v-if="item.paper && item.paper.questionList">
                      <div class="answer-info-label">题目数量：</div>
                      <div class="answer-info-value">{{item.paper.questionList.length || 0}}</div>
                    </div>
                    <div class="answer-item">
                      <div class="answer-info-label">试卷总分页</div>
                      <div class="answer-info-value">{{item.paper.score || 0}}</div>
                    </div>
                    <div class="answer-item">
                      <div class="answer-info-label">合格分数量</div>
                      <div class="answer-info-value">{{item.paper.passScore || 0}}</div>
                    </div>
                  </el-col>
                  <el-col :span="8">
                    <div class="answer-item">
                      <div class="answer-info-label">开始时间：</div>
                      <div class="answer-info-value">
                        {{item.startTime}}
                      </div>
                    </div>
                    <div class="answer-item">
                      <div class="answer-info-label">提交时间线</div>
                      <div class="answer-info-value">
                        {{item.endTime}}
                      </div>
                    </div>
                    <div class="answer-item">
                      <div class="answer-info-label">试卷得分页</div>
                      <div class="answer-info-value" style="color: green;font-size: 20px;font-weight: 500;">{{item.score || 0}}</div>
                    </div>
                  </el-col>
                </el-row>
              </div>
            </div>
          </div>
        </div>
        <page style="padding: 20px;" :page-size="param.size" :total="total" :current-change="currentChange" :size-change="sizeChange"></page>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import {ref} from "vue"
import memberMenu from "../../menu/index.vue"
import {getMemberPaperRecordList} from "@/api/edu/web/exam"
import Page from "@/components/Page";
import router from "@/router";

export default {
  name: "memberExamRecord",
  components: {
    Page,
    memberMenu
  },
  setup() {
    const total = ref(0)
    const paperRecordList = ref([])
    const param = ref({
      current: 1,
      size: 20
    })
    const listLoading = ref(true)
    const load = function() {
      listLoading.value = true
      getMemberPaperRecordList(param.value, res => {
        for (const record of res.list) {
          record.paper = JSON.parse(record.paper)
          record.answer = JSON.parse(record.answer)
        }
        paperRecordList.value = res.list
        total.value = res.total
        listLoading.value = false
      })
    }
    load()
    const currentChange = (current) => {
      param.value.current = current
      load();
    }
    const sizeChange = (size) => {
      param.value.size = size
      load();
    }
    const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
    const gotoDetail = (item) => {
      const { href } = router.resolve({path: "/edu/exam/paper/detail", query: {examId: item.examId, signUpId: item.signUpId, examChapterSectionId: item.examChapterSectionId}});
      window.open(href, "_blank");
    }
    const paperTypeMap = {
      "normal": "静态试卷",
      "random": "随机试卷",
      "mock": "模拟试卷",
    }
    const statusMap = {
      "draft": "草稿",
      "submitted": "待批改",
      "passed": "已通过",
      "failed": "未通过",
      "deleted": "已删除"
    }
    return {
      param,
      total,
      currentChange,
      sizeChange,
      paperRecordList,
      colors,
      listLoading,
      gotoDetail,
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
      .wrong-question-list {
        background-color: #FFFFFF;
        margin: 20px;
        .wrong-question {
          margin: 0 0 20px 0;
          line-height: 36px;
          border-radius: 6px;
          background: #ffffff;
          border: 1px solid #f0f0f0;
          &:first-child {
            margin-top: 0;
          }
          .wrong-header {
            background: #cccccc;
            color: #000;
            padding: 0 20px;
            line-height: 40px;
            .wrong-header-btn-box {
              display: inline-block;
              float: right;
            }
          }
          .question-title {
            padding: 20px 0 0 20px;
            cursor: pointer;
            &:hover {
              color: var(--el-color-primary);
            }
          }
          .question-body {
            padding: 0 20px 20px 20px;
            :deep(.el-checkbox__input.is-disabled.is-checked .el-checkbox__inner) {
              background-color: var(--el-color-primary);
            }
            :deep(.el-radio__input.is-disabled.is-checked .el-radio__inner) {
              background-color: var(--el-color-primary);
            }
            :deep(.el-checkbox-group) {
              .el-checkbox__label {
                color: #333;
              }
            }
            :deep(.el-radio__label) {
              color: #333;
            }
          }
          .answer-box {
            margin-top: 10px;
            .answer-item {
              .answer-info-label {
                display: inline-block;
              }
              .answer-info-value {
                display: inline-block;
                :deep(.el-rate) {
                  line-height: 16px;
                }
              }
              .passed {
                background: green;
                color: #FFFFFF;
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 12px;
              }
              .failed {
                background: red;
                color: #FFFFFF;
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 12px;
              }
              .submitted {
                background: orange;
                color: #FFFFFF;
                padding: 3px 10px;
                border-radius: 20px;
                font-size: 12px;
              }
            }
          }
        }
      }
    }
  }
}
</style>
