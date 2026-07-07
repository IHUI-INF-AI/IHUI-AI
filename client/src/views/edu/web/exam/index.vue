<template>
  <div>
    <el-breadcrumb style="margin: 20px 10px;" :separator-icon="ArrowRight">
      <el-breadcrumb-item :to="{ path: '/edu/exam' }">考试</el-breadcrumb-item>
    </el-breadcrumb>
    <!-- 轮播放-->
<!--    <Banner class="banner-box" :carousel="carousel" v-loading="carouselLoading"/>-->
    <!-- 热门推荐 -->
    <hot :type="'exam'" :hot-item="hotItem"/>
    <!-- 目录考试 -->
    <div v-for="(item, index) in categoryExamList" :key="index">
      <row-tabs :item="item" :type="'exam'"/>
    </div>
  </div>
</template>

<script>
import { ref, markRaw} from "vue"
import {ArrowRight} from '@/lib/lucide-fallback'
  import { getRecommendExam, getHotExam } from "@/api/edu/web/exam/index"
  import {findCategoryList, toTree} from "@/api/edu/web/exam/category"
  // import Banner from "../module/banner.vue"
  import hot from "../module/hot.vue";
  import rowTabs from "../module/rowTabs.vue";
  import {getCarousel} from "@/api/edu/web/setting/carousel";
import router from "@/router";
  export default {
    name: "ExamIndex",
    components: {
      rowTabs,
      hot,
      // Banner
    },
    setup() {
      const ArrowRightIcon = markRaw(ArrowRight)
      // 目录
      const showSubmenu = ref(false);
      const categoryList = ref([])
      const categoryIndexMap = ref({})
      const menuList = ref([])
      const loadCategoryMenu = (treeList) => {
        let i = 0;
        for (const e of treeList) {
          const res = {value: e.value, type: e.value, label: e.label, children: e.children}
          categoryList.value.push({value: e.value, type: "learn", label: e.label, children: [res]})
          categoryIndexMap.value[res.type] = i++
          const children = res.children;
          let label = "";
          if (children && children.length) {
            for (let i = 0; i < children.length; i++) {
              label += children[i].label
              if (i === 1) {
                break;
              }
              if (i !== children.length - 1) {
                label += "/";
              }
            }
          }
          menuList.value.push({type: res.type, title: res.label + " ", subTitle: label})
        }
      }
      const submenu = ref({})
      const showSubmenuType = ref("")
      const categoryHover = (type) => {
        submenu.value = categoryList.value[categoryIndexMap.value[type]]
        showSubmenu.value = true
        showSubmenuType.value = type;
      }
      // 导航
      const carouselLoading = ref(true)
      const carousel = ref({})
      getCarousel({}, (res) => {
        const carouselJsonStr = res.carouselJson;
        if (carouselJsonStr) {
          carousel.value = JSON.parse(carouselJsonStr);
        }
        carouselLoading.value = false
      }).catch(() => {
        carouselLoading.value = false
      })
      // 热门推荐
      const hotItem = ref({
        id: 0,
        name: "热门考试",
        contentList: [],
        moduleLinkList: []
      })
      const hotDataLoading = ref(true)
      const loadRecommendLesson = function() {
        hotDataLoading.value = true
        getRecommendExam({}, res => {
          hotItem.value.contentList = res
          hotDataLoading.value = false
        })
      }
      loadRecommendLesson();
      // 分类推荐
      const categoryExamList = ref([])
      const loadCategory = async function() {
        await findCategoryList(0, true, async (res) => {
          const categoryList = toTree(res)
          loadCategoryMenu(categoryList)
          if (categoryList && categoryList.length) {
            for (const category of categoryList) {
              const categoryChildrenList = []
              await getHotExam({cid: category.value, isShowIndex: true}, async res => {
                const categoryChildren = {name: "最新", id: category.value, contentList: res}
                categoryChildrenList.push(categoryChildren)
                if (category.children && category.children.length) {
                  for (const child of category.children) {
                    await getHotExam({cid: child.value, isShowIndex: true}, childRes => {
                      for (const p of categoryExamList.value) {
                        if (p.id === category.value) {
                          p.children.push({name: child.label, id: child.value, contentList: childRes});
                          break
                        }
                      }
                    })
                  }
                }
              })
              categoryExamList.value.push({
                name: category.label,
                id: category.value,
                children: categoryChildrenList
              });
            }
          }
        })
      }
      loadCategory();

      const gotoLessonDetail = function (item) {
        router.push({ name: "examDetail", query: { id: item.id } })
      }
      return {
        ArrowRight: ArrowRightIcon,
        hotItem,
        hotDataLoading,
        categoryExamList,
        carousel,
        carouselLoading,
        showSubmenu,
        categoryList,
        menuList,
        submenu,
        categoryHover,
        showSubmenuType,
        gotoLessonDetail
      }
    }
  }
</script>
<style scoped lang="scss">
  .banner-box {
    margin: 20px auto;
    width: calc(100% - 20px);
    min-width: calc(100% - 20px);
    border-radius: 6px;
  }
</style>
