<template>
  <div>
    <el-form :model="channel" :rules="channelRules" ref="channelRef" label-width="120px">
      <el-form-item label="标题：" prop="name">
        <el-input v-model="channel.name" placeholder="请输入标题"></el-input>
      </el-form-item>
      <el-form-item label="时间：" prop="startTime">
        <el-date-picker
          v-model="channel.startTime"
          type="datetime"
          placeholder="选择直播时间"
          class="input-text"
          :default-time="new Date(2000, 0, 1, 19, 0, 0)"
          size="small"
          @change="changeStartTime"
          style="width: 100%;"></el-date-picker>
      </el-form-item>
      <el-form-item label="分类：" prop="cidList">
        <el-cascader style="width: 100%;"
                     v-model="selectCidList"
                     :props="{ multiple: true, checkStrictly: true }"
                     :options="categoryOptions"
                     @change="changeCategory">
        </el-cascader>
      </el-form-item>
      <el-form-item label="讲师：" prop="lecturerId">
        <el-button size="small" @click="showLecturer">选择讲师</el-button>
        <div class="lecturer-selected" v-if="lecturerSelection && lecturerSelection.id">{{lecturerSelection.userName}}</div>
        <el-dialog title="选择讲师" v-model="showLecturerDialog" :before-close="hideLecturer" :close-on-click-modal="false" :close-on-press-escape="false">
          <el-table :data="lecturerList" style="width: 100%" ref="multipleTable" @selection-change="handleSelectionChange">
            <el-table-column type="selection" width="55"></el-table-column>
            <el-table-column width="180px" label="头像">
              <template #default="scope">
                <img :src="scope.row.image" style="width: 100px;height: 100px;"/>
              </template>
            </el-table-column>
            <el-table-column prop="userName" label="名字"></el-table-column>
            <el-table-column prop="jobTitle" label="头衔"></el-table-column>
          </el-table>
          <page :current-change="lecturerCurrentChange" :size-change="lecturerSizeChange" :total="lecturerTotal" :page-size="lecturerParam.size"/>
          <template #footer>
            <div class="dialog-footer">
              <el-button size="small" type="primary" @click="selectedLecturer()">确认</el-button>
            </div>
          </template>
        </el-dialog>
      </el-form-item>
      <el-form-item label="详情：" prop="introduction">
        <wang-editor v-if="loadWangEditorFlag" v-model="channel.introduction"></wang-editor>
      </el-form-item>
      <el-form-item label="海报：" prop="image">
        <upload :on-upload-success="onUploadImageSuccess"
                :on-upload-remove="onUploadImageRemove"
                :files="uploadData.files"
                :upload-url="uploadData.url"
                :limit="1"
                accept="image/jpeg,image/gif,image/png">
        </upload>
        <span class="upload-image-tips">尺寸建议 1920 x 1200 像素，大小7M以下，张数1张</span>
      </el-form-item>
      <el-form-item label="允许聊天：" prop="enableChat">
        <el-switch id="enableChat" v-model="channel.enableChat" active-color="#07c160" :active-value="true" :inactive-value="false"></el-switch>
      </el-form-item>
      <el-form-item label="人数显示：" prop="showNumber">
        <el-switch id="showNumber" v-model="channel.showNumber" active-color="#07c160" :active-value="true" :inactive-value="false"></el-switch>
      </el-form-item>
      <el-button style="display:block;margin:50px auto;" @click="submitChannel">提交</el-button>
    </el-form>
  </div>
</template>
<script>
// @ts-nocheck
  import {ref} from "vue"
  import {useRoute} from "vue-router"
  import router from "@/router"
  import Upload from "@/components/Uplaod/index.vue"
  import WangEditor from "@/components/WangEditor/index.vue"
  import {error, success} from "@/util/tipsUtils"
  import { liveApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getAllParent } = liveApi
  const { saveChannel, updateChannel, getChannel } = liveApi
  import { lecturerApi } from '@/api/edu/admin-api'
const { findList } = lecturerApi
  import Page from "@/components/Page/index.vue";

  export default {
    name: "LiveChannelEdit",
    components:{
      Page,
      Upload,
      WangEditor
    },
    setup() {
      const loadWangEditorFlag = ref(false)
      const route = useRoute()
      const isUpdate = !!route.query.id
      // 基本信息
      const uploadData = ref({
        url: '/api/v1/edu' + "/oss/live/channel/image",
        files: []
      })
      const categoryOptions = ref([])
      const selectCidList = ref([])
      const channel = ref({
        id: "",
        name: "",
        introduction: "",
        startTime: "",
        image: "",
        cidList: [],
        showNumber: true,
        enableChat: true,
        lecturerId: ""
      })
      const channelRules = {
        name: [{ required: true, message: "请输入标题", trigger: "blur" }],
        startTime: [{ required: true, message: "请选择时间", trigger: "change" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
        introduction: [{ required: true, message: "请输入描述", trigger: "blur" }],
        image: [{ required: true, message: "请选择海报", trigger: "change" }],
        lecturerId: [{ required: true, message: "请选择讲师", trigger: "change" }]
      }
      const lecturerSelection = ref({})
      // 加载基本信息
      const loadChannel = () => {
        let id = route.query.id;
        if (!id) {
          loadWangEditorFlag.value = true;
          return;
        }
        getChannel(id, function (res) {
          channel.value = res;
          lecturerSelection.value = res.lecturer;
          selectCidList.value = getAllParent(categoryOptions.value, res.cidList);
          channel.value.cidList = []
          uploadData.value.files = [{name: "海报", url: channel.value.image}]
          for (const valElement of selectCidList.value) {
            if (valElement) {
              channel.value.cidList.push(valElement[valElement.length - 1])
            }
          }
          loadWangEditorFlag.value = true;
        })
      }
      // 获取分类
      const loadCategory = () => {
        findCategoryList(0, true, (res) => {
          if (res && res.length) {
            categoryOptions.value = toTree(res);
            loadChannel();
          }
        })
      }
      loadCategory();
      // 选择分类
      const changeCategory = (val) => {
        channel.value.cidList = []
        for (const valElement of val) {
          channel.value.cidList.push(valElement[valElement.length - 1])
        }
      }
      // 选择时间
      const changeStartTime = (val) => {
        channel.value.startTime = val
      }
      // 上传图片成功
      const onUploadImageSuccess = (res) => {
        channel.value.image = res.data
      }
      // 删除图片
      const onUploadImageRemove = () => {
        channel.value.image = ""
        uploadData.value.files = []
      }
      // 提交基本信息
      const channelRef = ref(null)
      const submitChannel = () => {
        if (lecturerSelection.value && lecturerSelection.value.id) {
          channel.value.lecturerId = lecturerSelection.value.id;
        }
        channelRef.value.validate((valid) => {
          if (!valid) { return false }
          if (isUpdate) {
            if (typeof channel.value.startTime === "string") {
              channel.value.startTime = new Date(channel.value.startTime)
            }
            updateChannel(channel.value, function (res) {
              if (res && res.id) {
                channel.value.id = res.id;
                success("编辑成功")
                router.push({path: "/admin/edu/live/channel" });
              }
            })
          } else {
            if (typeof channel.value.startTime === "string") {
              channel.value.startTime = new Date(channel.value.startTime)
            }
            saveChannel(channel.value, function (res) {
              if (res && res.id) {
                channel.value.id = res.id;
                success("新增成功")
                router.push({path: "/admin/edu/live/channel" });
              }
            })
          }
        })
      }
      const lecturerList = ref([])
      const lecturerTotal = ref(0)
      const lecturerParam = {
        size: 20,
        current: 1,
        keyword: ""
      }
      const showLecturerDialog = ref(false)
      const loadLecturerList = () => {
        findList(lecturerParam.value, res => {
          lecturerList.value = res.list
          lecturerTotal.value = res.total
        })
      }
      const showLecturer = () => {
        showLecturerDialog.value = true
        loadLecturerList()
      }
      const hideLecturer = () => {
        showLecturerDialog.value = false
      }
      const lecturerCurrentChange = (currentPage) => {
        lecturerParam.value.current = currentPage;
        loadLecturerList()
      }
      const lecturerSizeChange = (s) => {
        lecturerParam.value.size = s;
        loadLecturerList()
      }
      const handleSelectionChange = (val) => {
        if (val) {
          if(val.length > 2) {
            error("只能选择一个讲师");
            return;
          }
          if (val.length === 1) {
            lecturerSelection.value = val[0];
          }
        }
      }
      const selectedLecturer = () => {
        showLecturerDialog.value = false
      }
      return {
        uploadData,
        categoryOptions,
        channel,
        selectCidList,
        channelRules,
        channelRef,
        changeCategory,
        changeStartTime,
        onUploadImageSuccess,
        onUploadImageRemove,
        submitChannel,
        showLecturerDialog,
        showLecturer,
        hideLecturer,
        lecturerList,
        lecturerTotal,
        lecturerParam,
        lecturerCurrentChange,
        lecturerSizeChange,
        handleSelectionChange,
        selectedLecturer,
        lecturerSelection,
        loadWangEditorFlag
      };
    }
  }
</script>
<style scoped lang="scss">
  .upload-image-tips {
    font-size: 12px;
    color: #999999;
  }
  .el-form-item {
    width: 96%;
  }
  .el-input--mini .el-input__inner {
    height: 40px;
  }
  .lecturer-selected {
    background: #fff;
    border: 1px solid #DCDFE6;
    border-radius: 4px;
    padding: 0 10px;
    line-height: 32px;
  }
</style>
<style lang="scss">
  .el-upload-list--picture-card .el-upload-list__item {
    width: 100%;
    height: 62.5%;
    max-width: 400px;
    img {
      max-width: 400px;
    }
  }
</style>
