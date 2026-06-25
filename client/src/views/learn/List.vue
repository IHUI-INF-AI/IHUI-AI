<template>
  <div class="learn-list-page page-container">
    <LearnNavMenu />
    <LearnBreadcrumb :items="[{ title: t('learnList.breadcrumbCourse'), path: '/learn' }, { title: t('learnList.breadcrumbList') }]" />

    <div class="filter-bar">
      <div class="cat-row">
        <span class="label">{{ t('learnList.category') }}:</span>
        <span
          class="cat-tag"
          :class="{ active: !cid }"
          @click="changeCid('')"
        >{{ t('learnList.all') }}</span>
        <span
          v-for="c in categories"
          :key="c.id"
          class="cat-tag"
          :class="{ active: String(cid) === String(c.id) }"
          @click="changeCid(c.id)"
        >{{ c.name }}</span>
      </div>
      <div class="keyword-row">
        <el-input
          v-model="keyword"
          :placeholder="t('learnList.searchPlaceholder')"
          clearable
          @keyup.enter="loadList"
        >
          <template #append>
            <el-button @click="loadList">{{ t('common.search') }}</el-button>
          </template>
        </el-input>
      </div>
    </div>

    <div v-loading="loading" class="list-content">
      <el-empty v-if="!list.length" :description="t('learnList.noCourses')" />
      <div v-else class="grid">
        <Rectangle
          v-for="item in list"
          :key="item.id"
          :item="item"
          link="/learn/detail"
        />
      </div>
    </div>

    <LearnPage
      :total="total"
      v-model:page="page"
      v-model:size="size"
      @change="loadList"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { useRoute } from 'vue-router'
import LearnNavMenu from '@/components/learn/LearnNavMenu.vue'
import LearnBreadcrumb from '@/components/learn/Breadcrumb.vue'
import LearnPage from '@/components/learn/Page.vue'
import Rectangle from '@/components/module/Rectangle.vue'
import { learnApi } from '@/api/learn/learn'

const route = useRoute()
const categories = ref<any[]>([])
const list = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const keyword = ref('')
const cid = ref<string | number>(Array.isArray(route.query.cid) ? (route.query.cid[0] ?? '') : ((route.query.cid as string | null) || ''))
const page = ref(1)
const size = ref(12)

async function loadCategories() {
  try { const res: any = await learnApi.categoryTree(); categories.value = res.data || [] } catch (e) { console.error(e) }
}

async function loadList() {
  loading.value = true
  try {
    const res: any = await learnApi.list({
      title: keyword.value || undefined,
      categoryId: cid.value ? String(cid.value) : undefined,
      page: page.value,
      pageSize: size.value,
    } as any)
    list.value = res.data?.items || res.data?.list || []
    total.value = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function changeCid(v: string | number) {
  cid.value = v
  page.value = 1
  loadList()
}

onMounted(() => {
  loadCategories()
  loadList()
})
</script>

<style lang="scss" scoped>
:where(.learn-list-page) {
  min-height: 100vh;
  background: var(--el-bg-color-page);
}

:where(.filter-bar) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 12px;
}

:where(.cat-row) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;

  .label {
    font-size: 14px;
    color: var(--el-text-color-regular);
  }

  .cat-tag {
    font-size: 13px;
    color: var(--el-text-color-regular);
    cursor: pointer;
    padding: 4px 12px;
    border-radius: var(--global-border-radius);

    &:hover {
      color: var(--el-color-primary);
    }

    &.active {
      color: var(--color-on-primary);
      background: var(--el-color-primary);
    }
  }
}

:where(.keyword-row) {
  max-width: 400px;
}

:where(.list-content) {
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 0 12px 24px;
}

:where(.grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
</style>
