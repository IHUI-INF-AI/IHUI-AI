<template>
  <div class="imgs_list" v-if="imgsList.length > 0">
    <div class="imgs_list_item" v-for="(item, index) in imgsList" :key="index">
      <img
        @click="removeImage(index)"
        :src="'/images/common/close_input.svg'"
        class="imgs_list_close"
        alt="关闭"
      />
      <div
        style="
          position: absolute;
          left: 0;
          bottom: 0;
          right: 0;
          z-index: var(--z-base);
          color: var(--el-text-color-primary);
          overflow: hidden;
          height: 16px;
          display: flex;
          align-items: center;
        "
        v-if="item.fileType && item.fileType == 'document'"
      >
        <div class="scroll-container">
          <div class="scroll-content">
            <span>{{ item.filename }}</span>
            <span class="scroll-separator"></span>
            <span>{{ item.filename }}</span>
          </div>
        </div>
      </div>
      <img
        :src="
          item.fileType && item.fileType == 'document' ? '/images/common/file.svg' : item.imgUrl
        "
        class="imgs_list_item_img"
        alt="图片"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface ImageItem {
  imgUrl: string
  fileType?: string
  filename?: string
}

const { imgsList } = defineProps<{
  imgsList: ImageItem[]
}>()

const emit = defineEmits<{
  (e: 'remove-image', index: number): void
}>()

const removeImage = (index: number) => {
  emit('remove-image', index)
}
</script>

<style lang="scss" scoped>
.imgs_list_item {
  position: relative;
  width: auto;
  flex: none;

  .imgs_list_close {
    position: absolute;
    top: 2.5px;
    right: 2.5px;
    width: 15px;
    height: 15px;
    z-index: var(--z-dropdown);
    background-color: var(--el-bg-color);
    border-radius: var(--global-border-radius);
  }

  .imgs_list_item_img {
    width: 100%;
    height: 60px;
    display: block;
    border-radius: var(--global-border-radius);
  }
}

.imgs_list {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  left: 0;
  right: 0;
  z-index: var(--z-base);
  width: 100%;
  padding: 10px 0;
  box-sizing: border-box;
  overflow-x: auto;
  flex: none;
  border-bottom: none;
  margin-bottom: 10px;
}

/* 无缝滚动样式 */
.scroll-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  height: 100%;
}

.scroll-content {
  display: flex;
  white-space: nowrap;
  animation: scroll 10s linear infinite;
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  align-items: center;
  animation-fill-mode: both;
  animation-play-state: running;
  will-change: transform;
}

.scroll-separator {
  width: 50px;
  display: inline-block;
}

@keyframes scroll {
  0% {
    transform: translateX(10%);
  }

  100% {
    transform: translateX(-50%);
  }
}

/* 鼠标悬停时暂停滚动 - 保持原有功能 */
.scroll-container:hover .scroll-content {
  animation-play-state: paused;
}
</style>
