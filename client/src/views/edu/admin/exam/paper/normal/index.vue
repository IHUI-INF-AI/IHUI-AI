<template>
  <div class="paper-box">
    <form ref="paperRef" @submit.prevent>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">分类：</label>
        <div class="flex-1">
          <Select size="small" style="width: 100%;"
                  multiple
                  v-model="selectCidList"
                  @change="changeCategory">
            <SelectOption v-for="item in flatCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </Select>
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
                <Button variant="link" size="sm" style="padding: 10px;" @click="showAddQuestion">添加题目</Button>
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
          <div class="flex gap-1" style="line-height: 48px;">
            <svg v-for="i in 5" :key="i" @click="paper.difficulty = i" :class="['h-4 w-4 cursor-pointer', i <= paper.difficulty ? 'text-yellow-400' : 'text-muted-foreground']" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.783 1.401 8.168L12 18.896l-7.335 3.865 1.401-8.168L.132 9.21l8.2-1.192z"/></svg>
          </div>
        </div>
      </div>
    </form>
    <Button variant="outline" size="sm" style="display:block;margin:50px auto;" @click="submitBaseInfo">提交</Button>
  </div>
</template>
<script>
  import {ref, computed} from "vue"
  import { useFormRef } from '@/composables/useFormRef'
  import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getAllParent } = examApi
  const { saveBaseInfo, updateBaseInfo, getBaseInfo } = examApi
  import {useRoute} from "vue-router";
  import {error, success} from "@/util/tipsUtils";
  import router from "@/router";
  import QuestionLib from "@/views/edu/admin/exam/question-lib/index.vue";
  import { examApi as questionApi } from '@/api/edu/admin-api';

  import { Card, CardHeader, CardContent } from '@/components/ui/card'
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'
  import { Textarea } from '@/components/ui/textarea'
  import { Select, SelectOption } from '@/components/ui/select'
export default {
    name: "ExamPaperNormalIndex",
    components: {
    Select,
    SelectOption,
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
    Button,
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
      const flatCategoryOptions = computed(() => {
        const result = []
        const flatten = (nodes, parentPath = '') => {
          for (const node of nodes) {
            const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
            result.push({ label, value: node.value || node.id })
            if (node.children && node.children.length) { flatten(node.children, label) }
          }
        }
        flatten(categoryOptions.value || [])
        return result
      })
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
              selectCidList.value = res.cidList || []
              paper.value.cidList = res.cidList || []
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
        paper.value.cidList = val || []
      }
      const paperRef = useFormRef()
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
        flatCategoryOptions,
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
    color: hsl(var(--primary));
  }
}
</style>
