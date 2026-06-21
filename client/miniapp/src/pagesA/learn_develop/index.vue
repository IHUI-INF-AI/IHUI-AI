<template>
  <div class="learn-develop-page">
    <h1>课程星球</h1>
    <p class="subtitle">探索优质课程，提升技能</p>
    
    <!-- 课程分类 -->
    <div class="category-section">
      <h2>课程分类</h2>
      <div class="category-grid">
        <div class="category-item" v-for="cat in categories" :key="cat.id" @click="goToCategory(cat)">
          <div class="category-icon">{{ cat.icon }}</div>
          <div class="category-name">{{ cat.name }}</div>
        </div>
      </div>
    </div>

    <!-- 热门课程 -->
    <div class="courses-section">
      <h2>热门课程</h2>
      <div class="course-list">
        <div class="course-card" v-for="course in hotCourses" :key="course.id" @click="goToCourse(course)">
          <div class="course-cover">{{ course.cover }}</div>
          <div class="course-info">
            <div class="course-title">{{ course.title }}</div>
            <div class="course-desc">{{ course.description }}</div>
            <div class="course-meta">
              <span class="course-level">{{ course.level }}</span>
              <span class="course-price">¥{{ course.price }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 联系入口 -->
    <div class="contact-section">
      <button class="contact-btn" @click="contactUs">联系客服</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const categories = ref([
  { id: 1, name: 'AI基础', icon: '🤖' },
  { id: 2, name: '智能体开发', icon: '🔧' },
  { id: 3, name: '数据分析', icon: '📊' },
  { id: 4, name: '内容创作', icon: '✍️' },
])

const hotCourses = ref([
  { id: 1, title: 'AI基础入门', description: '从零开始学习AI', cover: '📚', level: '入门', price: 99 },
  { id: 2, title: '智能体开发实战', description: '构建你的第一个智能体', cover: '🤖', level: '进阶', price: 199 },
  { id: 3, title: '数据分析入门', description: '掌握数据分析技能', cover: '📊', level: '入门', price: 149 },
])

const goToCategory = (cat: any) => {
  console.log('Go to category:', cat)
}

const goToCourse = (course: any) => {
  console.log('Go to course:', course)
}

const contactUs = () => {
  console.log('Contact us')
}
</script>

<style scoped>
.learn-develop-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.subtitle {
  color: #666;
  margin-bottom: 30px;
}

.category-section, .courses-section {
  margin-bottom: 30px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.category-item {
  text-align: center;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
}

.category-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.course-card {
  display: flex;
  margin-bottom: 15px;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
}

.course-cover {
  width: 120px;
  height: 80px;
  background: #e0e0e0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-right: 15px;
}

.course-info {
  flex: 1;
}

.course-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 5px;
}

.course-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
}

.course-meta {
  display: flex;
  justify-content: space-between;
}

.course-level {
  font-size: 12px;
  color: #007aff;
}

.course-price {
  font-size: 16px;
  color: #ff3b30;
  font-weight: bold;
}

.contact-section {
  text-align: center;
  margin-top: 30px;
}

.contact-btn {
  padding: 12px 24px;
  background: #007aff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
}

@media (max-width: 768px) {
  .category-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
