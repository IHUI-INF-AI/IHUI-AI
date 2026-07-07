<template>
  <div class="app-container">
    <el-form ref="categoryRef" :rules="rules" :model="category" label-width="110px">
      <el-form-item label="上级分类" prop="pid">
        <el-input size="small" v-if="parentCategory.name" type="text" class="input-text" disabled v-model="parentCategory.name"></el-input>
        <el-cascader v-else class="input-text" :props="{checkStrictly: true}" v-model="selectedPidList" :options="categoryOptions" placeholder="请选择上级分类" @change="changeParentCategory"></el-cascader>
      </el-form-item>
      <el-form-item label="分类名称" prop="name">
        <el-input size="small" maxlength="15" show-word-limit class="input-text" v-model="category.name"></el-input>
      </el-form-item>
      <el-form-item label="分类图片" prop="image">
        <upload-image :limit="1" :files="uploadData.files" :on-upload-success="onUploadSuccess" :on-upload-remove="onUploadRemove" :upload-url="uploadData.url"></upload-image>
      </el-form-item>
      <el-form-item label="排序" prop="sortOrder">
        <el-input size="small" class="input-text" v-model="category.sortOrder" placeholder="数据越大显示越前"></el-input>
      </el-form-item>
      <el-form-item label="是否显示" prop="isShow">
        <el-switch size="small" id="isShow" active-color="#13ce66" v-model="category.isShow"></el-switch>
      </el-form-item>
      <el-form-item label="是否在首页显示" prop="isShowIndex">
        <el-switch size="small" id="isShowIndex" active-color="#13ce66" v-model="category.isShowIndex"></el-switch>
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
  import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree, getCategory, saveCategory, updateCategory } = examApi
  import uploadImage from "@/components/Uplaod/index.vue";
  import {success, error} from "@/util/tipsUtils";
  export default {
    name: "ExamQuestionLibCategoryEdit",
    components: {
      uploadImage
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
        url: '/api/v1/edu' + "/oss/exam-paper/category/image",
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
              router.push({path: "/admin/edu/exam/paper/category", query:{ id: res["id"]}});
              props.editSuccess && props.editSuccess(res["id"])
            })
          } else {
            saveCategory(category.value, (res) => {
              success("新增成功")
              router.push({path: "/admin/edu/exam/paper/category", query:{ id: res["id"]}});
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
