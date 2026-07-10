<template>
  <Button variant="link" size="sm" @click="to">授权</Button>
  <Dialog v-model="dialog" width="90%">
    <DialogHeader>
      <DialogTitle>选择角色</DialogTitle>
    </DialogHeader>
    <form ref="form" @submit.prevent class="flex flex-wrap items-center gap-4">
      <div class="mb-4 flex items-center gap-4" style="margin-bottom: 0;">
        <label class="w-16 shrink-0 text-sm">角色</label>
        <div class="flex-1">
          <Select size="small" v-model="roleId" style="width: 450px;" placeholder="请选择">
            <SelectOption v-for="(item, index) in roleList" :key="item.name + index" :label="item.name" :value="item.id"/>
          </Select>
        </div>
      </div>
    </form>
    <DialogFooter>
      <div class="dialog-footer">
        <Button variant="link" size="sm" @click="cancel">取消</Button>
        <Button variant="default" size="sm" @click="submit">确认</Button>
      </div>
    </DialogFooter>
  </Dialog>
</template>
<script>
import {ref} from "vue"
import {success, warning} from "@/util/tipsUtils";
import { roleApi } from '@/api/edu/admin-api'
const { getRoleList, getUserRoleList, updateUserRole } = roleApi;
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import Button from '@/components/ui/Button.vue'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "UserEdit",
  components: {
    Button,
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    Select,
    SelectOption
  },
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
      form.value?.reset()
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
