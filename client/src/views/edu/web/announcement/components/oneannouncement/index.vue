<template>
  <!-- 公告栏 -->
  <div class="one-announcement-bar">
    <div class="one-announcement-inner">
      <!-- 加载中骨架 -->
      <template v-if="loading">
        <div class="one-announcement-label">
          <span class="one-announcement-icon">📢</span>
          <span class="one-announcement-title">公告</span>
        </div>
        <div class="one-announcement-skeleton"></div>
      </template>
      <!-- 有数据时显示 -->
      <template v-else-if="announcementList.length">
        <div class="one-announcement-label">
          <span class="one-announcement-icon">📢</span>
          <span class="one-announcement-title">公告</span>
        </div>
        <div class="one-announcement-content">
          <el-carousel height="20px" direction="vertical" :autoplay="true" :interval="5000" indicator-position="none">
            <el-carousel-item v-for="item in announcementList" :key="item.id">
              <div class="one-announcement-text" @click="goto('/edu/announcement/detail', item.id)">
                {{ item.title }}
              </div>
            </el-carousel-item>
          </el-carousel>
        </div>
        <router-link :to="{path: '/edu/announcement'}" class="one-announcement-more">
          查看更多
        </router-link>
      </template>
      <!-- 无数据时显示 -->
      <template v-else>
        <div class="one-announcement-label">
          <span class="one-announcement-icon">📢</span>
          <span class="one-announcement-title">公告</span>
        </div>
        <div class="one-announcement-empty">暂无公告</div>
      </template>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getAnnouncementList } from "@/api/edu/web/announcement";

export default {
  name: "OneAnnouncement",
  setup() {
    const router = useRouter();
    const announcementList = ref([]);
    const loading = ref(true);
    
    const getList = async () => {
      try {
        await getAnnouncementList({ pageNum: 1, pageSize: 5 }, (res) => {
          if (res && res.list) {
            announcementList.value = res.list;
          } else if (res && res.rows) {
            announcementList.value = res.rows;
          }
        });
      } catch (e) {
        console.error('获取公告失败', e);
      } finally {
        loading.value = false;
      }
    };
    
    const goto = (path, id) => {
      router.push({ path, query: { id } });
    };
    
    onMounted(() => {
      getList();
    });
    
    return {
      announcementList,
      loading,
      goto
    };
  }
};
</script>

<style lang="scss">
.one-announcement-bar {
  width: 100%;
  margin: 8px 0;
  box-sizing: border-box;
}

.one-announcement-inner {
  background: linear-gradient(90deg, #fff8e6 0%, #fffcf0 100%);
  border: 1px solid #ffe6a0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(230, 162, 60, 0.1);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.one-announcement-label {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.one-announcement-icon {
  font-size: 16px;
}

.one-announcement-title {
  font-size: 14px;
  font-weight: 600;
  color: #b45309;
}

.one-announcement-content {
  flex: 1;
  min-width: 0;
  height: 20px;
  
  .el-carousel__container {
    height: 20px;
  }
}

.one-announcement-text {
  line-height: 20px;
  font-size: 14px;
  color: #92400e;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.2s;
  
  &:hover {
    color: #d97706;
    text-decoration: underline;
  }
}

.one-announcement-more {
  flex-shrink: 0;
  font-size: 13px;
  color: #b45309;
  text-decoration: none;
  padding: 4px 12px;
  border-radius: 4px;
  background: rgba(245, 158, 11, 0.15);
  transition: all 0.2s;
  white-space: nowrap;
  
  &:hover {
    background: rgba(245, 158, 11, 0.25);
    color: #92400e;
  }
}

.one-announcement-skeleton {
  flex: 1;
  height: 20px;
  color: #b8860b;
  font-size: 14px;
  line-height: 20px;
  
  &::after {
    content: '加载中...';
  }
}

.one-announcement-empty {
  flex: 1;
  font-size: 14px;
  color: #b8860b;
}
</style>
