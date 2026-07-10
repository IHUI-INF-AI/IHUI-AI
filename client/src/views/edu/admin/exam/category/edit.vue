<template>
  <div class="app-container">
    <form ref="categoryRef" @submit.prevent>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">上级分类</label>
        <div class="flex-1">
          <Input size="small" v-if="parentCategory.name" type="text" class="input-text" disabled v-model="parentCategory.name"></Input>
          <Select size="small" v-else class="input-text" v-model="selectedPid" @change="changeParentCategory" placeholder="请选择上级分类" clearable>
            <SelectOption v-for="item in flatCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
          </Select>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">分类名称</label>
        <div class="flex-1">
          <Input size="small" maxlength="15" class="input-text" v-model="category.name"></Input>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">分类图片</label>
        <div class="flex-1">
          <upload-image :limit="1" :files="uploadData.files" :on-upload-success="onUploadSuccess" :on-upload-remove="onUploadRemove" :upload-url="uploadData.url"></upload-image>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">排序</label>
        <div class="flex-1">
          <Input size="small" class="input-text" v-model="category.sortOrder" placeholder="数据越大显示越前"></Input>
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">是否显示</label>
        <div class="flex-1">
          <Switch size="small" id="isShow" v-model="category.isShow" />
        </div>
      </div>
      <div class="mb-4 flex items-center gap-4">
        <label class="w-28 shrink-0 text-sm font-medium text-foreground">是否在首页显示</label>
        <div class="flex-1">
          <Switch size="small" id="isShowIndex" v-model="category.isShowIndex" />
        </div>
      </div>
    </form>
    <div class="dialog-footer">
      <Button size="sm" variant="outline" @click="cancel()">取 消</Button>
      <Button size="sm" variant="default" @click="submit()">确 定</Button>
    </div>
  </div>
</template>

<script>
  import {ref, watch, computed} from "vue"
  import { useFormRef } from '@/composables/useFormRef'
  import router from "@/router"
  import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getCategory, saveCategory, updateCategory } = examApi
  import uploadImage from "@/components/Uplaod/index.vue";
  import {success, error} from "@/util/tipsUtils";
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'
  import { Select, SelectOption } from '@/components/ui/select'
  export default {
    name: "ExamCategoryEdit",
    components: {
      uploadImage,
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
      const categoryOptions = ref([])
      const parentCategory = ref({})
      const uploadData = {
        url: '/api/v1/edu' + "/oss/exam/category/image",
        files: []
      }
      const rules = {
        pid: [{ required: true, message: "请选择上级分类", trigger: "blur" }],
        name: [{ required: true, message: "请输入分类名称", trigger: "blur" }],
        picture: [{ required: true, message: "请上传分类图片", trigger: "blur" }]
      }
      let category = ref({
        pid: 0,
        name: "",
        image: "",
        sortOrder: 1,
        isShow: true,
        isShowIndex: true
      })
      const init = (item, pid) => {
        if (pid) {
          getCategory(pid, res => {
            if (!res) {
              error("没有找到该分类")
              return;
            }
            parentCategory.value = res;
          });
        } else {
          parentCategory.value = {id: 0, name: "全部"};
        }
        if (item && item.id) {
          category = ref(item);
          if (item.image) {
            uploadData.files = [{name: item.name, url: item.image}]
          }
        }
        category.value.pid = pid || 0;
        selectedPidList.value.push(category.value.pid);
      }
      init(props.data, props.pid)
      watch(() => props.data, (nv) => {
        init(nv, nv.pid)
        category = ref(nv)
      })
      const loadCategory = () => {
        findCategoryList(0, true).then(function (response) {
          if (response) {
            categoryOptions.value = toTree(response);
          }
        });
      }
      loadCategory();
      const changeParentCategory = () => {
        if (category.value.selectedPidList && category.value.selectedPidList.length > 0) {
          let id = selectedPidList.value[selectedPidList.value.length - 1];
          if (id === category.value.id) {
            error("不能选择自己为上级分类")
            return;
          }
          category.value.pid = id;
        }
      }
      const cancel = () => {
        props.editCancel && props.editCancel()
      }
      const onUploadSuccess = (res) => {
        category.value.image = res.data;
      }
      const onUploadRemove = () => {
        if (!category.value.image) {
          return;
        }
        category.value.image = "";
        uploadData.value.files = [];
      }
      const categoryRef = useFormRef()
      const submit = () => {
        categoryRef.value.validate(valid => {
          if (!valid) {
            return false;
          }
          if (!category.value.pid && category.value.pid !== 0) {
            error("请选择上级分类")
            return false;
          }
          if (category.value.id) {
            updateCategory(category.value, (res) => {
              success("编辑成功")
              router.push({path: "/admin/edu/exam/exam/category", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          } else {
            saveCategory(category.value, (res) => {
              success("新增成功")
              router.push({path: "/admin/edu/exam/exam/category", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          }
        });
      }
      const flatCategoryOptions = computed(() => {
        const result = []
        const flatten = (nodes, parentPath = '') => {
          for (const node of nodes) {
            const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
            result.push({ label, value: node.value || node.id })
            if (node.children && node.children.length) {
              flatten(node.children, label)
            }
          }
        }
        flatten(categoryOptions.value || [])
        return result
      })
      const selectedPid = computed({
        get: () => {
          const arr = selectedPidList.value
          return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : ''
        },
        set: (val) => { selectedPidList.value = [val] }
      })
      return {
        selectedPidList,
        selectedPid,
        categoryOptions,
        flatCategoryOptions,
        parentCategory,
        category,
        rules,
        uploadData,
        categoryRef,
        loadCategory,
        changeParentCategory,
        cancel,
        onUploadSuccess,
        onUploadRemove,
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
