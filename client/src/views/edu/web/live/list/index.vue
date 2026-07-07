<template>
  <div class="live-page">
    <!-- 面包屑导航 -->
    <el-breadcrumb class="breadcrumb" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/live' }">直播</el-breadcrumb-item>
    </el-breadcrumb>

    <!-- 分类筛选 -->
    <div class="category-filter">
      <div class="category-row main">
        <div class="category-tags-wrapper two-rows" :class="{ expanded: isCategoryExpanded }">
          <div class="category-tags">
            <span 
              class="tag" 
              :class="{ active: pid === 0 }" 
              @click="changeCategory(0)">
              全部
            </span>
            <span 
              v-for="c in categoryList" 
              :key="c.value"
              class="tag" 
              :class="{ active: pid === c.value }"
              @click="changeCategory(c.value)">
              {{ c.label }}
            </span>
          </div>
        </div>
        <button 
          class="expand-btn" 
          @click="toggleCategoryExpand"
          v-if="categoryList.length > 12">
          <span>{{ isCategoryExpanded ? '收起' : '展开' }}</span>
          <el-icon :class="{ rotated: isCategoryExpanded }"><ArrowDown /></el-icon>
        </button>
      </div>
      <div class="category-row sub" v-if="subCategoryList.length">
        <div class="category-tags-wrapper" :class="{ expanded: isSubExpanded }">
          <div class="category-tags">
            <span 
              class="tag small" 
              :class="{ active: cid === 0 }" 
              @click="subChangeCategory(0)">
              全部
            </span>
            <span 
              v-for="c in subCategoryList" 
              :key="c.value"
              class="tag small" 
              :class="{ active: cid === c.value }"
              @click="subChangeCategory(c.value)">
              {{ c.label }}
            </span>
          </div>
        </div>
        <button 
          class="expand-btn" 
          @click="toggleSubExpand"
          v-if="subCategoryList.length > 6">
          <span>{{ isSubExpanded ? '收起' : '展开' }}</span>
          <el-icon :class="{ rotated: isSubExpanded }"><ArrowDown /></el-icon>
        </button>
      </div>
    </div>

    <!-- 空状态 -->
    <el-empty v-if="!itemList || !itemList.length" description="暂无直播内容" />

    <!-- 内容区域 -->
    <div v-else class="live-content">
      <!-- 特色区域：左大右小布局 -->
      <section class="featured-section" v-if="featuredItems.length">
        <div class="section-header">
          <h2 class="section-title">
            <span class="icon">🔥</span>
            精选直播
          </h2>
        </div>
        <div class="featured-grid">
          <!-- 左侧大卡片 -->
          <router-link 
            class="featured-main" 
            :to="{ path: '/edu/live/detail', query: { id: featuredItems[0].id } }">
            <div class="card-image">
              <img :src="featuredItems[0].image" :alt="featuredItems[0].name" />
              <div class="overlay">
                <span class="live-badge" v-if="featuredItems[0].status === 'active'">
                  <i class="live-dot"></i>直播中
                </span>
                <span class="view-count">{{ featuredItems[0].subscribeNum || 0 }} 人预约</span>
              </div>
              <div class="info-bar">
                <h3>{{ featuredItems[0].name }}</h3>
                <p>{{ featuredItems[0].introduction }}</p>
              </div>
            </div>
          </router-link>
          
          <!-- 右侧小卡片网格 -->
          <div class="featured-side">
            <router-link 
              v-for="item in featuredItems.slice(1, 5)" 
              :key="item.id"
              class="side-card"
              :to="{ path: '/edu/live/detail', query: { id: item.id } }">
              <div class="card-image">
                <img :src="item.image" :alt="item.name" />
                <span class="live-badge small" v-if="item.status === 'active'">
                  <i class="live-dot"></i>LIVE
                </span>
              </div>
              <div class="card-info">
                <h4>{{ item.name }}</h4>
                <span class="meta">{{ item.subscribeNum || 0 }}人预约</span>
              </div>
            </router-link>
          </div>
        </div>
      </section>

      <!-- 热门直播：横向滚动 -->
      <section class="scroll-section" v-if="hotItems.length">
        <div class="section-header">
          <h2 class="section-title">
            <span class="icon">⚡</span>
            热门推荐
          </h2>
          <div class="scroll-controls">
            <button class="scroll-btn" @click="scrollLeft('hot')">‹</button>
            <button class="scroll-btn" @click="scrollRight('hot')">›</button>
          </div>
        </div>
        <div class="scroll-container" ref="hotScrollRef">
          <router-link 
            v-for="item in hotItems" 
            :key="item.id"
            class="scroll-card"
            :to="{ path: '/edu/live/detail', query: { id: item.id } }">
            <div class="card-image">
              <img :src="item.image" :alt="item.name" />
              <span class="live-badge mini" v-if="item.status === 'active'">
                <i class="live-dot"></i>
              </span>
              <div class="time-tag">{{ formatTime(item.startTime) }}</div>
            </div>
            <div class="card-info">
              <h4>{{ item.name }}</h4>
              <div class="card-meta">
                <span>{{ item.subscribeNum || 0 }}人</span>
              </div>
            </div>
          </router-link>
        </div>
      </section>

      <!-- 更多直播：紧凑网格 -->
      <section class="grid-section" v-if="gridItems.length">
        <div class="section-header">
          <h2 class="section-title">
            <span class="icon">📺</span>
            更多直播
          </h2>
        </div>
        <div class="compact-grid">
          <router-link 
            v-for="item in gridItems" 
            :key="item.id"
            class="grid-card"
            :to="{ path: '/edu/live/detail', query: { id: item.id } }">
            <div class="card-image">
              <img :src="item.image" :alt="item.name" />
              <span class="live-badge mini" v-if="item.status === 'active'">
                <i class="live-dot"></i>
              </span>
            </div>
            <div class="card-info">
              <h4>{{ item.name }}</h4>
              <div class="card-meta">
                <span class="time">{{ formatTime(item.startTime) }}</span>
                <span class="count">{{ item.subscribeNum || 0 }}人</span>
              </div>
            </div>
          </router-link>
        </div>
      </section>
    </div>

    <!-- 分页 -->
    <div v-if="itemList && itemList.length" class="pagination-wrap">
      <page
        :size-change="handleSizeChange"
        :current-change="handleCurrentChange"
        :current-page="param.current"
        :page-size="param.size"
        :total="total"
        class="page-bar"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, markRaw } from "vue"
import { ArrowRight, ArrowDown } from '@/lib/lucide-fallback'
import { liveList } from "@/api/edu/web/live/index"
import { findCategoryList, toTree } from "@/api/edu/web/live/category"
import { useRoute } from "vue-router"
import Page from "@/components/Page/index"

export default {
  name: "liveList",
  components: { Page },
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const ArrowDownIcon = markRaw(ArrowDown)
    const categoryList = ref([])
    const categoryIdList = ref([])
    const subCategoryList = ref([])
    const subCategoryIdList = ref([])
    const parentIdMap = ref({})
    const itemList = ref([])
    const pid = ref(0)
    const cid = ref(0)
    const param = ref({ cid: 0, current: 1, size: 30 })
    const total = ref(0)
    const route = useRoute()
    const hotScrollRef = ref(null)
    const isCategoryExpanded = ref(false)
    const isSubExpanded = ref(false)

    // 切换一级分类展开/收起
    const toggleCategoryExpand = () => {
      isCategoryExpanded.value = !isCategoryExpanded.value
    }

    // 切换二级分类展开/收起
    const toggleSubExpand = () => {
      isSubExpanded.value = !isSubExpanded.value
    }

    // 计算属性：分割数据用于不同区域
    const featuredItems = computed(() => itemList.value.slice(0, 5))
    const hotItems = computed(() => itemList.value.slice(5, 15))
    const gridItems = computed(() => itemList.value.slice(15))

    // 格式化时间
    const formatTime = (time) => {
      if (!time) return '待定'
      const date = new Date(time)
      const now = new Date()
      const diff = date - now
      
      if (diff < 0) return '已结束'
      if (diff < 3600000) return '即将开始'
      if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000)
        return `${hours}小时后`
      }
      const month = date.getMonth() + 1
      const day = date.getDate()
      return `${month}/${day}`
    }

    // 横向滚动控制
    const scrollLeft = () => {
      const container = hotScrollRef.value
      if (container) {
        container.scrollBy({ left: -300, behavior: 'smooth' })
      }
    }
    const scrollRight = () => {
      const container = hotScrollRef.value
      if (container) {
        container.scrollBy({ left: 300, behavior: 'smooth' })
      }
    }

    const loadSubCategory = (cid) => {
      subCategoryList.value = []
      for (const category of categoryList.value) {
        if (cid === 0 || cid === category.value) {
          if (category.children && category.children.length) {
            for (const child of category.children) {
              subCategoryIdList.value.push(child.value)
              subCategoryList.value.push(child)
              parentIdMap.value[child.value] = category.value
            }
          }
        }
      }
    }

    const changeCid = (id, type) => {
      if (id === 0) {
        if (type === "category") pid.value = 0
        cid.value = 0
      } else {
        if (categoryIdList.value.indexOf(id) > -1) {
          pid.value = id
          cid.value = 0
        } else if (subCategoryIdList.value.indexOf(id) > -1) {
          cid.value = id
          pid.value = parentIdMap.value[id]
        }
      }
      loadSubCategory(pid.value)
      param.value.cid = cid.value || pid.value
    }

    const loadCategory = () => {
      let cidQuery = route.query.cid
      cidQuery = cidQuery ? parseInt(cidQuery) : 0
      param.value.cid = cidQuery
      findCategoryList(0, true, (res) => {
        const list = toTree(res)
        if (list && list.length) {
          for (const category of list) {
            categoryList.value.push(category)
            categoryIdList.value.push(category.value)
            loadSubCategory(cidQuery)
            changeCid(cidQuery)
          }
        }
      })
    }
    loadCategory()

    const load = () => {
      liveList(param.value, (res) => {
        itemList.value = res.list
        total.value = res.total
      })
    }
    load()

    const changeCategory = (id) => {
      changeCid(id, "category")
      isSubExpanded.value = false // 切换一级分类时收起二级分类
      load()
    }
    const subChangeCategory = (id) => {
      changeCid(id, "subCategory")
      load()
    }
    const handleSizeChange = (val) => {
      param.value.size = val
      load()
    }
    const handleCurrentChange = (val) => {
      param.value.current = val
      load()
    }

    return {
      ArrowRight: ArrowRightIcon,
      ArrowDown: ArrowDownIcon,
      categoryList,
      subCategoryList,
      itemList,
      featuredItems,
      hotItems,
      gridItems,
      pid,
      cid,
      param,
      total,
      hotScrollRef,
      isCategoryExpanded,
      isSubExpanded,
      formatTime,
      scrollLeft,
      scrollRight,
      changeCategory,
      subChangeCategory,
      toggleCategoryExpand,
      toggleSubExpand,
      handleSizeChange,
      handleCurrentChange,
    }
  },
}
</script>

<style lang="scss" scoped>
.live-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.breadcrumb {
  margin-bottom: 16px;
}

/* 分类筛选 */
.category-filter {
  background: #fff;
  border-radius: $border-radius;
  padding: 12px 16px;
  margin-bottom: 20px;

  .category-row {
    &.sub {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }
  }

  .category-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;

    .tag {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 16px;
      border-radius: $border-radius;
      font-size: 13px;
      line-height: 1.4;
      color: #666;
      background: #f5f5f5;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: $primary-color;
        background: rgba(64,158,255, 0.08);
      }

      &.active {
        color: #fff;
        background: $primary-color;
      }

      &.small {
        padding: 5px 14px;
        font-size: 12px;
      }
    }
  }

  /* 分类展开/收起 */
  .category-row.main,
  .category-row.sub {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .category-tags-wrapper {
    flex: 1;
    overflow: hidden;
    transition: max-height 0.3s ease;

    /* 一级分类：默认两排 */
    &.two-rows {
      max-height: 76px; /* 两排高度 */

      &.expanded {
        max-height: 500px;
      }
    }

    /* 二级分类：默认一排 */
    &:not(.two-rows) {
      max-height: 36px;

      &.expanded {
        max-height: 500px;
      }
    }

    .category-tags {
      flex-wrap: wrap;
    }
  }

  .expand-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border: 1px solid #e0e0e0;
    border-radius: $border-radius;
    background: #fff;
    font-size: 12px;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    margin-top: 2px;

    &:hover {
      border-color: $primary-color;
      color: $primary-color;
    }

    .el-icon {
      font-size: 12px;
      transition: transform 0.3s;

      &.rotated {
        transform: rotate(180deg);
      }
    }
  }
}

/* 内容区域 */
.live-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 区块头部 */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;

  .section-title {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;

    .icon {
      font-size: 20px;
    }
  }

  .scroll-controls {
    display: flex;
    gap: 6px;

    .scroll-btn {
      width: 28px;
      height: 28px;
      border: 1px solid #e0e0e0;
      border-radius: 50%;
      background: #fff;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;

      &:hover {
        border-color: $primary-color;
        color: $primary-color;
      }
    }
  }
}

/* 特色区域：左大右小 */
.featured-section {
  .featured-grid {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 12px;
    height: 380px;
  }

  .featured-main {
    position: relative;
    border-radius: $border-radius;
    overflow: hidden;
    display: block;

    .card-image {
      width: 100%;
      height: 100%;
      position: relative;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.4s;
      }

      .overlay {
        position: absolute;
        top: 12px;
        left: 12px;
        right: 12px;
        display: flex;
        justify-content: space-between;
        z-index: 2;
      }

      .info-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 40px 16px 16px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
        color: #fff;

        h3 {
          font-size: 18px;
          font-weight: 600;
          margin: 0 0 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        p {
          font-size: 13px;
          margin: 0;
          opacity: 0.85;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    &:hover img {
      transform: scale(1.03);
    }
  }

  .featured-side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
    gap: 12px;

    .side-card {
      position: relative;
      border-radius: $border-radius;
      overflow: hidden;
      background: #f8f8f8;

      .card-image {
        width: 100%;
        height: 100%;
        position: relative;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s;
        }
      }

      .card-info {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 24px 10px 10px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
        color: #fff;

        h4 {
          font-size: 13px;
          font-weight: 500;
          margin: 0 0 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .meta {
          font-size: 11px;
          opacity: 0.8;
        }
      }

      &:hover img {
        transform: scale(1.05);
      }
    }
  }
}

/* 直播徽章 */
.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 77, 79, 0.9);
  color: #fff;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  backdrop-filter: blur(4px);

  &.small {
    padding: 3px 8px;
    font-size: 11px;
  }

  &.mini {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 3px 6px;
    font-size: 10px;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    background: #fff;
    border-radius: 50%;
    animation: pulse 1.5s infinite;
  }
}

.view-count {
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  border-radius: 12px;
  font-size: 12px;
  backdrop-filter: blur(4px);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* 横向滚动区域 */
.scroll-section {
  .scroll-container {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-behavior: smooth;
    padding-bottom: 8px;

    &::-webkit-scrollbar {
      height: 4px;
    }
    &::-webkit-scrollbar-track {
      background: #f0f0f0;
      border-radius: 2px;
    }
    &::-webkit-scrollbar-thumb {
      background: #d0d0d0;
      border-radius: 2px;
    }
  }

  .scroll-card {
    flex: 0 0 180px;
    background: #fff;
    border-radius: $border-radius;
    overflow: hidden;
    border: 1px solid #f0f0f0;
    transition: all 0.2s;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
    }

    .card-image {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 10;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .time-tag {
        position: absolute;
        bottom: 6px;
        right: 6px;
        padding: 2px 6px;
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border-radius: 4px;
        font-size: 10px;
      }
    }

    .card-info {
      padding: 10px;

      h4 {
        font-size: 13px;
        font-weight: 500;
        color: #1a1a1a;
        margin: 0 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .card-meta {
        font-size: 11px;
        color: #999;
      }
    }
  }
}

/* 紧凑网格 */
.grid-section {
  .compact-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px;
  }

  .grid-card {
    background: #fff;
    border-radius: $border-radius;
    overflow: hidden;
    border: 1px solid #f0f0f0;
    transition: all 0.2s;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
    }

    .card-image {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 10;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .card-info {
      padding: 10px;

      h4 {
        font-size: 12px;
        font-weight: 500;
        color: #1a1a1a;
        margin: 0 0 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .card-meta {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #999;

        .time {
          color: $primary-color;
        }
      }
    }
  }
}

/* 分页 */
.pagination-wrap {
  margin-top: 24px;
  padding: 16px;
  background: #fff;
  border-radius: $border-radius;
  text-align: center;
}

/* 响应式 */
@media (max-width: 1200px) {
  .featured-section .featured-grid {
    grid-template-columns: 1fr 280px;
    height: 320px;
  }
  .grid-section .compact-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 900px) {
  .featured-section .featured-grid {
    grid-template-columns: 1fr;
    height: auto;
  }
  .featured-section .featured-main {
    height: 240px;
  }
  .featured-section .featured-side {
    grid-template-columns: repeat(4, 1fr);
    height: 140px;
  }
  .grid-section .compact-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 600px) {
  .featured-section .featured-side {
    grid-template-columns: repeat(2, 1fr);
    height: auto;
  }
  .grid-section .compact-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .scroll-section .scroll-card {
    flex: 0 0 150px;
  }
}
</style>
