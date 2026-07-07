<template>
  <el-button size="small" link @click="to">授权</el-button>
  <el-dialog v-model="dialog" :title="'选择角色'" append-to-body width="90%">
    <el-form ref="form" :inline="true" size="small" label-width="66px">
      <el-form-item style="margin-bottom: 0;" label="角色">
        <el-select size="small" v-model="roleId" style="width: 450px;" placeholder="请选择">
          <el-option v-for="(item, index) in roleList" :key="item.name + index" :label="item.name" :value="item.id"/>
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button size="small" link @click="cancel">取消</el-button>
        <el-button size="small" :loading="loading" type="primary" @click="submit">确认</el-button>
      </div>
    </template>
  </el-dialog>
</template>
<script>
// @ts-nocheck
import {ref} from "vue"
import {success, warning} from "@/util/tipsUtils";
import { roleApi } from '@/api/edu/admin-api'
const { getRoleList, getUserRoleList, updateUserRole } = roleApi;
export default {
  name: "UserEdit",
  props: {
    data: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    let dialog = ref(false)
    let loading = ref(false)
    let roleList = ref([])
    let roleId = ref(null)
    let userId = 0;
    const form = ref(null)
    const loadRoleList = (id) => {
      getRoleList(res => {
        roleList.value = res || []
        roleList.value.unshift({
          name: "无",
          id: -1
        })
        getUserRoleList(id, res => {
          res[0] && (roleId.value = res[0].id)
        })
      })
    }
    const to = () => {
      userId = props.data.id
      loadRoleList(userId)
      dialog.value = true
    }
    const cancel = () => {
      dialog.value = false
      form.value.resetFields()
    }
    const submit = () => {
      if (!roleId.value) {
        warning("角色不能为空")
        return
      }
      loading.value = true
      const userRoleList = [{ id: roleId.value }]
      const data = {userId: userId, roleList: userRoleList}
      updateUserRole(data, () => {
        success("修改成功")
        dialog.value = false
        loading.value = false
      }).catch(err => {
        loading.value = false
      })
    }
    return {
      dialog,
      loading,
      roleList,
      roleId,
      form,
      to,
      cancel,
      submit
    }
  }
}
</script>

<style scoped>
  div{display: inline-block;margin-right: 3px;}
</style>
