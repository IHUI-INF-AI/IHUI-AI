<template>
  <div class="resource-edit-wrap">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/'}">首页</el-breadcrumb-item>
      <el-breadcrumb-item :to="{ path: topath ? topath : '/resource'}">知识</el-breadcrumb-item>
      <el-breadcrumb-item>{{id ? '编辑' : '上传内容'}}</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="resource-edit-main">
      <el-form :model="resource" :rules="resourceRules" ref="resourceRef" label-width="120px">
        <el-form-item label="标题目" prop="title">
          <el-input placeholder="请输入标题" v-model="resource.title" clearable></el-input>
        </el-form-item>
        <el-form-item label="分类：" prop="cidList">
          <el-cascader
            style="width: 100%;"
            v-model="selectCidList"
            :props="{ checkStrictly: true }"
            :options="categoryOptions"
            @change="changeCategory">
          </el-cascader>
        </el-form-item>
        <el-form-item label="类型：" prop="type">
          <el-radio-group v-model="resource.type">
            <el-radio :label="key" v-for="(item,key) in typeNameJson" :key="key">{{item}}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="文件：" prop="url">
          <upload :on-upload-success="onUploadFileSuccess" :on-upload-remove="onUploadFileRemove" :upload-url="uploadFileUrl" :files="files" list-type="text" :limit="1"/>
        </el-form-item>
        <el-form-item label="类别：" prop="productId">
          <el-cascader
              style="width: 100%;"
              v-model="selectResourceProductIdList"
              :props="{ checkStrictly: true }"
              :options="resourceProductOptions"
              @change="changeResourceProduct">
          </el-cascader>
        </el-form-item>
        <el-form-item label="标签：">
          <el-cascader
              style="width: 100%;"
              v-model="selectResourceTagIdList"
              :props="{ checkStrictly: true, multiple: true }"
              :options="resourceTagOptions"
              @change="changeResourceTag">
          </el-cascader>
<!--          <el-tag :key="tag" v-for="(tag, index) in tags" closable :disable-transitions="false" @close="delTag(index)">{{tag}}</el-tag>-->
<!--          <el-input class="input-new-tag" v-if="tagsVisible" v-model="tag" ref="tagsRef" @blur="tagsInputConfirm" @keydown.enter="tagsInputConfirm" placeholder="请输入标题></el-input>-->
<!--          <el-button v-else" class="button-new-tag" @click="showTagsInput">+ 新增标签</el-button>-->
        </el-form-item>
        <el-form-item label="展示图：" prop="image">
          <upload :on-upload-success="onUploadSuccess" :on-upload-remove="onUploadRemove" :upload-url="uploadUrl" :files="imageFiles" :limit="1"/>
        </el-form-item>
        <el-form-item label="详情" prop="introduction">
          <wang-editor v-if="loadWangEditorFlag" v-model="resource.introduction" :on-change="editorChange"></wang-editor>
        </el-form-item>
      </el-form>
      <div class="dialog-footer">
        <el-button @click="cancel">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import {computed, ref, markRaw} from "vue";
import {ArrowRight} from '@/lib/lucide-fallback';
import {findCategoryList, toTree} from "@/api/edu/web/resource/category";
import Upload from "@/components/Uplaod";
import WangEditor from "@/components/WangEditor/index.vue"
import {success} from "@/util/tipsUtils";
import {getResource, saveResource, updateResource, getResourceProductList, getResourceTagList} from "@/api/edu/web/resource";
import {useRoute} from "vue-router";
import router from "@/router";
import {getAllParent} from "@/api/edu/web/learn/category";

export default {
  name: "resourceEdit",
  components: {
    Upload,
    WangEditor
  },
  emits: [
    "submitCallback",
    "cancelCallback"
  ],
  props: {
    submitCallback: {
      type: Function
    },
    cancelCallback: {
      type: Function
    },
    vModel: {
      type: Boolean,
      default: false
    },
    item: {
      type: Object,
      default: () => {
        return {}
      }
    }
  },
  setup(props, context) {
    const ArrowRightIcon = markRaw(ArrowRight)
    const loadWangEditorFlag = ref(false)
    const route = useRoute();
    const id = route.query.id;
    const topath = ref(route.query.topath);
    if (!topath.value) {
      topath.value = "/resource"
    }
    const dialogModel = computed({
      get() {
        return props.vModel;
      },
      set(val) {
        context.emit('update:vModel', val);
      },
    });
    const typeNameJson = {
      "other": "其他",
      "word": "WORD文档",
      "excel": "EXCEL表格",
      "ppt": "PPPT幻灯片",
      "pdf": "PDF文档",
      "image": "图片",
      "txt": "TXT文本",
      "file": "文件"
    }
    const tags = ref([])
    const categoryOptions = ref()
    const selectCidList = ref([])
    const selectResourceProductIdList = ref([])
    const selectResourceTagIdList = ref([])
    const init = function () {
      if (id && id.length) {
        getResource(id, res => {
          resource.value = res
          if (res.image) {
            imageFiles.value = [{name: "封面板", url: res.image}]
          }
          if (res.url) {
            files.value = [{name: res.title, url: res.url}]
          }
          if (res.cidList && res.cidList.length) {
            var allParent = getAllParent(categoryOptions.value, res.cidList);
            selectCidList.value = allParent[0];
          }
          if (res.resourceProduct && res.resourceProduct.id) {
            selectResourceProductIdList.value.push(res.resourceProduct.id)
            resource.value.productId = res.resourceProduct.id;
          }
          if (res.resourceTagList && res.resourceTagList.length) {
            const tIdList = []
            for (const t of res.resourceTagList) {
              tIdList.push(t.id)
            }
            selectResourceTagIdList.value = tIdList
            resource.value.tagIdList = tIdList
          }
          if (res.tags && res.tags.length) {
            tags.value = res.tags.split(",")
          }
          loadWangEditorFlag.value = true
        })
      } else {
        loadWangEditorFlag.value = true
      }
    }
    // 获取分类
    findCategoryList( 0, true, res => {
      categoryOptions.value = toTree(res)
      init()
    })

    // 产品
    const resourceProductOptions = ref([])
    const loadResourceProductList = function () {
      getResourceProductList({}, res => {
        if (res && res.length) {
          const reList = []
          for (const re of res) {
            const obj = {
              value: re.id,
              label: re.name
            }
            reList.push(obj);
          }
          resourceProductOptions.value = reList
        }
      })
    }
    loadResourceProductList();
    const changeResourceProduct = (val) => {
      resource.value.productId = ""
      resource.value.productId = val[val.length - 1]

      selectResourceProductIdList.value = []
      selectResourceProductIdList.value.push(val[val.length - 1])

    }

    const resourceTagOptions = ref([])
    const loadResourceTagList = function () {
      getResourceTagList({}, res => {
        if (res && res.length) {
          const reList = []
          for (const re of res) {
            const obj = {
              value: re.id,
              label: re.name
            }
            reList.push(obj);
          }
          resourceTagOptions.value = reList
        }
      })
    }
    loadResourceTagList();
    const changeResourceTag = (val) => {

      if (val && val.length) {

        const tIdList = []
        for (let i = 0; i < val.length; i++) {
          const valElement = val[i];
          tIdList.push(valElement[valElement.length - 1]);
        }
        resource.value.tagIdList = tIdList
        selectResourceTagIdList.value = tIdList

      } else {
        resource.value.tagIdList = []
        selectResourceTagIdList.value = []
      }
    }



    const resource = ref({
      cidList: [],
      introduction: "",
      image: "",
      title: "",
      url: "",
      type: "other",
      tags: "",
      productId: ""
    })
    const imageFiles = ref([])
    const files = ref([])

    // 上传图片的路
    const uploadUrl = ref('/api/v1/edu' + "/oss/resource/image")
    // 上传图片成功的回收
    const onUploadSuccess = (data) => {
      resource.value.image = data.data
    }
    // 删除图片的回收
    const onUploadRemove = () => {
      resource.value.image = ""
    }
    // 上传图片的路
    const uploadFileUrl = ref('/api/v1/edu' + "/oss/resource/file")
    // 上传图片成功的回收
    const onUploadFileSuccess = (data) => {
      resource.value.url = data.data
    }
    // 删除图片的回收
    const onUploadFileRemove = () => {
      resource.value.url = ""
    }
    // 选择分类
    const changeCategory = (val) => {
      resource.value.cidList = []
      resource.value.cidList.push(val[val.length - 1])
    }
    const resourceRules = {
      title: [{ required: true, message: "请输入标题", trigger: "blur" }],
      type: [{ required: true, message: "请选择类型", trigger: "change" }],
      introduction: [{ required: true, message: "请输入内容", trigger: "blur" }],
      // image: [{ required: true, message: "请选择图片", trigger: "change" }],
      // url: [{ required: true, message: "请选择文件", trigger: "change" }],
      productId: [{ required: true, message: "请选择类别", trigger: "change" }],
      cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
    }
    const resourceRef = ref(null)
    const submit = () => {
      resourceRef.value.validate((valid) => {
        if (!valid) { return false }
        if (tags.value && tags.value.length) {
          resource.value.tags = tags.value.join(",")
        } else {
          resource.value.tags = "";
        }
        if (resource.value.id) {
          updateResource(resource.value, () => {
            success("编辑成功")
            // props.submitCallback && props.submitCallback()
            router.push({path: topath.value})
          })
        } else {
          saveResource(resource.value, () => {
            success("分享成功")
            // props.submitCallback && props.submitCallback()
            router.push({path: topath.value})
          })
        }
      })
    }
    const cancel = () => {
      // props.cancelCallback && props.cancelCallback()
      router.push({path: topath.value})
    }
    const editorValue = ref("")
    const editorChange = (value) => {
      editorValue.value = value
    }
    // 标签
    const tag = ref("")
    const tagsVisible = ref(false)
    const tagsRef = ref(null)
    const showTagsInput = () => {
      tagsVisible.value = true
    }
    const tagsInputConfirm = () => {
      if (tag.value) {
        tags.value.push(tag.value)
        tag.value = ""
      }
      tagsVisible.value = false
    }
    const delTag = (index) => {
      tags.value.splice(index, 1)
    }
    return {
      ArrowRight: ArrowRightIcon,
      id,
      topath,
      typeNameJson,
      selectCidList,
      uploadUrl,
      changeCategory,
      categoryOptions,
      resourceRules,
      resource,
      onUploadSuccess,
      onUploadRemove,
      submit,
      uploadFileUrl,
      onUploadFileSuccess,
      onUploadFileRemove,
      resourceRef,
      cancel,
      imageFiles,
      files,
      dialogModel,
      loadWangEditorFlag,
      editorChange,
      // 标签
      tags,
      tag,
      tagsVisible,
      tagsRef,
      showTagsInput,
      tagsInputConfirm,
      delTag,

      resourceProductOptions,
      changeResourceProduct,
      selectResourceProductIdList,

      resourceTagOptions,
      changeResourceTag,
      selectResourceTagIdList,
    }
  }
}
</script>

<style scoped lang="scss">
.resource-edit-wrap {
  padding-top: 20px;
}
.dialog-footer {
  text-align: center;
}
.resource-edit-main {
  margin: 40px 0;
}
</style>
