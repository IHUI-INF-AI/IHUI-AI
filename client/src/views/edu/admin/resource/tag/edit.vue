<template>
  <div class="app-container">
    <form ref="categoryRef" @submit.prevent>
<!--      <div class="mb-4">-->
<!--        <label class="mb-1 block text-sm font-medium text-foreground">上级分类</label>-->
<!--        <div>-->
<!--          <Input size="small" v-if="parentCategory.name" type="text" class="input-text" disabled v-model="parentCategory.name"></Input>-->
<!--          <el-cascader v-else class="input-text" :props="{checkStrictly: true}" v-model="selectedPidList" :options="categoryOptions" placeholder="请选择上级分类" @change="changeParentCategory"></el-cascader>-->
<!--        </div>-->
<!--      </div>-->
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">分类名称</label>
        <div>
          <Input size="small" maxlength="15" class="input-text" v-model="category.name"></Input>
        </div>
      </div>
<!--      <div class="mb-4">-->
<!--        <label class="mb-1 block text-sm font-medium text-foreground">分类图片</label>-->
<!--        <div>-->
<!--          <upload-image :limit="1" :files="uploadData.files" :on-upload-success="onUploadSuccess" :on-upload-remove="onUploadRemove" :upload-url="uploadData.url"></upload-image>-->
<!--        </div>-->
<!--      </div>-->
<!--      <div class="mb-4">-->
<!--        <label class="mb-1 block text-sm font-medium text-foreground">排序</label>-->
<!--        <div>-->
<!--          <Input size="small"  class="input-text" v-model="category.sortOrder" placeholder="数据越大显示越前"></Input>-->
<!--        </div>-->
<!--      </div>-->
<!--      <div class="mb-4">-->
<!--        <label class="mb-1 block text-sm font-medium text-foreground">是否显示</label>-->
<!--        <div>-->
<!--          <el-switch size="small"  id="isShow" active-color="#13ce66" v-model="category.isShow"></el-switch>-->
<!--        </div>-->
<!--      </div>-->
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
        <div>
          <Switch id="status" v-model="category.status" />
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
// @ts-nocheck
  import {ref, watch} from "vue"
  import router from "@/router"
  import Button from '@/components/ui/Button.vue';
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'
  import { resourceApi } from '@/api/edu/admin-api'
const { toTree } = resourceApi
  const { findTagList, getTag, saveTag, updateTag } = resourceApi
  // import uploadImage from "@/components/Uplaod/index.vue";
  import {success, error} from "@/util/tipsUtils";
  export default {
    name: "ResourceCategoryEdit",
    components: {
      // uploadImage
      Button,
      Input,
      Switch
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
        url: '/api/v1/edu' + "/oss/resource/category/image",
        files: []
      }
      const rules = {
        name: [{ required: true, message: "请输入分类名称", trigger: "blur" }],
      }
      let category = ref({
        name: "",
        status: true
      })
      const init = (item, pid) => {
        if (pid) {
          getTag(pid, res => {
            if (!res) {
              error("没有找到该标签")
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
        findTagList(0, true).then(function (response) {
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
      const categoryRef = ref(null)
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
            updateTag(category.value, (res) => {
              success("编辑成功")
              router.push({path: "/admin/edu/resource/tag", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          } else {
            saveTag(category.value, (res) => {
              success("新增成功")
              router.push({path: "/admin/edu/resource/tag", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          }
        });
      }
      return {
        selectedPidList,
        categoryOptions,
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
