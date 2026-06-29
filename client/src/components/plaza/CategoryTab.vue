<template>
  <div class="category-tab">
    <div class="tab-list">
      <div v-if="showAll" :class="['tab-item', { active: all }]" @click="selectAllTab">
        <img class="tab-icon" :src="all ? 'https://file.aizhs.top/sys-backs/2025/08/16/sqb_20250816161049A277.png' : 'https://file.aizhs.top/sys-backs/2025/08/16/qqb_20250816161046A276.png'" alt="" loading="lazy" />
        <span>{ t('plazaCategoryTab.all') }</span>
      </div>
      <div v-for="item in tabList" :key="item.id" :class="['tab-item', { active: tabValue.includes(item) }]"
        @click="select(item)">
        <img class="tab-icon" :src="tabValue.includes(item) ? item.butUrl : item.field1" :alt="item.name || ''" loading="lazy" />
        <span>{{ item.name }}</span>
      </div>
      <div v-if="customize" :class="['tab-item', { active: addType }]" @click="addType = true">
        <img class="tab-icon" src="https://file.aizhs.top/sys-backs/2025/08/16/szdy_20250816161421A290.png" alt="" loading="lazy" />
        <span>{{ t('plazaCategoryTab.custom') }}</span>
      </div>
    </div>
    <div v-if="addType" class="mask" @click="addType = false"></div>
    <div v-if="addType" class="add-dialog">
      <div class="dialog-title">{ t('plazaCategoryTab.setCustomCategory') }</div>
      <el-input v-model="value" maxlength="4" :placeholder="t('plazaCategoryTab.enterCategory')" class="dialog-input" />
      <el-button type="primary" class="dialog-btn" @click="add">{{ t('common.ok') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { category } from '@/services/aiModels'

const { t } = useI18n()

defineOptions({ name: 'CategoryTab' })


const props = withDefaults(defineProps<{
  showAll?: boolean
  paddingLeft?: string
  customize?: boolean
}>(), {
  showAll: false,
  paddingLeft: '0',
  customize: false
})

const emit = defineEmits<{
  (e: 'change', value: Record<string, unknown>[]): void
}>()

const tabList = ref<Record<string, unknown>[]>([])
const tabValue = ref<Record<string, unknown>[]>([])
const all = ref(true)
const addType = ref(false)
const value = ref('')

watch(() => tabValue.value.length, (n) => {
  if (n > 0 && props.showAll) all.value = false
  if (n === 0) all.value = true
  emit('change', tabValue.value)
})

onMounted(() => {
  category('0').then((res) => { tabList.value = (res?.data as Record<string, unknown>[]) || [] }).catch((e) => { console.error(e) })
})

function add() {
  if (value.value) {
    const item = {
      id: value.value,
      name: value.value,
      type: 'type',
      field1: 'https://file.aizhs.top/sys-backs/2025/08/16/qzdy_20250816161419A289.png',
      butUrl: 'https://file.aizhs.top/sys-backs/2025/08/16/szdy_20250816161421A290.png'
    }
    tabList.value.unshift(item)
    select(item)
  }
  addType.value = false
}

function select(item: Record<string, unknown>) {
  const idx = tabValue.value.indexOf(item)
  if (idx >= 0) tabValue.value.splice(idx, 1)
  else tabValue.value.push(item)
}

function selectAllTab() {
  all.value = !all.value
  if (all.value) tabValue.value = []
}
</script>

<style scoped>
.category-tab { width: 100%; }

.tab-list {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 6px; overflow-x: auto; white-space: nowrap;
}
.tab-list::-webkit-scrollbar { display: none; }

.tab-item {
  flex: none; display: flex; align-items: center;
  padding: 6px 4px; border-radius: var(--global-border-radius-sm, 4px); font-weight: bold;
  color: var(--color-black-60); border: var(--unified-border);
  cursor: pointer; height: 24px;
}

.tab-item.active {
  color: var(--color-black); border: var(--unified-border);
  box-shadow: var(--global-box-shadow);
  background: var(--color-rgba-248-249-252-0-65-);
}
.tab-icon { width: 24px; height: 24px; margin-right: 4px; flex-shrink: 0; }

.mask {
  position: fixed; inset: 0;
  z-index: var(--z-sticky); background-color: var(--color-black-30);
}

.add-dialog {
  position: fixed; inset: 0;
  margin: auto; z-index: var(--z-sticky); width: 200px; height: 150px;
  border-radius: var(--global-border-radius); background: var(--color-white); border: var(--unified-border);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.dialog-title { font-size: 12px; font-weight: bold; color: var(--color-gray-3d); margin-bottom: 20px; }
.dialog-input { width: 160px; margin-bottom: 20px; }
.dialog-btn { width: 50px; }
</style>
