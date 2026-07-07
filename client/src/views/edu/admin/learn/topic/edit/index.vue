<template>
  <div class="topic-edit">
    <el-row>
      <el-col :span="20">
        <div v-if="showStep === 'base'" class="base">
          <el-form :model="topic" :rules="topicRules" ref="topicRef" label-width="120px">
            <el-form-item label="名称：" prop="title">
              <el-input size="small" v-model="topic.title" placeholder="请输入标题"></el-input>
            </el-form-item>
            <el-form-item label="课程：" prop="lidList" class="name">
              <el-button size="small" @click="showLesson">选择</el-button>
              <template v-for="(item, index) in selectLessonList" :key="item.id">
                <el-input size="small" placeholder="请选择课程" v-model="item.name" readonly>
                  <template #suffix>
                    <el-icon @click="deleteSelectLesson(item, index)" class="el-input__icon search-btn"><Delete /></el-icon>
                  </template>
                </el-input>
              </template>
            </el-form-item>
            <el-form-item label="分类：" prop="cidList">
              <el-cascader style="width: 100%;"
                           size="small"
                           v-model="selectCidList"
                           :props="{ multiple: true, checkStrictly: true }"
                           :options="categoryOptions"
                           @change="changeCategory">
              </el-cascader>
            </el-form-item>
            <el-form-item label="价格：" prop="price">
              <el-input-number class="input-number" v-model="topic.price" placeholder="请输入价格" :precision="2" :step="1" :min="0"></el-input-number>
              <el-input-number class="input-number" v-model="topic.originalPrice" placeholder="请输入原价" :precision="2" :step="1" :min="0"></el-input-number>
            </el-form-item>
            <el-form-item label="海报：" prop="image">
              <upload
                :class="{'no-plus': topic.image}"
                :on-upload-success="onUploadImageSuccess"
                :on-upload-remove="onUploadImageRemove"
                :files="uploadData.files"
                :upload-url="uploadData.url"
                :limit="1"
                accept="image/jpeg,image/gif,image/png">
              </upload>
              <span class="upload-image-tips">图片建议：尺寸 1920 x 1200 像素，大小7M以下</span>
            </el-form-item>
            <el-form-item label="介绍：" prop="description">
              <wang-editor v-if="loadWangEditorFlag" v-model="topic.description"></wang-editor>
            </el-form-item>
            <el-button size="small" style="display:block;margin:50px auto;" @click="submitBaseInfo">提交</el-button>
          </el-form>
        </div>
        <div v-if="showStep === 'publish'" class="publish">
          <div class="publish-box">
            <div class="current-status">
              <el-alert :title="statusMap[topic.status]" effect="dark" type="success" :closable="false" show-icon v-if="topic.status === 'published'"></el-alert>
              <el-alert :title="statusMap[topic.status]" effect="dark" type="warning" :closable="false" show-icon v-else-if="topic.status === 'unpublished'"> </el-alert>
              <el-alert :title="statusMap[topic.status]" effect="dark" type="error" :closable="false" show-icon v-else> </el-alert>
            </div>
            <div class="btn-list">
              <el-button size="small" @click="publish" v-if="topic.status === 'unpublished'">马上发布</el-button>
              <el-button size="small" @click="unPublish" v-if="topic.status === 'published'">移入草稿</el-button>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="4" style="position: relative;">
        <el-affix :offset="160" class="affix">
          <div class="step-list">
            <div class="title">
              步骤导航
            </div>
            <el-steps class="steps" finish-status="success" direction="vertical" :active="stepActive">
              <el-step v-for="(step) in steps" :key="step.key" @click="stepClick(step.key)" :class="{'step-active': showStep === step.key}" :title="step.name"></el-step>
            </el-steps>
          </div>
        </el-affix>
      </el-col>
    </el-row>
    <el-dialog class="custom-dialog" title="选择课程" v-model="showLessonDialog" :before-close="hideLesson" width="80%">
      <lesson-list :cancel-callback="hideLesson" :select-callback="selectLesson" :is-component="true"/>
    </el-dialog>
  </div>
</template>
<script>
// @ts-nocheck
  import router from "@/router"
  import {Delete} from '@/lib/lucide-fallback'
  import Upload from "@/components/Uplaod/index.vue"
  import WangEditor from "@/components/WangEditor/index.vue"
  import LessonList from "@/views/edu/admin/learn/lesson/index.vue";
  import {ref} from "vue"
  import {useRoute} from "vue-router"
  import {success} from "@/util/tipsUtils";
  import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getAllParent } = learnApi
  const { saveBaseInfo, updateBaseInfo, getBaseInfo, publishTopic, unPublishTopic } = learnApi

  export default {
    name: "LearnTopicEdit",
    components:{
      LessonList,
      Upload,
      WangEditor,
      Delete
    },
    setup() {
      const loadWangEditorFlag = ref(false)
      const route = useRoute()
      const isUpdate = !!route.query.id
      let showStep = ref("")
      const steps = [
        {key: "base", name: "专题信息"},
        {key: "publish", name: "发布状态"},
      ]
      const stepActive = ref(0)
      const loadStepActiveArray = () => {
        const stepActiveArray = [];
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          stepActiveArray.push(step.key);
          if (step.key === showStep.value) {
            stepActive.value = i;
            break;
          }
        }
        if (isUpdate) {
          stepActive.value = steps.length;
        }
        return stepActiveArray;
      }
      // 基本信息
      const uploadData = ref({
        url: '/api/v1/edu' + "/oss/learn/topic/image",
        files: []
      })
      const categoryOptions = ref([])
      const selectCidList = ref([])
      const selectLessonList = ref([])
      const topic = ref({
        id: "",
        title: "",
        image: "",
        price: 0,
        originalPrice: 0,
        cidList: [],
        lidList: [],
        description: ""
      })
      const topicRules = {
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
        description: [{ required: true, message: "请输入描述", trigger: "blur" }],
        price: [{ required: true, message: "请输入价格", trigger: "blur" }],
        image: [{ required: true, message: "请选择海报", trigger: "change" }],
      }
      // 加载基本信息
      const loadBaseInfo = () => {
        let id = route.query.id;
        if (!id) {
          loadWangEditorFlag.value = true;
          return;
        }
        getBaseInfo(id, function (res) {
          topic.value = res;
          selectCidList.value = getAllParent(categoryOptions.value, res.cidList);
          topic.value.cidList = []
          uploadData.value.files = [
              {
                name: "海报",
                url: topic.value.image
              }
            ]
          for (const valElement of selectCidList.value) {
            topic.value.cidList.push(valElement[valElement.length - 1])
          }
          selectLessonList.value = res.lessonList;
          loadWangEditorFlag.value = true;
        })
      }
      // 获取分类
      const loadCategory = () => {
        findCategoryList(0, true, (res) => {
          if (res && res.length) {
            categoryOptions.value = toTree(res);
            loadBaseInfo();
          }
        })
      }
      // 选择分类
      const changeCategory = (val) => {
        topic.value.cidList = []
        for (const valElement of val) {
          topic.value.cidList.push(valElement[valElement.length - 1])
        }
      }
      // 上传图片成功
      const onUploadImageSuccess = (res) => {
        topic.value.image = res.data
      }
      // 删除图片
      const onUploadImageRemove = () => {
        topic.value.image = ""
        uploadData.value.files = []
      }
      // 提交基本信息
      const topicRef = ref(null)
      const submitBaseInfo = () => {
        topicRef.value.validate((valid) => {
          if (!valid) { return false }
          if (isUpdate) {
            updateBaseInfo(topic.value, function (res) {
              if (res && res.id) {
                topic.value = res;
                success("编辑成功")
                showStep.value = "publish";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: topic.value.id, step: "publish"} });
              }
            })
          } else {
            saveBaseInfo(topic.value, function (res) {
              if (res && res.id) {
                topic.value = res;
                success("新增成功")
                showStep.value = "publish";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: topic.value.id, step: "publish"} });
              }
            })
          }
        })
      }
      const showLessonDialog = ref(false)
      const showLesson = () => {
        showLessonDialog.value = true
      }
      const hideLesson = () => {
        showLessonDialog.value = false
      }
      const selectLesson = (val) => {
        for (const v of val) {
          if (topic.value.lidList.indexOf(v.id) === -1) {
            topic.value.lidList.push(v.id)
            selectLessonList.value.push(v)
          }
        }
        hideLesson()
      }
      const deleteSelectLesson = (item, index) => {
        selectLessonList.value.splice(index, 1);
        topic.value.lidList.splice(topic.value.lidList.indexOf(item.id), 1);
      }
      // 发布页面
      const statusMap = {
        unpublished: "草稿箱",
        published: "已发布",
        deleted: "已删除"
      }
      const publish = () => {
        publishTopic({id: topic.value.id}, () => {
          success("发布成功")
          topic.value.status = "published"
        })
      }
      const unPublish = () => {
        unPublishTopic({id: topic.value.id}, () => {
          success("取消发布成功")
          topic.value.status = "unpublished"
        })
      }
      // 步骤条
      const init = () => {
        // 初始化加载
        if (route.query.step) {
          showStep.value = route.query.step;
        } else {
          showStep.value = "base"
        }
        topic.value.id = route.query.id || ""
        loadCategory();
      }
      init()
      // 步骤条点击切换
      const stepClick = (key) => {
        if (!isUpdate && loadStepActiveArray().indexOf(key) < 0) {
          return;
        }
        showStep.value = key;
        let path = route.fullPath;
        router.push({path, query: {id: topic.value.id, step: key} });
      }
      loadStepActiveArray();
      // 返回参数与方法
      return {
        // 基本信息
        uploadData,
        categoryOptions,
        topic,
        selectCidList,
        topicRules,
        topicRef,
        changeCategory,
        onUploadImageSuccess,
        onUploadImageRemove,
        submitBaseInfo,
        showLessonDialog,
        showLesson,
        hideLesson,
        selectLessonList,
        selectLesson,
        deleteSelectLesson,
        // 发布页面
        statusMap,
        publish,
        unPublish,
        // 步骤条
        steps,
        stepActive,
        showStep,
        stepClick,
        loadWangEditorFlag
      };
    }
  }
</script>
<style scoped lang="scss">
  .topic-edit {
    margin: 20px;
    .base {
      .upload-image-tips {
        font-size: 12px;
        color: #999999;
      }
      :deep(.el-upload--picture-card),
      :deep(.el-upload-list--picture-card .el-upload-list__item){
        max-width: 400px;
        height: 62.5%;
        border: none;
        display: flex;
        margin: 0;
        min-height: 146px;
        justify-content: center;
        flex-direction: column;
      }
      .no-plus {
        :deep(.el-upload--picture-card){
          min-height: inherit;
          justify-content: inherit;
          flex-direction: inherit;
          display: none;
        }
        img {
          max-height: 460px;
        }
      }
      .input-number {
        margin-right: 20px;
      }
    }
    .publish {
      .publish-box {
        margin: 50px auto;
        text-align: center;
        .current-status {
          margin: 0 auto 20px;
          width: 180px;
        }
        .btn-list{
          margin: 0 auto;
          width: 180px;
          text-align: left;
          :deep(.el-button){
            width: 100%;
          }
        }
      }
    }
  }
  :deep(.el-input__inner), :deep(.el-input-number){
    height: 34px;
    line-height: 34px;
    font-size: 12px;
    border-color: #f3f5f8;
    //border: none;
    &:focus, &:hover {
      border-color: #f3f5f8;
    }
    .el-input-number__decrease, .el-input-number__increase {
      background: #FFFFFF;
      line-height: 32px;
      border: none;
      &:focus, &:hover {
        border-color: #f3f5f8;
      }
    }
  }
  :deep(.el-textarea__inner){
    border-color: #f3f5f8;
    &:focus, &:hover {
      border-color: #f3f5f8;
    }
  }
  :deep(.el-cascader .el-input .el-input__inner:focus){
    border-color: #f3f5f8;
  }
  :deep(.el-input__icon){
    line-height: 34px;
    cursor: pointer;
    &:hover {
      color: var(--el-color-primary);
    }
  }
  :deep(.el-form-item__label){
    font-size: 12px;
  }
  :deep(.el-table th),
  :deep(.el-table td){
    padding: 5px 0;
    font-size: 12px;
    color: #000000;
  }
  :deep(.el-table--enable-row-hover .el-table__body tr:hover > td){
    background-color: #FFFFFF;
  }
  :deep(.el-table__body tr.current-row > td){
    background-color: #FFFFFF;
  }
  :deep(.el-button--text){
    color: #303133;
    &:hover {
      color: var(--el-color-primary);
    }
  }
  :deep(.el-button){
    border-color: #f3f5f8;
  }
  :deep(.el-cascader:not(.is-disabled):hover .el-input__inner){
    cursor: pointer;
    border-color: #f3f5f8;
  }
  .affix {
    .step-list {
      padding: 10px 20px;
      .title {
        padding: 0 0 20px 0;
        font-size: 12px;
      }
      .steps {
        height: 80px;
        padding-left: 10px;
        :deep(.el-step__title){
          font-size: 14px;
        }
        :deep(.el-step__icon){
          width: 20px;
          height: 20px;
        }
        :deep(.el-step.is-vertical .el-step__head){
          width: 20px;
        }
        :deep(.el-step.is-vertical .el-step__title){
          cursor:pointer;
        }
        :deep(.el-step.is-vertical .el-step__line){
          width: 1px;
          left: 10px;
          top: 2px;
        }
        :deep(.el-step__icon.is-text){
          border-width: 1px;
          cursor:pointer;
        }
        :deep(.step-active .el-step__head.is-finish){
          color: red;
        }
      }
    }
  }
  :deep(.el-affix--fixed){
    z-index: 98;
  }
  :deep(.custom-dialog){
    max-height: 700px;
    overflow-y: auto;
    .el-dialog__body {
      padding: 0;
    }
  }
</style>
