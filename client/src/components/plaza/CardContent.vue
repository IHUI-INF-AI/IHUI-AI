<template>
  <div class="card-content">
    <div v-if="imageList && type === 'item'" class="has-image" @click="showDialog">
      <img class="main-image" :src="imageList[0]" alt="内容图片" loading="lazy" />
      <div class="has-img2">
        <div class="user-row">
          <img class="avatar" :src="info.avatar || 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'" :alt="info.username || '用户头像'" loading="lazy" />
          <div class="user-info">
            <span class="user-name">{{ info.createdName || '' }}</span>
            <div class="tag-list">
              <span v-for="item in rightTypes" :key="item.id || item.name" class="tag">{{ item.name }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="title">{{ info.title || '' }}</div>
      <div class="date-text">{{ formatDateRange(info.createdAt, info.closingTime) }}</div>
      <div class="cycle-row">
        <span class="cycle">{{ t('cardContent.cycleTime') }}：{{ info.cycle || '' }}{{ cycleUnits[info.cycleUnit] || '' }}</span>
      </div>
      <div class="has-img1">
        <div class="money">
          <span :style="{ color: info.status === 6 ? 'var(--color-gray-8d8d8d)' : 'var(--color-red)' }">
            <span style="font-size: 12px;">￥</span>{{ formatPrice(info.lowestPrice) }}-{{ formatPrice(info.peakPrice) }}
          </span>
        </div>
        <div class="status">
          <div v-if="info.status === 2" class="fabu" @click.stop="toKf">{{ t('cardContent.chat') }}</div>
          <div v-if="info.status === 6" class="ywc">{{ t('cardContent.projectCompleted') }}</div>
          <div v-if="info.status === 4" class="kfz">{{ t('cardContent.developing') }}</div>
        </div>
      </div>
    </div>

    <div v-else class="no-image" @click="showDialog">
      <div class="top-row">
        <div class="user-row">
          <img class="avatar" :src="info.avatar || 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'" :alt="info.username || '用户头像'" loading="lazy" />
          <div class="user-info">
            <span class="user-name">{{ info.createdName || '' }}</span>
            <div class="tag-list">
              <span v-for="item in rightTypes" :key="item.id || item.name" class="tag">{{ item.name }}</span>
            </div>
          </div>
        </div>
        <img v-if="type === 'dialog'" class="close-icon" src="https://file.aizhs.top/sys-mini/xtk/cancel.png" alt="关闭" @click.stop="close" loading="lazy" />
      </div>
      <div class="title">{{ info.title || '' }}</div>
      <div class="context">{{ info.context || '' }}</div>
      <div class="date-text">{{ formatDateRange(info.createdAt, info.closingTime) }}</div>
      <div class="cycle">{{ t('cardContent.cycleTime') }}：{{ info.cycle || '' }}{{ cycleUnits[info.cycleUnit] || '' }}</div>
      <div v-if="type === 'dialog'" class="related-images">
        <span class="field-label">{ t('plazaCardContent.relatedImages') }</span>
        <div class="image-list">
          <img v-for="item in imageList" :key="item" class="image-item" :src="item" alt="图片" loading="lazy" />
        </div>
      </div>
      <div class="bottom-row">
        <div class="money">
          <span :style="{ color: info.status === 6 ? 'var(--color-gray-8d8d8d)' : 'var(--color-red)' }">
            <span style="font-size: 12px;">￥</span>{{ formatPrice(info.lowestPrice || 0) }}-{{ formatPrice(info.peakPrice || 0) }}
          </span>
        </div>
        <div class="status">
          <div v-if="info.status === 2" class="fabu" @click.stop="toKf">{{ t('cardContent.chat') }}</div>
          <div v-if="info.status === 6" class="ywc">{{ t('cardContent.projectCompleted') }}</div>
          <div v-if="info.status === 4" class="kfz">{{ t('cardContent.developing') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

defineOptions({ name: 'CardContent' })


const props = withDefaults(defineProps<{
  info?: Record<string, unknown>
  type?: string
  itemUserInfo?: Record<string, unknown>
  categorys?: Record<string, unknown>[]
}>(), {
  info: () => ({}),
  type: 'item',
  categorys: () => []
})

const emit = defineEmits<{
  (e: 'showDialog', info: Record<string, unknown>): void
  (e: 'close'): void
}>()

const cycleUnits: Record<string, string> = { '0': '日', '1': '周', '2': '月', '3': '年' }

const imageList = computed(() => {
  if (props.info.imgs) return String(props.info.imgs).split(',')
  return false
})

const rightTypes = computed(() => {
  if (props.type === 'dialog') {
    let list: Record<string, unknown>[] = []
    if (props.info.categoryList && props.info.typeList) {
      list = [...(props.info.typeList as Record<string, unknown>[]), ...(props.info.categoryList as Record<string, unknown>[])]
    } else if (props.info.typeList) {
      list = [...(props.info.typeList as Record<string, unknown>[])]
    } else if (props.info.categoryList) {
      list = [...(props.info.categoryList as Record<string, unknown>[])]
    }
    if (props.info.type) {
      const typeList = String(props.info.type).split(',').map((typeStr: string) => ({ name: typeStr }))
      return [...list, ...typeList]
    }
    return list
  } else {
    return (props.info.typeList as Record<string, unknown>[]) || []
  }
})

function formatPrice(price: number) {
  price = Number(price)
  if (price >= 10000) return (price / 10000).toFixed(0) + '万'
  if (price >= 1000) return (price / 1000).toFixed(0) + 'K'
  return price
}

function formatDate(dateStr: string) {
  if (!dateStr || dateStr === '-') return '-'
  return dateStr.split(' ')[0].replace(/-/g, '.')
}

function formatDateRange(createdAt: string, closingTime: string) {
  return `${formatDate(createdAt)}——${formatDate(closingTime)}`
}

function toKf() {
  const roomId = props.info.roomId || props.info.room_id || ''
  const name = encodeURIComponent(props.info.createdName || '开发助手')
  const avatar = encodeURIComponent(props.info.avatar || '')
  const room_name = encodeURIComponent(props.info.title + '的群聊')
  let url = `/pagesA/assistant/index?name=${name}&room_name=${room_name}`
  if (roomId) url += `&roomId=${roomId}`
  if (avatar) url += `&avatar=${avatar}`
  window.location.href = url
}

function showDialog() {
  if (props.type === 'item') emit('showDialog', props.info)
}
function close() { emit('close') }
</script>

<style scoped>
.card-content {
  width: 100%;
  height: 100%;
}
.has-image { padding-bottom: 8px; }

.main-image {
  width: 100%;
  height: 180px;
  border-radius: var(--global-border-radius) 10px 0 0;
  margin-bottom: 4px;
  object-fit: cover;
}
.has-img2, .has-img1 { display: flex; justify-content: space-between; padding: 0 8px; margin-bottom: 6px; }
.user-row { display: flex; align-items: center; }

.avatar {
  width: 30px; height: 30px; border-radius: var(--global-border-radius);
  background-color: var(--color-black); object-fit: cover; flex-shrink: 0;
}
.user-info { margin-left: 6px; }
.user-name { font-size: 16px; font-weight: bold; color: var(--color-black); }
.tag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }

.tag {
  padding: 2px 6px; border: var(--unified-border);
  border-radius: var(--global-border-radius); font-size: 12px; font-weight: bold; color: var(--color-black-60);
}

.title {
  font-size: 16px; font-weight: bold; color: var(--color-black);
  margin: 0 8px 6px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap;
}
.date-text { font-size: 12px; color: var(--color-gray-3d); padding: 0 10px; margin-bottom: 6px; }
.cycle-row { padding: 0 10px; margin-bottom: 6px; }
.cycle { font-size: 12px; color: var(--color-gray-8d8d8d); }

.money {
  font-size: 18px; font-weight: bold; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.no-image { padding: 8px; }
.top-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.close-icon { width: 22px; height: 22px; cursor: pointer; }

.context {
  padding: 4px 8px 8px; border-bottom: var(--unified-border-bottom);
  margin: 0 -8px; font-size: 12px; color: var(--color-gray-3d);
}
.related-images { margin: 8px 0; }
.field-label { font-size: 12px; color: var(--color-gray-3d); display: block; margin-bottom: 4px; }
.image-list { display: flex; gap: 8px; }
.image-item { width: 50px; height: 50px; border-radius: var(--global-border-radius); object-fit: cover; }
.bottom-row { display: flex; justify-content: space-between; align-items: center; }

.status .fabu {
  padding: 3px 12px; border-radius: var(--global-border-radius); font-size: 12px;
  font-weight: bold; color: var(--color-black); border: var(--unified-border);
  background: var(--color-white); box-shadow: var(--global-box-shadow);
}
.status .ywc { font-size: 12px; color: var(--color-gray-8d8d8d); }
.status .kfz { font-size: 12px; color: var(--color--b0a0ff); }
</style>
