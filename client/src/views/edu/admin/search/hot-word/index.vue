<template>
  <div class="sensitive-word-container">
    <div class="head">
      <Input size="small" v-model="param.keyword" clearable placeholder="输入名称搜索" class="custom-input" @keyup.enter="search"></Input>
      <Button size="sm" className="search-btn" variant="outline" @click="search"><Search />搜索</Button>
      <Button style="margin-left: 10px;" @click="show(-1)" size="sm" variant="default">新增</Button>
    </div>
    <div v-if="dataLoading" class="loading-div">加载中...</div>
    <Table class="text-sm" style="width: 100%">
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>权重</TableHead>
          <TableHead class="text-center">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(row, index) in hotWordList" :key="row.id ?? index">
          <TableCell>{{ row.name }}</TableCell>
          <TableCell>{{ row.sortOrder }}</TableCell>
          <TableCell class="text-center">
            <Button className="right-btn" @click="edit(row)" size="sm" variant="outline">编辑</Button>
            <Button className="right-btn" @click="del(row)" size="sm" variant="outline">删除</Button>
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
      <form ref="hotWordRef" @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">名称：</label>
          <div>
            <Input size="small" v-model="hotWord.name" placeholder="请输入名称" autocomplete="off"></Input>
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">权重：</label>
          <div>
            <Input size="small" v-model="hotWord.sortOrder" placeholder="请输入权重" autocomplete="off"></Input>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hide">取 消</Button>
          <Button size="sm" variant="default" @click="submit">确 定</Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, markRaw} from "vue"
  import Page from "@/components/Page/index.vue"
  import { searchApi } from '@/api/edu/admin-api'
const { findList, removeHotWord, saveHotWord, updateHotWord } = searchApi;
  import {confirm} from "@/util/tipsUtils"
  import {Search} from '@/lib/lucide-fallback'
  import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  export default {
    name: "HotWordIndex",
    components: {
      Page,
      Button,
      Input,
      Table, TableHeader, TableBody, TableRow, TableHead, TableCell
    },
    setup() {
      const total = ref(0)
      const hotWordList = ref([])
      const param = ref({
        current: 1,
        size: 20,
        keyword: ""
      })
      const dataLoading = ref(true)
      const loadList = () => {
        dataLoading.value = true
        findList(param.value, res => {
          hotWordList.value = res.list
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
      const hotWord = ref({
        id: "",
        name: "",
        sortOrder: ""
      })
      const hotWordRules = {
        name: [{ required: true, message: "请输入名称", trigger: "blur" }],
        sortOrder: [{ required: true, message: "请输入权重", trigger: "blur" }]
      }
      const hotWordRef = ref(null)
      const showDialog = ref(false)
      const hide = () => {
        showDialog.value = false;
        hotWord.value = {
          id: "",
          name: "",
          sortOrder: ""
        }
      }
      const show = (id) => {
        showDialog.value = true
        if (id > 0) {
          hotWord.value.id = id
        } else {
          hotWord.value.id = ""
        }
      }
      const edit = (item) => {
        hotWord.value.name = item.name
        hotWord.value.sortOrder = item.sortOrder
        show(item.id)
      }
      const del = (item) => {
        confirm("确认删除该条数据？", "提示", () => {
          removeHotWord({id: item.id}, () => {
            loadList()
          })
        })
      }
      const submit = () => {
        if (hotWord.value.id) {
          updateHotWord(hotWord.value, () => {
            loadList()
            hide()
          })
        } else {
          saveHotWord(hotWord.value, () => {
            loadList()
            hide()
          })
        }
      }
      return {
        param,
        total,
        hotWordList,
        currentChange,
        sizeChange,
        search,
        showDialog,
        hide,
        show,
        hotWord,
        hotWordRules,
        hotWordRef,
        edit,
        del,
        submit,
        dataLoading,
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
