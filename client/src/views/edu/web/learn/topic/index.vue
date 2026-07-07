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
      <div class="category" v-if="subCategoryList && subCategoryList.length">
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
      <div class="topic-item" v-else v-for="item in itemList" :key="item.id">
        <router-link :to="{path: '/edu/learn/topic/detail', query: {id: item.id}}" class="inner clearfix2">
          <div class="path-mes">
            <h5 :title="item.title">{{item.title}}</h5>
            <div class="del">总价格<span><b>￥{{formatFloat(item.originalPrice)}}</b></span></div>
            <div class="save clearfix2"><span>节省</span>￥{{formatFloat(item.price - item.originalPrice)}}</div>
            <div class="price">套餐价：<b>￥{{formatFloat(item.price)}}</b></div>
            <div class="buy">进入专题</div>
            <div class="hidebank">
              <h6>简介：</h6>
              <div class="desc" v-html="item.description"></div>
            </div>
          </div>
          <div class="path-detail">
            <h5><span>含{{item.lessonList.length}}门课程</span><span>已有{{item.learnNum || 0}}人学</span></h5>
            <div class="plistbox">
              <div class="list" v-for="lesson in item.lessonList" :key="lesson.id">
                <div class="pic">
                  <img :src="lesson.image" alt="" height="104">
                </div>
                <div class="tit">{{lesson.name}}</div>
                <!--                <p class="num  clearfix2"><span class="fl"><b>20</b>课时</span><em></em><span class="fl">讲师</span></p>-->
                <div class="price">单价：￥{{formatFloat(lesson.price)}}<span class="fr"></span></div>
              </div>
              <div class="total">更多<br>{{item.lessonList.length}}<br>门课程</div>
            </div>
          </div>
        </router-link>
      </div>
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
  import {findCategoryList, getTopicList} from "@/api/edu/web/learn/topic"
  import {toTree} from "@/api/edu/web/learn/category"
  import {useRoute} from "vue-router";
  import Page from "@/components/Page/index";
  import LearnNavMenu from "@/views/edu/web/learn/navMenu";
  export default {
    name: "learnTopicList",
    components: {
      LearnNavMenu,
      Page,
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
        getTopicList(param.value, res => {
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
      const formatFloat = function(value) {
        if (!value) {
          value = 0;
        }
        return parseFloat(value).toFixed(2);
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
        handleCurrentChange,
        formatFloat
      }
    }
  }
</script>

<style lang="scss" scoped>
  .content-list-container {
    padding-top: 50px;
    margin: 0 10px;
    .content-filter {
      margin-bottom: 20px;
      .category {
        position: relative;
        line-height: 34px;
        padding: 10px;
        background-color: #fff;
        z-index: 300;
        .label {
          width: 90px;
          margin-right: 6px;
          font-weight: 700;
        }
        .category-list-box {
          position: absolute;
          width: 100%;
          line-height: 34px;
          height: 52px;
          overflow: hidden;
          background-color: #fff;
          transition: all .2s;
          display: flex;
          top: 0;
          right: 0;
          z-index: 300;
          .category-list {
            list-style: none;
            width: 0;
            flex: 1;
            border: 1px solid #ffffff;
            .item {
              float: left;
              padding: 0 8px;
              margin: 10px;
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
          }
        }
      }
      .category:hover {
        .category-list-box {
          height: auto;
        }
        .category-list {
          border: 1px solid #f0f0f0;
        }
      }
    }
    .content-list {
      background-color: #FFFFFF;
      min-height: 768px;
      border-radius: 6px;
      .topic-item {
        border-radius: 8px;
        box-sizing: border-box;
        padding: 20px 0;
        background: url("@/assets/edu/pathbg.jpg") repeat-y left top;
        background-size: 926px 1px;
        height: 297px;
        cursor: pointer;
        position: relative;
        margin: 0 10px 20px;
        border: 1px #f1f1f1 solid;
        &:hover {
          box-shadow: 0 8px 14px 0 rgb(7 17 27 / 5%);
        }
        .clearfix2 {
          &:after {
            content: '\0020';
            display: block;
            height: 0;
            font-size: 0;
            line-height: 0;
            clear: both;
            overflow: hidden;
          }
        }
        .inner {
          display: block;
          height: 257px;
          .path-mes {
            width: 220px;
            float: left;
            padding: 0 20px;
            box-sizing: border-box;
            position: relative;
            h5 {
              color: #5a6476;
              margin-bottom: 10px;
              height: 56px;
              overflow: hidden;
              font-size: 16px;
              line-height: 30px;
            }
            .del {
              color: #919598;
              margin-bottom: 10px;
              text-decoration: line-through;
            }
            .price {
              color: var(--el-color-primary);
              margin-bottom: 20px;
              font-size: 18px;
              margin-top: 10px;
            }
            .buy {
              width: 85px;
              height: 30px;
              line-height: 30px;
              text-align: center;
              border-radius: 6px;
              color: var(--el-color-primary);
              background: #dbecfb;
            }
            .save {
              display: inline-block;
              height: 23px;
              line-height: 24px;
              background: #fff;
              border-radius: 6px;
              font-weight: bold;
              padding-right: 8px;
              box-shadow: 0 0 10px #ccc;
              font-size: 18px;
              overflow: hidden;
              color: #e31436;
              margin-bottom: 10px;
              margin-top: 10px;
              width: 168px;
              span {
                height: 23px;
                line-height: 24px;
                float: left;
                width: 40px;
                text-align: center;
                color: #fff;
                font-size: 12px;
                background: #e31336;
                font-weight: normal;
                margin-right: 8px;
              }
            }
            .desc {
              max-height: 237px;
              overflow-y: auto;
            }
            .hidebank {
              position: absolute;
              left: 213px;
              top: -20px;
              z-index: 99;
              width: 518px;
              height: 297px;
              background-size: 518px 1px;
              background: #fff;
              box-shadow: 3px 0px 3px rgb(204 204 204 / 50%);
              border-radius: 0 4px 4px 0;
              box-sizing: border-box;
              padding: 20px 30px 20px 40px;
              color: #6d7483;
              display: none;
              h6 {
                font-size: 16px;
                font-weight: bold;
                color: #11233f;
              }
              p {
                margin-bottom: 15px;
                max-height: 72px;
                overflow: hidden;
              }
              ul {
                list-style: none;
                li {
                  height: 39px;
                  line-height: 39px;
                  padding: 0 10px;
                  border-radius: 3px;
                  margin-bottom: 10px;
                  background: #f7f8f8;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                }
              }
            }
            &:hover {
              .hidebank {
                display: block;
              }
            }
          }
          .path-detail {
            width: calc(100% - 220px);
            float: left;
            padding: 0 30px 0 40px;
            box-sizing: border-box;
            position: relative;
            h5 {
              color: #5a6476;
              span {
                color: #9399a5;
                font-size: 12px;
                font-weight: normal;
                padding-right: 12px;
              }
            }
            .plistbox {
              position: relative;
              margin-top: 15px;
              .list {
                width: calc(20% - 26px);
                float: left;
                margin-right: 20px;
                .pic {
                  width: 100%;
                  height: 105px;
                  background: #ccc;
                  overflow: hidden;
                  border-radius: 5px;
                  position: relative;
                  img {
                    width: 100%;
                  }
                }
                .tit {
                  margin: 10px 0 5px 0;
                  height: 40px;
                  line-height: 21px;
                  overflow: hidden;
                  color: #414f65;
                }
                .num {
                  color: #838b98;
                  font-size: 12px;
                  margin-bottom: 5px;
                }
                .fl, .Left {
                  float: left;
                }
                .fr, .Right {
                  float: right;
                }
                em {
                  font-style: normal;
                  margin: 5px 8px 0;
                  float: left;
                  width: 1px;
                  height: 10px;
                  background: #cfd2d9;
                }
                .price {
                  color: #838b98;
                  font-size: 12px;
                }
              }
              .total {
                width: 30px;
                height: 184px;
                border-radius: 5px;
                display: table-cell;
                vertical-align: middle;
                position: absolute;
                right: 0;
                top: 0;
                padding: 0 5px;
                box-sizing: border-box;
                text-align: center;
                line-height: 18px;
                padding-top: 38px;
                font-size: 12.5px;
                color: #888c98;
                background: #f6f7f9;
                background-size: 6px 9px;
                &:hover {
                  color: #697384;
                }
              }
            }
          }
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
  body{
    background-color: #fafafa;
  }
</style>
