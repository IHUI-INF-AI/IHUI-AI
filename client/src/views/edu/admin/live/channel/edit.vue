<template>
  <div>
    <form ref="channelRef" @submit.prevent>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">标题：</label>
        <div>
          <Input v-model="channel.name" placeholder="请输入标题"></Input>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">时间：</label>
        <div>
          <Input
            type="datetime-local"
            v-model="channel.startTime"
            placeholder="选择直播时间"
            class="input-text"
            size="small"
            @change="changeStartTime"
            style="width: 100%;" />
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">分类：</label>
        <div>
          <Select style="width: 100%;"
                  v-model="selectCidList"
                  multiple
                  @change="changeCategory">
            <SelectOption v-for="item in flatCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </Select>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">讲师：</label>
        <div>
          <Button size="sm" variant="outline" @click="showLecturer">选择讲师</Button>
          <div class="lecturer-selected" v-if="lecturerSelection && lecturerSelection.id">{{lecturerSelection.userName}}</div>
          <Dialog v-model="showLecturerDialog" @close="hideLecturer" :close-on-click-overlay="false" :close-on-esc="false">
            <DialogHeader>
              <DialogTitle>选择讲师</DialogTitle>
            </DialogHeader>
            <Table style="width: 100%">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[55px]"><input type="checkbox" :checked="selectedRows.length === lecturerList.length && lecturerList.length > 0" @change="toggleAll($event)" /></TableHead>
                  <TableHead class="w-[180px]">头像</TableHead>
                  <TableHead>名字</TableHead>
                  <TableHead>头衔</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(row, index) in lecturerList" :key="row.id ?? index">
                  <TableCell class="w-[55px]"><input type="checkbox" :checked="selectedRows.includes(row)" @change="toggleRow(row)" /></TableCell>
                  <TableCell><img :src="row.image" style="width: 100px;height: 100px;"/></TableCell>
                  <TableCell>{{ row.userName }}</TableCell>
                  <TableCell>{{ row.jobTitle }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <page :current-change="lecturerCurrentChange" :size-change="lecturerSizeChange" :total="lecturerTotal" :page-size="lecturerParam.size"/>
            <template #footer>
              <div class="dialog-footer">
                <Button size="sm" variant="default" @click="selectedLecturer()">确认</Button>
              </div>
            </template>
          </Dialog>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">详情：</label>
        <div>
          <wang-editor v-if="loadWangEditorFlag" v-model="channel.introduction"></wang-editor>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">海报：</label>
        <div>
          <upload :on-upload-success="onUploadImageSuccess"
                  :on-upload-remove="onUploadImageRemove"
                  :files="uploadData.files"
                  :upload-url="uploadData.url"
                  :limit="1"
                  accept="image/jpeg,image/gif,image/png">
          </upload>
          <span class="upload-image-tips">尺寸建议 1920 x 1200 像素，大小7M以下，张数1张</span>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">允许聊天：</label>
        <div>
          <Switch id="enableChat" v-model="channel.enableChat" />
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">人数显示：</label>
        <div>
          <Switch id="showNumber" v-model="channel.showNumber" />
        </div>
      </div>
      <Button variant="outline" style="display:block;margin:50px auto;" @click="submitChannel">提交</Button>
    </form>
  </div>
</template>
<script>
  import {ref, computed} from "vue"
  import { useFormRef } from '@/composables/useFormRef'
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
  import Button from '@/components/ui/Button.vue'
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'
  import { Select, SelectOption } from '@/components/ui/select'

  export default {
    name: "LiveChannelEdit",
    components:{
      Button,
      Page,
      Upload,
      WangEditor,
      Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
      Input,
      Switch,
      Select,
      SelectOption
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
          selectCidList.value = res.cidList || []
          uploadData.value.files = [{name: "海报", url: channel.value.image}]
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
        channel.value.cidList = val || []
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
      const channelRef = useFormRef()
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
      const selectedRows = ref([])
      const toggleRow = (row) => {
        const idx = selectedRows.value.indexOf(row)
        if (idx >= 0) {
          selectedRows.value.splice(idx, 1)
        } else {
          selectedRows.value.push(row)
        }
        handleSelectionChange(selectedRows.value)
      }
      const toggleAll = (event) => {
        if (event.target.checked) {
          selectedRows.value = [...lecturerList.value]
        } else {
          selectedRows.value = []
        }
        handleSelectionChange(selectedRows.value)
      }
      const selectedLecturer = () => {
        showLecturerDialog.value = false
      }
      return {
        uploadData,
        categoryOptions,
        flatCategoryOptions,
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
        loadWangEditorFlag,
        selectedRows,
        toggleRow,
        toggleAll
      };
    }
  }
</script>
<style scoped lang="scss">
  .upload-image-tips {
    font-size: 12px;
    color: #999999;
  }
  .lecturer-selected {
    background: #fff;
    border: 1px solid #DCDFE6;
    border-radius: 4px;
    padding: 0 10px;
    line-height: 32px;
  }
</style>
