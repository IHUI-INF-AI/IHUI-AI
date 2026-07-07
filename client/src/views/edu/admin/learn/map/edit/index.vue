<template>
  <div class="learn-map-edit">
    <el-row>
      <el-col :span="20">
        <div v-if="showStep === 'base'" class="base">
          <el-form :model="learnMap" :rules="learnMapRules" ref="learnMapRef" label-width="120px">
            <el-form-item label="名称：" prop="title">
              <el-input size="small" v-model="learnMap.title" placeholder="请输入标题"></el-input>
            </el-form-item>
            <el-form-item label="专题：" prop="tidList" class="name">
              <el-button size="small" @click="showTopic">选择</el-button>
              <template v-for="(item, index) in selectTopicList" :key="item.id">
                <el-input size="small" placeholder="请选择专题" v-model="item.title" readonly>
                  <template #suffix>
                    <el-icon @click="deleteSelectTopic(item, index)" class="el-input__icon search-btn"><Delete /></el-icon>
                  </template>
                </el-input>
              </template>
            </el-form-item>
            <el-form-item label="海报：" prop="image">
              <upload
                :class="{'no-plus': learnMap.image}"
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
              <wang-editor v-if="loadWangEditorFlag" v-model="learnMap.description"></wang-editor>
            </el-form-item>
            <el-button size="small" style="display:block;margin:50px auto;" @click="submitBaseInfo">提交</el-button>
          </el-form>
        </div>
        <div v-if="showStep === 'publish'" class="publish">
          <div class="publish-box">
            <div class="current-status">
              <el-alert :title="statusMap[learnMap.status]" effect="dark" type="success" :closable="false" show-icon v-if="learnMap.status === 'published'"></el-alert>
              <el-alert :title="statusMap[learnMap.status]" effect="dark" type="warning" :closable="false" show-icon v-else-if="learnMap.status === 'unpublished'"> </el-alert>
              <el-alert :title="statusMap[learnMap.status]" effect="dark" type="error" :closable="false" show-icon v-else> </el-alert>
            </div>
            <div class="btn-list">
              <el-button size="small" @click="publish" v-if="learnMap.status === 'unpublished'">马上发布</el-button>
              <el-button size="small" @click="unPublish" v-if="learnMap.status === 'published'">移入草稿</el-button>
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
    <el-dialog class="custom-dialog" title="选择专题" v-model="showTopicDialog" :before-close="hideTopic" width="80%">
      <topic-list :cancel-callback="hideTopic" :select-callback="selectTopic" :is-component="true"/>
    </el-dialog>
  </div>
</template>
<script>
// @ts-nocheck
  import router from "@/router"
  import {Delete} from '@/lib/lucide-fallback'
  import Upload from "@/components/Uplaod/index.vue"
  import WangEditor from "@/components/WangEditor/index.vue"
  import TopicList from "@/views/edu/admin/learn/topic/index.vue"
  import {ref} from "vue"
  import {useRoute} from "vue-router"
  import {success} from "@/util/tipsUtils"
  import { learnApi } from '@/api/edu/admin-api'
const { saveBaseInfo, updateBaseInfo, getBaseInfo, publishLearnMap, unPublishLearnMap } = learnApi

  export default {
    name: "LearnMapEdit",
    components:{
      TopicList,
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
        {key: "base", name: "基础信息"},
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
        url: '/api/v1/edu' + "/oss/learn/map/image",
        files: []
      })
      const selectTopicList = ref([])
      const learnMap = ref({
        id: "",
        title: "",
        image: "",
        tidList: [],
        description: ""
      })
      const learnMapRules = {
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        tidList: [{ required: true, message: "请选择专题", trigger: "change" }],
        description: [{ required: true, message: "请输入描述", trigger: "blur" }],
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
          learnMap.value = res;
          uploadData.value.files = [
              {name: "海报",
                url: learnMap.value.image
              }
            ]
          selectTopicList.value = res.topicList;
          loadWangEditorFlag.value = true;
        })
      }
      // 上传图片成功
      const onUploadImageSuccess = (res) => {
        learnMap.value.image = res.data
      }
      // 删除图片
      const onUploadImageRemove = () => {
        learnMap.value.image = ""
        uploadData.value.files = []
      }
      // 提交基本信息
      const learnMapRef = ref(null)
      const submitBaseInfo = () => {
        learnMapRef.value.validate((valid) => {
          if (!valid) { return false }
          if (isUpdate) {
            updateBaseInfo(learnMap.value, function (res) {
              if (res && res.id) {
                learnMap.value = res;
                success("编辑成功")
                showStep.value = "publish";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: learnMap.value.id, step: "publish"} });
              }
            })
          } else {
            saveBaseInfo(learnMap.value, function (res) {
              if (res && res.id) {
                learnMap.value = res;
                success("新增成功")
                showStep.value = "publish";
                loadStepActiveArray()
                let path = route.fullPath;
                router.push({path, query: {id: learnMap.value.id, step: "publish"} });
              }
            })
          }
        })
      }
      const showTopicDialog = ref(false)
      const showTopic = () => {
        showTopicDialog.value = true
      }
      const hideTopic = () => {
        showTopicDialog.value = false
      }
      const selectTopic = (val) => {
        for (const v of val) {
          if (learnMap.value.tidList.indexOf(v.id) === -1) {
            learnMap.value.tidList.push(v.id)
            selectTopicList.value.push(v)
          }
        }
        hideTopic()
      }
      const deleteSelectTopic = (item, index) => {
        selectTopicList.value.splice(index, 1);
        learnMap.value.tidList.splice(learnMap.value.tidList.indexOf(item.id), 1);
      }
      // 发布页面
      const statusMap = {
        unpublished: "草稿箱",
        published: "已发布",
        deleted: "已删除"
      }
      const publish = () => {
        publishLearnMap({id: learnMap.value.id}, () => {
          success("发布成功")
          learnMap.value.status = "published"
        })
      }
      const unPublish = () => {
        unPublishLearnMap({id: learnMap.value.id}, () => {
          success("取消发布成功")
          learnMap.value.status = "unpublished"
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
        learnMap.value.id = route.query.id || ""
        loadBaseInfo();
      }
      init()
      // 步骤条点击切换
      const stepClick = (key) => {
        if (!isUpdate && loadStepActiveArray().indexOf(key) < 0) {
          return;
        }
        showStep.value = key;
        let path = route.fullPath;
        router.push({path, query: {id: learnMap.value.id, step: key} });
      }
      loadStepActiveArray();
      // 返回参数与方法
      return {
        // 基本信息
        uploadData,
        learnMap,
        learnMapRules,
        learnMapRef,
        onUploadImageSuccess,
        onUploadImageRemove,
        submitBaseInfo,
        showTopicDialog,
        showTopic,
        hideTopic,
        selectTopicList,
        selectTopic,
        deleteSelectTopic,
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
  .learn-map-edit {
    margin: 20px;
    .base {
      .upload-image-tips {
        font-size: 12px;
        color: #999999;
      }
      :deep(.el-upload--picture-card),
      :deep(.el-upload-list--picture-card .el-upload-list__item){
        width: 100%;
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
