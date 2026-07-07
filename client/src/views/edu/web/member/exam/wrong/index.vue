<template>
  <div class="content-container">
    <el-row class="row">
      <el-col :span="4">
        <member-menu active="exam-wrong-question"/>
      </el-col>
      <el-col :span="20" v-loading="listLoading">
        <el-empty style="background: #ffffff;border-radius: 6px;" v-if="!(wrongQuestionList && wrongQuestionList.length)"/>
        <div v-else class="wrong-question-list">
          <div class="wrong-question" v-for="item in wrongQuestionList" :key="item.id">
            <div class="wrong-header">
              <span>{{questionTypeMap[item.type]}}</span>
              <div class="wrong-header-btn-box">
                <el-button link @click="remove(item)">移出错题目</el-button>
              </div>
            </div>
            <div class="question-title">
              {{formatTitle(item)}}
            </div>
            <div class="question-body">
              <div v-if="item.type === 'subjective'">
                <el-input :readonly="true" type="textarea" :rows="10" v-model="answerMap[item.type + '_' + item.id]"/>
              </div>
              <div v-if="item.type === 'fill_blank'">
                <div v-for="i in item.blankCount" :key="i" style="display: flex;margin: 10px 0;">
                  <div style="width: 20px;padding: 0 10px;">{{i}}.</div>
                  <el-input :readonly="true" size="small" v-model="answerMap[item.type + '_' + item.id + '_' + i]"/>
                </div>
              </div>
              <div v-else-if="item.options">
                <el-checkbox-group v-if="item.type === 'multi_choice'" v-model="answerMap[item.type + '_' + item.id]">
                  <el-checkbox :disabled="true" :label="o.key" v-for="o in JSON.parse(item.options)" :key="o.key">{{o.key}}. {{o.value}}</el-checkbox>
                </el-checkbox-group>
                <div v-else v-for="o in JSON.parse(item.options)" :key="o.key">
                  <el-radio :disabled="true" v-model="answerMap[item.type + '_' + item.id]" :label="o.key">{{o.key}}. {{o.value}}</el-radio>
                </div>
              </div>
              <div class="answer-box">
                <div class="answer-item">
                  <div class="answer-info-label">结果</div>
                  <div class="answer-info-value">
                    <el-button style="padding: 3px 10px;" v-if="item.result" size="small" type="success">正确</el-button>
                    <el-button style="padding: 3px 10px;" v-else size="small" type="danger">错误</el-button>
                  </div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label">分数量</div>
                  <div class="answer-info-value">{{item.score}}</div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label">得分页</div>
                  <div class="answer-info-value" style="color: green;font-size: 20px;font-weight: 500;">{{item.scored || 0}}</div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label">难度</div>
                  <div class="answer-info-value">
                    <el-rate :disabled="true" v-model="item.difficulty" :colors="colors"></el-rate>
                  </div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label" style="vertical-align: top;">正确答案：</div>
                  <div class="answer-info-value">
                    <div v-if="item.type === 'fill_blank'">
                      <div v-for="(blank, i) in item.referenceAnswer.split('[_]')" :key="i">
                        填空 {{i + 1}}. {{blank}}
                      </div>
                    </div>
                    <div v-else>
                      {{item.referenceAnswer}}
                    </div>
                  </div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label">解析：</div>
                  <div class="answer-info-value">
                    {{item.referenceAnswerNote}}
                  </div>
                </div>
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
  import {getWrongQuestionList, removeWrongQuestion} from "@/api/edu/web/exam"
  import Page from "@/components/Page";
  import {confirm, success} from "@/util/tipsUtils";

  export default {
    name: "memberWrongQuestion",
    components: {
      Page,
      memberMenu
    },
    setup() {
      const total = ref(0)
      const wrongQuestionList = ref([])
      const param = ref({
        current: 1,
        size: 20
      })
      const listLoading = ref(true)
      const answerMap = ref({})
      const questionTypeMap = {
        fill_blank: "填空题",
        judgment: "判断题",
        multi_choice: "多选题",
        single_choice: "单选题",
        subjective: "简答题"
      }
      const load = function() {
        listLoading.value = true
        getWrongQuestionList(param.value, res => {
          for (const question of res.list) {
            if (question.type === "multi_choice") {
              answerMap.value[question.type + "_" + question.id] = question.answer.split(",")
            } else if (question.type === "fill_blank") {
              const answerArray = question.answer.split("[_]")
              let thisCount = 0;
              question.title.replace(/\[_\]/g, function () {
                answerMap.value[question.type + "_" + question.id + "_" + (thisCount + 1)] = answerArray[thisCount]
                thisCount++;
                return "[_]"
              });
              question.blankCount = thisCount
            } else {
              answerMap.value[question.type + "_" + question.id] = question.answer
            }
          }
          wrongQuestionList.value = res.list
          total.value = res.total
          listLoading.value = false
        })
      }
      load()
      const remove = function(item) {
        confirm("确定移除该题目？", "提示", () => {
          removeWrongQuestion({id: item.id}, () => {
            success("移除成功")
            load()
          })
        })
      }
      const formatTitle = (item) => {
        if (item.type === "fill_blank") {
          let title = item.title
          for (let i = 0; i < item.blankCount; i++) {
            title = title.replace("[_]", "[__" + (i + 1) + "__]");
          }
          return title
        } else {
          return item.title
        }
      }
      const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
      const currentChange = (current) => {
        param.value.current = current
        load();
      }
      const sizeChange = (size) => {
        param.value.size = size
        load();
      }
      return {
        param,
        total,
        currentChange,
        sizeChange,
        wrongQuestionList,
        answerMap,
        questionTypeMap,
        remove,
        formatTitle,
        colors,
        listLoading
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
          margin: 20px 0;
          line-height: 36px;
          border-radius: 6px;
          background: #ffffff;
          &:first-child {
            margin-top: 0;
          }
          .wrong-header {
            background: #fafafa;
            color: #000;
            line-height: 40px;
            padding: 0 10px;
            .wrong-header-btn-box {
              display: inline-block;
              float: right;
            }
          }
          .question-title {
            padding: 20px 0 0 20px;
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
            }
          }
        }
      }
    }
  }
}
</style>
