<template>
  <div class="sensitive-word-container">
    <div class="head">
      <el-input size="small" v-model="param.keyword" clearable placeholder="输入名称搜索" class="custom-input" @keyup.enter="search"></el-input>
      <el-button size="small" class="search-btn" :icon="Search" @click="search">搜索</el-button>
      <el-button style="margin-left: 10px;" @click="show(-1)" size="small" type="primary">新增</el-button>
    </div>
    <el-table v-loading="dataLoading" :data="hotWordList" size="small" style="width: 100%;">
      <el-table-column prop="name" label="名称"/>
      <el-table-column prop="sortOrder" label="权重"/>
      <el-table-column label="操作" align="center">
        <template #default="scope">
          <el-button class="right-btn" @click="edit(scope.row)" size="small">编辑</el-button>
          <el-button class="right-btn" @click="del(scope.row)" size="small">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <!--分页组件-->
    <page :total="total" @size-change="sizeChange" @current-change="currentChange" :page-size="param.size"/>
    <el-dialog title="编辑" v-model="showDialog" :before-close="hide">
      <el-form :model="hotWord" :rules="hotWordRules" ref="hotWordRef">
        <el-form-item label="名称：" label-width="80px" prop="name">
          <el-input size="small" v-model="hotWord.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="权重：" label-width="80px" prop="sortOrder">
          <el-input size="small" v-model="hotWord.sortOrder" placeholder="请输入权重" autocomplete="off"></el-input>
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
  import { searchApi } from '@/api/edu/admin-api'
const { findList, removeHotWord, saveHotWord, updateHotWord } = searchApi;
  import {confirm} from "@/util/tipsUtils"
  import {Search} from '@/lib/lucide-fallback'
  export default {
    name: "HotWordIndex",
    components: {
      Page
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
