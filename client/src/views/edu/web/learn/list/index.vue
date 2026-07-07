<template>
  <learn-nav-menu/>
  <div class="content-list-container">
    <div class="content-filter">
      <div class="category" style="z-index: 500;">
        <span class="label"></span>
        <div class="category-list-box">
          <ul class="category-list">
            <li class="item" :class="{'active': pid === 0}">
              <a @click="changeCategory(0)">全部</a>
            </li>
            <li class="item" :class="{'active': pid === c.value}" v-for="c in categoryList" :key="c.value">
              <a @click="changeCategory(c.value)">{{c.label}}</a>
            </li>
          </ul>
        </div>
      </div>
      <div class="category">
        <span class="label"></span>
        <div class="category-list-box">
          <ul class="category-list">
            <li class="item" :class="{'active': cid === 0}">
              <a @click="subChangeCategory(0)">全部</a>
            </li>
            <li class="item" :class="{'active': cid === c.value}" :key="c.value" v-for="c in subCategoryList">
              <a @click="subChangeCategory(c.value)">{{c.label}}</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div class="content-list" v-loading="dataLoading">
      <el-empty v-if="!(itemList && itemList.length)"/>
      <rectangle v-else v-for="item in itemList" :key="item.id" width="calc(20% - 20px);" :item="item" class="content-item"/>
      <div style="clear: both;"></div>
    </div>
    <div v-if="itemList && itemList.length">
      <page
        :size-change="handleSizeChange"
        :current-change="handleCurrentChange"
        :current-page="param.current"
        :page-size="param.size"
        :total="total"
        class="page-bar">
      </page>
    </div>
  </div>
</template>

<script>
  import {ref} from "vue"
  import rectangle from "@/views/edu/web/module/component/rectangle"
  import {getLessonList} from "@/api/edu/web/learn/lesson"
  import {findCategoryList, toTree} from "@/api/edu/web/learn/category"
  import {useRoute} from "vue-router";
  import Page from "@/components/Page/index";
  import LearnNavMenu from "@/views/edu/web/learn/navMenu";
  export default {
    name: "learnList",
    components: {
      LearnNavMenu,
      Page,
      rectangle
    },
    setup() {
      const showListBox = ref(true)
      const categoryList = ref([])
      const categoryIdList = ref([])
      const subCategoryList = ref([])
      const subCategoryIdList = ref([])
      const parentIdMap = ref({})
      const itemList = ref([])
      const pid = ref(0)
      const cid = ref(0)
      const param = ref({
        cid: 0,
        current: 1,
        size: 20
      })
      const total = ref(0)
      const route = useRoute();
      const loadSubCategory = function(cid) {
        subCategoryList.value = []
        for (const category of categoryList.value) {
          if (cid === 0 || cid === category.value) {
            if (category.children && category.children.length) {
              for (const child of category.children) {
                subCategoryIdList.value.push(child.value)
                subCategoryList.value.push(child)
                parentIdMap.value[child.value] = category.value;
              }
            }
          }
        }
      }
      const changeCid = function(id, type) {
        if (id === 0) {
          if("category" === type) {
            pid.value = 0;
          }
          cid.value = 0;
        } else {
          if(categoryIdList.value.indexOf(id) > -1) {
            pid.value = id;
            cid.value = 0;
          } else if(subCategoryIdList.value.indexOf(id) > -1) {
            cid.value = id;
            pid.value = parentIdMap.value[id]
          }
        }
        loadSubCategory(pid.value)
        if (!cid.value) {
          param.value.cid = pid.value
        } else {
          param.value.cid = cid.value
        }
      }
      const loadCategory = function() {
        let cid = route.query.cid
        cid = cid ? parseInt(cid) : 0
        param.value.cid = cid
        findCategoryList(0, true, (res) => {
          const list = toTree(res)
          if (list && list.length) {
            for (const category of list) {
              categoryList.value.push(category);
              categoryIdList.value.push(category.value)
              loadSubCategory(cid);
              changeCid(cid);
            }
          }
        })
      }
      loadCategory()
      const dataLoading = ref(true)
      const load = function() {
        dataLoading.value = true
        getLessonList(param.value, res => {
          itemList.value = res.list
          total.value = res.total
          dataLoading.value = false
        }).catch(() => {
          dataLoading.value = false
        })
      }
      load()
      const changeCategory = function(cid) {
        changeCid(cid, "category")
        load()
      }
      const subChangeCategory = function(cid) {
        changeCid(cid, "subCategory")
        load()
      }
      const handleSizeChange = function(val) {
        param.value.size = val;
        load();
      }
      const handleCurrentChange = function(val) {
        param.value.current = val;
        load();
      }
      return {
        showListBox,
        categoryList,
        categoryIdList,
        subCategoryList,
        subCategoryIdList,
        parentIdMap,
        itemList,
        pid,
        cid,
        param,
        total,
        dataLoading,
        changeCategory,
        subChangeCategory,
        handleSizeChange,
        handleCurrentChange
      }
    }
  }
</script>

<style lang="scss" scoped>
  .content-list-container {
    padding-top: 16px;
    margin: 0 10px;
    
    .content-filter {
      margin-bottom: 16px;
      background: #ffffff;
      border: 1px solid #f0f0f0;
      border-radius: 6px;
      overflow: hidden;
      
      .category {
        position: relative;
        line-height: 36px;
        padding: 12px 16px;
        background-color: #ffffff;
        z-index: 300;
        border-bottom: 1px solid #f0f0f0;
        
        &:last-child {
          border-bottom: none;
        }
        
        .label {
          width: 90px;
          margin-right: 8px;
          font-weight: 600;
          color: #333333;
        }
        
        .category-list-box {
          position: absolute;
          width: 100%;
          line-height: 36px;
          height: 56px;
          overflow: hidden;
          background-color: #ffffff;
          transition: all 0.2s ease;
          display: flex;
          top: 0;
          right: 0;
          z-index: 300;
          
          .category-list {
            list-style: none;
            width: 0;
            flex: 1;
            border: 1px solid transparent;
            border-radius: 6px;
            
            .item {
              float: left;
              padding: 6px 12px;
              margin: 8px;
              border-radius: 6px;
              cursor: pointer;
              transition: all 0.2s ease;
              color: #333333;
              
              &:hover {
                background: #f8f8f8;
                color: var(--el-color-primary);
              }
            }
            
            .active {
              background: var(--el-color-primary);
              color: #ffffff;
              
              &:hover {
                background: var(--el-color-primary);
                color: #ffffff;
              }
            }
          }
        }
      }
      
      .category:hover {
        .category-list-box {
          height: auto;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .category-list {
          border: 1px solid #f0f0f0;
          background: #ffffff;
        }
      }
    }
    
    .content-list {
      background-color: #ffffff;
      min-height: 768px;
      border-radius: 6px;
      border: 1px solid #f0f0f0;
      padding: 16px 6px;
      
      .content-item {
        &:nth-child(5n + 1) {
          clear: left;
        }
      }
    }
    
    .page-bar {
      margin: 20px 0;
      text-align: center;
    }
  }
</style>
<style lang="scss">
  body {
    background-color: #fafafa;
  }
</style>
