<template>
  <div class="app-container">
    <form ref="departmentRef" @submit.prevent>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">上级组织</label>
        <div class="flex-1">
          <Input size="small" v-if="parentDepartment.name" type="text" class="input-text" disabled v-model="parentDepartment.name"></Input>
          <Select size="small" v-else class="input-text" v-model="selectedPid" @change="changeParentDepartment" placeholder="请选择上级组织" clearable>
            <SelectOption v-for="item in flatDepartmentOptions" :key="item.value" :label="item.label" :value="item.value" />
          </Select>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">组织名称</label>
        <div class="flex-1">
          <Input size="small" maxlength="15" class="input-text" v-model="department.name"></Input>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm">是否显示</label>
        <div class="flex-1">
          <Switch size="small" id="enabled" v-model="department.enabled" />
        </div>
      </div>
    </form>
    <div class="dialog-footer">
      <Button variant="outline" size="sm" @click="cancel()">取 消</Button>
      <Button variant="default" size="sm" @click="submit()">确 定</Button>
    </div>
  </div>
</template>

<script>
  import {ref, watch, computed} from "vue"
  import { useFormRef } from '@/composables/useFormRef'
  import router from "@/router"
  import Button from '@/components/ui/Button.vue';
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'
  import { Select, SelectOption } from '@/components/ui/select'
  import { organizationalApi } from '@/api/edu/admin-api'
const { findDepartmentList, toTree, getDepartment, saveDepartment, updateDepartment } = organizationalApi
  import {success, error} from "@/util/tipsUtils";
  export default {
    name: "departmentEdit",
    components: {
      Button,
      Input,
      Switch,
      Select,
      SelectOption
    },
    props: {
      data: {
        type: Object,
        required: true
      },
      pid: {
        type: Number,
        required: true
      },
      editSuccess: {
        type: Function
      },
      editCancel: {
        type: Function
      }
    },
    setup(props) {
      let selectedPidList = ref([])
      const departmentOptions = ref([])
      const parentDepartment = ref({})
      const rules = {
        pid: [{ required: true, message: "请选择上级组织", trigger: "blur" }],
        name: [{ required: true, message: "请输入组织名称", trigger: "blur" }],
      }
      let department = ref({
        pid: 0,
        name: "",
        code: "",
        enabled: true,
      })
      const init = (item, pid) => {
        if (pid) {
          getDepartment(pid, res => {
            if (!res) {
              error("没有找到该组织")
              return;
            }
            parentDepartment.value = res;
          });
        } else {
          parentDepartment.value = {id: 0, name: "全部"};
        }
        if (item && item.id) {
          department = ref(item);
        }
        department.value.pid = pid || 0;
        selectedPidList.value.push(department.value.pid);
      }
      init(props.data, props.pid)
      watch(() => props.data, (nv) => {
        init(nv, nv.pid)
        department = ref(nv)
      })
      const loadDepartment = () => {
        findDepartmentList(0, true).then(function (response) {
          if (response) {
            departmentOptions.value = toTree(response);
          }
        });
      }
      loadDepartment();
      const flatDepartmentOptions = computed(() => {
        const result = []
        const flatten = (nodes, parentPath = '') => {
          for (const node of nodes) {
            const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
            result.push({ label, value: node.value || node.id })
            if (node.children && node.children.length) { flatten(node.children, label) }
          }
        }
        flatten(departmentOptions.value || [])
        return result
      })
      const selectedPid = computed({
        get: () => { const arr = selectedPidList.value; return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : '' },
        set: (val) => { selectedPidList.value = [val] }
      })
      const changeParentDepartment = () => {
        if (department.value.selectedPidList && department.value.selectedPidList.length > 0) {
          let id = selectedPidList.value[selectedPidList.value.length - 1];
          if (id === department.value.id) {
            error("不能选择自己为上级组织")
            return;
          }
          department.value.pid = id;
        }
      }
      const cancel = () => {
        props.editCancel && props.editCancel()
      }
      const departmentRef = useFormRef()
      const submit = () => {
        departmentRef.value.validate(valid => {
          if (!valid) {
            return false;
          }
          if (!department.value.pid && department.value.pid !== 0) {
            error("请选择上级组织")
            return false;
          }
          if (department.value.id) {
            updateDepartment(department.value, (res) => {
              success("编辑成功")
              router.push({path: "/admin/edu/organizational/department", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          } else {
            saveDepartment(department.value, (res) => {
              success("新增成功")
              router.push({path: "/admin/edu/organizational/department", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          }
        });
      }
      return {
        selectedPidList,
        departmentOptions,
        parentDepartment,
        department,
        rules,
        departmentRef,
        loadDepartment,
        changeParentDepartment,
        cancel,
        submit
      }
    }
  }
</script>
<style scoped lang="scss">
.dialog-footer {
  text-align: center;
}
.input-text {
  width: 80%;
}
</style>
