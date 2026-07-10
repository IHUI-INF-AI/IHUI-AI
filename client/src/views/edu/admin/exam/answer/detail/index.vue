<template>
  <div class="exam-paper" v-loading="paperLoading">
    <div class="flex flex-col" :style="'height: ' + clientHeight + 'px'">
      <header class="exam-paper-header" ref="headerRef">
        <div class="question-menu-list" v-if="paper.questionList && paper.questionList.length">
          <span class="question-menu" v-for="(i, index) in paper.questionList.length" :key="i" @click="position(index)" :ref="el => { if (el) questionNavBtnList[index] = el }">{{i}}</span>
        </div>
      </header>
      <main ref="mainRef" class="flex-1" v-if="paper && paper.questionList && paper.questionList.length">
        <div class="paper-title">
          {{paper.title}}
        </div>
        <div class="paper-base">
          <span class="paper-base-info" v-if="record && record.id">状态：{{record.status === 'submitted' ? "待批改" : record.status === 'passed' ? "已通过" : "未通过"}}</span>
          <span class="paper-base-info">试卷得分：{{record.score}}</span>
          <span class="paper-base-info">合格分数：{{paper.passScore}}</span>
          <span class="paper-base-info">试卷总分：{{paper.score}}</span>
          <span class="paper-base-info">考试时长：{{paper.limitTime}} 分钟</span>
        </div>
        <div class="paper-question-list">
          <div class="paper-question" v-for="(item, index) in paper.questionList" :key="index" :ref="el => { if (el) questionNavList[index] = el }">
            <div class="title">
              {{index + 1}}. {{formatTitle(item)}}
            </div>
            <div class="question-body">
              <div v-if="item.type === 'subjective'">
                <Textarea :readonly="true" @blur="answerChangeHandle(index, item)" :rows="10" v-model="answerMap[item.type + '_' + item.id]"/>
              </div>
              <div v-if="item.type === 'fill_blank'">
                <div v-for="i in item.blankCount" :key="i" style="display: flex;margin: 10px 0;">
                  <div style="width: 20px;padding: 0 10px;">{{i}}.</div>
                  <Input :readonly="true" @blur="answerChangeHandle(index, item)" size="small" v-model="answerMap[item.type + '_' + item.id + '_' + i]"/>
                </div>
              </div>
              <div v-else-if="item.options">
                <div v-if="item.type === 'multi_choice'">
                  <Checkbox :disabled="true" v-model="answerMap[item.type + '_' + item.id]" :value="o.key" @change="answerChangeHandle(index, item)" v-for="o in JSON.parse(item.options)" :key="o.key">{{o.key}}. {{o.value}}</Checkbox>
                </div>
                <div v-else v-for="o in JSON.parse(item.options)" :key="o.key">
                  <Radio :disabled="true" @change="answerChangeHandle(index, item)" v-model="answerMap[item.type + '_' + item.id]" :value="o.key">{{o.key}}. {{o.value}}</Radio>
                </div>
              </div>
              <div class="answer-box">
                <div class="answer-item">
                  <div class="answer-info-label">结果：</div>
                  <div class="answer-info-value">
                    <Button style="padding: 3px 10px;" v-if="item.result" size="sm" variant="default">对</Button>
                    <Button style="padding: 3px 10px;" v-else size="sm" variant="destructive">错</Button>
                  </div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label">得分：</div>
                  <div class="answer-info-value" style="color: green;font-size: 20px;font-weight: 500;">{{item.scored || 0}}</div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label">分数：</div>
                  <div class="answer-info-value">{{item.score}}</div>
                </div>
                <div class="answer-item">
                  <div class="answer-info-label">难度：</div>
                  <div class="answer-info-value">
                    <div class="flex gap-1">
                      <svg v-for="i in 5" :key="i" :class="['h-4 w-4', i <= item.difficulty ? 'text-yellow-400' : 'text-muted-foreground']" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.783 1.401 8.168L12 18.896l-7.335 3.865 1.401-8.168L.132 9.21l8.2-1.192z"/></svg>
                    </div>
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
      </main>
    </div>
  </div>
</template>

<script>
import {nextTick, ref} from "vue"
import { examApi } from '@/api/edu/admin-api'
const { getPaper, getRecord } = examApi
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Radio } from '@/components/ui/radio'
import { Checkbox } from '@/components/ui/checkbox'
export default {
  name: "PaperDetail",
  components: {
    Radio,
    Checkbox,
    Button,
    Input,
    Textarea
  },
  props: {
    examId: {
      type: Number
    },
    signUpId: {
      type: Number
    },
    examChapterSectionId: {
      type: Number
    },
  },
  setup(props) {
    const clientHeight = ref(document.documentElement.clientHeight)
    window.onresize = () => {
      return (() => {
        clientHeight.value = document.documentElement.clientHeight;
      })()
    }
    const questionNavList = ref([])
    const questionNavBtnList = ref([])
    const mainRef = ref(null)
    const headerRef = ref(null)
    const position = (i) => {
      const anchor = questionNavList.value[i]
      const scrollTop = anchor.offsetTop - headerRef.value.offsetHeight
      nextTick(() => {
        mainRef.value.scrollTop = scrollTop
      })
    }
    const paper = ref({})
    const paperLoading = ref(false)
    const answerMap = ref({})
    const answerChangeHandle = (index, item) => {
      if (item.type === "subjective") {
        if (answerMap.value[item.type + "_" + item.id]) {
          questionNavBtnList.value[index].style.background = "#415fff";
        } else {
          questionNavBtnList.value[index].style.background = "#cccccc";
        }
      } else if (item.type === "multi_choice") {
        if (answerMap.value[item.type + "_" + item.id].length >= 2) {
          questionNavBtnList.value[index].style.background = "#415fff";
        } else if (answerMap.value[item.type + "_" + item.id].length === 1) {
          questionNavBtnList.value[index].style.background = "#fdc90c";
        } else {
          questionNavBtnList.value[index].style.background = "#cccccc";
        }
      } else if (item.type === "fill_blank") {
        let hasEmpty = false;
        let hasEmptyCount = 1;
        for (let i = 0; i < item.blankCount; i++) {
          if (!answerMap.value[item.type + "_" + item.id + "_" + (i + 1)]) {
            hasEmpty = true;
            hasEmptyCount++;
          }
        }
        if (hasEmpty) {
          if (hasEmptyCount === item.blankCount) {
            questionNavBtnList.value[index].style.background = "#fdc90c";
          } else {
            questionNavBtnList.value[index].style.background = "#cccccc";
          }
        } else {
          questionNavBtnList.value[index].style.background = "#415fff";
        }
      } else {
        if (answerMap.value[item.type + "_" + item.id]) {
          questionNavBtnList.value[index].style.background = "#415fff";
        }
      }
    }
    const record = ref({});
    // 加载试卷
    const loadPaper = () => {
      paperLoading.value = true;
      const p = {
        examId: props.examId,
        signUpId: props.signUpId,
        examChapterSectionId: props.examChapterSectionId
      }
      getRecord(p, (res) => {
        if (!(res && res.id)) {
          record.value = res
          getPaper(props.paperId, res => {
            if (res.questionList && res.questionList.length) {
              for (const question of res.questionList) {
                if (question.type === "multi_choice") {
                  answerMap.value[question.type + "_" + question.id] = []
                } else if (question.type === "fill_blank") {
                  let thisCount = 0;
                  question.title.replace(/\[_\]/g, function () {
                    thisCount++;
                    answerMap.value[question.type + "_" + question.id + "_" + thisCount] = ""
                    return "[_]"
                  });
                  question.blankCount = thisCount
                } else {
                  answerMap.value[question.type + "_" + question.id] = ""
                }
              }
            }
            paper.value = res
            paperLoading.value = false;
          })
        } else {
          record.value = res
          answerMap.value = JSON.parse(res.answer)
          paper.value = JSON.parse(res.paper)
          paperLoading.value = false;
          nextTick(() => {
            // 题目导航颜色
            let i = 0
            for (const q of paper.value.questionList) {
              answerChangeHandle(i, q);
              i++;
            }
          })
        }
      })
    }
    loadPaper()
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
    return {
      clientHeight,
      questionNavList,
      questionNavBtnList,
      paper,
      paperLoading,
      answerMap,
      position,
      mainRef,
      headerRef,
      answerChangeHandle,
      formatTitle,
      colors,
      record
    }
  }
}
</script>

<style scoped lang="scss">
.exam-paper {
  .exam-paper-header {
    background: rgba(65, 95, 255, .1);
    .question-menu-list {
      .question-menu {
        background: #cccccc;
        padding: 3px 10px;
        vertical-align: middle;
        margin: 5px 10px 5px 0;
        border-radius: 4px;
        float: left;
        cursor: pointer;
        color: #ffffff;
        &:not(.countdown):hover {
          background: hsl(var(--primary));
        }
      }
      .countdown {
        float: right;
        background: none;
        margin-right: 0;
        cursor: text;
        color: #222222;
      }
    }
  }
  main {
    background: #ffffff;
    .paper-title {
      font-size: 30px;
      font-weight: 500;
      text-align: center;
    }
    .paper-base {
      text-align: center;
      margin: 20px 0;
      .paper-base-info {
        padding: 0 20px;
      }
    }
    .paper-question-list {
      .paper-question {
        padding: 20px 0;
        line-height: 36px;
        .answer-box {
          margin-top: 20px;
          .answer-item {
            .answer-info-label {
              display: inline-block;
            }
            .answer-info-value {
              display: inline-block;
            }
          }
        }
      }
    }
  }
}
</style>
