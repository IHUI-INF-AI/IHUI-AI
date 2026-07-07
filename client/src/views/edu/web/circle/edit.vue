<template>
  <el-dialog :title="circle.id ?  '编辑社区' : '创建社区'" custom-class="el-dialog-box" v-model="dialogModel" width="80%" :before-close="hideCreateDialogVisible" :lock-scroll="false">
    <el-form :model="circle" ref="circleRef" :rules="circleRule" label-width="120px">
      <el-form-item label="名称" prop="name">
        <el-input placeholder="请输入社区名" v-model="circle.name" clearable></el-input>
      </el-form-item>
      <el-form-item label="目录" prop="cidList">
        <el-cascader style="width: 100%;"
                     size="small"
                     ref="cascadeRef"
                     v-model="circle.cidList"
                     :props="{checkStrictly: true, label: 'name', value: 'id'}"
                     :options="circleCategoryList"
                     @change="selectCategory"></el-cascader>
      </el-form-item>
      <el-form-item label="图片" prop="image">
        <upload
          :on-upload-success="onUploadSuccess"
          :on-upload-remove="onUploadRemove"
          :upload-url="uploadUrl"
          :files="files"
          :limit="1"></upload>
      </el-form-item>
      <el-form-item label="描述：" prop="introduction">
        <el-input type="textarea" v-model="circle.introduction" :rows="5" clearable>
        </el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button size="small" @click="hideCreateDialogVisible">取消</el-button>
        <el-button size="small" type="primary" @click="submitCircle">发布</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script>
import Upload from "@/components/Uplaod"
import {ref, reactive, computed} from "vue"
import {
  createCircle,
  updateCircle,
  getCircleCategoryList,
  getCircle
} from "@/api/edu/web/circle/index"
import {success} from "@/util/tipsUtils";
export default {
  name: "CircleEdit",
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
    // 加载分类
    const circleCategoryList = ref([])
    getCircleCategoryList({fetchAll: true, id: 0}, res => {
      circleCategoryList.value = res
    })
    // 创建社区
    const circle = reactive({
      cidList: [],
      image: "",
      introduction: "",
      name: ""
    })
    // 上传图片的路径
    const uploadUrl = '/api/v1/edu' + "/oss/auth-api/circle/circle/image"
    const files = ref([])
    // 上传图片成功的回调
    const onUploadSuccess = (data) => {
      circle.image = data.data
    }
    // 删除图片的回调
    const onUploadRemove = () => {
      circle.image = ""
      files.value = []
    }
    const selectCategory = data => {
      circle.cidList = data
    }
    const circleRule = {
      name: [{ required: true, message: "请输入名", trigger: "blur" }],
      introduction: [{ required: true, message: "请输入简介", trigger: "blur" }],
      cidList: [{ required: true, message: "请选择类型", trigger: "change" }],
      image: [{ required: true, message: "请选择图片", trigger: "change" }],
    }
    const cascadeRef = ref()
    const circleRef = ref()
    const hideCreateDialogVisible = () => {
      circle.cidList = []
      circle.image = ""
      circle.introduction = ""
      circle.name = ""
      circle.id = ""
      files.value = []
      props.cancelCallback && props.cancelCallback()
    }
    const submitCircle = () => {
      circleRef.value.validate((valid) => {
        if (!valid) { return false }
        if (circle.id) {
          updateCircle(circle, () => {
            hideCreateDialogVisible()
            success("修改成功")
            props.submitCallback && props.submitCallback()
          })
        } else {
          createCircle(circle, () => {
            hideCreateDialogVisible()
            success("创建成功")
            props.submitCallback && props.submitCallback()
          })
        }
      })
    }
    if (props.item && props.item.id) {
      getCircle({id: props.item.id}, item => {
        circle.cidList = item.cidList
        circle.image = item.image
        circle.introduction = item.introduction
        circle.name = item.name
        circle.id = item.id
        files.value.push({name: "图片", url: item.image})
      })
    }
    return {
      circleCategoryList,
      circle,
      circleRule,
      onUploadSuccess,
      onUploadRemove,
      uploadUrl,
      submitCircle,
      selectCategory,
      cascadeRef,
      circleRef,
      files,
      hideCreateDialogVisible,
      dialogModel
    }
  }
}
</script>

<style scoped lang="scss">
.circle-box {
  margin: 10px;
  box-sizing: border-box;
  position: relative;
  min-height: 500px;
  padding: 20px 10px;
  border-radius: 10px;
  .nav-item-list {
    overflow-y: auto;
    border-radius: 6px 6px 0 0;
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    height: 100%;
    padding: 0 4px 40px;
    border-left: 1px solid #f9f9f9;
  }
  .nav-item-warp {
    .nav-item {
      position: relative;
      padding: 10px 16px;
      border-radius: 2px;
      cursor: pointer;
      color: #333;
      font-weight: 500;
      align-items: center;
      -webkit-box-align: center;
      display: flex;
      .nav-item-icon {
        width: 20px;
        height: 20px;
        margin-right: 12px;
        overflow: hidden;
        font-size: 14px;
        line-height: 20px;
      }
      .nav-item-text {
        line-height: 20px;
        font-size: 14px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      &:hover {
        background-color: rgba(65,95,255, .1);
      }
    }
    .nav-item.active {
      .nav-item-icon {
        font-size: 20px;
        color: var(--el-color-primary);
      }
      .nav-item-text {
        font-size: 16px;
        color: var(--el-color-primary);
      }
    }
  }
  .circle-content {
    min-height: 500px;
    .circle-list {
      display: flex;
      flex-wrap: wrap;
      margin-left: -10px;
      min-height: 236px;
      .circle-item {
        width: 50%;
      }
      .card-container {
        width: calc(100% - 20px);
        padding: 10px;
        position: relative;
        .outer {
          position: relative;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          .container {
            height: 0;
            padding-bottom: 62.71186440677966%;
            position: relative;
            overflow: hidden;
            .thumbnail {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              pointer-events: none;
              background-color: #f7f7f7;
              background-position: bottom;
              background-repeat: no-repeat;
              background-size: 100% auto;
              bottom: 44px;
            }
            .mask {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              pointer-events: none;
              transition: all 0.3s cubic-bezier(0.44,0.9,0.6,0.94);
              transition-property: opacity,background-color;
              opacity: 1;
              background-color: rgba(0,0,0,0.1);
            }
            .content {
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              pointer-events: auto;
              .content-header {
                padding: 16px;
                display: flex;
                justify-content: space-between;
                pointer-events: all;
                .icon {
                  opacity: 0;
                  font-size: 24px;
                  margin-left: 12px;
                  color: #fff;
                  cursor: pointer;
                  transition: opacity 0.3s cubic-bezier(0.44,0.9,0.6,0.94);
                  display: inline-block;
                  line-height: 0;
                  text-align: center;
                  vertical-align: -0.25em;
                  &:hover {
                    opacity: 1;
                  }
                }
              }
              .content-desc {
                bottom: 44px;
                position: absolute;
                padding: 5px 16px;
                color: #fff;
                overflow: hidden;
                text-overflow: ellipsis;
                -webkit-box-orient: vertical;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                width: calc(100% - 32px);
                line-height: 24px;
                opacity: 0;
                &:hover {
                  opacity: 1;
                }
              }
              .content-footer {
                background-color: #fff;
                padding: 12px 16px;
                transition: height 0.3s cubic-bezier(0.44,0.9,0.6,0.94);
                .name {
                  font-size: 14px;
                  color: #373737;
                  font-weight: 600;
                  line-height: 20px;
                  max-height: 48px;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
              }
            }
            &:not(.skeleton) {
              cursor: pointer;
              border-radius: 12px;
              box-shadow: 0 1px 1px rgb(38 38 38 / 10%);
              transition: all 0.5s cubic-bezier(0.44,0.9,0.6,0.94);
              transition-property: transform,box-shadow,background,border-color;
            }
          }
          &:hover {
            //box-shadow: 0 1px 1px rgb(38 38 38 / 14%);
            -webkit-backface-visibility: hidden;
            -moz-backface-visibility: hidden;
            -webkit-transform: translateZ(0) translateY(-4px);
            -moz-transform: translateZ(0) translateY(-4px);
            border-radius: 12px;
            .mask {
              background-color: rgba(38,38,38,0.7);
            }
            .content {
              .content-header {
                .icon {
                  opacity: 0.8;
                  &:hover {
                    opacity: 1;
                  }
                }
              }
              .content-desc {
                opacity: 1;
              }
            }
          }
        }
      }
    }
    .btn-wrap {
      margin-top: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }
  .add-circle {
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;
    height: 50px;
    margin: 10px 0;
    background: #fff;
    border: 1px solid #f0f0f0;
    cursor: pointer;
    &:hover {
      background: var(--el-color-primary);
      border-color: var(--el-color-primary);
      p {
        color: #fff;
      }
    }
  }
  .circle-hot {
    min-height: 300px;
    p {
      line-height: 46px;
      font-size: 16px;
      font-weight: 600;
      box-sizing: border-box;
      color: #333;
    }
    ul {
      box-sizing: border-box;
      li {
        margin-top: 10px;
        transition: all 0.3s;
        border: 1px solid rgba(0, 0, 0, .1);
        border-radius: 8px;
        cursor: pointer;
        align-items: center;
        padding: 10px;
        box-sizing: border-box;
        height: 82px;
        background: #fff;
        &:hover {
          box-shadow: 0 0 5px #e5e7eb;
          transform: scale(1.05);
          .title {
            color: var(--el-color-primary);
          }
        }
        .el-image {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          float: left;
        }
        .published-dom {
          font-size: 14px;
          max-height: 40px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 20px;
          width: calc(100% - 70px);
          margin-left: 70px;
          color: #999999;
        }
        .title {
          font-size: 16px;
          color: #000000;
        }
      }
    }
  }
  :deep(.el-dialog-box) {
    .box-flex:nth-child(2) {
      max-height: 100px;
      overflow: hidden;
    }
    .box-flex {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      .el-input {
        flex: 1;
        margin-left: 6px;
      }
      .el-textarea {
        flex: 1;
        margin-left: 6px;
      }
      :deep(.el-upload) {
        border: 1px dashed #d9d9d9;
        border-radius: 6px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
      }
      .span-title {
        span {
          color: red;
        }
      }
    }
  }
}
.box-flex :deep(.el-upload) {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  width: 80px;
  height: 80px;
  .el-icon-plus {
    line-height: 80px;
    vertical-align: top;
  }
}
.box-flex :deep(.el-upload-list) {
  margin-left: 6px;
}
.box-flex :deep(.is-success),
.box-flex :deep(.is-uploading),
.box-flex :deep(.el-progress),
.box-flex :deep(.el-progress-circle) {
  width: 80px;
  height: 80px;
  overflow: hidden;
}
.box-flex :deep(.el-upload:hover) {
  border-color: var(--el-color-primary);
}
.box-flex-icon {
  font-size: 28px;
  color: #8c939d;
  width: 80px;
  height: 80px;
  line-height: 80px;
  text-align: center;
}
.avatar {
  width: 80px;
  height: 80px;
  display: block;
}
.box-flex :deep(.el-cascader__tags) {
  left: 10px;
}
.box-flex :deep(.is-success) {
  margin: 0;
}
:deep(.el-cascader) {
  width: 100%;
}
</style>
