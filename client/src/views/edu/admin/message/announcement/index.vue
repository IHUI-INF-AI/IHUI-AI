<template>
  <div class="sensitive-word-container">
    <div class="head">
      <Input size="small" v-model="param.keyword" clearable placeholder="输入标题搜索" class="custom-input" @keyup.enter="search"></Input>
      <Button size="sm" className="search-btn" variant="outline" @click="search"><Search />搜索</Button>
      <Button style="margin-left: 10px;" size="sm" variant="default" @click="show(-1)">新增</Button>
    </div>
    <div v-if="dataLoading" class="loading-overlay">加载中...</div>
    <Table class="text-sm">
      <TableHeader>
        <TableRow>
          <TableHead>标题</TableHead>
          <TableHead class="w-[90px]">发布状态</TableHead>
          <TableHead class="w-[140px]">创建时间</TableHead>
          <TableHead class="w-[140px]">修改时间</TableHead>
          <TableHead class="text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in announcementList" :key="row.id ?? index">
          <TableCell>{{ row.title }}</TableCell>
          <TableCell>{{ statusMap[row.status] }}</TableCell>
          <TableCell>{{ row.createTime }}</TableCell>
          <TableCell>{{ row.updateTime }}</TableCell>
          <TableCell class="text-center">
            <Button className="right-btn" variant="outline" size="sm" v-if="row.status !== 'deleted'" @click="publish(row)">{{ row.status === 'published' ? '取消发布' : '发布' }}</Button>
            <Button className="right-btn" variant="outline" size="sm" v-if="row.status !== 'deleted'" @click="edit(row)">编辑</Button>
            <Button className="right-btn" variant="outline" size="sm" v-if="row.status !== 'deleted'" @click="del(row)">删除</Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <!--分页组件-->
    <page :total="total" @size-change="sizeChange" @current-change="currentChange" :page-size="param.size"/>
    <Dialog v-model="showDialog" @close="hide">
      <DialogHeader>
        <DialogTitle>编辑</DialogTitle>
      </DialogHeader>
      <form ref="announcementRef" @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">标题：</label>
          <div>
            <Input size="small" v-model="announcement.title" placeholder="请输入标题" autocomplete="off"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">内容：</label>
          <div>
            <wang-editor v-model="announcement.content"></wang-editor>
          </div>
        </div>
      </form>
      <DialogFooter>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hide">取 消</Button>
          <Button size="sm" variant="default" @click="submit">确 定</Button>
        </div>
      </DialogFooter>
    </Dialog>
  </div>
</template>

<script>
  import {ref, markRaw} from "vue"
  import Page from "@/components/Page/index.vue"
  import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { messageApi } from '@/api/edu/admin-api'
const { getAnnouncementList, removeAnnouncement, saveAnnouncement, updateAnnouncement } = messageApi;
  import {confirm} from "@/util/tipsUtils"
  import WangEditor from "@/components/WangEditor/index.vue";
  import {Search} from '@/lib/lucide-fallback'
  export default {
    name: "MessageAnnouncementIndex",
    components: {
      WangEditor,
      Page,
      Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
      Button,
      Search,
      Input
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
          color: hsl(var(--primary));
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
