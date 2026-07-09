<template>
  <div style="margin: 20px;">
    <div class="header">
      <div class="flex flex-wrap">
        <Button size="sm" variant="default" @click="addAgreement()">
          <Plus class="h-4 w-4" />
          新增
        </Button>
      </div>
    </div>
    <div class="content">
      <Table style="width: 100%">
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>类型</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="(row, index) in agreementList" :key="row.id ?? index">
            <TableCell>{{ row.name }}</TableCell>
            <TableCell>{{ row.type }}</TableCell>
            <TableCell>
              <Button size="sm" className="right-btn" variant="outline" @click="edit(row.type)">编辑</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="param.size"></page>
    <Dialog v-model="showAgreementVisible" :width="'90%'" @close="hideAgreement">
      <DialogHeader>
        <DialogTitle>编辑协议</DialogTitle>
      </DialogHeader>
      <form ref="agreementRef" @submit.prevent>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">名称：</label>
          <div>
            <Input size="small" v-model="agreement.name" placeholder="请输入名称" autocomplete="off" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">类型：</label>
          <div>
            <Input size="small" v-model="agreement.type" placeholder="请输入类型" autocomplete="off" />
          </div>
        </div>
        <div class="mb-4">
          <label class="mb-1 block text-sm font-medium text-foreground">内容：</label>
          <div>
            <wang-editor v-if="loadWangEditorFlag && showAgreementVisible" v-model="agreement.content"></wang-editor>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="dialog-footer">
          <Button size="sm" variant="outline" @click="hideAgreement">取 消</Button>
          <Button size="sm" variant="default" @click="submitAgreement">确 定</Button>
        </div>
      </template>
    </Dialog>
  </div>
</template>

<script>
// @ts-nocheck
import {ref} from "vue";
import WangEditor from "@/components/WangEditor/index.vue"
import Page from "@/components/Page/index.vue";
import { settingApi } from '@/api/edu/admin-api'
const { saveAgreement, getAgreement, getAgreementList, putAgreement } = settingApi;
import {error} from "@/util/tipsUtils";
import {Plus} from '@/lib/lucide-fallback';
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
export default {
  name: "SettingAgreement",
  components: {
    WangEditor,
    Page,
    Plus,
    Button,
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
    Input
  },
  setup() {
    const loadWangEditorFlag = ref(false)
    const param = ref({
      current: 1,
      size: 20
    })
    const total = ref(0)
    // 协议
    const agreement = ref({
      // 名称
      name: "",
      // 类型
      type: "",
      // 内容
      content: ""
    })
    const agreementRules = {
      name: [{ required: true, message: "请输入名称", trigger: "blur" }],
      type: [{ required: true, message: "请输入类型", trigger: "blur" }],
      content: [{ required: true, message: "请输入内容", trigger: "blur" }],
    }
    const showAgreementVisible = ref(false)
    // 列表
    const agreementList = ref([])
    // 加载列表
    const load = () => {
      getAgreementList(param.value, (res) => {
        agreementList.value = res.list;
        total.value = res.total;
      })
    }
    load()
    // 页码改变
    const currentChange = (currentPage) => {
      param.value.current = currentPage;
      load();
    }
    // 页面显示数量改变
    const sizeChange = (size) => {
      param.value.size = size;
      load();
    }
    // 显示编辑框
    const showAgreement = function() {
      showAgreementVisible.value = true
    }
    const agreementRef = ref(null)
    // 隐藏编辑框
    const hideAgreement = function() {
      showAgreementVisible.value = false
      agreementRef.value.resetFields()
    }
    const addAgreement = function() {
      agreement.value = {
        // 名称
        name: "",
        // 类型
        type: "",
        // 内容
        content: ""
      }
      showAgreement()
      loadWangEditorFlag.value = true;
    }
    // 编辑
    const edit = function(type) {
      getAgreement({type: type}, res => {
        agreement.value = res;
        showAgreement()
        loadWangEditorFlag.value = true;
      })
    }
    // 提交
    const submitAgreement = function() {
      agreementRef.value.validate((valid) => {
        if (!valid) {
          return;
        }
        if (!agreement.value.name) {
          error("请输入名称")
          return
        }
        if (!agreement.value.type) {
          error("请输入类型")
          return
        }
        if (!agreement.value.content) {
          error("请输入协议内容")
          return
        }
        if (agreement.value["id"]) {
          putAgreement(agreement.value, () => {
            hideAgreement()
            load()
          })
        } else {
          saveAgreement(agreement.value, () => {
            hideAgreement()
            load()
          })
        }
      })
    }
    return {
      param,
      total,
      agreement,
      agreementRules,
      showAgreementVisible,
      agreementList,
      currentChange,
      sizeChange,
      addAgreement,
      showAgreement,
      hideAgreement,
      edit,
      submitAgreement,
      agreementRef,
      loadWangEditorFlag
    }
  }
}
</script>

<style lang="scss" scoped>
  .header {
    margin-bottom: 20px;
    text-align: right;
  }
  .el-dialog__wrapper :deep(.el-dialog__body){
    padding: 10px 20px;
  }
</style>
