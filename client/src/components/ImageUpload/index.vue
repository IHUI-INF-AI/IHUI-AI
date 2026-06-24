<template>
  <div class="component-upload-image">
    <el-upload
      multiple
      :disabled="disabled"
      :action="uploadImgUrl"
      list-type="picture-card"
      :on-success="handleUploadSuccess"
      :before-upload="handleBeforeUpload"
      :data="data"
      :limit="limit"
      :on-error="handleUploadError"
      :on-exceed="handleExceed"
      ref="imageUpload"
      :on-remove="handleDelete"
      :show-file-list="true"
      :headers="headers"
      :file-list="fileList"
      :on-preview="handlePictureCardPreview"
      :class="{ hide: this.fileList.length >= this.limit }"
    >
      <i class="el-icon-plus"></i>
    </el-upload>

    <!-- Upload tip -->
    <div v-if="showTip && !disabled" class="el-upload__tip">
      {{ $t('imageUpload.tip', { size: fileSize, types: fileType.join('/') }) }}
    </div>

    <el-dialog
      v-model:visible="dialogVisible"
      :title="$t('imageUpload.preview')"
      width="800"
      append-to-body
    >
      <img
        :src="dialogImageUrl"
        alt="图片预览"
        style="display: block; max-width: 100%; margin: 0 auto"
      />
    </el-dialog>
  </div>
</template>

<script>
import { getToken } from "@/utils/auth";
import Sortable from "sortablejs";

export default {
  props: {
    value: [String, Object, Array],
    // Upload interface address
    action: {
      type: String,
      default: "/file/upload",
    },
    // Upload parameters
    data: {
      type: Object,
    },
    // Image quantity limit
    limit: {
      type: Number,
      default: 5,
    },
    // Size limit (MB)
    fileSize: {
      type: Number,
      default: 5,
    },
    // File type, e.g. ['png', 'jpg', 'jpeg']
    fileType: {
      type: Array,
      default: () => ["png", "jpg", "jpeg"],
    },
    // Whether to show tip
    isShowTip: {
      type: Boolean,
      default: true,
    },
    // Disable component (view only)
    disabled: {
      type: Boolean,
      default: false,
    },
    // Drag and drop sorting
    drag: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      number: 0,
      uploadList: [],
      dialogImageUrl: "",
      dialogVisible: false,
      hideUpload: false,
      uploadImgUrl: (import.meta.env.VITE_BASE_API || import.meta.env.VUE_APP_BASE_API || "/dev-api") + this.action, // Image upload server address
      headers: {
        Authorization: "Bearer " + getToken(),
      },
      fileList: [],
    };
  },
  mounted() {
    if (this.drag && !this.disabled) {
      this.$nextTick(() => {
        const element =
          this.$refs.imageUpload?.$el?.querySelector(".el-upload-list");
        Sortable.create(element, {
          onEnd: (evt) => {
            const movedItem = this.fileList.splice(evt.oldIndex, 1)[0];
            this.fileList.splice(evt.newIndex, 0, movedItem);
            this.$emit("input", this.listToString(this.fileList));
          },
        });
      });
    }
  },
  watch: {
    value: {
      handler(val) {
        if (val) {
          // First convert value to array
          const list = Array.isArray(val) ? val : this.value.split(",");
          // Then convert array to object array
          this.fileList = list.map((item) => {
            if (typeof item === "string") {
              item = { name: item, url: item };
            }
            return item;
          });
        } else {
          this.fileList = [];
          return [];
        }
      },
      deep: true,
      immediate: true,
    },
  },
  computed: {
    // Whether to show tip
    showTip() {
      return this.isShowTip && (this.fileType || this.fileSize);
    },
  },
  methods: {
    // Loading before upload
    handleBeforeUpload(file) {
      let isImg = false;
      if (this.fileType.length) {
        let fileExtension = "";
        if (file.name.lastIndexOf(".") > -1) {
          fileExtension = file.name.slice(file.name.lastIndexOf(".") + 1);
        }
        isImg = this.fileType.some((type) => {
          if (file.type.indexOf(type) > -1) return true;
          if (fileExtension && fileExtension.indexOf(type) > -1) return true;
          return false;
        });
      } else {
        isImg = file.type.indexOf("image") > -1;
      }

      if (!isImg) {
      this.$modal.msgError(
          this.$t('imageUpload.formatError', { types: this.fileType.join("/") }),
        );
        return false;
      }
      if (file.name.includes(",")) {
        this.$modal.msgError(this.$t('imageUpload.filenameComma'));
        return false;
      }
      if (this.fileSize) {
        const isLt = file.size / 1024 / 1024 < this.fileSize;
        if (!isLt) {
          this.$modal.msgError(
            this.$t('imageUpload.sizeLimit', { size: this.fileSize }),
          );
          return false;
        }
      }
      this.$modal.loading(this.$t('imageUpload.uploading'));
      this.number++;
    },
    // File count exceeded
    handleExceed() {
      this.$modal.msgError(
        this.$t('imageUpload.countLimit', { count: this.limit }),
      );
    },
    // Upload success callback
    handleUploadSuccess(res, file) {
      if (res.code === 200) {
        this.uploadList.push({ name: res.data.url, url: res.data.url });
        this.uploadedSuccessfully();
      } else {
        this.number--;
        this.$modal.closeLoading();
        this.$modal.msgError(res.msg);
        this.$refs.imageUpload.handleRemove(file);
        this.uploadedSuccessfully();
      }
    },
    // Delete image
    handleDelete(file) {
      const findex = this.fileList.map((f) => f.name).indexOf(file.name);
      if (findex > -1) {
        this.fileList.splice(findex, 1);
        this.$emit("input", this.listToString(this.fileList));
      }
    },
    // Upload failed
    handleUploadError() {
      this.$modal.msgError(this.$t('imageUpload.uploadFail'));
      this.$modal.closeLoading();
    },
    // Upload end handling
    uploadedSuccessfully() {
      if (this.number > 0 && this.uploadList.length === this.number) {
        this.fileList = this.fileList.concat(this.uploadList);
        this.uploadList = [];
        this.number = 0;
        this.$emit("input", this.listToString(this.fileList));
        this.$modal.closeLoading();
      }
    },
    // Preview
    handlePictureCardPreview(file) {
      this.dialogImageUrl = file.url;
      this.dialogVisible = true;
    },
    // Convert object to specified string separator
    listToString(list, separator) {
      let strs = "";
      separator = separator || ",";
      for (let i in list) {
        if (list[i].url) {
          strs += list[i].url.replace(this.baseUrl, "") + separator;
        }
      }
      return strs != "" ? strs.substr(0, strs.length - 1) : "";
    },
  },
};
</script>
<style scoped lang="scss">
// .el-upload--picture-card controls the plus sign part
  :deep(.hide .el-upload--picture-card) {
  display: none;
}

:deep(.el-upload-list--picture-card.is-disabled + .el-upload--picture-card) {
  display: none;
}

// Remove animation effect
  :deep(.el-list-enter-active),
  :deep(.el-list-leave-active) {
  transition: all 0s;
}

  :deep(.el-list-enter),
.el-list-leave-active {
  opacity: 0;
  transform: translateY(0);
}
</style>
