<template>
  <el-image
    :src="`${realSrc}`"
    fit="cover"
    :style="`width:${realWidth};height:${realHeight};`"
    :preview-src-list="realSrcList"
  >
    <template v-slot:error>
      <div class="image-slot">
        <i class="el-icon-picture-outline"></i>
      </div>
    </template>
  </el-image>
</template>

<script>
export default {
  name: "ImagePreview",
  props: {
    src: {
      type: String,
      default: "",
    },
    width: {
      type: [Number, String],
      default: "",
    },
    height: {
      type: [Number, String],
      default: "",
    },
  },
  computed: {
    realSrc() {
      if (!this.src) {
        return;
      }
      let real_src = this.src.split(",")[0];
      return real_src;
    },
    realSrcList() {
      if (!this.src) {
        return;
      }
      let real_src_list = this.src.split(",");
      let srcList = [];
      real_src_list.forEach((item) => {
        return srcList.push(item);
      });
      return srcList;
    },
    realWidth() {
      return typeof this.width == "string" ? this.width : `${this.width}px`;
    },
    realHeight() {
      return typeof this.height == "string" ? this.height : `${this.height}px`;
    },
  },
};
</script>

<style lang="scss" scoped>
.el-image {
  border-radius: var(--global-border-radius);

  // 背景色和阴影由主题类控制
  :deep(.el-image__inner) {
    transition: transform 0.3s;
    cursor: pointer;

    &:hover {
      transform: scale(1.2);
    }
  }

  :deep(.image-slot) {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;

    // 颜色由主题类控制
    font-size: 30px;
  }
}
</style>
