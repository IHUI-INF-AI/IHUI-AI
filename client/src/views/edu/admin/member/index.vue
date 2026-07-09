<template>
  <div class="member-overview">
    <!-- 统计卡片区域 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon total-icon">
          <User class="h-4 w-4" />
        </div>
        <div class="stat-content">
          <div class="stat-title">会员总数</div>
          <div class="stat-value">{{ statistics.totalCount || 0 }}</div>
          <div class="stat-footer">
            <span class="stat-label">正常状态会员</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon today-icon">
          <Plus class="h-4 w-4" />
        </div>
        <div class="stat-content">
          <div class="stat-title">今日新增</div>
          <div class="stat-value">{{ statistics.todayCount || 0 }}</div>
          <div class="stat-footer">
            <span v-if="statistics.yesterdayCount > 0" class="stat-compare">
              昨日 <span class="compare-value">+{{ statistics.yesterdayCount }}</span>
            </span>
            <span v-else class="stat-label">昨日无新增</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon pending-icon">
          <Clock class="h-4 w-4" />
        </div>
        <div class="stat-content">
          <div class="stat-title">待审核</div>
          <div class="stat-value warning-text">{{ statistics.unauditedCount || 0 }}</div>
          <div class="stat-footer">
            <Button v-if="statistics.unauditedCount > 0" variant="link" size="sm" @click="goToUnaudited">
              去处理 →
            </Button>
            <span v-else class="stat-label">暂无待审核</span>
          </div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon expiring-icon">
          <Warning class="h-4 w-4" />
        </div>
        <div class="stat-content">
          <div class="stat-title">即将过期</div>
          <div class="stat-value danger-text">{{ statistics.expiringCount || 0 }}</div>
          <div class="stat-footer">
            <span class="stat-label">30天内到期</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-section">
      <!-- 会员增长趋势 -->
      <div class="chart-box full-width">
        <div class="chart-header">
          <span class="chart-title">会员增长趋势（近7天）</span>
        </div>
        <div class="chart-content" id="trend-chart"></div>
      </div>
    </div>

    <div class="charts-section">
      <!-- 状态分布 -->
      <div class="chart-box half-width">
        <div class="chart-header">
          <span class="chart-title">会员状态分布</span>
        </div>
        <div class="chart-content" id="status-chart"></div>
      </div>

      <!-- 等级分布 -->
      <div class="chart-box half-width">
        <div class="chart-header">
          <span class="chart-title">会员等级分布</span>
        </div>
        <div class="chart-content" id="level-chart"></div>
      </div>
    </div>

    <!-- 公司分布 -->
    <div class="charts-section" v-if="statistics.companyDistribution && statistics.companyDistribution.length > 0">
      <div class="chart-box full-width">
        <div class="chart-header">
          <span class="chart-title">会员公司分布（Top10）</span>
        </div>
        <div class="chart-content" id="company-chart"></div>
      </div>
    </div>

    <!-- 列表区域 -->
    <div class="lists-section">
      <!-- 最近注册会员 -->
      <div class="list-box">
        <div class="list-header">
          <span class="list-title">最近注册会员</span>
          <Button variant="link" size="sm" @click="goToMemberList">
            查看全部 →
          </Button>
        </div>
        <div class="list-content">
          <Table class="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[120px]">姓名</TableHead>
                <TableHead class="w-[130px]">手机号</TableHead>
                <TableHead class="w-[80px]">状态</TableHead>
                <TableHead>注册时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in statistics.recentMembers" :key="row.id ?? index">
                <TableCell>
                  <div class="member-info">
                    <Avatar :size="28" :src="row.avatar" />
                    <span class="member-name">{{ row.name || '-' }}</span>
                  </div>
                </TableCell>
                <TableCell>{{ row.mobile || '-' }}</TableCell>
                <TableCell>
                  <Tag :type="getStatusType(row.status)" size="small">
                    {{ getStatusText(row.status) }}
                  </Tag>
                </TableCell>
                <TableCell>{{ formatTime(row.createTime) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Empty v-if="!statistics.recentMembers || statistics.recentMembers.length === 0" description="暂无数据" />
        </div>
      </div>

      <!-- 即将过期会员 -->
      <div class="list-box">
        <div class="list-header">
          <span class="list-title">即将过期会员</span>
        </div>
        <div class="list-content">
          <Table class="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead class="w-[120px]">姓名</TableHead>
                <TableHead class="w-[130px]">手机号</TableHead>
                <TableHead>到期时间</TableHead>
                <TableHead class="w-[100px]">剩余天数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="(row, index) in statistics.expiringMembers" :key="row.id ?? index">
                <TableCell>
                  <div class="member-info">
                    <Avatar :size="28" :src="row.avatar" />
                    <span class="member-name">{{ row.name || '-' }}</span>
                  </div>
                </TableCell>
                <TableCell>{{ row.mobile || '-' }}</TableCell>
                <TableCell><span class="expire-time">{{ formatTime(row.expireTime) }}</span></TableCell>
                <TableCell>
                  <Tag type="danger" size="small">
                    {{ getDaysLeft(row.expireTime) }}天
                  </Tag>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <Empty v-if="!statistics.expiringMembers || statistics.expiringMembers.length === 0" description="暂无即将过期会员" />
        </div>
      </div>
    </div>

    <!-- 其他状态统计 -->
    <div class="other-stats">
      <div class="other-stat-item">
        <span class="other-stat-label">锁定会员</span>
        <span class="other-stat-value">{{ statistics.lockedCount || 0 }}</span>
      </div>
      <div class="other-stat-item">
        <span class="other-stat-label">黑名单会员</span>
        <span class="other-stat-value">{{ statistics.blackCount || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { User, Plus, Clock, Warning } from '@/lib/lucide-fallback';
import * as echarts from "echarts";
import { memberApi } from '@/api/edu/admin-api'
const { getMemberStatistics } = memberApi;
import Button from '@/components/ui/Button.vue'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Avatar } from '@/components/ui/avatar'
import { Tag } from '@/components/ui/tag'
import { Empty } from '@/components/ui/empty'

export default {
  name: "MemberIndex",
  components: {
    Button,
    User,
    Plus,
    Clock,
    Warning,
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
    Avatar,
    Tag,
    Empty
  },
  setup() {
    const router = useRouter();
    const statistics = ref({
      totalCount: 0,
      todayCount: 0,
      yesterdayCount: 0,
      unauditedCount: 0,
      expiringCount: 0,
      lockedCount: 0,
      blackCount: 0,
      statusDistribution: [],
      levelDistribution: [],
      companyDistribution: [],
      dailyTrend: [],
      recentMembers: [],
      expiringMembers: []
    });

    let trendChart = null;
    let statusChart = null;
    let levelChart = null;
    let companyChart = null;

    const statusMap = {
      normal: { text: "正常", type: "success" },
      active: { text: "激活", type: "primary" },
      black: { text: "黑名单", type: "danger" },
      lock: { text: "锁定", type: "warning" },
      deleted: { text: "注销", type: "info" },
      unaudited: { text: "未审核", type: "warning" }
    };

    const getStatusText = (status) => {
      return statusMap[status]?.text || status;
    };

    const getStatusType = (status) => {
      return statusMap[status]?.type || "info";
    };

    const formatTime = (time) => {
      if (!time) return "-";
      const date = new Date(time);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };

    const getDaysLeft = (expireTime) => {
      if (!expireTime) return 0;
      const now = new Date();
      const expire = new Date(expireTime);
      const diff = expire - now;
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    };

    const goToUnaudited = () => {
      router.push("/admin/edu/member/unaudited");
    };

    const goToMemberList = () => {
      router.push("/admin/edu/member/list");
    };

    const initTrendChart = () => {
      const chartDom = document.getElementById("trend-chart");
      if (!chartDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingChart = echarts.getInstanceByDom(chartDom);
      if (existingChart) existingChart.dispose();
      trendChart = echarts.init(chartDom);
      const data = statistics.value.dailyTrend || [];

      const option = {
        tooltip: {
          trigger: "axis",
          formatter: "{b}<br/>新增会员: {c}"
        },
        grid: {
          top: "15%",
          left: "8%",
          right: "5%",
          bottom: "15%"
        },
        xAxis: {
          type: "category",
          data: data.map(item => item.date),
          axisLabel: {
            rotate: 0
          }
        },
        yAxis: {
          type: "value",
          minInterval: 1
        },
        series: [
          {
            name: "新增会员",
            data: data.map(item => item.count),
            type: "bar",
            barWidth: "40%",
            itemStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "#7D83FF" },
                  { offset: 0.5, color: "#5A60E0" },
                  { offset: 1, color: "#3D43C6" }
                ]
              },
              borderRadius: [6, 6, 6, 6]
            }
          },
          {
            name: "趋势线",
            data: data.map(item => item.count),
            type: "line",
            smooth: true,
            lineStyle: {
              color: "#FF6B81",
              width: 3
            },
            symbol: "circle",
            symbolSize: 8,
            itemStyle: {
              color: "#FFF",
              borderColor: "#FF6B81",
              borderWidth: 2
            }
          }
        ]
      };

      trendChart.setOption(option);
    };

    const initStatusChart = () => {
      const chartDom = document.getElementById("status-chart");
      if (!chartDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingChart = echarts.getInstanceByDom(chartDom);
      if (existingChart) existingChart.dispose();
      statusChart = echarts.init(chartDom);
      const data = statistics.value.statusDistribution || [];

      const colorMap = {
        normal: "#67C23A",
        active: "#409EFF",
        black: "#F56C6C",
        lock: "#E6A23C",
        deleted: "#909399",
        unaudited: "#E6A23C"
      };

      const option = {
        tooltip: {
          trigger: "item",
          formatter: "{b}: {c} ({d}%)"
        },
        legend: {
          orient: "vertical",
          right: "5%",
          top: "center"
        },
        series: [
          {
            name: "会员状态",
            type: "pie",
            radius: ["40%", "70%"],
            center: ["40%", "50%"],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 4,
              borderColor: "#fff",
              borderWidth: 2
            },
            label: {
              show: false
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 14,
                fontWeight: "bold"
              }
            },
            data: data.map(item => ({
              name: item.statusName,
              value: item.count,
              itemStyle: {
                color: colorMap[item.status] || "#909399"
              }
            }))
          }
        ]
      };

      statusChart.setOption(option);
    };

    const initLevelChart = () => {
      const chartDom = document.getElementById("level-chart");
      if (!chartDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingChart = echarts.getInstanceByDom(chartDom);
      if (existingChart) existingChart.dispose();
      levelChart = echarts.init(chartDom);
      const data = statistics.value.levelDistribution || [];

      const option = {
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow"
          }
        },
        grid: {
          top: "15%",
          left: "15%",
          right: "10%",
          bottom: "15%"
        },
        xAxis: {
          type: "value",
          minInterval: 1
        },
        yAxis: {
          type: "category",
          data: data.map(item => item.levelName || "未设置"),
          axisLabel: {
            width: 80,
            overflow: "truncate"
          }
        },
        series: [
          {
            name: "会员数量",
            type: "bar",
            data: data.map(item => item.count),
            itemStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 0,
                colorStops: [
                  { offset: 0, color: "#409EFF" },
                  { offset: 1, color: "#66B1FF" }
                ]
              },
              borderRadius: [0, 4, 4, 0]
            }
          }
        ]
      };

      levelChart.setOption(option);
    };

    const initCompanyChart = () => {
      const chartDom = document.getElementById("company-chart");
      if (!chartDom) return;

      // 获取 DOM 上已存在的实例并销毁
      const existingChart = echarts.getInstanceByDom(chartDom);
      if (existingChart) existingChart.dispose();
      companyChart = echarts.init(chartDom);
      const data = statistics.value.companyDistribution || [];

      const option = {
        tooltip: {
          trigger: "axis",
          axisPointer: {
            type: "shadow"
          }
        },
        grid: {
          top: "10%",
          left: "15%",
          right: "5%",
          bottom: "15%"
        },
        xAxis: {
          type: "category",
          data: data.map(item => item.companyName || "未设置"),
          axisLabel: {
            rotate: 30,
            width: 60,
            overflow: "truncate"
          }
        },
        yAxis: {
          type: "value",
          minInterval: 1
        },
        series: [
          {
            name: "会员数量",
            type: "bar",
            data: data.map(item => item.count),
            itemStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "#67C23A" },
                  { offset: 1, color: "#95D475" }
                ]
              },
              borderRadius: [4, 4, 0, 0]
            }
          }
        ]
      };

      companyChart.setOption(option);
    };

    const loadStatistics = () => {
      getMemberStatistics((res) => {
        if (res) {
          statistics.value = res;
          nextTick(() => {
            initTrendChart();
            initStatusChart();
            initLevelChart();
            if (res.companyDistribution && res.companyDistribution.length > 0) {
              initCompanyChart();
            }
          });
        }
      });
    };

    // resize 事件处理函数
    const handleResize = () => {
      trendChart?.resize();
      statusChart?.resize();
      levelChart?.resize();
      companyChart?.resize();
    };

    onMounted(() => {
      loadStatistics();

      // 窗口大小变化时重绘图表
      window.addEventListener("resize", handleResize);
    });

    // 组件销毁时清理资源
    onUnmounted(() => {
      // 移除 resize 事件监听器
      window.removeEventListener("resize", handleResize);
      
      // 销毁所有 ECharts 实例（检查是否已被销毁）
      if (trendChart && !trendChart.isDisposed()) {
        trendChart.dispose();
      }
      trendChart = null;
      if (statusChart && !statusChart.isDisposed()) {
        statusChart.dispose();
      }
      statusChart = null;
      if (levelChart && !levelChart.isDisposed()) {
        levelChart.dispose();
      }
      levelChart = null;
      if (companyChart && !companyChart.isDisposed()) {
        companyChart.dispose();
      }
      companyChart = null;
    });

    return {
      statistics,
      getStatusText,
      getStatusType,
      formatTime,
      getDaysLeft,
      goToUnaudited,
      goToMemberList
    };
  }
};
</script>

<style scoped lang="scss">
.member-overview {
  padding: 20px;
  min-height: calc(100vh - 120px);
}

// 统计卡片
.stats-cards {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;

  .stat-card {
    flex: 1;
    background: #fff;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: #fff;

      &.total-icon {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }

      &.today-icon {
        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      }

      &.pending-icon {
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      }

      &.expiring-icon {
        background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
      }
    }

    .stat-content {
      flex: 1;

      .stat-title {
        font-size: 14px;
        color: #909399;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 600;
        color: #303133;
        line-height: 1.2;

        &.warning-text {
          color: #E6A23C;
        }

        &.danger-text {
          color: #F56C6C;
        }
      }

      .stat-footer {
        margin-top: 8px;
        font-size: 12px;

        .stat-label {
          color: #909399;
        }

        .stat-compare {
          color: #909399;

          .compare-value {
            color: #67C23A;
            font-weight: 500;
          }
        }
      }
    }
  }
}

// 图表区域
.charts-section {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;

  .chart-box {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    overflow: hidden;

    &.full-width {
      flex: 1;
    }

    &.half-width {
      flex: 1;
    }

    .chart-header {
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;

      .chart-title {
        font-size: 16px;
        font-weight: 500;
        color: #303133;
        font-family: 'HarmonyOS Sans SC', sans-serif;
      }
    }

    .chart-content {
      height: 280px;
      padding: 10px;
    }
  }
}

// 列表区域
.lists-section {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;

  .list-box {
    flex: 1;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    overflow: hidden;

    .list-header {
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      justify-content: space-between;
      align-items: center;

      .list-title {
        font-size: 16px;
        font-weight: 500;
        color: #303133;
      }
    }

    .list-content {
      padding: 10px;

      .member-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .member-name {
          font-size: 13px;
          color: #303133;
        }
      }

      .expire-time {
        color: #F56C6C;
      }
    }
  }
}

// 其他统计
.other-stats {
  display: flex;
  gap: 20px;

  .other-stat-item {
    background: #fff;
    border-radius: 12px;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);

    .other-stat-label {
      font-size: 14px;
      color: #909399;
    }

    .other-stat-value {
      font-size: 20px;
      font-weight: 600;
      color: #303133;
    }
  }
}

// 响应式
@media (max-width: 1200px) {
  .stats-cards {
    flex-wrap: wrap;

    .stat-card {
      flex: 1 1 calc(50% - 10px);
      min-width: 240px;
    }
  }

  .charts-section {
    flex-direction: column;

    .chart-box {
      &.half-width {
        width: 100%;
      }
    }
  }

  .lists-section {
    flex-direction: column;
  }
}
</style>
