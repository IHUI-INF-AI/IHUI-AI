<template>
  <div class="category-edit">
    <form ref="categoryRef" @submit.prevent>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">上级分类：</label>
        <div>
          <Input size="small" v-if="parentCategory.name" type="text" class="input-text" disabled v-model="parentCategory.name" />
          <el-cascader  v-else class="input-text" :props="{checkStrictly: true}" v-model="selectedPidList" :options="categoryOptions" placeholder="请选择上级分类" @change="changeParentCategory"></el-cascader>
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">分类名称：</label>
        <div>
          <Input size="small" maxlength="15" class="input-text" v-model="category.name" />
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">排序：</label>
        <div>
          <Input size="small" class="input-text" v-model="category.sortOrder" placeholder="数据越大显示越前" />
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">是否显示：</label>
        <div>
          <Switch size="small" id="isShow" v-model="category.isShow" />
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">首页显示：</label>
        <div>
          <Switch size="small" id="isShowIndex" v-model="category.isShowIndex" />
        </div>
      </div>
      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-foreground">分类图片：</label>
        <div>
          <upload-image :limit="1" :files="uploadData.files" :on-upload-success="onUploadSuccess" :on-upload-remove="onUploadRemove" :upload-url="uploadData.url"></upload-image>
        </div>
      </div>
    </form>
    <div class="dialog-footer">
      <Button className="ql_bu" size="sm" variant="outline" @click="cancel()">取 消</Button>
      <Button className="ql_bu" size="sm" variant="default" @click="submit()">确 定</Button>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
  import router from "@/router"
  import uploadImage from "@/components/Uplaod/index.vue"
  import Button from '@/components/ui/Button.vue'
  import { Input } from '@/components/ui/input'
  import { Switch } from '@/components/ui/switch'
  import {ref, watch} from "vue"
  import {success, error} from "@/util/tipsUtils"
  import { learnApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getCategory, saveCategory, updateCategory } = learnApi
  export default {
    name: "LearnCategoryEdit",
    components: {
      Button,
      uploadImage,
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
        url: '/api/v1/edu' + "/oss/learning/category/image",
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
            updateCategory(category.value, (res) => {
              success("编辑成功")
              router.push({path: "/admin/edu/learn/lesson/category", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          } else {
            saveCategory(category.value, (res) => {
              success("新增成功")
              router.push({path: "/admin/edu/learn/lesson/category", query:{ id: res["id"]}});
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
.category-edit {
  :deep(.el-upload-list--picture-card .el-upload-list__item){
    width: 260px;
    height: 160px;
  }
  .dialog-footer {
    padding-top: 20px;
    text-align: center;
    :deep(.el-button){
      border-color: #f3f5f8;
    }
  }
}

//穿透改颜色
:deep(.el-input__wrapper) {
  //background-color: #f2e9fb;
  background: rgba(255, 255, 255, 0.283);
  box-shadow: inset 6.64px -6.64px 6.64px 0px rgba(214, 214, 214, 0.326),inset -6.64px 6.64px 6.64px 0px rgba(255, 255, 255, 0.326);
  border: 1px solid #B7B5CA;
}
//el-upload--picture-card
:deep(.el-upload) {
  //background-color: #f2e9fb;
  background: rgba(206, 203, 241, 0.25);
  border: 1px solid #B7B5CA;
}
.ql_bu{
  width: 130px;
  height: 45px;
  border-radius: 8px;
  background: linear-gradient(268deg, rgba(217, 219, 254, 0.65) -210%, rgba(217, 219, 254, 0.65) -150%, rgba(217, 219, 255, 0.65) -124%, rgba(217, 219, 254, 0.65) -34%, rgba(217, 219, 255, 0.65) -18%, rgba(144, 125, 255, 0.65) 218%, rgba(224, 225, 252, 0.65) 304%);
  border: 2px dashed #cbcdd3;
  color: #716d9e;
  box-sizing: border-box;
  border-width: 2px 2px 0px 2px;
  border-style: solid;
  border-color: #E0E1FC;

  backdrop-filter: blur(10px);
  box-shadow: inset 0px -6px 20px 0px rgba(255, 255, 255, 0.8);
}

</style>
