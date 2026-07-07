<template>
  <div style="margin: 20px;">
    <div class="header">
      <el-row>
        <el-button size="small" type="primary" @click="addAgreement()">
          <el-icon><Plus /></el-icon>
          新增
        </el-button>
      </el-row>
    </div>
    <div class="content">
      <el-table ref="multipleTable" :data="agreementList" style="width: 100%">
        <el-table-column prop="name" label="名称"></el-table-column>
        <el-table-column prop="type" label="类型"></el-table-column>
        <el-table-column label="操作">
          <template #default="scope">
            <el-button size="small" class="right-btn" @click="edit(scope.row.type)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="param.size"></page>
    <el-dialog title="编辑协议" v-model="showAgreementVisible" :before-close="hideAgreement" width="90%">
      <el-form :model="agreement" :rules="agreementRules" ref="agreementRef">
        <el-form-item label="名称：" label-width="120px" prop="name">
          <el-input size="small" v-model="agreement.name" placeholder="请输入名称" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="类型：" label-width="120px" prop="type">
          <el-input size="small" v-model="agreement.type" placeholder="请输入类型" autocomplete="off"></el-input>
        </el-form-item>
        <el-form-item label="内容：" label-width="120px" prop="content">
          <wang-editor v-if="loadWangEditorFlag && showAgreementVisible" v-model="agreement.content"></wang-editor>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="hideAgreement">取 消</el-button>
          <el-button size="small" type="primary" @click="submitAgreement">确 定</el-button>
        </div>
      </template>
    </el-dialog>
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
export default {
  name: "SettingAgreement",
  components: {
    WangEditor,
    Page,
    Plus
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
