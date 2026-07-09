<template>
  <div class="lecturer-edit">
    <form ref="lecturerRef" @submit.prevent>
      <div class="mb-4 name" @click="showUserSearch">
        <label class="mb-1 block text-sm font-medium text-foreground">讲师：</label>
        <div>
          <Input size="small" v-model="lecturer.userName" placeholder="请选择讲师" readonly></Input>
          <Button variant="outline" size="sm">选择</Button>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">头像：</label>
        <div>
          <upload
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
        <label class="mb-1 block text-sm font-medium text-foreground">联系电话：</label>
        <div>
          <Input size="small" v-model="lecturer.mobile" placeholder="请输入联系电话"></Input>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">头衔：</label>
        <div>
          <Input size="small" v-model="lecturer.jobTitle" placeholder="请输入头衔"></Input>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">介绍：</label>
        <div>
          <Textarea size="small" :rows="10" v-model="lecturer.description" placeholder="请输入介绍"></Textarea>
        </div>
      </div>
      <div class="mb-4" style="text-align: center">
        <Button variant="outline" size="sm" @click="submitLecturer">提交</Button>
      </div>
    </form>
    <Dialog v-model="showUserSearchDialog" @close="hideUserSearch" width="80%">
      <DialogHeader>
        <DialogTitle>搜索用户</DialogTitle>
      </DialogHeader>
      <user-list :cancel-callback="hideUserSearch" :submit-callback="submitUser" :is-component="true"/>
    </Dialog>
  </div>
</template>
<script>
// @ts-nocheck
  import {ref} from "vue"
  import {useRoute} from "vue-router"
  import router from "@/router"
  import { lecturerApi } from '@/api/edu/admin-api'
const { saveLecturer, updateLecturer, getLecturer } = lecturerApi
  import Upload from "@/components/Uplaod/index.vue"
  import {error, success} from "@/util/tipsUtils";
  import UserList from "@/views/edu/admin/organizational/user/index.vue";
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Textarea } from '@/components/ui/textarea'

  export default {
    name: "LecturerEdit",
    components:{
      UserList,
      Upload,
      Button,
      Input,
      Textarea
    },
    setup() {
      const route = useRoute()
      const isUpdate = !!route.query.id
      // 基本信息
      const uploadData = ref({
        url: '/api/v1/edu' + "/oss/lecturer/image",
        files: []
      })
      const lecturer = ref({
        id: "",
        userId: "",
        image: "",
        mobile: "",
        jobTitle: "",
        description: ""
      })
      const lecturerRules = {
        userId: [{ required: true, message: "请选择用户", trigger: "change" }],
      }
      // 加载基本信息
      const load = () => {
        let id = route.query.id;
        if (!id) { return; }
        getLecturer(id, function (res) {
          lecturer.value = res;
          if (lecturer.value.image) {
            uploadData.value.files = [{name: "头像", url: lecturer.value.image}]
          }
        })
      }
      load()
      // 上传图片成功
      const onUploadImageSuccess = (res) => {
        lecturer.value.image = res.data
      }
      // 删除图片
      const onUploadImageRemove = () => {
        lecturer.value.image = ""
        uploadData.value.files = []
      }
      // 提交基本信息
      const lecturerRef = ref(null)
      const submitLecturer = () => {
        lecturerRef.value.validate((valid) => {
          if (!valid) { return false }
          if (isUpdate) {
            updateLecturer(lecturer.value, function (res) {
              if (res && res.id) {
                lecturer.value.id = res.id;
                success("编辑成功")
                router.push({path: "/admin/edu/live/lecturer/list"});
              }
            })
          } else {
            saveLecturer(lecturer.value, function (res) {
              if (res && res.id) {
                lecturer.value.id = res.id;
                success("新增成功")
                router.push({path: "/admin/edu/live/lecturer/list"});
              }
            })
          }
        })
      }
      const showUserSearchDialog = ref(false)
      const showUserSearch = () => {
        showUserSearchDialog.value = true
      }
      const hideUserSearch = () => {
        showUserSearchDialog.value = false
      }
      const submitUser = (val) => {
        if (val.length > 1) {
          error("只能选择一个用户")
        }
        lecturer.value.userId = val[0].id
        lecturer.value.userName = val[0].name
        hideUserSearch()
      }
      return {
        uploadData,
        lecturer,
        lecturerRules,
        lecturerRef,
        onUploadImageSuccess,
        onUploadImageRemove,
        submitLecturer,
        hideUserSearch,
        showUserSearch,
        showUserSearchDialog,
        submitUser
      };
    }
  }
</script>
<style scoped lang="scss">
  .lecturer-edit {
    padding: 20px;
  }
  .upload-image-tips {
    font-size: 12px;
    color: #999999;
  }
  .el-form-item {
    width: 96%;
  }
  .el-tag {
    margin-right: 10px;
  }
  .el-upload--picture-card, .el-upload-list--picture-card .el-upload-list__item {
    width: 100%;
    height: 62.5%;
  }
  .tips {
    font-size: 12px;
    color: #999999;
  }
  .name {
    :deep(.el-input){
      width: calc(100% - 56px);
    }
  }
</style>
