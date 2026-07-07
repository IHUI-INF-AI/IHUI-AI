<template>
  <div class="question-box">
    <el-form :model="question" :rules="questionRules" ref="questionRef" label-width="120px">
      <el-form-item label="分类：" prop="cidList">
        <el-cascader size="small" style="width: 100%;"
                     v-model="selectCidList"
                     :props="{ multiple: true, checkStrictly: true }"
                     :options="categoryOptions"
                     @change="changeCategory">
        </el-cascader>
      </el-form-item>
      <el-form-item label="题干：" prop="title">
        <el-input size="small" v-model="question.title" placeholder="请输入题干"></el-input>
      </el-form-item>
      <el-form-item label="描述：" prop="note">
        <el-input size="small" type="textarea" :rows="5" v-model="question.note" placeholder="请输入题干描述"></el-input>
      </el-form-item>
      <el-form-item label="选项：" prop="options">
        <el-card size="small" shadow="never">
          <template #header>
            <div class="clearfix">
              <el-button size="small" style="padding: 10px;" link @click="addOption">添加选项</el-button>
            </div>
          </template>
          <div v-if="!(optionList && optionList.length > 0) && !showAddOptionInput">请添加选项</div>
          <div v-else-if="optionList && optionList.length > 0" v-for="(o, index) in optionList" :key="o.key" class="text item">
            <span>{{o.key + '. ' + o.value}}</span>
            <el-icon class="option-delete" @click="editOption(index)"><Edit/></el-icon>
            <el-icon class="option-delete" @click="deleteOption(index)"><Delete/></el-icon>
          </div>
          <el-input size="small" placeholder="请输入选项内容" v-if="showAddOptionInput" v-model="option" @blur="optionBlur" @keypress.enter="optionBlur"/>
        </el-card>
      </el-form-item>
      <el-form-item label="参考答案："  prop="referenceAnswer">
        <el-radio v-model="question.referenceAnswer" v-for="item in optionList" :key="item.key" :label="item.key">{{item.key}}</el-radio>
      </el-form-item>
      <el-form-item label="答案解析：" prop="referenceAnswerNote">
        <el-input size="small" type="textarea" :rows="5" v-model="question.referenceAnswerNote" placeholder="请输入答案解析"></el-input>
      </el-form-item>
      <el-form-item label="分数：" prop="score">
        <el-input size="small" v-model="question.score" placeholder="请输入试题分数"></el-input>
      </el-form-item>
      <el-form-item label="难度：" prop="difficulty">
        <el-rate style="line-height: 48px;" v-model="question.difficulty" :colors="colors"></el-rate>
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
  import {success} from "@/util/tipsUtils";
  import router from "@/router";
  import {Edit, Delete} from '@/lib/lucide-fallback';

  export default {
    name: "ExamQuestionLibSingleChoice",
    components: {
      Edit,
      Delete
    },
    setup() {
      const route = useRoute()
      const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
      const question = ref({
        id: "",
        title: "",
        note: "",
        type: "single_choice",
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
        referenceAnswer: [{ required: true, message: "请选择参考答案", trigger: "change" }],
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
              optionList.value = JSON.parse(res.options);
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
        submitBaseInfo
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
    color: var(--el-color-primary);
  }
  :deep(.el-card__header){
    padding: 0;
  }
}
</style>
