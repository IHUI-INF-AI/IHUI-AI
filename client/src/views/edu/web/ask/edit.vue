<template>
  <el-dialog title="描述您的问题" custom-class="el-dialog-box" v-model="dialogModel" width="80%" :close-on-click-modal="false" :before-close="cancelCallback" :lock-scroll="false">
    <el-form :model="question" :rules="questionRules" ref="questionRef" label-width="120px">
      <el-form-item label="标题目" prop="title">
        <el-input size="small" placeholder="请输入标题" v-model="question.title" clearable></el-input>
      </el-form-item>
      <el-form-item label="图片" prop="image">
        <upload :on-upload-success="onUploadSuccess" :on-upload-remove="onUploadRemove" :upload-url="uploadUrl" :files="files" :limit="1"/>
      </el-form-item>
      <el-form-item label="内容：" prop="content">
        <el-input size="small" type="textarea" :rows="4" v-model="question.content" clearable></el-input>
      </el-form-item>
      <el-form-item label="分类：" prop="cidList">
        <el-cascader
          style="width: 100%;"
          size="small"
          v-model="selectCidList"
          :props="{ multiple: true, checkStrictly: true }"
          :options="categoryOptions"
          @change="changeCategory">
        </el-cascader>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button size="small" @click="cancelCallback">取消</el-button>
        <el-button size="small" type="primary" @click="submitQuestion">确定</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import { useRouter } from "vue-router"
import { ref, computed } from "vue"
import { saveQuestion, updateQuestion, getCategoryList } from "@/api/edu/web/ask"
import Upload from "@/components/Uplaod"
import {success} from "@/util/tipsUtils"
import {getAllParent, toTree} from "@/api/edu/web/learn/category";

export default {
  name: "QuestionEdit",
  components: {
    Upload
  },
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
    const dialogModel = computed({
      get() {
        return props.vModel;
      },
      set(val) {
        context.emit('update:vModel', val);
      },
    });
    const route = useRouter()
    // 跳转
    const goto = (path, id) => {
      if (id) {
        route.push({ path, query: { id } })
      } else {
        route.push({ path })
      }
    }
    // 获取分类
    const categoryOptions = ref()
    const selectCidList = ref([])
    getCategoryList({pid: 0, fetchAll: true}, res => {
      categoryOptions.value = toTree(res)
    })
    // 提出问题
    const dialogVisible = ref(false)
    // 上传图片的路径
    const uploadUrl = ref('/api/v1/edu' + "/oss/ask/question/image")
    const files = ref([])
    let question = ref({
      cidList: [],
      content: "",
      image: "",
      title: ""
    })
    if (props.item) {
      question = ref(props.item)
      if (props.item.image && props.item.image.trim()) {
        files.value = [{name: "封面", url: props.item.image}]
      }
      selectCidList.value = getAllParent(categoryOptions.value, props.item.cidList);
    }
    // 选择分类
    const changeCategory = (val) => {
      question.value.cidList = []
      for (const valElement of val) {
        question.value.cidList.push(valElement[valElement.length - 1])
      }
    }
    const questionRules = {
      title: [{ required: true, message: "请输入标题", trigger: "blur" }],
      content: [{ required: true, message: "请输入内容", trigger: "blur" }],
      cidList: [{ required: true, message: "请选择分类", trigger: "change" }],
    }
    // 上传图片成功的回收
    const onUploadSuccess = (data) => {
      question.value.image = data.data
    }
    // 删除图片的回收
    const onUploadRemove = () => {
      question.value.image = ""
      files.value = []
    }
    // 提问
    const questionRef = ref(null)
    const submitQuestion = () => {
      questionRef.value.validate((valid) => {
        if (!valid) { return false }
        if (question.value.id) {
          updateQuestion(question.value, () => {
            success("修改成功")
            dialogVisible.value = false
            props.submitCallback && props.submitCallback()
          })
        } else {
          saveQuestion(question.value, () => {
            success("提问成功")
            dialogVisible.value = false
            props.submitCallback && props.submitCallback()
          })
        }
      })
    }
    return {
      categoryOptions,
      goto,
      dialogVisible,
      onUploadSuccess,
      onUploadRemove,
      uploadUrl,
      questionRef,
      questionRules,
      submitQuestion,
      question,
      changeCategory,
      selectCidList,
      files,
      dialogModel
    }
  }
}
</script>

<style scoped lang="scss">
  .question-list-box {
    margin: 30px 10px;
    .card-header{
      border-bottom: 1px solid #f0f2f7;
      height: 58px;
      background: #ffffff;
      font-size: 18px;
      font-weight: 600;
      line-height: 58px;
      padding-left: 20px;
      a.active {
        color: var(--el-color-primary);
      }
    }
    .card {
      background: #fff;
      box-sizing: border-box;
      border-radius: 0;
      overflow: visible;
      overflow: initial;
      position: relative;
      padding: 20px;
      margin-bottom: 0;
      -webkit-box-shadow: none;
      box-shadow: none;
      border-bottom: 1px solid #f0f2f7;
      .title {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.9;
        color: #121212;
        margin-top: -4px;
        margin-bottom: -4px;
        cursor: pointer;
        &:hover {
          color: var(--el-color-primary);
        }
      }
      .content {
        cursor: pointer;
        transition: color .14s ease-out;
        line-height: 1.97;
        .cover {
          position: relative;
          width: 190px;
          height: 105px;
          margin-top: -2px;
          margin-right: 18px;
          margin-bottom: 4px;
          float: left;
          overflow: hidden;
          background-position: 50%;
          background-size: cover;
          border-radius: 6px;
          -webkit-transform: translateZ(0);
          transform: translateZ(0);
          .cover-inner {
            position: absolute;
            top: 50%;
            left: 0;
            height: 100%;
            width: 100%;
            -webkit-transform: translateY(-50%);
            transform: translateY(-50%);
            overflow: hidden;
            img {
              position: absolute;
              top: 50%;
              left: 50%;
              height: 100%;
              width: 100%;
              -o-object-fit: cover;
              object-fit: cover;
              -webkit-transform: translate3d(-50%,-50%,0);
              transform: translate3d(-50%,-50%,0);
            }
          }
          &:after {
            content: "";
            position: absolute;
            z-index: 1;
            display: block;
            width: 100%;
            height: 100%;
            background: rgba(18,18,18,.02);
          }
        }
        .inner {
          margin-bottom: -4px;
          overflow: hidden;
          max-height: 100px;
          margin-top: 16px;
          .rich-text {
            pointer-events: none;
            line-height: 1.9;
            cursor: pointer;
            display: -webkit-box;
            white-space: normal;
            word-break: break-word;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .more {
            display: inline-block;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
            margin-left: 4px;
            color: #175199;
            height: auto;
            padding: 0;
            line-height: inherit;
            background-color: transparent;
            border: none;
            border-radius: 0;
          }
        }
        &:hover {
          .inner {
            .more {
              color: var(--el-color-primary);
            }
          }
        }
      }
      .actions {
        display: flex;
        -webkit-box-align: center;
        -ms-flex-align: center;
        align-items: center;
        padding: 10px 20px;
        margin: 0 -20px -10px;
        color: #646464;
        clear: both;
        background: #fff;
        .action {
          margin-left: 24px;
          font-size: 14px;
          color: #646464;
          cursor: text;
          &:first-child {
            margin-left: 0;
          }
        }
      }
    }
    .nav-box {
      position: relative;
      padding: 20px 15px;
      border-bottom: 1px solid #f6f6f6;
      margin-bottom: 10px;
      background: #fff;
      .item {
        display: inline-flex;
        -webkit-box-orient: vertical;
        -webkit-box-direction: normal;
        -ms-flex-direction: column;
        flex-direction: column;
        -webkit-box-align: center;
        -ms-flex-align: center;
        align-items: center;
        cursor: pointer;
        width: calc(33.33% - 14.66px);
        margin-right: 22px;
        &:last-child {
          margin-right: 0;
        }
        .icon {
          margin: 0 auto 12px;
          color: #8590a6;
        }
        .title {
          font-size: 12px;
          line-height: 1;
          text-align: center;
          color: #444;
        }
        &:hover {
          .title {
            color: var(--el-color-primary);
          }
        }
      }
    }
    .recommend-ask {
      .header {
        background: #ffffff;
        font-weight: 500;
        padding-left: 10px;
        line-height: 50px;
        border-bottom: 1px solid #f0f0f0;
      }
      .content {
        background: #fff;
        .item {
          padding: 10px;
          display: block;
          .title {
            white-space: normal;
            pointer-events: none;
            word-break: break-word;
            cursor: pointer;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .img-box {
            overflow: hidden;
            position: relative;
            width: 110px;
            height: 64px;
            border-radius: 6px;
            color: #fff;
            display: inline-block;
            img {
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
            }
          }
          .personal {
            display: inline-block;
            width: calc(100% - 120px);
            margin-left: 10px;
            vertical-align: top;
            .meta {
              .avatar {
                width: 20px;
                height: 20px;
                margin-right: 4px;
                vertical-align: middle;
                -webkit-border-radius: 20px;
                -moz-border-radius: 20px;
                border-radius: 20px;
                display: inline-block;
              }
              .name {
                font-size: 12px;
                color: rgba(153,153,153,.8);
                line-height: 12px;
              }
              .time {
                float: right;
                display: inline-block;
                height: 20px;
                line-height: 20px;
                font-size: 12px;
                color: rgba(153,153,153,.8);
              }
            }
          }
          &:hover {
            background: #e5e7eb;
          }
        }
      }
    }
  }
</style>
