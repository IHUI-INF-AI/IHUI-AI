<template>
  <div class="paper-box">
    <form ref="paperRef" @submit.prevent>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">分类：</label>
        <div class="flex-1">
          <el-cascader size="small" style="width: 100%;"
                       v-model="selectCidList"
                       :props="{ multiple: true, checkStrictly: true }"
                       :options="categoryOptions"
                       @change="changeCategory">
          </el-cascader>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">试卷名称：</label>
        <div class="flex-1">
          <Input size="small" v-model="paper.title" placeholder="请输入试卷名称"></Input>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">试卷描述：</label>
        <div class="flex-1">
          <Textarea size="small" :rows="5" v-model="paper.description" placeholder="请输入试卷描述"></Textarea>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">选择题目：</label>
        <div class="flex-1">
          <Card class="shadow-none">
            <CardHeader>
              <div class="clearfix">
                <Button size="sm" style="padding: 10px;" variant="link" @click="showAddQuestion">添加题目</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="!(questionList && questionList.length > 0)">请添加题目</div>
              <div v-else>
                <Table class="w-full">
                  <TableBody>
                    <TableRow v-for="(row, index) in questionList" :key="row.id ?? index">
                      <TableCell>
                        <div>{{(index + 1) + '.' + row.title}}</div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Dialog v-model="showAddQuestionDialog" width="90%" @close="hideAddQuestion">
            <DialogHeader>
              <DialogTitle>添加题目</DialogTitle>
            </DialogHeader>
            <question-lib :is-component="true" :hide-component="hideAddQuestion" :selection-change-callback="selectionChangeCallback"/>
          </Dialog>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">试卷总分：</label>
        <div class="flex-1">
          {{paper.score}} 分
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">合格分数：</label>
        <div class="flex-1">
          <Input size="small" v-model="paper.passScore" placeholder="请输入试题分数"></Input>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">试卷时间：</label>
        <div class="flex-1">
          <Input size="small" v-model="paper.limitTime" placeholder="请输入试卷时间（分）"></Input>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">题序打乱：</label>
        <div class="flex-1">
          <Switch id="questionDisordered" v-model="paper.questionDisordered" />
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">选项打乱：</label>
        <div class="flex-1">
          <Switch id="optionDisordered" v-model="paper.optionDisordered" />
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">试卷难度：</label>
        <div class="flex-1">
          <el-rate style="line-height: 48px;" v-model="paper.difficulty" :colors="colors"></el-rate>
        </div>
      </div>
    </form>
    <Button size="sm" variant="outline" style="display:block;margin:50px auto;" @click="submitBaseInfo">提交</Button>
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

  import { Card, CardHeader, CardContent } from '@/components/ui/card'
  import Button from '@/components/ui/Button.vue'
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'
  import { Textarea } from '@/components/ui/textarea'
export default {
    name: "ExamPaperMock",
    components: {
    Button,
    Card,
    CardHeader,
    CardContent,
    Dialog,
    DialogHeader,
    DialogTitle,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Input,
    Textarea,
      QuestionLib,
      Switch
    },
    setup() {
      const route = useRoute()
      const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
      const paper = ref({
        id: "",
        cidList: [],
        title: "",
        description: "",
        type: "mock",
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
}
</style>
