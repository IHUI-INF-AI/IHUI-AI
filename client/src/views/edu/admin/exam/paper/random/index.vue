<template>
  <div class="paper-box">
    <el-form :model="paper" :rules="paperRules" ref="paperRef" label-width="120px">
      <el-form-item label="分类：" prop="cidList">
        <el-cascader size="small" style="width: 100%;"
                     v-model="selectCidList"
                     :props="{ multiple: true, checkStrictly: true }"
                     :options="categoryOptions"
                     @change="changeCategory">
        </el-cascader>
      </el-form-item>
      <el-form-item label="试卷名称：" prop="title">
        <el-input size="small" v-model="paper.title" placeholder="请输入试卷名称"></el-input>
      </el-form-item>
      <el-form-item label="试卷描述：" prop="description">
        <el-input size="small" type="textarea" :rows="5" v-model="paper.description" placeholder="请输入试卷描述"></el-input>
      </el-form-item>
      <el-form-item label="抽题规则：" prop="questionIdList">
        <el-card size="small" shadow="never">
          <template #header>
            <div class="clearfix"></div>
          </template>
          <div class="question-rule">
            <div class="question-rule-item">
              <div class="title">题目分类</div>
              <div class="content">
                <el-cascader size="small" style="width: 100%;"
                             v-model="selectQuestionCidList"
                             :props="{ multiple: true, checkStrictly: true }"
                             :options="questionCategoryOptions"
                             @change="changeQuestionCategory"></el-cascader>
              </div>
            </div>
            <div class="question-rule-item">
              <div class="title">单选题</div>
              <div class="content">
                <div class="content-item">
                  <span>题目数量：</span>
                  <el-input v-model="questionRule.singleChoice.number" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>每题分数：</span>
                  <el-input v-model="questionRule.singleChoice.score" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>题目难度：</span>
                  <el-rate v-model="questionRule.singleChoice.difficulty" style="display: inline-block;width: 150px;" :colors="colors"></el-rate>
                </div>
              </div>
            </div>
            <div class="question-rule-item">
              <div class="title">多选题</div>
              <div class="content">
                <div class="content-item">
                  <span>题目数量：</span>
                  <el-input v-model="questionRule.multiChoice.number" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>每题分数：</span>
                  <el-input v-model="questionRule.multiChoice.score" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>题目难度：</span>
                  <el-rate v-model="questionRule.multiChoice.difficulty" style="display: inline-block;width: 150px;" :colors="colors"></el-rate>
                </div>
              </div>
            </div>
            <div class="question-rule-item">
              <div class="title">判断题</div>
              <div class="content">
                <div class="content-item">
                  <span>题目数量：</span>
                  <el-input v-model="questionRule.judgment.number" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>每题分数：</span>
                  <el-input v-model="questionRule.judgment.score" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>题目难度：</span>
                  <el-rate v-model="questionRule.judgment.difficulty" style="display: inline-block;width: 150px;" :colors="colors"></el-rate>
                </div>
              </div>
            </div>
            <div class="question-rule-item">
              <div class="title">填空题</div>
              <div class="content">
                <div class="content-item">
                  <span>题目数量：</span>
                  <el-input v-model="questionRule.fillBlank.number" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>每题分数：</span>
                  <el-input v-model="questionRule.fillBlank.score" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>题目难度：</span>
                  <el-rate v-model="questionRule.fillBlank.difficulty" style="display: inline-block;width: 150px;" :colors="colors"></el-rate>
                </div>
              </div>
            </div>
            <div class="question-rule-item">
              <div class="title">简答题</div>
              <div class="content">
                <div class="content-item">
                  <span>题目数量：</span>
                  <el-input v-model="questionRule.subjective.number" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>每题分数：</span>
                  <el-input v-model="questionRule.subjective.score" @blur="changeRule" size="small"/>
                </div>
                <div class="content-item">
                  <span>题目难度：</span>
                  <el-rate v-model="questionRule.subjective.difficulty" style="display: inline-block;width: 150px;" :colors="colors"></el-rate>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-form-item>
      <el-form-item label="试卷总分：">
        {{paper.score}} 分
      </el-form-item>
      <el-form-item label="合格分数："  prop="passScore">
        <el-input size="small" v-model="paper.passScore" placeholder="请输入试题分数"></el-input>
      </el-form-item>
      <el-form-item label="试卷时间：" prop="limitTime">
        <el-input size="small" v-model="paper.limitTime" placeholder="请输入试卷时间（分）"></el-input>
      </el-form-item>
      <el-form-item label="题序打乱：" prop="questionDisordered">
        <el-switch id="questionDisordered" v-model="paper.questionDisordered" active-color="#415fff" active-text="是" inactive-text="否"></el-switch>
      </el-form-item>
      <el-form-item label="选项打乱：" prop="optionDisordered">
        <el-switch id="optionDisordered" v-model="paper.optionDisordered" active-color="#415fff" active-text="是" inactive-text="否"></el-switch>
      </el-form-item>
      <el-form-item label="试卷难度：" prop="difficulty">
        <el-rate style="line-height: 48px;" v-model="paper.difficulty" :colors="colors"></el-rate>
      </el-form-item>
    </el-form>
    <el-button size="small" style="display:block;margin:50px auto;" @click="submitBaseInfo">提交</el-button>
  </div>
</template>
<script>
// @ts-nocheck
  import {ref} from "vue"
  import { examApi as questionCategoryApi } from '@/api/edu/admin-api'
  import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getAllParent } = examApi
  const { saveBaseInfo, updateBaseInfo, getBaseInfo } = examApi
  import {useRoute} from "vue-router";
  import {error, success} from "@/util/tipsUtils";
  import router from "@/router";
  import { examApi as questionApi } from '@/api/edu/admin-api';

  export default {
    name: "ExamPaperRandomIndex",
    setup() {
      const route = useRoute()
      const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
      const paper = ref({
        id: "",
        cidList: [],
        title: "",
        description: "",
        type: "random",
        score: 0,
        limitTime: "",
        passScore: 0,
        questionDisordered: false,
        optionDisordered: false,
        difficulty: 2,
        questionIdList: [],
        ruleJson: ""
      })
      const paperRules = {
        title: [{ required: true, message: "请输入题干", trigger: "blur" }],
        score: [{ required: true, message: "请输入分数", trigger: "blur" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
        passScore: [{ required: true, message: "请选择合格分数", trigger: "change" }],
        limitTime: [{ required: true, message: "请输入试卷时间", trigger: "blur" }],
      }
      const categoryOptions = ref([])
      const selectCidList = ref([])
      const questionList = ref([])
      const questionRule = ref({
        cidList: [],
        singleChoice: {
          number: "",
          score: "",
          difficulty: 2
        },
        multiChoice: {
          number: "",
          score: "",
          difficulty: 2
        },
        judgment: {
          number: "",
          score: "",
          difficulty: 2
        },
        fillBlank: {
          number: "",
          score: "",
          difficulty: 2
        },
        subjective: {
          number: "",
          score: "",
          difficulty: 2
        }
      })
      const selectQuestionCidList = ref([])
      const questionCategoryOptions = ref([])
      // 获取分类
      findCategoryList(0, true, (res) => {
        if (res && res.length) {
          categoryOptions.value = toTree(res);
          categoryOptions.value.splice(0, 1);
          if (route.query.id) {
            // 获取试卷信息
            getBaseInfo(route.query.id, (res) => {
              paper.value = res;
              selectCidList.value = getAllParent(categoryOptions.value, res.cidList);
              paper.value.cidList = []
              for (const valElement of selectCidList.value) {
                paper.value.cidList.push(valElement[valElement.length - 1])
              }
              paper.value.questionIdList = []
              if (res.questionList && res.questionList.length) {
                for (const valElement of res.questionList) {
                  paper.value.questionIdList.push(valElement.id)
                  questionList.value.push(valElement)
                }
              }
              if (paper.value.ruleJson) {
                questionRule.value = JSON.parse(res.ruleJson);
              }
              if (questionCategoryOptions.value && questionCategoryOptions.value.length) {
                selectQuestionCidList.value = getAllParent(questionCategoryOptions.value, questionRule.value.cidList);
              }
            })
          }
        }
      })
      // 选择分类
      const changeCategory = (val) => {
        paper.value.cidList = []
        for (const valElement of val) {
          paper.value.cidList.push(valElement[valElement.length - 1])
        }
      }
      questionCategoryApi.findCategoryList(0, true, (res) => {
        if (res && res.length) {
          questionCategoryOptions.value = toTree(res);
          questionCategoryOptions.value.splice(0, 1);
          if (questionRule.value && questionRule.value.cidList && questionRule.value.cidList.length) {
            selectQuestionCidList.value = getAllParent(questionCategoryOptions.value, questionRule.value.cidList);
          }
        }
      })
      const changeQuestionCategory = (val) => {
        questionRule.value.cidList = []
        for (const valElement of val) {
          questionRule.value.cidList.push(valElement[valElement.length - 1])
        }
      }
      const changeRule = () => {
        paper.value.score = 0;
        paper.value.score += (questionRule.value.singleChoice.number || 0) * (questionRule.value.singleChoice.score || 0);
        paper.value.score += (questionRule.value.multiChoice.number || 0) * (questionRule.value.multiChoice.score || 0);
        paper.value.score += (questionRule.value.judgment.number || 0) * (questionRule.value.judgment.score || 0);
        paper.value.score += (questionRule.value.fillBlank.number || 0) * (questionRule.value.fillBlank.score || 0);
        paper.value.score += (questionRule.value.subjective.number || 0) * (questionRule.value.subjective.score || 0);
      }
      const paperRef = ref();
      const submitBaseInfo = () => {
        if (!(questionRule.value.singleChoice.number && questionRule.value.singleChoice.score) &&
            !(questionRule.value.singleChoice.number && questionRule.value.singleChoice.score) &&
            !(questionRule.value.singleChoice.number && questionRule.value.singleChoice.score) &&
            !(questionRule.value.singleChoice.number && questionRule.value.singleChoice.score) &&
            !(questionRule.value.singleChoice.number && questionRule.value.singleChoice.score) &&
            !(questionRule.value.cidList && questionRule.value.cidList.length)) {
          error("请填写抽题规则");
          return;
        }
        paper.value.ruleJson = JSON.stringify(questionRule.value)
        paperRef.value.validate((valid) => {
          if (!valid) { return false }
          if (paper.value.id) {
            updateBaseInfo(paper.value, function () {
              success("编辑成功")
              router.push({path: "/admin/edu/exam/paper"})
            })
          } else {
            saveBaseInfo(paper.value, function () {
              success("新增成功")
              router.push({path: "/admin/edu/exam/paper"})
            })
          }
        })
      }
      const showAddQuestionDialog = ref(false)
      const showAddQuestion = () => {
        showAddQuestionDialog.value = true;
      }
      const hideAddQuestion = () => {
        showAddQuestionDialog.value = false;
      }
      const selectionChangeCallback = (questionIdList) => {
        // 获取题目详情
        if (!questionIdList || questionIdList.length === 0) {
          error("请选择题目")
          return;
        }
        for (const questionId of questionIdList) {
          if (paper.value.questionIdList.indexOf(questionId) > -1) {
            continue;
          }
          paper.value.questionIdList.push(questionId)
          questionApi.getBaseInfo(questionId, (res) => {
            questionList.value.push(res);
            paper.value.score += res.score;
          })
        }
        success("已添加至试题题目列表")
        hideAddQuestion()
      }
      return {
        colors,
        paper,
        paperRules,
        categoryOptions,
        selectCidList,
        paperRef,
        changeCategory,
        submitBaseInfo,
        questionList,
        showAddQuestionDialog,
        showAddQuestion,
        hideAddQuestion,
        selectionChangeCallback,
        questionRule,
        questionCategoryOptions,
        selectQuestionCidList,
        changeQuestionCategory,
        changeRule
      }
    }
  }
</script>
<style scoped lang="scss">
.paper-box {
  margin: 20px;
  .option-delete {
    margin-left: 20px;
    cursor: pointer;
  }
  .option-delete:hover {
    color: var(--el-color-primary);
  }
  :deep(.el-card__header){
    padding: 0;
  }
  :deep(.el-card .el-table__row:last-child td){
    border: 0;
  }
  .question-rule {
    .question-rule-item {
      background: #f7f7f7;
      margin-bottom: 20px;
      &:last-child {
        margin-bottom: 0;
      }
      .title {
        background: #f1f1f1;
        padding: 0 10px;
      }
      .content {
        padding: 10px 20px;
        :deep(.el-input){
          width: 150px;
        }
        .content-item {
          display: inline-block;
          width: 33.3333%;
        }
      }
      &:first-child {
        .content {
          :deep(.el-input){
            width: 100%;
          }
        }
      }
    }
  }
}
</style>
