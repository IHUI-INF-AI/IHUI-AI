<template>
  <div>
    <div class="container">
      <div class="header">
        <el-form :inline="true" :model="params" class="demo-form-inline">
          <el-form-item label="">
            <el-input size="small" class="search-input" v-model="params.keyword" placeholder="请输入关键字"></el-input>
            <el-button size="small" class="search-btn" type="primary" @click="search">搜索</el-button>
          </el-form-item>
          <el-form-item label="题型" class="status">
            <el-select size="small" v-model="params.type" @change="search">
              <el-option label="全部" value=""></el-option>
              <el-option :label="key" :value="value" v-for="(key, value) in questionTypeMap" :key="value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="状态" class="status">
            <el-select size="small" v-model="params.status" @change="search">
              <el-option label="全部" value=""></el-option>
              <el-option :label="key" :value="value" v-for="(key, value) in statusMap" :key="value"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="分类" v-if="!isComponent">
            <el-cascader size="small" v-model="selectCidList" :options="categoryOptions" :props="{ checkStrictly: true }" @change="search" clearable></el-cascader>
          </el-form-item>
        </el-form>
      </div>
      <div class="content">
        <el-table ref="multipleTable" @selection-change="selectItem" :data="list" style="width: 100%;" @expand-change="expandChange">
          <el-table-column v-if="isComponent" type="selection" width="30"></el-table-column>
          <el-table-column type="expand">
            <template #default="scope">
              <el-card class="box-card">
                <template #header>
                  <div class="clearfix">
                    <span>基础信息</span>
                  </div>
                </template>
                <div class="table-wrapper">
                  <table class="fl-table" style="width: 100%;">
                    <tr><td>题干：</td><td>{{scope.row.title}}</td></tr>
                    <tr><td width="120">创建时间：</td><td>{{scope.row.createTime}}</td></tr>
                    <tr><td>题干描述：</td><td>{{scope.row.note}}</td></tr>
                  </table>
                </div>
              </el-card>
              <el-card style="margin-top: 20px;" v-if="scope.row.type !== 'subjective' && scope.row.type !== 'fill_blank'">
                <template #header>
                  <div class="clearfix">
                    <span>选项</span>
                  </div>
                </template>
                <div class="fl-table">
                  <el-table :data="JSON.parse(scope.row.options)" v-if="scope.row.options" :show-header="false" style="width: 100%;">
                    <el-table-column width="40px" label="序号">
                      <template #default="scope">
                        {{scope.row.key + "."}}
                      </template>
                    </el-table-column>
                    <el-table-column prop="value" label="内容"></el-table-column>
                  </el-table>
                </div>
              </el-card>
              <el-card style="margin-top: 20px;">
                <template #header>
                  <div class="clearfix">
                    <span>答案</span>
                  </div>
                </template>
                <div class="table-wrapper">
                  <table class="fl-table" style="width: 100%;">
                    <tbody>
                      <tr>
                        <td width="120">参考答案：</td>
                        <td v-if="scope.row.type === 'fill_blank'">
                          <div v-for="(item, index) in scope.row.referenceAnswer.split('[_]')" :key="item" style="line-height: 40px;">
                            <span style="color: #999999;">填空 {{index + 1}} ：</span>
                            {{item}}</div>
                        </td>
                        <td v-else>{{scope.row.referenceAnswer}}</td>
                      </tr>
                      <tr><td>答案解析：</td><td>{{scope.row.referenceAnswerNote}}</td></tr>
                    </tbody>
                  </table>
                </div>
              </el-card>
            </template>
          </el-table-column>
          <el-table-column prop="id" label="ID" width="50"></el-table-column>
          <el-table-column label="题型" width="80">
            <template #default="scope">
              {{questionTypeMap[scope.row.type]}}
            </template>
          </el-table-column>
          <el-table-column prop="title" label="题干"></el-table-column>
          <el-table-column prop="score" label="分数" width="80"></el-table-column>
          <el-table-column prop="difficulty" label="难度" width="140">
            <template #default="scope">
              <el-rate :disabled="true" v-model="scope.row.difficulty" :colors="colors"></el-rate>
            </template>
          </el-table-column>
          <el-table-column prop="difficulty" label="状态" width="80">
            <template #default="scope">
              {{statusMap[scope.row.status]}}
            </template>
          </el-table-column>
          <el-table-column label="操作" v-if="!isComponent" width="100">
            <template #default="scope">
              <el-button class="right-btn" link @click="edit(scope.row)" size="small">编辑</el-button>
              <el-button class="right-btn" link @click="remove(scope.row.id)" size="small">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <page :total="total" :page-size="params.size" :current-change="pageChange" :size-change="sizeChange"></page>
    </div>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <el-button @click="hideComponent">取 消</el-button>
        <el-button type="primary" @click="selectionChangeCallback(commodityIdList)">确 定</el-button>
      </div>
    </template>
  </div>
</template>

<script>
// @ts-nocheck
import {ref} from "vue"
import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = examApi
const { findList, delQuestion } = examApi
import Page from "@/components/Page/index.vue"
import {confirm, success} from "@/util/tipsUtils";
import router from "@/router";

export default {
  name: "questionLib",
  components: {
    Page
  },
  props: {
    isComponent: {
      type: Boolean,
      default: false
    },
    selectionChangeCallback: {
      type: Function,
      default: (a) => {
      }
    },
    componentCid: {
      type: Number,
      default: 0
    },
    hideComponent: {
      type: Function,
      default: () => {
      }
    }
  },
  setup(props) {
    const selectCidList = ref([])
    const commodityIdList = ref([])
    const categoryOptions = ref([])
    const list = ref([])
    const total = ref(0)
    const params = ref({
      keyword: "",
      cid: "",
      type: "",
      size: 20,
      current: 1,
      neqStatusList: ["deleted"]
    })
    const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
    const questionTypeMap = {
      "single_choice": "单选题",
      "multi_choice": "多选题",
      "judgment": "判断题",
      "fill_blank": "填空题",
      "subjective": "简答题",
    }
    const statusMap = {
      "draft": "草稿",
      "published": "已发布",
      "deleted": "已删除"
    }
    // 加载分类
    const loadCategory = () => {
      findCategoryList(0, true, (res) => {
        if (res) {
          categoryOptions.value = toTree(res);
        }
      })
    }
    loadCategory()
    // 加载列表
    const loadList = () => {
      if (props.isComponent) {
        params.value.cid = props.componentCid;
      }
      findList(params.value, (res) => {
        if (!res) {return;}
        list.value = res.list;
        total.value = res.total;
      })
    }
    loadList()
    // 搜索
    const search = () => {
      if (selectCidList.value && selectCidList.value.length) {
        params.value.cid = selectCidList.value[selectCidList.value.length - 1];
      }
      loadList();
    }
    // 编辑
    const edit = (item) => {
      router.push({path: "/admin/edu/exam/question-lib/" + item.type.replace("_", "-"), query: { id : item.id }})
    }
    const remove = (id) => {
      confirm("确认删除试题?", "提示", () => {
        delQuestion(id, () => {
          success("删除成功")
          loadList()
        })
      })
    }
    const pageChange = (c) => {
      params.value.current = c;
      loadList();
    }
    const sizeChange =function(size){
      params.value.size = size;
      loadList();
    }
    const expandChange = (row, expandedRows) => {
      // 展开
      if(expandedRows.length>0) {
      }
    }
    // 选择列表项
    const selectItem = (val) => {
      commodityIdList.value = [];
      if (val && val.length > 0) {
        for (const valElement of val) {
          commodityIdList.value.push(valElement.id);
        }
      }
    }
    return {
      colors,
      questionTypeMap,
      statusMap,
      selectCidList,
      commodityIdList,
      categoryOptions,
      list,
      total,
      params,
      search,
      selectItem,
      edit,
      remove,
      pageChange,
      sizeChange,
      expandChange
    }
  }
};
</script>

<style  scoped lang="scss">
  .container {
    margin: 20px;
  }
  .image {
    height: 60px;
    display: inline-block;
  }
  .right-btn{
    margin: 5px 10px 5px 0;
  }
  .search-input {
    width: 242px;
  }
  :deep(.el-table-column--selection .cell){
    padding-left: 14px;
    padding-right: 14px;
  }
  :deep(.el-table tbody tr:hover > td){
    background-color: transparent;
  }
  .fl-table {
    tr:last-child, :deep(tr:last-child){
      td {
        border: 0;
      }
    }
  }
  .dialog-footer {
    text-align: center;
    margin-top: 40px;
  }
</style>
