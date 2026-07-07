<template>
  <div class="sensitive-word-container">
    <div class="head">
      <el-input size="small" v-model="param.keyword" clearable placeholder="输入标题搜索" class="custom-input" @keyup.enter="search"></el-input>
      <el-button size="small" class="search-btn" :icon="Search" @click="search">搜索</el-button>
      <el-button style="margin-left: 10px;" @click="show(-1)" size="small" type="primary">新增</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="announcementList" size="small" style="width: 100%;">
      <el-table-column prop="title" label="标题"/>
      <el-table-column width="90" label="发布状态">
        <template #default="scope">
          {{statusMap[scope.row.status]}}
        </template>
      </el-table-column>
      <el-table-column width="140" prop="createTime" label="创建时间"/>
      <el-table-column width="140" prop="updateTime" label="修改时间"/>
      <el-table-column label="操作" align="center">
        <template #default="scope">
          <el-button class="right-btn" @click="publish(scope.row)" v-if="scope.row.status !== 'deleted'" size="small">{{scope.row.status === 'published' ? '取消发布' : '发布'}}</el-button>
          <el-button class="right-btn" @click="edit(scope.row)" v-if="scope.row.status !== 'deleted'" size="small">编辑</el-button>
          <el-button class="right-btn" @click="del(scope.row)" v-if="scope.row.status !== 'deleted'" size="small">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <!--分页组件-->
    <page :total="total" @size-change="sizeChange" @current-change="currentChange" :page-size="param.size"/>
    <el-dialog title="编辑" v-model="showDialog" :before-close="hide">
      <el-form :model="announcement" :rules="announcementRules" ref="announcementRef">
        <el-form-item label="标题：" label-width="80px" prop="title">
          <el-input size="small" v-model="announcement.title" placeholder="请输入标题" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="内容：" label-width="80px" prop="content">
          <wang-editor v-model="announcement.content"></wang-editor>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hide">取 消</el-button>
          <el-button size="small" type="primary" @click="submit">确 定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, markRaw} from "vue"
  import Page from "@/components/Page/index.vue"
  import { messageApi } from '@/api/edu/admin-api'
const { getAnnouncementList, removeAnnouncement, saveAnnouncement, updateAnnouncement } = messageApi;
  import {confirm} from "@/util/tipsUtils"
  import WangEditor from "@/components/WangEditor/index.vue";
  import {Search} from '@/lib/lucide-fallback'
  export default {
    name: "MessageAnnouncementIndex",
    components: {
      WangEditor,
      Page
    },
    setup() {
      const statusMap = {
        "unpublished": "未发布",
        "published": "已发布",
        "deleted": "已删除"
      }
      const total = ref(0)
      const announcementList = ref([])
      const param = ref({
        current: 1,
        size: 20,
        keyword: ""
      })
      const dataLoading = ref(true)
      const loadList = () => {
        dataLoading.value = true
        getAnnouncementList(param.value, res => {
          announcementList.value = res.list
          total.value = res.total
          dataLoading.value = false
        })
      }
      loadList();
      // 页码改变
      const currentChange = (currentPage) => {
        param.value.current = currentPage;
        loadList()
      }
      // 页面显示数量改变
      const sizeChange = (size) => {
        param.value.size = size;
        loadList()
      }
      const search = () => {
        loadList()
      }
      const announcement = ref({
        id: "",
        title: "",
        content: ""
      })
      const announcementRules = {
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        content: [{ required: true, message: "请输入内容", trigger: "blur" }]
      }
      const announcementRef = ref(null)
      const showDialog = ref(false)
      const hide = () => {
        showDialog.value = false;
        announcement.value = {
          id: "",
          title: "",
          content: ""
        }
      }
      const show = (id) => {
        showDialog.value = true
        if (id > 0) {
          announcement.value.id = id
        } else {
          announcement.value.id = ""
        }
      }
      const edit = (item) => {
        announcement.value.title = item.title
        announcement.value.content = item.content
        show(item.id)
      }
      const del = (item) => {
        confirm("确认删除该条数据？", "提示", () => {
          removeAnnouncement({id: item.id}, () => {
            loadList()
          })
        })
      }
      const submit = () => {
        if (announcement.value.id) {
          updateAnnouncement(announcement.value, () => {
            loadList()
            hide()
          })
        } else {
          saveAnnouncement(announcement.value, () => {
            loadList()
            hide()
          })
        }
      }
      const publish = (item) => {
        if(item.status === "published") {
          item.status = "unpublished"
        } else {
          item.status = "published"
        }
        updateAnnouncement(item, () => {
          loadList()
        })
      }
      return {
        param,
        total,
        announcementList,
        currentChange,
        sizeChange,
        search,
        showDialog,
        hide,
        show,
        announcement,
        announcementRules,
        announcementRef,
        edit,
        del,
        submit,
        dataLoading,
        publish,
        statusMap,
        Search: markRaw(Search)
      }
    }
  }
</script>

<style scoped lang="scss">
  .sensitive-word-container {
    margin: 20px;
    .head {
      margin-bottom: 10px;
      .custom-input {
        width: 50%;
        min-width: 300px;
      }
      .custom-btn {
        color: #606266;
        &:hover {
          color: var(--el-color-primary);
        }
      }
    }
  }
  .box-card {
    max-width: 500px;
  }
  .fl-table {
    border-radius: 5px;
    font-size: 12px;
    font-weight: normal;
    border: none;
    border-collapse: collapse;
    width: 100%;
    background-color: white;
  }
  .fl-table td {
    border: 1px solid #f8f8f8;
    font-size: 12px;
    padding: 12px;
  }
  .fl-table tr td:nth-child(1) {
    background: #F8F8F8;
    width: 30%;
    min-width: 100px;
  }
</style>
