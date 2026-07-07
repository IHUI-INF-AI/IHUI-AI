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
      <el-form-item label="选择题目：" prop="questionIdList">
        <el-card size="small" shadow="never">
          <template #header>
            <div class="clearfix">
              <el-button size="small" style="padding: 10px;" link @click="showAddQuestion">添加题目</el-button>
            </div>
          </template>
          <div v-if="!(questionList && questionList.length > 0)">请添加题目</div>
          <div v-else>
            <el-table :data="questionList" :show-header="false" :highlight-current-row="false" style="width: 100%">
              <el-table-column>
                <template #default="scope">
                  <div>{{(scope.$index + 1) + '.' + scope.row.title}}</div>
                  <!--                  <div>-->
                  <!--                    <ul>-->
                  <!--                      <li v-for="option in JSON.parse(scope.row.options)" :key="option.key">{{option.key}}.{{option.value}}</li>-->
                  <!--                    </ul>-->
                  <!--                  </div>-->
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
        <el-dialog title="添加题目" v-model="showAddQuestionDialog" :before-close="hideAddQuestion" width="90%">
          <question-lib :is-component="true" :hide-component="hideAddQuestion" :selection-change-callback="selectionChangeCallback"/>
        </el-dialog>
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
  import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getAllParent } = examApi
  const { saveBaseInfo, updateBaseInfo, getBaseInfo } = examApi
  import {useRoute} from "vue-router";
  import {error, success} from "@/util/tipsUtils";
  import router from "@/router";
  import QuestionLib from "@/views/edu/admin/exam/question-lib/index.vue";
  import { examApi as questionApi } from '@/api/edu/admin-api';

  export default {
    name: "ExamPaperNormalIndex",
    components: {
      QuestionLib
    },
    setup() {
      const route = useRoute()
      const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
      const paper = ref({
        id: "",
        cidList: [],
        title: "",
        description: "",
        type: "normal",
        score: 0,
        limitTime: "",
        passScore: 0,
        questionDisordered: false,
        optionDisordered: false,
        difficulty: 2,
        questionIdList: []
      })
      const paperRules = {
        title: [{ required: true, message: "请输入题干", trigger: "blur" }],
        score: [{ required: true, message: "请输入分数", trigger: "blur" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
        passScore: [{ required: true, message: "请选择合格分数", trigger: "change" }],
        limitTime: [{ required: true, message: "请输入试卷时间", trigger: "blur" }],
        questionIdList: [{ required: true, message: "请添加题目", trigger: "blur" }],
      }
      const categoryOptions = ref([])
      const selectCidList = ref([])
      const questionList = ref([])
      // 获取分类
      findCategoryList(0, true, (res) => {
        if (res && res.length) {
          categoryOptions.value = toTree(res);
          categoryOptions.value.splice(0, 1);
          if (route.query.id) {
            // 获取试卷信息
            getBaseInfo(route.query.id, (res) => {
              res.limitTime = res.limitTime / 60;
              paper.value = res;
              selectCidList.value = getAllParent(categoryOptions.value, res.cidList);
              paper.value.cidList = []
              for (const valElement of selectCidList.value) {
                paper.value.cidList.push(valElement[valElement.length - 1])
              }
              paper.value.questionIdList = []
              for (const valElement of res.questionList) {
                paper.value.questionIdList.push(valElement.id)
                questionList.value.push(valElement)
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
      const paperRef = ref();
      const submitBaseInfo = () => {
        paperRef.value.validate((valid) => {
          if (!valid) { return false }
          paper.value.limitTime = parseFloat(paper.value.limitTime) * 60;
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
        selectionChangeCallback
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
}
</style>
