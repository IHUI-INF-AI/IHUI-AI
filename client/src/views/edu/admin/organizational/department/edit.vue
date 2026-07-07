<template>
  <div class="app-container">
    <el-form ref="departmentRef" :rules="rules" :model="department" label-width="110px">
      <el-form-item label="上级组织" prop="pid">
        <el-input size="small" v-if="parentDepartment.name" type="text" class="input-text" disabled v-model="parentDepartment.name"></el-input>
        <el-cascader size="small" v-else class="input-text" :props="{checkStrictly: true}" v-model="selectedPidList" :options="departmentOptions" placeholder="请选择上级组织" @change="changeParentDepartment"></el-cascader>
      </el-form-item>
      <el-form-item label="组织名称" prop="name">
        <el-input size="small" maxlength="15" show-word-limit class="input-text" v-model="department.name"></el-input>
      </el-form-item>
      <el-form-item label="是否显示" prop="enabled">
        <el-switch size="small" id="enabled" active-color="#13ce66" v-model="department.enabled"></el-switch>
      </el-form-item>
    </el-form>
    <div class="dialog-footer">
      <el-button size="small" @click="cancel()">取 消</el-button>
      <el-button size="small" type="primary" @click="submit()">确 定</el-button>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
  import {ref, watch} from "vue"
  import router from "@/router"
  import { organizationalApi } from '@/api/edu/admin-api'
const { findDepartmentList, toTree, getDepartment, saveDepartment, updateDepartment } = organizationalApi
  import {success, error} from "@/util/tipsUtils";
  export default {
    name: "departmentEdit",
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
      const departmentRef = ref(null)
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
