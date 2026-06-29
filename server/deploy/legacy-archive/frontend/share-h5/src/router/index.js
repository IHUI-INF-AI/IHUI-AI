import { createRouter, createWebHistory } from 'vue-router'
import SharePage from '../pages/SharePage.vue'
import ErrorPage from '../pages/ErrorPage.vue'

const routes = [
  {
    path: '/error',
    name: 'Error',
    component: ErrorPage
  },
  {
    path: '/share/:code?',
    name: 'ShareWithPath',
    component: SharePage
  },
  {
    // 排除 dist 路径，避免将 dist 或 index.html 当作 code
    path: '/dist/:pathMatch(.*)*',
    redirect: (to) => {
      // 如果有 code 查询参数，保留它
      if (to.query.code) {
        return { path: '/', query: { code: to.query.code } }
      }
      return '/'
    }
  },
  {
    path: '/:code?',
    name: 'Share',
    component: SharePage
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
