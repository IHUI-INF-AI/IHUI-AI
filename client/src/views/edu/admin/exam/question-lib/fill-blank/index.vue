<template>
  <div class="question-box">
    <form ref="questionRef" @submit.prevent>
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
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">题干：</label>
        <div class="flex-1">
          <Input size="small" v-model="question.title" placeholder="请输入题干" @change="titleChange" @blur="titleChange"></Input>
          <div style="font-size: 12px;color: #999999;">tips: 填空位置使用 [_] 表示</div>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">描述：</label>
        <div class="flex-1">
          <Textarea size="small" :rows="5" v-model="question.note" placeholder="请输入题干描述"></Textarea>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4" v-if="question.referenceAnswerList && question.referenceAnswerList.length">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">参考答案：</label>
        <div class="flex-1">
          <div v-for="(o, index) in question.referenceAnswerList" :key="o" class="text item">
            <span style="color: #666666;">填空 {{index + 1}}. </span>
            <Input v-model="o.value" size="small"></Input>
          </div>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">答案解析：</label>
        <div class="flex-1">
          <Textarea size="small" :rows="5" v-model="question.referenceAnswerNote" placeholder="请输入答案解析"></Textarea>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">分数：</label>
        <div class="flex-1">
          <Input size="small" v-model="question.score" placeholder="请输入试题分数"></Input>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">难度：</label>
        <div class="flex-1">
          <el-rate style="line-height: 48px;" v-model="question.difficulty" :colors="colors"></el-rate>
        </div>
      </div>
    </form>
    <Button variant="outline" size="sm" style="display:block;margin:50px auto;" @click="submitBaseInfo">提交</Button>
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
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Textarea } from '@/components/ui/textarea'

  export default {
    name: "ExamQuestionLibFillBlank",
    components: {
      Button,
      Input,
      Textarea
    },
    setup() {
      const route = useRoute()
      const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
      const question = ref({
        id: "",
        title: "",
        note: "",
        type: "fill_blank",
        score: "",
        difficulty: 2,
        referenceAnswer: "",
        referenceAnswerNote: "",
        options: "",
        cidList: []
      })
      const questionRules = {
        title: [{ required: true, message: "请输入题干", trigger: "blur" }],
        score: [{ required: true, message: "请输入分数", trigger: "blur" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
        //referenceAnswer: [{ required: true, message: "请选择参考答案", trigger: "change" }],
        referenceAnswerNote: [{ required: true, message: "请输入答案解析", trigger: "blur" }],
        options: [{ required: true, message: "请添加选项", trigger: "blur" }],
      }
      const serialNumber = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]
      const optionList = ref([])
      const categoryOptions = ref([])
      const selectCidList = ref([])
      // 获取分类
      findCategoryList(0, true, (res) => {
        if (res && res.length) {
          categoryOptions.value = toTree(res);
          categoryOptions.value.splice(0, 1);
          if (route.query.id) {
            // 获取试题信息
            getBaseInfo(route.query.id, function (res) {
              question.value = res;
              question.value.referenceAnswerList = [];
              const answerList = res.referenceAnswer.split("[_]")
              for (const a of answerList) {
                question.value.referenceAnswerList.push({value: a})
              }
              selectCidList.value = getAllParent(categoryOptions.value, res.cidList);
              question.value.cidList = []
              for (const valElement of selectCidList.value) {
                question.value.cidList.push(valElement[valElement.length - 1])
              }
            })
          }
        }
      })
      // 选择分类
      const changeCategory = (val) => {
        question.value.cidList = []
        for (const valElement of val) {
          question.value.cidList.push(valElement[valElement.length - 1])
        }
      }
      let optionIndex = -1;
      const option = ref("")
      const showAddOptionInput = ref(false)
      const addOption = () => {
        showAddOptionInput.value = true
      }
      const optionBlur = () => {
        showAddOptionInput.value = false
        if (!option.value) {
          return
        }
        if (optionIndex > -1) {
          optionList.value[optionIndex].value = option.value
        } else {
          optionList.value.push({value: option.value, key: serialNumber[optionList.value.length]})
        }
        question.value.options = JSON.stringify(optionList.value)
        option.value = ""
        optionIndex = -1;
      }
      const editOption = (index) => {
        const o = optionList.value[index];
        option.value = o.value;
        optionIndex = index;
        showAddOptionInput.value = true
      }
      const deleteOption = (index) => {
        if (optionList.value && optionList.value.length) {
          optionList.value.splice(index, 1);
          optionList.value.forEach((item, index) => {
            item.key = serialNumber[index]
          })
          question.value.options = JSON.stringify(optionList.value)
        } else {
          question.value.options = ""
        }
      }
      const questionRef = ref();
      const submitBaseInfo = () => {
        questionRef.value.validate((valid) => {
          if (!valid) { return false }
          const answerList = []
          if (question.value.referenceAnswerList && question.value.referenceAnswerList.length) {
            for (const answer of question.value.referenceAnswerList) {
              if (!answer.value) {
                error("参考答案为必填项")
                return false;
              }
              answerList.push(answer.value)
            }
          } else {
            error("参考答案为必填项")
            return
          }
          question.value.referenceAnswer = answerList.join("[_]")
          if (question.value.id) {
            updateBaseInfo(question.value, function () {
              success("编辑成功")
              router.push({path: "/admin/edu/exam/question-lib"})
            })
          } else {
            saveBaseInfo(question.value, function () {
              success("新增成功")
              router.push({path: "/admin/edu/exam/question-lib"})
            })
          }
        })
      }
      const titleChange = () => {
        let thisCount = 0;
        question.value.title.replace(/\[_\]/g, function () {
          thisCount++;
          return "[_]"
        });
        if (!question.value.referenceAnswerList) {
          question.value.referenceAnswerList = []
        }
        let count = 0;
        if (question.value.referenceAnswerList.length <= thisCount) {
          count = thisCount - question.value.referenceAnswerList.length
          for (let i = 0; i < count; i++) {
            question.value.referenceAnswerList.push({value: ""})
          }
        } else {
          question.value.referenceAnswerList.splice(thisCount, question.value.referenceAnswerList.length)
        }
      }
      return {
        colors,
        question,
        questionRules,
        categoryOptions,
        selectCidList,
        serialNumber,
        option,
        optionList,
        showAddOptionInput,
        questionRef,
        changeCategory,
        addOption,
        optionBlur,
        editOption,
        deleteOption,
        submitBaseInfo,
        titleChange
      }
    }
  }
</script>
<style scoped lang="scss">
.question-box {
  margin: 20px;
  .option-delete {
    margin-left: 20px;
    cursor: pointer;
  }
  .option-delete:hover {
    color: hsl(var(--primary));
  }
  :deep(.el-card__header){
    padding: 0;
  }
}
</style>
