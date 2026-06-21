<template>
  <div class="catalog">
    <el-loading v-if="loading" />
    <div class="swiper-tabs">
      <div v-for="(item, index) in videoList" :key="index"
        :class="['tab-item', { active: selectIndex === index }]" @click="clickVideo(item, index)">
        <div v-if="selectIndex === index" class="playing-animation">
          <div class="bar bar1"></div>
          <div class="bar bar2"></div>
          <div class="bar bar3"></div>
          <div class="bar bar4"></div>
          <div class="bar bar5"></div>
        </div>
        <span class="tab-text">{{ item.content || item.title || '' }}</span>
      </div>
    </div>
    <div class="video-scroll" @scroll="onScroll">
      <div class="video-list">
        <div v-for="(item, index) in videoList" :key="item.id" class="video-item" @click="clickVideo(item, index)">
          <img class="video-cover" :src="item.binding" loading="lazy" />
          <div class="video-info">
            <VipBtns v-if="pay" :pay="pay" @showPay="showPay(item)" />
            <span class="date">{{ item.createdAt }}</span>
          </div>
          <div class="video-detail">
            <div class="des-title">{{ item.title }}</div>
            <div class="describe">{{ item.content }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import VipBtns from './VipBtns.vue'

defineOptions({ name: 'Catalog' })

const props = defineProps<{
  videoList?: any[]
  pay?: any
}>()

const emit = defineEmits<{
  (e: 'showPay', item: any): void
  (e: 'change', item: any): void
  (e: 'pageDown'): void
}>()

const selectIndex = ref(0)
const loading = ref(false)

watch(() => props.videoList, (arr) => {
  if (arr && arr.length > 0) clickVideo(arr[0], 0)
})

function showPay(obj: any) {
  emit('showPay', obj)
}

function clickVideo(item: any, index: number) {
  selectIndex.value = index
  emit('change', item)
}

function onScroll(e: Event) {
  const el = e.target as HTMLDivElement
  if (el.scrollHeight - el.scrollTop <= el.clientHeight + 50) {
    emit('pageDown')
  }
}
</script>

<style scoped>
.catalog {
  margin-top: 12px;
}

.swiper-tabs {
  display: flex;
  overflow-x: auto;
  gap: 10px;
  padding: 0 12px;
  margin-bottom: 12px;
  scrollbar-width: none;
}
.swiper-tabs::-webkit-scrollbar { display: none; }

.tab-item {
  flex: none;
  width: 125px;
  height: 34px;
  border-radius: var(--global-border-radius);
  background: var(--color-gray-f4f4f4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  font-size: 10px;
  color: var(--color-black);
  cursor: pointer;
}

.tab-item.active {
  color: var(--color-blue-515aff);
}

.tab-text {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  text-overflow: ellipsis;
  font-size: 10px;
}

.video-scroll {
  height: calc(100vh - 500px);
  overflow-y: auto;
  padding-top: 8px;
}

.video-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.video-item {
  display: flex;
  gap: 8px;
  position: relative;
  cursor: pointer;
}

.video-cover {
  width: 132px;
  height: 68px;
  border-radius: var(--global-border-radius);
  background-color: var(--color-black);
  object-fit: cover;
  flex-shrink: 0;
}

.video-info {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 132px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date {
  font-size: 9px;
  font-weight: bold;
  color: var(--color-white);
}

.video-detail {
  flex: 1;
}

.des-title {
  font-size: 15px;
  font-weight: bold;
  color: var(--color-black);
  overflow: hidden;
  max-width: 100%;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.describe {
  margin: 4px 0;
  max-height: 60px;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  text-overflow: ellipsis;
  font-size: 13px;
  color: var(--color-black-60);
}

.playing-animation {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 20px;
  border-radius: var(--global-border-radius);
  margin-right: 4px;
  padding: 0 2px;
}

.bar {
  width: 3px;
  background-color: var(--color-blue-515aff);
  margin: 0 1px;
  border-radius: var(--global-border-radius);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-duration: 1.2s;
}
.bar1 { height: 8px; animation-name: wave1; }
.bar2 { height: 18px; animation-name: wave2; animation-delay: -0.2s; }
.bar3 { height: 8px; animation-name: wave3; animation-delay: -0.4s; }
.bar4 { height: 18px; animation-name: wave4; animation-delay: -0.6s; }
.bar5 { height: 8px; animation-name: wave5; animation-delay: -0.8s; }

@keyframes wave1 { 0%,100%{height:8px} 50%{height:18px} }

@keyframes wave2 { 0%,100%{height:18px} 50%{height:8px} }

@keyframes wave3 { 0%,100%{height:8px} 50%{height:18px} }

@keyframes wave4 { 0%,100%{height:18px} 50%{height:8px} }

@keyframes wave5 { 0%,100%{height:8px} 50%{height:18px} }
</style>
