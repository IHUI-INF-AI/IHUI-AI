<template>
  <el-dialog :title="article.id ? '编辑文章' : '发布文章'" custom-class="el-dialog-box" v-model="dialogModel" width="80%" :before-close="cancel" :lock-scroll="false">
    <el-form :model="article" :rules="articleRules" ref="articleRef" label-position="top">
      <el-form-item label="文章标题" prop="title">
        <el-input placeholder="请输入吸引人的标题..." v-model="article.title" clearable size="large"></el-input>
      </el-form-item>
      <el-form-item label="文章封面" prop="image">
        <div class="upload-container">
          <upload :on-upload-success="onUploadSuccess" :on-upload-remove="onUploadRemove" :upload-url="uploadUrl" :files="files" :limit="1"/>
          <p class="upload-tip">建议尺寸：800*450px，支持 jpg、png 格式</p>
        </div>
      </el-form-item>
      <el-form-item label="文章内容" prop="content">
        <div class="editor-wrapper">
          <wang-editor v-if="loadWangEditorFlag" v-model="article.content"></wang-editor>
        </div>
      </el-form-item>
      <el-form-item label="所属分类" prop="cidList">
        <el-cascader
          style="width: 100%;"
          v-model="selectCidList"
          placeholder="请选择文章分类（可多选）"
          :props="{ multiple: true, checkStrictly: true }"
          :options="categoryOptions"
          @change="changeCategory">
        </el-cascader>
      </el-form-item>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="cancel" size="large">取 消</el-button>
        <el-button type="primary" @click="submitArticle" size="large" class="submit-btn">{{ article.id ? '保存修改' : '立即发布' }}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import {computed, ref} from "vue"
  import Upload from "@/components/Uplaod";
  import {getArticle, saveArticle, updateArticle} from "@/api/edu/web/content/article";
  import {findCategoryList} from "@/api/edu/web/content/category";
  import {getAllParent, toTree} from "@/api/edu/web/learn/category";
  import {success} from "@/util/tipsUtils";
  import WangEditor from "@/components/WangEditor/index.vue"

  export default {
    name: "ArticleEdit",
    components: {WangEditor, Upload},
    props: {
      item: {
        type: Object,
        default: null
      },
      vModel: {
        type: Boolean
      },
      cancelCallback: {
        type: Function
      },
      submitCallback: {
        type: Function
      }
    },
    setup(props, context) {
      const loadWangEditorFlag = ref(false)
      const dialogModel = computed({
        get() {
          return props.vModel;
        },
        set(val) {
          context.emit('update:vModel', val);
        },
      });
      // 获取分类
      const categoryOptions = ref()
      const selectCidList = ref([])
      findCategoryList(0, true, res => {
        categoryOptions.value = toTree(res)
      })
      // 发布文章
      const dialogVisible = ref(false)
      // 上传图片的路
      const uploadUrl = ref('/api/v1/edu' + "/oss/content/article/image")
      const files = ref([])
      const article = ref({
        cidList: [],
        content: "",
        image: "",
        title: ""
      })
      // 选择分类
      const changeCategory = (val) => {
        article.value.cidList = []
        for (const valElement of val) {
          article.value.cidList.push(valElement[valElement.length - 1])
        }
      }
      if (props.item && props.item.id) {
        getArticle(props.item.id, res => {
          article.value = res
          if (res.image && res.image.trim()) {
            files.value = [{name: res.title, url: res.image}]
          }
          selectCidList.value = getAllParent(categoryOptions.value, res.cidList);
          loadWangEditorFlag.value = true
        })
      } else {
        loadWangEditorFlag.value = true
      }
      const articleRules = {
        title: [{ required: true, message: "请输入标题", trigger: "blur" }],
        content: [{ required: true, message: "请输入内容", trigger: "blur" }],
        // image: [{ required: true, message: "请选择图片", trigger: "change" }],
        cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
      }
      // 上传图片成功的回收
      const onUploadSuccess = (data) => {
        article.value.image = data.data
      }
      // 删除图片的回收
      const onUploadRemove = () => {
        article.value.image = ""
        files.value = []
      }
      // 发布
      const articleRef = ref(null)
      const submitArticle = () => {
        articleRef.value.validate((valid) => {
          if (!valid) { return false }
          if (article.value.id) {
            updateArticle(article.value, () => {
              success("编辑成功")
              props.submitCallback && props.submitCallback();
            })
          } else {
            saveArticle(article.value, () => {
              success("发布成功")
              props.submitCallback && props.submitCallback();
            })
          }
        })
      }
      const cancel = () => {
        props.cancelCallback && props.cancelCallback();
      }
      return {
        categoryOptions,
        dialogVisible,
        onUploadSuccess,
        onUploadRemove,
        uploadUrl,
        articleRef,
        articleRules,
        submitArticle,
        article,
        changeCategory,
        selectCidList,
        files,
        cancel,
        dialogModel,
        loadWangEditorFlag
      }
    }
  }
</script>
<style scoped lang="scss">
:deep(.el-dialog-box) {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 32px 4px rgba(0, 0, 0, .04), 0 8px 20px rgba(0, 0, 0, .08);

  .el-dialog__header {
    margin-right: 0;
    padding: 20px 24px;
    border-bottom: 1px solid #f0f0f0;
    .el-dialog__title {
      font-weight: 600;
      color: #1a1a1a;
      font-size: 18px;
    }
  }

  .el-dialog__body {
    padding: 24px;
    max-height: 70vh;
    overflow-y: auto;
  }

  .el-dialog__footer {
    padding: 16px 24px;
    border-top: 1px solid #f0f0f0;
  }
}

.el-form {
  .el-form-item {
    margin-bottom: 24px;

    &:last-child {
      margin-bottom: 0;
    }

    :deep(.el-form-item__label) {
      font-weight: 500;
      color: #333;
      padding-bottom: 8px;
      font-size: 15px;
      line-height: 1.2;

      &::before {
        margin-right: 4px;
      }
    }
  }
}

.upload-container {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .upload-tip {
    font-size: 12px;
    color: #999;
    margin: 0;
    line-height: 1.5;
  }
}

.editor-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  transition: all .2s;
  background-color: #fff; // 确保底色纯净
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: #c0c4cc;
  }

  &:focus-within {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 1px rgba(var(--el-color-primary), 0.1);
  }
}

/* 适配 WangEditor 的样式，解决角落衔接问题 */
:deep(.w-e-toolbar) {
  border: none;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fafafa;
  border-top-left-radius: 4px; // 显式设置顶部圆角以匹配父容器
  border-top-right-radius: 4px;
}

:deep(.w-e-text-container) {
  border: none;
  min-height: 400px;
  background-color: #fff;
  border-bottom-left-radius: 4px; // 显式设置底部圆角
  border-bottom-right-radius: 4px;
}

/* 消除所有内部组件的默认边框和阴影 */
:deep(.w-e-container),
:deep(.w-e-text-container),
:deep(.w-e-toolbar-container) {
  border: none;
  box-shadow: none;
}
</style>
