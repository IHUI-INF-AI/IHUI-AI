<template>
  <div class="content-list-container">
    <el-breadcrumb :separator-icon="ArrowRight">
      <el-breadcrumb-item>知识库</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="search-wrap">
      <div class="search-main">
        <div class="search-input">
          <div class="search-input-logo">
            <span style="font-size: 20px;"></span>
          </div>
          <div class="search-input-main">
            <el-input v-model="param.keyword" @change="searchInputChange" placeholder="请输入搜索内容" class="input-with-select" :clearable="true" style="height: 40px;">
              <template #append>
                <el-button @click="search">搜索</el-button>
              </template>
            </el-input>
          </div>
          <div class="search-input-high" @click="showHighSearchDrawerModel">
            <span class="text">高级搜索</span>
            <span class="icon"><el-icon><ArrowDown /></el-icon></span>
          </div>
        </div>
        <div class="search-high-wrap">
          <el-drawer v-model="highSearchDrawerModel" :direction="'ltr'">
            <template #header>
              <h4>高级搜索</h4>
            </template>
            <template #default>
              <div class="content-filter">
                <div class="category selected-condition-wrap">
                  <div class="category-title">已选条件</div>
                  <div class="category-list-box condition-module">
                    <div class="selected-condition" v-if="selectedConditionList && selectedConditionList.length">
                      <el-tag v-for="(tag, index) in selectedConditionList" class="mx-1" closable :type="tag.type" :disable-transitions="false" :key="index" @close="closeTag(tag)">
                        {{ tag.name }}
                      </el-tag>
                    </div>
                    <div class="selected-condition" v-if="!(selectedConditionList && selectedConditionList.length)">
                      <span></span>
                    </div>
                    <div class="selected-condition reset" @click="resetParam">
                      <span>重置</span>
                    </div>
                  </div>
                </div>
                <div class="category">
                  <div class="category-title">发布时间：</div>
                  <div class="category-list-box condition-module">
                    <div class="time-select">
                      <el-date-picker
                          v-model="param.startTime"
                          type="datetimerange"
                          start-placeholder="选择开始时间"
                          end-placeholder="选择结束时间"
                          class="input-text"
                          :default-time="[new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)]"
                          size="default"
                          @change="changeTime"
                          format="YYYY-MM-DD HH:mm:ss"
                          value-format="YYYY-MM-DD HH:mm:ss"
                          style="width: 100%;"
                      ></el-date-picker>
                    </div>
                  </div>
                </div>
                <div class="category" style="z-index: 500;">
                  <div class="category-title">分类：</div>
                  <div class="category-list-box condition-module">
                    <el-cascader
                        style="width: 100%;"
                        v-model="selectCidList"
                        :props="{ checkStrictly: true }"
                        :options="categoryOptions"
                        @change="changeCategory">
                    </el-cascader>
                  </div>
                </div>
                <div class="category" style="z-index: 500;">
                  <div class="category-title">类别：</div>
                  <div class="category-list-box condition-module">
                    <el-cascader
                        style="width: 100%;"
                        v-model="selectResourceProductIdList"
                        :props="{ checkStrictly: true }"
                        :options="resourceProductOptions"
                        @change="changeResourceProduct">
                    </el-cascader>
                  </div>
                </div>
                <div class="category" style="z-index: 500;">
                  <div class="category-title">标签：</div>
                  <div class="category-list-box condition-module">
                    <el-cascader
                        style="width: 100%;"
                        v-model="selectResourceTagIdList"
                        :props="{ checkStrictly: true }"
                        :options="resourceTagOptions"
                        @change="changeResourceTag">
                    </el-cascader>
                  </div>
                </div>
                <div class="category">
                  <div class="category-title">格式：</div>
                  <div class="category-list-box condition-module">
                    <ul class="category-list">
                      <li class="item" :class="{'active': resType === ''}">
                        <a @click="changeType(0)">全部</a>
                      </li>
                      <li class="item" :class="{'active': resType === c.value}" :key="c.value" v-for="c in typeList">
                        <a @click="changeType(c.value)">{{c.label}}</a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

            </template>
            <template #footer>
              <div style="flex: auto">
                <el-button>关闭</el-button>
              </div>
            </template>
          </el-drawer>
        </div>
      </div>
    </div>
    <div class="content-box">
      <el-row :gutter="20" style="width: 100%;">
        <el-col :span="18">
          <div class="left-main-card">
            <div class="selected-condition-wrap">
              <div class="selected-condition-title">已选条件</div>
              <div class="selected-condition" v-if="selectedConditionList && selectedConditionList.length">
                <el-tag v-for="(tag, index) in selectedConditionList" class="mx-1" closable :type="tag.type" :key="index" :disable-transitions="false" @close="closeTag(tag)">
                  {{ tag.name }}
                </el-tag>
              </div>
              <div class="selected-condition" v-if="!(selectedConditionList && selectedConditionList.length)">
                <span style="margin-left: 10px;"></span>
              </div>
              <div class="selected-condition reset" @click="resetParam">
                <span>重置</span>
              </div>
            </div>
            <div class="list-filter-wrap" v-if="!listLoading">
              <div class="list-filter-item">
                <div class="filter-link" @click="toggleFilter('category')" :class="{'active': activeFilterName === 'category'}">
                  <span class="text">分类</span>
                  <el-icon><arrow-down /></el-icon>
                </div>
                <div class="layout" :class="{'hide': activeFilterName !== 'category'}">
                  <el-cascader
                      style="width: 100%;"
                      v-model="selectCidList"
                      :props="{ checkStrictly: true }"
                      :options="categoryOptions"
                      @change="changeCategory">
                  </el-cascader>
                </div>
              </div>
              <div class="list-filter-item">
                <div class="filter-link" @click="toggleFilter('product')" :class="{'active': activeFilterName === 'product'}">
                  <span class="text">类别</span>
                  <el-icon><arrow-down /></el-icon>
                </div>
                <div class="layout" :class="{'hide': activeFilterName !== 'product'}">
                  <el-cascader
                      style="width: 100%;"
                      v-model="selectResourceProductIdList"
                      :props="{ checkStrictly: true }"
                      :options="resourceProductOptions"
                      @change="changeResourceProduct">
                  </el-cascader>
                </div>
              </div>
              <div class="list-filter-item">
                <div class="filter-link" @click="toggleFilter('tag')" :class="{'active': activeFilterName === 'tag'}">
                  <span class="text">标签</span>
                  <el-icon><arrow-down /></el-icon>
                </div>
                <div class="layout" :class="{'hide': activeFilterName !== 'tag'}">
                  <el-cascader
                      style="width: 100%;"
                      v-model="selectResourceTagIdList"
                      :props="{ checkStrictly: true }"
                      :options="resourceTagOptions"
                      @change="changeResourceTag">
                  </el-cascader>
                </div>
              </div>
              <div class="list-filter-item">
                <el-dropdown trigger="click" @visible-change="(v) => v ? activeFilterName = 'type' : (activeFilterName === 'type' ? activeFilterName = '' : null)">
                  <div class="filter-link" :class="{'active': activeFilterName === 'type'}">
                    <span class="text">格式</span>
                    <el-icon><arrow-down /></el-icon>
                  </div>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="changeType(c.value)" :key="c.value" v-for="c in typeList">{{c.label}}</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <div class="list-filter-item">
                <div class="filter-link" @click="toggleFilter('time')" :class="{'active': activeFilterName === 'time'}">
                  <span class="text">发布时间</span>
                  <el-icon><arrow-down /></el-icon>
                </div>
                <div class="layout" :class="{'hide': activeFilterName !== 'time'}" style="width: 380px">
                  <el-date-picker
                      v-model="param.startTime"
                      type="datetimerange"
                      start-placeholder="选择开始时间"
                      end-placeholder="选择结束时间"
                      class="input-text"
                      :default-time="[new Date(2000, 0, 1, 0, 0, 0), new Date(2000, 0, 1, 23, 59, 59)]"
                      size="default"
                      @change="changeTime"
                      format="YYYY-MM-DD HH:mm:ss"
                      value-format="YYYY-MM-DD HH:mm:ss"
                      style="width: calc(100% - 20px);"
                  ></el-date-picker>
                </div>
              </div>
            </div>
            <div class="content-list" v-loading="listLoading">
              <resource-item :item-list="itemList"></resource-item>
              <page
                  v-if="itemList && itemList.length"
                  :size-change="handleSizeChange"
                  :current-change="handleCurrentChange"
                  :current-page="param.current"
                  :page-size="param.size"
                  :total="total"
                  class="page-bar">
              </page>
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="right-box" v-if="!listLoading">
            <div class="circle-info">
              <div class="board-info" v-if="member && member.id" style="display: none;">
                <el-image :src="member.avatar">
                  <template #error>
                    <div class="image-slot">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div class="circle-name">{{member.name}}</div>
                <div class="circle-introduction">{{member.signature}}</div>
              </div>
              <div class="count-bar">
                <div @click="showForm">
                  <svg width="40" height="40" viewBox="0 0 40 40" class="icon" fill="currentColor"><g fill="none" fill-rule="evenodd"><circle cx="20" cy="20" r="20" fill="#F4C807" opacity=".12"></circle><path d="M6 6h28v28H6z"></path><path fill="#F4C807" d="M20.406 11.772l-2.172 2.176h-2.29c-1.438 0-1.875.085-2.322.324-.33.176-.575.422-.751.752-.24.448-.324.886-.324 2.326v7.12c0 1.44.085 1.878.324 2.326.176.33.421.576.75.752.421.225.834.314 2.08.323l7.35.001c1.438 0 1.876-.084 2.323-.324.33-.176.575-.422.751-.752.24-.448.324-.886.324-2.326v-4.905l2.172-2.175v7.08c0 1.94-.202 2.643-.58 3.352a3.95 3.95 0 01-1.643 1.645c-.708.379-1.41.58-3.346.58h-7.108c-1.936 0-2.639-.201-3.347-.58a3.95 3.95 0 01-1.642-1.645c-.378-.71-.58-1.413-.58-3.352v-7.12c0-1.94.202-2.643.58-3.352a3.95 3.95 0 011.642-1.645c.708-.379 1.41-.58 3.347-.58h4.462zm6.908-2.053c.384.116.747.338 1.168.759l.188.189c.42.421.642.785.758 1.17a1.98 1.98 0 010 1.163c-.116.385-.337.749-.758 1.17l-6.9 6.911c-.62.622-.827.81-1.078 1.004-.251.193-.496.34-.784.47-.288.131-.553.226-1.392.48l-1.088.332a1.303 1.303 0 01-1.625-1.629l.33-1.09c.255-.84.35-1.104.48-1.393.13-.29.277-.534.47-.785.193-.252.381-.46 1.001-1.081l6.9-6.911c.42-.421.784-.643 1.168-.76a1.97 1.97 0 011.162 0zm-3.204 4.096l-4.797 4.805c-.547.548-.709.723-.852.91-.112.146-.19.276-.265.443-.097.214-.175.44-.4 1.182l-.094.31.31-.095c.74-.225.965-.303 1.179-.4.167-.076.297-.154.442-.266.187-.143.361-.305.909-.853l4.797-4.805-1.23-1.23zm2.546-2.43c-.109.033-.23.11-.443.324l-.874.875 1.228 1.231.875-.876c.213-.213.29-.334.323-.444a.24.24 0 000-.153c-.033-.11-.11-.23-.323-.445l-.189-.188c-.213-.214-.334-.291-.443-.325a.238.238 0 00-.154 0z" fill-rule="nonzero"></path></g></svg>
                  <span>上传内容</span>
                </div>
                <div @click="gotoMemberResource">
                  <svg width="40" height="40" viewBox="0 0 40 40" class="icon" fill="currentColor"><g fill="#06F" fill-rule="evenodd"><circle cx="20" cy="20" r="20" opacity=".12"></circle><path d="M23.487 10.463c1.896 0 2.583.193 3.277.555a3.824 3.824 0 011.607 1.573c.371.678.569 1.35.569 3.206v8.472c0 1.855-.198 2.527-.569 3.205a3.824 3.824 0 01-1.607 1.573c-.694.363-1.381.556-3.277.556h-6.96c-1.895 0-2.583-.193-3.276-.556a3.824 3.824 0 01-1.608-1.573c-.37-.678-.568-1.35-.568-3.205v-8.472c0-1.855.197-2.528.568-3.206.37-.678.915-1.21 1.608-1.573.693-.362 1.38-.556 3.277-.556h6.959zm0 2.08h-6.96c-1.407 0-1.836.081-2.273.31a1.72 1.72 0 00-.735.72c-.234.427-.317.847-.317 2.224v8.472c0 1.377.083 1.796.317 2.224.172.316.412.551.735.72.437.229.866.31 2.274.31h6.959c1.407 0 1.836-.081 2.274-.31a1.72 1.72 0 00.735-.72c.234-.428.317-.847.317-2.224v-8.472c0-1.377-.083-1.797-.317-2.225a1.72 1.72 0 00-.735-.72c-.438-.228-.867-.309-2.274-.309zm-1.991 9.778v1.873h-5.955V22.32h5.955zm2.977-3.328v1.872h-8.932v-1.872h8.932zm0-3.33v1.873h-8.932v-1.872h8.932z" fill-rule="nonzero"></path></g></svg>
                  <span>我的内容</span>
                </div>
              </div>
            </div>
            <div class="good-content">
              <right-module/>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script>
import {inject, ref, markRaw} from "vue"
import {getResourceRecommendList, getResourceType, getResourceLastSearchRecord, getResourceProductList, getResourceTagList} from "@/api/edu/web/resource"
import {findCategoryList, toTree} from "@/api/edu/web/resource/category"
import {getUser} from "@/util/userUtils";
import router from "@/router";
import Page from "@/components/Page/index";
import ResourceItem from "@/views/edu/web/resource/resourceItem";
import {getToken} from "@/util/tokenUtils";
import {ArrowDown, ArrowRight, Search} from '@/lib/lucide-fallback';
import RightModule from "@/views/edu/web/resource/right-module/index.vue"
import {success} from "@/util/tipsUtils";
export default {
  name: "ResourceList",
  computed: {
    Search() {
      return Search
    }
  },
  components: {
    ArrowDown,
    ResourceItem,
    Page,
    RightModule
  },
  setup() {
    const ArrowRightIcon = markRaw(ArrowRight)
    const p = {
      status: "published",
      cid: 0,
      current: 1,
      size: 20,
      type: "",
      createTimeBegin: null,
      createTimeEnd: null,
      keyword: "",
      selectCreateTime: "",
      orders: ["create_time desc"]
    };
    const param = ref(p);
    const resetParam = function () {
      param.value = p;
      success("重置成功")
      load()
    }
    // eslint-disable-next-line no-unused-vars
    const loadLastSearchRecord = function () {
      getResourceLastSearchRecord((res) => {
        if (res && res.searchCondition) {
          param.value = JSON.parse(res.searchCondition)
          param.value.current = 1;
        }
        load()
      })
    }
    const selectedConditionList = ref([])
    const showLoginFlag = inject("showLogin")
    const showListBox = ref(true)
    const categoryList = ref([])
    const categoryIdList = ref([])
    const parentIdMap = ref({})
    const tagIdMap = ref({})
    const productIdMap = ref({})
    const itemList = ref([])
    const pid = ref(0)
    const cid = ref(0)
    const activeFilterName = ref("") // 当前激活的筛选项名称
    const toggleFilter = (name) => {
      activeFilterName.value = activeFilterName.value === name ? "" : name
    }
    const paramView = ref({
      keyword: "关键词",
      cid: "目录",
      type: "格式",
      selectCreateTime: "发布时间",
      resourceProductId: "类别",
      resourceTagIdList: "标签"
    })
    const typeNameJson = {
      "word": "WORD文档",
      "excel": "EXCEL表格",
      "ppt": "PPPT幻灯片",
      "pdf": "PDF文档",
      "image": "图片",
      "txt": "TXT文本",
      "file": "文件",
      "other": "其他"
    }

    // 已选条件
    const setSelectedConditionList = function() {
      const nl = [];
      for (const p in paramView.value) {
        let v = param.value[p]
        if (v) {
          if (p === 'cid') {
            v = parentIdMap.value[v]
          }
          if (p === 'type') {
            v = typeNameJson[v]
          }
          if (p === 'resourceProductId') {
            v = productIdMap.value[v]
          }
          if (p === 'resourceTagIdList') {
            v = tagIdMap.value[v]
          }
          if (v) {
            nl.push({ name: paramView.value[p] + ": " + v, key: p })
          }
        }
      }
      selectedConditionList.value = nl
    }

    const categoryToMap = function (list) {
      for (const c of list) {
        parentIdMap.value[c.value] = c.label
        if (c.children && c.children.length) {
          categoryToMap(c.children)
        }
      }
    }
    // 分类
    const categoryOptions = ref()
    const selectCidList = ref([])
    findCategoryList( 0, true, res => {
      categoryOptions.value = toTree(res);
      categoryToMap(categoryOptions.value)
    })
    // 选择分类
    const changeCategory = (val) => {
      if (val && val.length) {
        param.value.cid = val[val.length - 1]
      }
      load()
    }

    // 选择时间
     const changeTime = function(val) {
       activeFilterName.value = "" // 选择后自动关闭
       if (val && val.length > 0) {
         param.value.createTimeBegin = val[0]
         param.value.createTimeEnd = val[1]
         param.value.selectCreateTime = val[0] + " " + val[1]
       }
       load()
     }

    const highSearchDrawerModel = ref(false)
    const total = ref(0)
    const listLoading = ref(true)
    const load = function() {
      activeFilterName.value = "" // 加载时关闭所有展开项
      setSelectedConditionList()
      listLoading.value = true
      
      // 处理响应数据的公共函数
      const handleResponse = (res) => {
        itemList.value = (res && res.list) || []
        total.value = (res && res.total) != null ? res.total : (res && res.list ? res.list.length : 0)
        const keywords = (res && res.keywords) || []
        for (const item of itemList.value) {
          // 格式化关键词
          if (keywords && keywords.length) {
            let subFlag = true;
            for (let i = 0; i < keywords.length; i++) {
              const k = keywords[i];
              if (!k) continue;
              item.title = item.title.replaceAll(k, "<span style='color: red;'>" + k + "</span>")
              const subIndex = item.introduction.indexOf(k)
              if (subIndex > -1 && subFlag) {
                subFlag = false;
                const firstLength = item.introduction.substring(0, subIndex).length
                if (firstLength > 10) {
                  item.introduction = "..." + item.introduction.substring(subIndex - 4, item.introduction.length)
                }
              }
              item.introduction = item.introduction.replaceAll(k, "<span style='color: red;'>" + k + "</span>")
            }
          }
        }
        listLoading.value = false
      }
      
      // 直接使用公开 API 加载数据（与右侧"最新知识"模块一致）
      // 注意：后端 API 收到 cid=0 会返回空数据，所以 cid=0 时不传该参数
      const apiParams = { 
        size: param.value.size, 
        current: param.value.current
      }
      // 只有 cid > 0 时才传递 cid 参数
      if (param.value.cid && param.value.cid > 0) {
        apiParams.cid = param.value.cid
      }
      // type 和 keyword 可以正常传递
      if (param.value.type) {
        apiParams.type = param.value.type
      }
      if (param.value.keyword) {
        apiParams.keyword = param.value.keyword
      }
      getResourceRecommendList(apiParams, handleResponse).catch(() => {
        listLoading.value = false
      })
    }
    // 直接加载
    load();
    const handleSizeChange = function(val) {
      param.value.size = val;
      load();
    }
    const handleCurrentChange = function(val) {
      param.value.current = val;
      load();
    }
    const member = ref(null)
    member.value = getUser();
    const gotoDetail = (item) => {
      router.push({path: "/edu/resource/detail", query: {id: item.id}})
    }
    const gotoMemberResource = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      router.push({path: "/edu/member/resource"})
    }
    const resType = ref("")
    const typeList = ref([])
    getResourceType({}, res => {
      for (const re of res) {
        typeList.value.push({label: typeNameJson[re] || "文件", value: re})
      }
    })
    const changeType = function(type) {
      if (type) {
        param.value.type = type
      } else {
        param.value.type = null
      }
      resType.value = type
      load()
    }
    const dialogVisible = ref(false)
    const showForm = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      router.push({path: "/edu/resource/edit"})
    }
    const cancelForm = () => {
      dialogVisible.value = false
      selectResourceProductIdList.value = []
      selectResourceTagIdList.value = []
      selectCidList.value = []
    }
    const submitCallback = () => {
      if (!getToken()) {
        showLoginFlag.value = true
        return;
      }
      cancelForm()
      load()
    }
    const showHighSearchDrawerModel = function () {
      highSearchDrawerModel.value = true;
    }
    const searchInputChange = function (val) {
      param.value.keyword = val;
    }
    const search = function () {
      load()
    }
    const closeTag = function (val) {
      if (val.key === 'selectCreateTime') {
        param.value.createTimeBegin = null
        param.value.createTimeEnd = null
      }
      if (val.key === 'resourceProductId') {
        selectResourceProductIdList.value = []
      }
      if (val.key === 'resourceTagIdList') {
        selectResourceTagIdList.value = []
      }
      if (val.key === 'cid') {
        selectCidList.value = []
      }
      param.value[val.key] = null
      load()
    }
    // 产品
    const selectResourceProductIdList = ref([])
    const resourceProductOptions = ref([])
    const loadResourceProductList = function () {
      getResourceProductList({}, res => {
        if (res && res.length) {
          const reList = []
          for (const re of res) {
            const obj = { value: re.id, label: re.name }
            reList.push(obj);
            productIdMap.value[re.id] = re.name
          }
          resourceProductOptions.value = reList
          setSelectedConditionList();
        }
      })
    }
    loadResourceProductList();
    const changeResourceProduct = (val) => {
      if (val && val.length) {
        param.value.resourceProductId = val[val.length - 1]
      }
      load()
    }
    // 标签
    const selectResourceTagIdList = ref([])
    const resourceTagOptions = ref([])
    const loadResourceTagList = function () {
      getResourceTagList({}, res => {
        if (res && res.length) {
          const reList = []
          for (const re of res) {
            const obj = { value: re.id, label: re.name }
            reList.push(obj);
            tagIdMap.value[re.id] = re.name
          }
          resourceTagOptions.value = reList
          setSelectedConditionList();
        }
      })
    }
    loadResourceTagList();
    const changeResourceTag = (val) => {
      if (val && val.length) {
        param.value.resourceTagIdList = [val[val.length - 1]]
      }
      load()
    }
    return {
      ArrowRight: ArrowRightIcon,
      selectResourceTagIdList,
      resourceTagOptions,
      changeResourceTag,
      selectResourceProductIdList,
      changeResourceProduct,
      resourceProductOptions,
      search,
      searchInputChange,
      showListBox,
      categoryList,
      categoryIdList,
      parentIdMap,
      itemList,
      pid,
      cid,
      param,
      total,
      changeCategory,
      handleSizeChange,
      handleCurrentChange,
      member,
      gotoDetail,
      listLoading,
      gotoMemberResource,
      resType,
      typeList,
      changeType,
      showForm,
      cancelForm,
      submitCallback,
      dialogVisible,
      highSearchDrawerModel,
      showHighSearchDrawerModel,
      selectCidList,
      categoryOptions,
      selectedConditionList,
      changeTime,
      closeTag,
      resetParam,
      activeFilterName,
      toggleFilter
    }
  }
}
</script>

<style lang="scss" scoped>
.search-wrap {
  margin: 60px auto;
  .search-main {
    .search-input {
      display: flex;
      justify-content: center;
      line-height: 40px;
      .search-input-logo {
        margin-right: 10px;
      }
      .search-input-main {
        min-width: 50%;
        :deep(.el-input-group__append) {
          margin-left: 8px;
          border: 1px solid #dcdfe6;
          border-radius: 6px;
          background-color: #fff;
          box-shadow: none;
          padding: 0 32px;
          height: 40px;
          line-height: 40px;
          box-sizing: border-box;
          transition: all 0.2s;
          .el-button {
            height: 100%;
            padding: 0;
            border: none;
            background: transparent;
          }
          &:hover {
            border-color: #409eff;
            color: #409eff;
          }
        }
      }
      .search-input-high {
        margin-left: 10px;
        color: #999999;
        cursor: pointer;
      }
    }
  }
}
.content-list-container {
  padding-top: 20px;
  margin: 0 10px 20px; // 底部外边距 20px
  display: block;
  overflow: hidden; // 触发 BFC，防止边距折叠
  
  :deep(.el-empty) {
    margin: 0 0 10px 0;
  }
  .content-box {
    display: flex;
    align-items: flex-start;
    margin-bottom: 20px;
  }
  .content-list {
    display: inline-block;
    width: 100%;
    .page-bar {
      margin-bottom: 28px;
    }
  }
  .list-filter-wrap {
    display: flex;
    align-items: center;
    height: 40px;
    .list-filter-item {
      margin-right: 24px;
      position: relative;
      display: flex;
      align-items: center;
      .layout {
        position: absolute;
        width: 200px;
        z-index: 999;
        padding: 10px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        top: 100%;
        margin-top: 10px;
        &::before {
          position: absolute;
          width: 10px;
          height: 10px;
          z-index: 9999;
          content: " ";
          transform: rotate(45deg);
          box-sizing: border-box;
          margin: -16px auto;
          left: 20px;
          border: 1px solid #e5e7eb;
          background: #fff;
          border-right: 0;
          border-bottom: 0;
        }
        &.hide {
          display: none;
        }
      }
      .filter-link {
        cursor: pointer;
        display: flex;
        align-items: center;
        white-space: nowrap;
        color: #606266;
        font-size: 14px;
        height: 100%;
        .text {
          line-height: 1;
        }
        .el-icon {
          margin-left: 4px;
          font-size: 12px;
          transition: transform 0.3s;
        }
        &.active {
          color: $primary-color;
          .el-icon {
            transform: rotate(180deg);
          }
        }
        &:hover {
          color: $primary-color;
        }
        &:focus-visible {
          outline: none;
        }
      }
    }
  }
  .left-main-card {
    background: #fff;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 20px;
    margin-bottom: 20px;
    min-height: 600px; // 确保有最小高度
  }
  .right-box {
    border-radius: 6px;
    width : 100%;
    display: inline-block;
    margin-bottom: 20px;
    .circle-info {
      background: #fff;
      margin-bottom: 10px;
      width: 100%;
      border-radius: 6px;
      .board-info {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        width: 100%;
        position: relative;
        overflow: hidden;
        padding: 15px 20px;
        box-sizing: border-box;
        border-bottom: 1px solid #f7f7f7;
        .el-image {
          font-size: 86px;
          width: 86px;
          height: 86px;
          border-radius: 18px;
          overflow: hidden;
          display: flex;
          position: relative;
          align-items: center;
          justify-content: center;
          object-fit: cover;
          margin: 10px 30px 15px;
          img {
            height: 100%;
            width: 100%;
          }
        }
        .circle-name {
          width: 100%;
          text-align: center;
          font-size: 18px;
          font-weight: 700;
          z-index: 1;
          padding: 0 20px;
        }
        .circle-introduction {
          font-size: 15px;
          margin: 10px 0;
          color: rgba(0,0,0,.45);
        }
        .el-button {
          display: block;
          margin: 10px auto 0;
          width: 120px;
          height: 40px;
          border-radius: 20px;
          font-size: 16px;
          color: #fff;
          text-align: center;
          border: none;
          text-shadow: unset;
          box-shadow: unset;
        }
      }
      .count-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        border: 1px solid #f0f0f0;
        border-radius: 6px;
        div {
          cursor: pointer;
          padding-top: 3px;
          text-align: center;
          width: 45%;
          font-size: 24px;
          color: rgba(0,0,0,.8);
          line-high: 20px;
          span {
            margin-top: 7px;
            font-size: 14px;
            color: rgba(0,0,0,.5);
            display: block;
          }
          &:hover {
            color: var(--el-color-primary);
            span {
              color: var(--el-color-primary);
            }
          }
        }
      }
    }
    .good-content {
      padding-top: 0;
    }
  }
}
.content-filter {
  margin-bottom: 20px;
  border-radius: 6px;
  .category {
    position: relative;
    height: auto;
    padding: 10px;
    background-color: #fff;
    z-index: 300;
    .category {
      margin-right: 6px;
      font-weight: 700;
    }
    .category-list-box {
      width: calc(100%);
      line-high: 34px;
      height: auto;
      overflow: hidden;
      background-color: #fff;
      transition: all .2s;
      display: flex;
      top: 0;
      right: 0;
      z-index: 300;
      .time-select {
        width: calc(100% - 20px);
      }
      .category-list {
        list-style: none;
        width: 0;
        flex: 1;
        border: 1px solid #ffffff;
        .item {
          float: left;
          padding: 0 8px;
          margin: 10px 2px;
          border-radius: 6px;
        }
        .active {
          background: var(--el-color-primary);
          color: #FFFFFF;
        }
        .item:hover {
          color: var(--el-color-primary);
        }
        .item.active:hover {
          background: var(--el-color-primary);
          color: #FFFFFF;
        }
        .item:first-child {
          margin-left: 0;
        }
      }
    }
  }
  .category:hover {
    .category-list-box {
      height: auto;
    }
  }
}
.condition-module {
  margin: 10px 0;
}
.selected-condition-wrap {
  width: 100%;
  margin: 0 0 20px 0;
  .selected-condition-title {
    display: inline-block;
  }
  .selected-condition {
    display: inline-block;
  }
  .mx-1 {
    margin: 10px 5px;
  }
  .reset {
    margin-left: 10px;
    cursor: pointer;
    color: var(--el-color-primary);
    &:hover {
      font-weight: 700;
    }
  }
}

</style>
