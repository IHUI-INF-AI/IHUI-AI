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
            <label class="mb-1 block text-sm font-medium text-foreground">类型</label>
            <div>
              <Select size="small" v-model="params.type" @change="search">
                <SelectOption label="全部" value=""></SelectOption>
                <SelectOption :label="key" :value="value" v-for="(key, value) in paperTypeMap" :key="value"></SelectOption>
              </Select>
            </div>
          </div>
        </form>
      </div>
      <div class="content">
        <Table class="w-full">
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>考试名称</TableHead>
              <TableHead>试卷名称</TableHead>
              <TableHead class="w-[80px]">试卷类型</TableHead>
              <TableHead class="w-[80px]">总分</TableHead>
              <TableHead class="w-[80px]">合格分数</TableHead>
              <TableHead class="w-[80px]">已得分数</TableHead>
              <TableHead class="w-[160px]">提交时间</TableHead>
              <TableHead class="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="(row, index) in list" :key="row.id ?? index">
              <TableRow>
                <TableCell>
                  <button @click="toggleExpand(index)">{{ expandedRows.has(index) ? '▼' : '▶' }}</button>
                </TableCell>
                <TableCell>{{ row.examTitle }}</TableCell>
                <TableCell>{{ row.paper.title }}</TableCell>
                <TableCell>{{ paperTypeMap[row.paper.type] }}</TableCell>
                <TableCell>{{ row.paper.score }}</TableCell>
                <TableCell>{{ row.paper.passScore }}</TableCell>
                <TableCell>{{ row.score }}</TableCell>
                <TableCell>{{ row.endTime }}</TableCell>
                <TableCell><Button className="right-btn" variant="link" @click="showMarkDialog(row)" size="sm">批改</Button></TableCell>
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
                      <table class="fl-table" style="width: 100%;" v-if="row.paper">
                        <tr><td>试卷名称：</td><td>{{row.paper.title}}</td></tr>
                        <tr><td>难度：</td><td><div class="flex gap-1">
                          <svg v-for="i in 5" :key="i" :class="['h-4 w-4', i <= row.paper.difficulty ? 'text-yellow-400' : 'text-muted-foreground']" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.783 1.401 8.168L12 18.896l-7.335 3.865 1.401-8.168L.132 9.21l8.2-1.192z"/></svg>
                        </div></td></tr>
                        <tr><td width="120">答题开始时间：</td><td>{{row.startTime}}</td></tr>
                        <tr><td width="120">答题结束时间：</td><td>{{row.endTime}}</td></tr>
                        <tr><td>状态：</td><td>{{statusMap[row.status]}}</td></tr>
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
    <Dialog v-model="showMarkDialogModel" :width="'90%'" @close="hideMarkDialog">
      <DialogHeader>
        <DialogTitle>批改试卷</DialogTitle>
      </DialogHeader>
      <div class="paper-question-list">
        <div class="paper-question" v-for="(item, index) in paperRecord.paper.questionList" :key="index">
          <div class="title">
            {{index + 1}}. {{formatTitle(item)}}
          </div>
          <div class="question-body">
            <div v-if="item.type === 'subjective'">
              <Textarea :readonly="true" :rows="10" v-model="paperRecord.answer[item.type + '_' + item.id]"/>
            </div>
            <div v-if="item.type === 'fill_blank'">
              <div v-for="i in item.blankCount" :key="i" style="display: flex;margin: 10px 0;">
                <div style="width: 20px;padding: 0 10px;">{{i}}.</div>
                <Input :readonly="true" size="small" v-model="paperRecord.answer[item.type + '_' + item.id + '_' + i]"/>
              </div>
            </div>
            <div v-else-if="item.options">
              <div v-if="item.type === 'multi_choice'">
                <Checkbox :disabled="true" v-model="paperRecord.answer[item.type + '_' + item.id]" :value="o.key" v-for="o in JSON.parse(item.options)" :key="o.key">{{o.key}}. {{o.value}}</Checkbox>
              </div>
              <div v-else v-for="o in JSON.parse(item.options)" :key="o.key">
                <Radio :disabled="true" v-model="paperRecord.answer[item.type + '_' + item.id]" :value="o.key">{{o.key}}. {{o.value}}</Radio>
              </div>
            </div>
            <div class="answer-box">
              <div class="answer-item">
                <div class="answer-info-label">结果：</div>
                <div class="answer-info-value">
                  <Button style="padding: 3px 10px;" v-if="item.result" size="sm" variant="default">对</Button>
                  <Button style="padding: 3px 10px;" v-else size="sm" variant="destructive">错</Button>
                </div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label">分数：</div>
                <div class="answer-info-value">{{item.score}}</div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label">难度：</div>
                <div class="answer-info-value">
                  <div class="flex gap-1">
                    <svg v-for="i in 5" :key="i" :class="['h-4 w-4', i <= item.difficulty ? 'text-yellow-400' : 'text-muted-foreground']" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.783 1.401 8.168L12 18.896l-7.335 3.865 1.401-8.168L.132 9.21l8.2-1.192z"/></svg>
                  </div>
                </div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label">解析：</div>
                <div class="answer-info-value">
                  {{item.referenceAnswerNote}}
                </div>
              </div>
              <div class="answer-item">
                <div class="answer-info-label" style="vertical-align: top;">正确答案：</div>
                <div class="answer-info-value">
                  <div v-if="item.type === 'fill_blank'">
                    <div v-for="(blank, i) in item.referenceAnswer.split('[_]')" :key="i">
                      填空 {{i + 1}}. {{blank}}
                    </div>
                  </div>
                  <div v-else>
                    {{item.referenceAnswer}}
                  </div>
                </div>
              </div>
              <div class="answer-item" v-if="item.type !== 'subjective'">
                <div class="answer-info-label">得分：</div>
                <div class="answer-info-value" style="color: green;font-size: 20px;font-weight: 500;">{{item.scored || 0}}</div>
              </div>
              <div class="answer-item" v-else>
                <div class="answer-info-label" style="color: #e6a23c;">评分：</div>
                <div class="answer-info-value">
                  <Input type="number" :precision="1" :step="1" :min="0" :max="item.score" size="small" v-model="answerMap[item.type + '_' + item.id]"/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="main-bottom">
        <Button size="sm" variant="default" @click="submitMark">提交</Button>
        <Button size="sm" variant="outline" @click="hideMarkDialog">取消</Button>
      </div>
    </Dialog>
  </div>
</template>

<script>
import {ref} from "vue"
import { examApi } from '@/api/edu/admin-api'
const { findCategoryList, toTree } = examApi
const { manualMarkRecord, getMarkRecordList } = examApi
import Page from "@/components/Page/index.vue"
import {confirm, success} from "@/util/tipsUtils";

import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Radio } from '@/components/ui/radio'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectOption } from '@/components/ui/select'
export default {
  name: "MarkList",
  components: {
    Radio,
    Checkbox,
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
    Textarea,
    Select,
    SelectOption
  },
  setup() {
    const expandedRows = ref(new Set())
    const toggleExpand = (key) => {
      if (expandedRows.value.has(key)) {
        expandedRows.value.delete(key)
      } else {
        expandedRows.value.add(key)
      }
    }
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
      current: 1
    })
    const colors = ["#99A9BF", "#F7BA2A", "#FF9900"]
    const paperTypeMap = {
      "normal": "静态试卷",
      "random": "随机试卷",
      "mock": "模拟试卷",
    }
    const statusMap = {
      "draft": "草稿",
      "submitted": "待批改",
      "passed": "已通过",
      "failed": "未通过",
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
    const answerMap = ref({})
    const loadList = () => {
      getMarkRecordList(params.value, (res) => {
        if (!res) {return;}
        for (const record of res.list) {
          record.paper = JSON.parse(record.paper)
          record.answer = JSON.parse(record.answer)
          if (record.paper.questionList && record.paper.questionList.length) {
            for (const question of record.paper.questionList) {
              if (question.type === "fill_blank") {
                let thisCount = 0;
                question.title.replace(/\[_\]/g, function () {
                  thisCount++;
                  return "[_]"
                });
                question.blankCount = thisCount
              } else if (question.type === "subjective") {
                answerMap[question.type + "_" + question.id] = 0
              }
            }
          }
        }
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
    const showMarkDialogModel = ref(false)
    const hideMarkDialog = () => {
      showMarkDialogModel.value = false
    }
    const paperRecord = ref()
    const showMarkDialog = (item) => {
      paperRecord.value = item
      showMarkDialogModel.value = true
    }
    const formatTitle = (item) => {
      if (item.type === "fill_blank") {
        let title = item.title
        for (let i = 0; i < item.blankCount; i++) {
          title = title.replace("[_]", "[__" + (i + 1) + "__]");
        }
        return title
      } else {
        return item.title
      }
    }
    const submitMark = () => {
      confirm("确认提交评分?", "提示", () => {
        manualMarkRecord({id: paperRecord.value.id, mark: JSON.stringify(answerMap.value)}, () => {
          success("评分成功")
          loadList()
          hideMarkDialog()
        })
      })
    }
    return {
      colors,
      paperTypeMap,
      statusMap,
      selectCidList,
      commodityIdList,
      categoryOptions,
      list,
      total,
      params,
      search,
      pageChange,
      sizeChange,
      expandChange,
      showMarkDialogModel,
      hideMarkDialog,
      showMarkDialog,
      paperRecord,
      formatTitle,
      answerMap,
      submitMark,
      expandedRows,
      toggleExpand
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
  .paper-question-list {
    .paper-question {
      padding: 20px 0;
      line-height: 36px;
      .answer-box {
        margin-top: 20px;
        .answer-item {
          .answer-info-label {
            display: inline-block;
          }
          .answer-info-value {
                display: inline-block;
              }
        }
      }
    }
  }
  .main-bottom {
    text-align: center;
    margin: 20px;
  }
</style>
