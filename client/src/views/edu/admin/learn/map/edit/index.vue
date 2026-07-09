<template>
  <div class="learn-map-edit">
    <div class="flex flex-wrap">
      <div class="w-5/6">
        <div v-if="showStep === 'base'" class="base">
          <form ref="learnMapRef" @submit.prevent>
            <div class="mb-4">
              <label class="mb-1 block text-sm font-medium text-foreground">名称：</label>
              <div>
                <Input size="small" v-model="learnMap.title" placeholder="请输入标题" />
              </div>
            </div>
            <div class="mb-4 name">
              <label class="mb-1 block text-sm font-medium text-foreground">专题：</label>
              <div>
                <Button size="sm" variant="outline" @click="showTopic">选择</Button>
                <template v-for="(item, index) in selectTopicList" :key="item.id">
                  <div class="flex">
                    <Input size="small" placeholder="请选择专题" v-model="item.title" readonly />
                    <Delete @click="deleteSelectTopic(item, index)" class="h-4 w-4 cursor-pointer el-input__icon search-btn" />
                  </div>
                </template>
              </div>
            </div>
            <div class="mb-4">
              <label class="mb-1 block text-sm font-medium text-foreground">海报：</label>
              <div>
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
              </div>
            </div>
            <div class="mb-4">
              <label class="mb-1 block text-sm font-medium text-foreground">介绍：</label>
              <div>
                <wang-editor v-if="loadWangEditorFlag" v-model="learnMap.description"></wang-editor>
              </div>
            </div>
            <Button size="sm" variant="outline" style="display:block;margin:50px auto;" @click="submitBaseInfo">提交</Button>
          </form>
        </div>
        <div v-if="showStep === 'publish'" class="publish">
          <div class="publish-box">
            <div class="current-status">
              <Alert :title="statusMap[learnMap.status]" variant="success" :closable="false" show-icon v-if="learnMap.status === 'published'"></Alert>
              <Alert :title="statusMap[learnMap.status]" variant="warning" :closable="false" show-icon v-else-if="learnMap.status === 'unpublished'"> </Alert>
              <Alert :title="statusMap[learnMap.status]" variant="destructive" :closable="false" show-icon v-else> </Alert>
            </div>
            <div class="btn-list">
              <Button size="sm" variant="outline" @click="publish" v-if="learnMap.status === 'unpublished'">马上发布</Button>
              <Button size="sm" variant="outline" @click="unPublish" v-if="learnMap.status === 'published'">移入草稿</Button>
            </div>
          </div>
        </div>
      </div>
      <div class="w-1/6" style="position: relative;">
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
      </div>
    </div>
    <Dialog class="custom-dialog" v-model="showTopicDialog" width="80%" @close="hideTopic">
      <DialogHeader>
        <DialogTitle>选择专题</DialogTitle>
      </DialogHeader>
      <topic-list :cancel-callback="hideTopic" :select-callback="selectTopic" :is-component="true"/>
    </Dialog>
  </div>
</template>
<script>
// @ts-nocheck
  import router from "@/router"
  import {Delete} from '@/lib/lucide-fallback'
  import Upload from "@/components/Uplaod/index.vue"
  import WangEditor from "@/components/WangEditor/index.vue"
  import TopicList from "@/views/edu/admin/learn/topic/index.vue"
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import Button from '@/components/ui/Button.vue'
  import { Alert } from '@/components/ui/alert'
  import { Input } from '@/components/ui/input'
  import {ref} from "vue"
  import {useRoute} from "vue-router"
  import {success} from "@/util/tipsUtils"
  import { learnApi } from '@/api/edu/admin-api'
const { saveBaseInfo, updateBaseInfo, getBaseInfo, publishLearnMap, unPublishLearnMap } = learnApi

  export default {
    name: "LearnMapEdit",
    components:{
      Alert,
      Button,
      TopicList,
      Upload,
      WangEditor,
      Delete,
      Dialog,
      DialogHeader,
      DialogTitle,
      Input
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
