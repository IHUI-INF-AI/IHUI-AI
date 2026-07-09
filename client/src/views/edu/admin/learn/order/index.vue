<template>
  <div class="app-container">
    <div class="header">
      <form @submit.prevent class="form-inline">
        <div class="mb-4">
          <Input class="search-input" v-model="searchParam.keyword" placeholder="请输入关键字" />
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">状态</label>
          <div>
            <Select v-model="searchParam.status" @change="search">
              <SelectOption label="全部" value=""></SelectOption>
              <SelectOption v-for="(item, k) in orderStatusMap" :label="item" :value="k" :key="k"></SelectOption>
            </Select>
          </div>
        </div>
        <div class="mb-4 select">
          <label class="mb-1 block text-sm font-medium text-foreground">日期</label>
          <div>
            <div style="display: flex;">
              <el-date-picker
                v-model="searchParam.startTime"
                type="datetime"
                placeholder="订单开始时间"
                class="input-text"
                :default-time="new Date(2000, 0, 1, 0, 0, 0)"
                @change="changeStartTime"
                style="width: 100%;"></el-date-picker>
              <el-date-picker
                v-model="searchParam.endTime"
                type="datetime"
                placeholder="订单结束时间"
                class="input-text"
                :default-time="new Date(2000, 0, 1, 22, 0, 0)"
                @change="changeEndTime"
                style="width: 100%;"></el-date-picker>
            </div>
          </div>
        </div>
        <div class="mb-4">
          <Button variant="default" @click="search">搜索</Button>
        </div>
      </form>
    </div>
    <div class="content">
      <div class="order-table-header">
        <div class="title-box width65 padding-10-0">
          <div class="image"></div>
          <div class="title">商品信息</div>
          <div class="width15">单价</div>
          <div class="width15">数量</div>
        </div>
        <div class="width15 padding-10-0">实付款</div>
        <div class="width10 padding-10-0">交易状态</div>
        <div class="width10 padding-10-0">操作</div>
      </div>
      <div class="order-table-list" v-loading="dataLoading">
        <Empty style="background-color: #FFFFFF;" v-if="!(list && list.length)" />
        <div v-else class="order-item" v-for="item in list" :key="item.id">
          <div class="order-header">
            <div class="member-info" v-if="item.member">
              <img class="member-info-image" :src="item.member.avatar" />
              <span>{{item.member.name}}</span>
            </div>
            <div class="order-no">订单号：{{item.no}}</div>
            <div class="create-time">
              下单时间：{{item.createTime}}
            </div>
          </div>
          <div class="order-main">
            <div class="commodity-list width65">
              <div class="commodity-item" v-for="c in item.itemList" :key="c.id">
                <div class="image">
                  <img :src="c.image" class="object-cover" />
                </div>
                <div class="title-box">
                  <div class="title">{{c.title}}</div>
                </div>
                <div class="price width15">
                  <div class="del">￥{{c.price || 0}}</div>
                  <div>￥{{c.paymentAmount || 0}}</div>
                </div>
                <div class="num width15">{{c.quantity || 0}}</div>
              </div>
            </div>
            <div class="real-price width15 padding-10-0">
              <div>￥{{item.paymentAmount || 0.00}}</div>
              <div>(含运费：￥{{item.freightAmount || 0.00}})</div>
              <div v-if="item.payment">{{paymentChannelMap[item.payment.channel]}}</div>
            </div>
            <div class="order-status width10 padding-10-0" :class="item.status">{{orderStatusMap[item.status]}}</div>
<!--            <div class="opt width10 padding-10-0">详情</div>-->
          </div>
        </div>
      </div>
    </div>
    <page :total="total" :current-change="currentChange" :size-change="sizeChange" :page-size="searchParam.size"></page>
  </div>
</template>

<script>
// @ts-nocheck
import Page from "@/components/Page/index.vue"
import {ref} from "vue"
import { learnApi } from '@/api/edu/admin-api'
const { findList } = learnApi
import {error, info} from "@/util/tipsUtils";
import {formatDate} from "@/util/dateUtils";
import {Picture} from '@/lib/lucide-fallback';
import Button from '@/components/ui/Button.vue'
import { Input } from '@/components/ui/input'
import { Empty } from '@/components/ui/empty'
import { Select, SelectOption } from '@/components/ui/select'

export default {
  name: "OrderList",
  components: {
    Page,
    Picture,
    Button,
    Input,
    Empty,
    Select,
    SelectOption
  },
  setup(props) {
    const list = ref([])
    const total = ref(0)
    const dataLoading = ref(true)
    const selectCidList = ref([])
    const categoryOptions = ref([])
    const lessonIdList = ref([])
    const searchParam = ref({
      keyword: "",
      status: "",
      startTime: "",
      endTime: "",
      size: 20,
      current: 1
    })
    const statusMap = {
      unpublished: "未发布",
      published: "已发布",
      deleted: "已删除"
    }
    const paymentChannelMap = {
      wechat_pay: "微信支付",
      alipay: "支付宝"
    }
    const orderStatusMap = {
      waiting_payment: "待支付",
      cancelled: "已取消",
      closed: "已关闭",
      waiting_delivery: "待发货",
      shipped: "已发货",
      some_shipped: "部分已发货"
    }
    // 加载列表
    const loadList = () => {
      dataLoading.value = true
      findList(searchParam.value, (res) => {
        dataLoading.value = false
        if (!res) {return;}
        list.value = res.list;
        total.value = res.total;
      }).catch(() => {
        dataLoading.value = false
      })
    }
    loadList();
    // 搜索
    const search = () => {
      if (selectCidList.value && selectCidList.value.length > 0) {
        searchParam.value.cid = selectCidList.value[selectCidList.value.length - 1];
      }
      loadList();
    }
    // 选择时间
    const changeStartTime = (val) => {
      if (val) {
        searchParam.value.startTime = formatDate(val)
      } else {
        searchParam.value.startTime = val
      }
      search()
    }
    // 选择时间
    const changeEndTime = (val) => {
      if (val) {
        searchParam.value.endTime = formatDate(val)
      } else {
        searchParam.value.endTime = val
      }
      search()
    }
    // 选择列表项
    const selectItem = (val) => {
      lessonIdList.value = [];
      if (val && val.length > 0) {
        for (const valElement of val) {
          lessonIdList.value.push(valElement.id);
        }
      }
    }
    const currentChange = (currentPage) => {
      searchParam.value.current = currentPage;
      loadList();
    }
    const sizeChange = (s) => {
      searchParam.value.size = s;
      loadList();
    }
    // 查看评论
    const selectTopic = ref({})
    const drawer = ref(false)
    const drawerClose = (done) => {
      drawer.value = false
      done()
    }
    const commentView = (item) => {
      drawer.value = true
      selectTopic.value = item
    }
    const multipleSelection = ref([])
    const handleSelectionChange = (val) => {
      multipleSelection.value = val;
    }
    const selectSelectionChange = () => {
      if (!multipleSelection.value.length) {
        error("请选择专题")
      }
      props.selectCallback && props.selectCallback(multipleSelection.value)
    }
    return {
      list,
      total,
      searchParam,
      selectCidList,
      categoryOptions,
      lessonIdList,
      search,
      selectItem,
      currentChange,
      sizeChange,
      dataLoading,
      statusMap,
      commentView,
      selectTopic,
      drawer,
      drawerClose,
      info,
      handleSelectionChange,
      selectSelectionChange,
      paymentChannelMap,
      orderStatusMap,
      changeStartTime,
      changeEndTime
    };
  }
};
</script>

<style scoped lang="scss">
.app-container {
  margin: 20px;
  .header {
    .form-inline {
      .search-input {
        width: 242px;
        :deep(.el-input__inner){
          height: 34px;
          line-height: 34px;
          border-color: #f3f5f8;
          &:focus, &:hover {
            border-color: #f3f5f8;
          }
        }
        :deep(.el-input__icon){
          height: 34px;
          line-height: 34px;
          cursor: pointer;
          &:hover {
            color: hsl(var(--primary));
          }
        }
      }
      .select {
        :deep(.el-form-item__label){
          font-size: 12px;
        }
        :deep(.el-input__inner){
          height: 34px;
          line-height: 34px;
          border-color: #f3f5f8;
        }
      }
      :deep(.el-form-item){
        margin-bottom: 20px;
      }
    }
  }
  .content {
    .order-table-header {
      display: flex;
      font-size: 12px;
      text-align: center;
      background-color: #ffffff;
      line-height: 30px;
      .width65 {
        width: 65%;
      }
      .width15 {
        width: 15%;
      }
      .width10 {
        width: 10%;
      }
      .title-box {
        display: flex;
        .title {
          width: 50%;
          padding: 2px 10px;
        }
      }
      .image {
        width: 80px;
        //height: 45px;
        margin-left: 20px;
      }
    }
    .order-table-list{
      .width10 {
        width: 10%;
      }
      .width15 {
        width: 15%;
      }
      .width65 {
        width: 65%;
      }
      .padding-10-0 {
        padding: 10px 0;
      }
      .order-item {
        background-color: #FFFFFF;
        font-size: 12px;
        margin-bottom: 10px;
        .order-header {
          display: flex;
          align-items: center;
          line-height: 28px;
          background-color: #f0f0f0;
          .member-info {
            margin: 5px;
            display: flex;
            font-weight: 500;
            .member-info-image {
              margin-right: 5px;
              width: 24px;
              height: 24px;
              border-radius: 50%;
            }
          }
          .create-time {
            margin-left: 20px;
            //font-weight: 500;
          }
          .order-no {
            margin-left: 20px;
            color: #222;
          }
        }
        .order-main {
          display: flex;
          text-align: center;
          line-height: 20px;
          .commodity-list{
            border-right: 1px solid #f0f0f0;
            .commodity-item {
              text-align: left;
              display: flex;
              border-bottom: 1px solid #f0f0f0;
              padding: 10px 0;
              &:last-child {
                border: 0;
              }
              .image {
                width: 80px;
                height: 45px;
                margin-left: 20px;
                img {
                  width: 100%;
                  height: 100%;
                }
              }
              .title-box {
                width: 50%;
                padding: 2px 10px;
              }
              .price {
                width: 15%;
                text-align: center;
              }
              .del {
                color: #9c9c9c;
                text-decoration: line-through;
              }
              .num {
                width: 15%;
                text-align: center;
              }
            }
          }
          .real-price {
            border-right: 1px solid #f0f0f0;
          }
          .order-status {
            border-right: 1px solid #f0f0f0;
          }
          .waiting_payment {
            color: #e9680b;
          }
          .cancelled {
            color: #a2a19e;
          }
          .closed {
            color: #a2a19e;
          }
          .waiting_delivery {
            color: #be3838;
          }
          .shipped {
            color: hsl(var(--primary));
          }
          .some_shipped {

          }
          .opt {}
        }
      }
    }
  }
}
</style>
