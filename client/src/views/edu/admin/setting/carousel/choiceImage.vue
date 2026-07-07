<template>
  <div class="upload-container">
    <div :class="['content-image']">
      <upload-image ref="upload" class="uploader" :upload-url="uploadUrl" :limit="1" :on-upload-error="onError" :on-upload-success="onSuccess" :on-upload-remove="onRemove" :files="fileList">
      </upload-image>
    </div>
    <div class="tips">{{tips}}</div>
  </div>
</template>

<script>
// @ts-nocheck
  import UploadImage from "@/components/Uplaod/index.vue"
  import { ossApi } from '@/api/edu/admin-api'
const { deleteFile } = ossApi
  import {ref, watch} from "vue"
  import {error} from "@/util/tipsUtils";
  export default {
    name: "CarouselChoiceImage",
    components: {
      UploadImage
    },
    props: {
      index: {
        type: Number,
        default: 0
      },
      item: {
        type: Object,
        default: () => {
          return {
            title: "",
            imageUrl: "",
            linkType: "0",
            link: ""
          }
        }
      },
      tips: {
        type: String,
        default: ""
      }
    },
    setup(props, context) {
      const uploadUrl = '/api/v1/edu' + "/oss/setting/carousel/image"
      const fileList = ref([])
      const initImage = () => {
        if (props.item && props.item.imageUrl) {
          fileList.value = []
          fileList.value.push({name: props.item.title || "轮播图", url: props.item.imageUrl})
        }
      }
      initImage()
      watch([props.item], (nv, ov, item) => {
        if (nv["imageUrl"] !== ov["imageUrl"]) {
          item.value = nv
          initImage()
        }
      })
      // 上传成功
      const onSuccess = (res) => {
        context.emit("on-success", { index: props.index, link: res.data })
      }
      // 删除图片
      const onRemove = (res) => {
        // 删除图片
        deleteFile(res.url)
        fileList.value = []
        context.emit("on-remove", { index: props.index, link: "" })
      }
      // 上传失败
      const onError = () => {
        error("上传失败")
      }
      return {
        uploadUrl,
        fileList,
        initImage,
        onSuccess,
        onRemove,
        onError
      }
    }
  }
</script>

<style lang="scss" scoped>
.upload-container {
  height: 100%;
  .uploader {
    margin: 20px;
    width: 100%;
    max-width: 500px;
  }
  .tips {
    line-height: 20px;
    text-align: center;
  }
}
.content-image {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  font-size: 12px;
  justify-content: space-between;
}
:deep(.el-upload-list.el-upload-list--picture-card .is-success){
  width: 100%;
  height: 100%;
  margin: 0;
  border: 0;
  display: flex;
}
:deep(.el-upload-list.el-upload-list--picture-card img){
  min-height: 180px;
  min-width: 320px;
}
</style>
