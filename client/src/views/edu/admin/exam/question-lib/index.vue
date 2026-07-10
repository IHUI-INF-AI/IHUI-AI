<template>
  <div>
    <div class="container">
      <div class="header">
        <form class="demo-form-inline flex flex-wrap items-end gap-4" @submit.prevent>
          <div class="mb-4">
            <Input size="small" class="search-input" v-model="params.keyword" placeholder="请输入关键字"></Input>
            <Button size="sm" className="search-btn" variant="default" @click="search">搜索</Button>
          </div>
          <div class="mb-4 status">
            <label class="mb-1 block text-sm font-medium text-foreground">题型</label>
            <div>
              <Select size="small" v-model="params.type" @change="search">
                <SelectOption label="全部" value=""></SelectOption>
                <SelectOption :label="key" :value="value" v-for="(key, value) in questionTypeMap" :key="value"></SelectOption>
              </Select>
            </div>
          </div>
          <div class="mb-4 status">
            <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
            <div>
              <Select size="small" v-model="params.status" @change="search">
                <SelectOption label="全部" value=""></SelectOption>
                <SelectOption :label="key" :value="value" v-for="(key, value) in statusMap" :key="value"></SelectOption>
              </Select>
            </div>
          </div>
          <div class="mb-4" v-if="!isComponent">
            <label class="mb-1 block text-sm font-medium text-foreground">分类</label>
            <div>
              <Select size="small" v-model="selectedCid" @change="search" clearable>
                <SelectOption v-for="item in flatCategoryOptions" :key="item.value" :label="item.label" :value="item.value" />
              </Select>
            </div>
          </div>
        </form>
      </div>
      <div class="content">
        <Table class="w-full">
          <TableHeader>
            <TableRow>
              <TableHead v-if="isComponent" class="w-[30px]"><input type="checkbox" :checked="allSelected" @change="toggleAll($event)" /></TableHead>
              <TableHead></TableHead>
              <TableHead class="w-[50px]">ID</TableHead>
              <TableHead class="w-[80px]">题型</TableHead>
              <TableHead>题干</TableHead>
              <TableHead class="w-[80px]">分数</TableHead>
              <TableHead class="w-[140px]">难度</TableHead>
              <TableHead class="w-[80px]">状态</TableHead>
              <TableHead v-if="!isComponent" class="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="(row, index) in list" :key="row.id ?? index">
              <TableRow>
                <TableCell v-if="isComponent" class="w-[30px]"><input type="checkbox" :checked="selectedRows.includes(row)" @change="toggleRow(row)" /></TableCell>
                <TableCell>
                  <button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button>
                </TableCell>
                <TableCell>{{ row.id }}</TableCell>
                <TableCell>{{ questionTypeMap[row.type] }}</TableCell>
                <TableCell>{{ row.title }}</TableCell>
                <TableCell>{{ row.score }}</TableCell>
                <TableCell><div class="flex gap-1">
                  <svg v-for="i in 5" :key="i" :class="['h-4 w-4', i <= row.difficulty ? 'text-yellow-400' : 'text-muted-foreground']" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.783 1.401 8.168L12 18.896l-7.335 3.865 1.401-8.168L.132 9.21l8.2-1.192z"/></svg>
                </div></TableCell>
                <TableCell>{{ statusMap[row.status] }}</TableCell>
                <TableCell v-if="!isComponent">
                  <Button className="right-btn" variant="link" @click="edit(row)" size="sm">编辑</Button>
                  <Button className="right-btn" variant="link" @click="remove(row.id)" size="sm">删除</Button>
                </TableCell>
              </TableRow>
              <tr v-if="expandedRows.has(index)">
                <td colspan="99">
                  <Card class="box-card">
                    <CardHeader>
                      <div class="clearfix">
                        <span>基础信息</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="table-wrapper">
                      <table class="fl-table" style="width: 100%;">
                        <tr><td>题干：</td><td>{{row.title}}</td></tr>
                        <tr><td width="120">创建时间：</td><td>{{row.createTime}}</td></tr>
                        <tr><td>题干描述：</td><td>{{row.note}}</td></tr>
                      </table>
                    </div>
                  </CardContent>
                  </Card>
                  <Card style="margin-top: 20px;" v-if="row.type !== 'subjective' && row.type !== 'fill_blank'">
                    <CardHeader>
                      <div class="clearfix">
                        <span>选项</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="fl-table">
                      <Table class="w-full" v-if="row.options">
                        <TableBody>
                          <TableRow v-for="(opt, oIndex) in JSON.parse(row.options)" :key="opt.key ?? oIndex">
                            <TableCell class="w-[40px]">{{ opt.key + "." }}</TableCell>
                            <TableCell>{{ opt.value }}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                  </Card>
                  <Card style="margin-top: 20px;">
                    <CardHeader>
                      <div class="clearfix">
                        <span>答案</span>
                      </div>
                    </CardHeader>
                  <CardContent>
                    <div class="table-wrapper">
                      <table class="fl-table" style="width: 100%;">
                        <tbody>
                          <tr>
                            <td width="120">参考答案：</td>
                            <td v-if="row.type === 'fill_blank'">
                              <div v-for="(item, fIndex) in row.referenceAnswer.split('[_]')" :key="item" style="line-height: 40px;">
                                <span style="color: #999999;">填空 {{fIndex + 1}} ：</span>
                                {{item}}</div>
                            </td>
                            <td v-else>{{row.referenceAnswer}}</td>
                          </tr>
                          <tr><td>答案解析：</td><td>{{row.referenceAnswerNote}}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                  </Card>
                </td>
              </tr>
            </template>
          </TableBody>
        </Table>
      </div>
      <page :total="total" :page-size="params.size" :current-change="pageChange" :size-change="sizeChange"></page>
    </div>
    <template v-if="isComponent">
      <div class="dialog-footer" style="text-align: right;margin-top: 30px;">
        <Button variant="outline" @click="hideComponent">取 消</Button>
        <Button variant="default" @click="selectionChangeCallback(commodityIdList)">确 定</Button>
      </div>
    </template>
  </div>
</template>

<script>
import {ref, computed} from "vue"
import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = examApi
const { findList, delQuestion } = examApi
import Page from "@/components/Page/index.vue"
import {confirm, success} from "@/util/tipsUtils";
import router from "@/router";

import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "questionLib",
  components: {
    Card,
    CardHeader,
    CardContent,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Page,
    Button,
    Input,
    Select,
    SelectOption
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
    const flatCategoryOptions = computed(() => {
      const result = []
      const flatten = (nodes, parentPath = '') => {
        for (const node of nodes) {
          const label = parentPath ? `${parentPath} / ${node.label || node.name}` : (node.label || node.name)
          result.push({ label, value: node.value || node.id })
          if (node.children && node.children.length) { flatten(node.children, label) }
        }
      }
      flatten(categoryOptions.value || [])
      return result
    })
    const selectedCid = computed({
      get: () => { const arr = selectCidList.value; return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : '' },
      set: (val) => { selectCidList.value = [val] }
    })
    const list = ref([])
    const total = ref(0)
    const expandedRows = ref(new Set())
    const toggleExpand = (key) => {
      if (expandedRows.value.has(key)) {
        expandedRows.value.delete(key)
      } else {
        expandedRows.value.add(key)
      }
    }
    const selectedRows = ref([])
    const allSelected = computed(() => list.value.length > 0 && selectedRows.value.length === list.value.length)
    const toggleAll = (event) => {
      if (event.target.checked) {
        selectedRows.value = [...list.value]
      } else {
        selectedRows.value = []
      }
      selectItem(selectedRows.value)
    }
    const toggleRow = (row) => {
      const idx = selectedRows.value.findIndex(r => r.id === row.id)
      if (idx > -1) {
        selectedRows.value.splice(idx, 1)
      } else {
        selectedRows.value.push(row)
      }
      selectItem(selectedRows.value)
    }
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
      flatCategoryOptions,
      selectedCid,
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
      expandChange,
      expandedRows,
      toggleExpand,
      selectedRows,
      allSelected,
      toggleAll,
      toggleRow
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
