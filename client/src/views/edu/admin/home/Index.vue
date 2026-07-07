<template>
  <div class="dashboard">
    <!--    <div class="feature-box feature-left-box feature-menu-box">-->
    <!--      <div class="feature-box-warp">-->
    <!--        <div class="feature-menu-title">我的导航</div>-->
    <!--        <div class="feature-menu-main"></div>-->
    <!--      </div>-->
    <!--    </div>-->
    <!--    <div class="feature-box feature-right-box">-->
    <!--      <div class="feature-box-warp">-->
    <!--        <div class="feature-menu-title">账号信息</div>-->
    <!--        <div class="feature-menu-main"></div>-->
    <!--      </div>-->
    <!--    </div>-->
    <!--    <div class="feature-box feature-left-box">-->
    <!--      <div class="feature-box-warp">-->
    <!--        <div class="feature-menu-title">预警事项</div>-->
    <!--        <div class="feature-menu-main"></div>-->
    <!--      </div>-->
    <!--    </div>-->
    <!--    <div class="feature-box feature-right-box">-->
    <!--      <div class="feature-box-warp">-->
    <!--        <div class="feature-menu-title">公告</div>-->
    <!--        <div class="feature-menu-main"></div>-->
    <!--      </div>-->
    <!--    </div>-->
    <!--    <div class="feature-box feature-left-box">-->
    <!--      <div class="feature-box-warp">-->
    <!--        <div class="feature-menu-title">待办事项</div>-->
    <!--        <div class="feature-menu-main"></div>-->
    <!--      </div>-->
    <!--    </div>-->
    <!--    <div class="feature-box feature-right-box">-->
    <!--      <div class="feature-box-warp">-->
    <!--        <div class="feature-menu-title">帮助文档</div>-->
    <!--        <div class="feature-menu-main"></div>-->
    <!--      </div>-->
    <!--    </div>-->

    <div class="feature-box operation-box">
      <div class="operation">
        <div class="operation-content">
          <div class="stat-icon stat-icon-pv">
            <el-icon :size="24"><View /></el-icon>
          </div>
          <div class="title">
            总浏览量/PV
            <el-tooltip
              class="item"
              effect="dark"
              content="页面被浏览的次数。每打开一个页面或每刷新一次均记录1次"
              placement="top"
            >
              <el-icon><Warning /></el-icon>
            </el-tooltip>
          </div>
          <div style="display: flex; align-items: center; justify-content: center;">
            <div class="value">{{ totalVisitMap.pv || 0 }}</div>
            <div style="margin-left: 21px; color: green; font-size: 24px;">↑</div>
          </div>
        </div>
        <div class="bottom">
          <span class="text" v-if="!yesterdayVisitMap.pv">昨日无变化</span>
          <span class="text" v-else
            >昨日
            <span style="color: red">+{{ yesterdayVisitMap.pv }}</span></span
          >
        </div>
      </div>
      <div class="operation">
        <div class="operation-content">
          <div class="stat-icon stat-icon-uv">
            <el-icon :size="24"><User /></el-icon>
          </div>
          <div class="title">
            总访客数/UV
            <el-tooltip
              class="item"
              effect="dark"
              content="1天之内，访问网站的用户数，一天内同一访客多次访问网站计算1次"
              placement="top"
            >
              <el-icon><Warning /></el-icon>
            </el-tooltip>
          </div>
          <div style="display: flex; align-items: center; justify-content: center;">
            <div class="value">{{ totalVisitMap.uv || 0 }}</div>
            <div style="margin-left: 21px; color: green; font-size: 24px;">↑</div>
          </div>
        </div>
        <div class="bottom">
          <span class="text" v-if="!yesterdayVisitMap.uv">昨日无变化</span>
          <span class="text" v-else
            >昨日
            <span style="color: red">+{{ yesterdayVisitMap.uv }}</span></span
          >
        </div>
      </div>
      <div class="operation">
        <div class="operation-content">
          <div class="stat-icon stat-icon-vv">
            <el-icon :size="24"><DataLine /></el-icon>
          </div>
          <div class="title">
            总访问次数/VV
            <el-tooltip
              class="item"
              effect="dark"
              content="visit view，一个session算一次，页面停留超过10分钟重新计算"
              placement="top"
            >
              <el-icon><Warning /></el-icon>
            </el-tooltip>
          </div>
          <div style="display: flex; align-items: center; justify-content: center;">
            <div class="value">{{ totalVisitMap.vv || 0 }}</div>
            <div style="margin-left: 21px; color: green;font-size: 24px;">↑</div>
          </div>
        </div>
        <div class="bottom">
          <span class="text" v-if="!yesterdayVisitMap.vv">昨日无变化</span>
          <span class="text" v-else
            >昨日
            <span style="color: red">+{{ yesterdayVisitMap.vv }}</span></span
          >
        </div>
      </div>
    </div>
    <div class="feature-box operation-chart-box">
      <div class="operation-chart full-width">
        <div class="operation-chart-header">
          <span>浏览趋势</span>
          <span style="float: right; color: #999; font-size: 12px"
            >查看记录</span
          >
        </div>
        <div class="operation-chart-canvas" id="pv-chart"></div>
      </div>
    </div>
    <div class="feature-box operation-chart-box">
      <div class="operation-chart">
        <div class="operation-chart-header">
          <span>访客趋势</span>
        </div>
        <div class="operation-chart-canvas" id="uv-chart"></div>
      </div>
      <div class="operation-chart">
        <div class="operation-chart-header">
          <span>访客分布</span>
        </div>
        <div class="operation-chart-canvas" id="uv-distribution-chart"></div>
      </div>
    </div>
  </div>
</template>

<script>
// @ts-nocheck
import * as echarts from "echarts";
import { ref, onMounted, onUnmounted } from "vue";
import { indexApi } from '@/api/edu/admin-api'
const { getDayPvList, getDayUvList, getIpCitySummaryList, getVisitSummary } = indexApi;
import { Warning, View, User, DataLine } from '@/lib/lucide-fallback';

export default {
  name: "HomeIndex",
  components: {
    Warning,
    View,
    User,
    DataLine,
  },
  setup() {
    const totalVisitMap = ref({
      pv: 0,
      uv: 0,
      vv: 0,
    });
    const yesterdayVisitMap = ref({
      pv: 0,
      uv: 0,
      vv: 0,
    });
    
    // ECharts 实例引用
    let pvChart = null;
    let uvChart = null;
    let uvDistributionChart = null;

    const handleResize = () => {
      pvChart?.resize();
      uvChart?.resize();
      uvDistributionChart?.resize();
    };
    const getDaysAgo = (day) => {
      let yesterday = new Date();
      yesterday.setTime(yesterday.getTime() - day * 24 * 60 * 60 * 1000);
      let month = yesterday.getMonth() + 1;
      if (month < 10) {
        month = "0" + month;
      }
      return yesterday.getFullYear() + "-" + month + "-" + yesterday.getDate();
    };
    // 汇总
    getVisitSummary({}, (res) => {
      if (res) {
        totalVisitMap.value = res;
      }
    }); // 显示错误提示，帮助用户了解问题
    const yesterdayDate = getDaysAgo(1);
    // 昨天汇总
    getVisitSummary(
      { startDate: yesterdayDate, endDate: yesterdayDate },
      (res) => {
        if (res) {
          yesterdayVisitMap.value = res;
        }
      }
    ); // 显示错误提示，帮助用户了解问题
    onMounted(() => {
      // 浏览趋势
 // 浏览趋势
  const pvxAxisData = [];
  const pvSeriesData = [];
      getDayPvList(
        { startDate: getDaysAgo(7), endDate: getDaysAgo(0) },
        (res) => {
          
          if (res && res.length) {
        for (const re of res) {
          pvxAxisData.push(re.visitDate);
          pvSeriesData.push(re.pv || 0);
        }
        // 浏览量
        const pvDom = document.getElementById("pv-chart");
        if (!pvDom) {
          console.warn("pv-chart DOM 元素未找到，跳过图表初始化");
          return;
        }
        // 获取 DOM 上已存在的实例并销毁
        const existingPvChart = echarts.getInstanceByDom(pvDom);
        if (existingPvChart) existingPvChart.dispose();
        pvChart = echarts.init(pvDom);
        const pvChartOption = {
          tooltip: {
            trigger: 'axis',
            formatter: '{b}<br/>{a0}: {c0}<br/>{a1}: {c1}'
          },
          xAxis: {
            type: 'category',
            data: pvxAxisData,
            axisLabel: {
              rotate: 30 // 如果日期标签太长可以旋转
            }
          },
          yAxis: {
            type: 'value'
          },
          series: [
            // 立体圆柱效果
            {
              name: '浏览量',
              data: pvSeriesData,
              type: 'bar',
              barWidth: '20%', // 固定宽度更易控制
              itemStyle: {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [{
                    offset: 0,
                    color: '#7D83FF' // 顶部亮色
                  }, {
                    offset: 0.5,
                    color: '#5A60E0' // 中间色
                  }, {
                    offset: 1,
                    color: '#3D43C6' // 底部暗色
                  }]
                },
                borderRadius: [10, 10, 10, 10], // 完全圆角
                shadowColor: 'rgba(0, 0, 0, 0.3)', // 圆柱阴影
                shadowBlur: 6,
                shadowOffsetY: 3
              },
              emphasis: {
                itemStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                      offset: 0,
                      color: '#9DA3FF'
                    }, {
                      offset: 0.5,
                      color: '#7A80FF'
                    }, {
                      offset: 1,
                      color: '#5D63E8'
                    }]
                  },
                  shadowColor: 'rgba(0, 0, 0, 0.5)',
                  shadowBlur: 8
                }
              }
            },
            // 折线图（带立体感）
            {
              name: '趋势线',
              data: pvSeriesData,
              type: 'line',
              // smooth: true,
              lineStyle: {
                color: '#FF6B81',
                width: 3,
                shadowColor: 'rgba(255,107,129,0.5)',
                shadowBlur: 10,
                shadowOffsetY: 5
              },
              symbol: 'circle',
              symbolSize: 12,
              itemStyle: {
                color: '#FFF',
                borderColor: '#FF6B81',
                borderWidth: 3,
                shadowColor: 'rgba(0,0,0,0.2)',
                shadowBlur: 5
              },
              label: {
                show: true,
                position: 'top',
                color: '#FF6B81',
                fontWeight: 'bold',
                fontSize: 12,
                formatter: '{c}',
                shadowColor: '#FFF',
                shadowBlur: 10
              },
              emphasis: {
                scale: 1.2,
                itemStyle: {
                  borderWidth: 4,
                  shadowColor: 'rgba(255,107,129,0.8)',
                  shadowBlur: 15
                }
              }
            }
          ],
          grid: {
            top: '18%',
            right: '5%',
            bottom: '20%',
            left: '8%'
          }
        };
            // 绘制图表
            pvChart.setOption(pvChartOption);
          }
        }
      ); // 显示错误提示，帮助用户了解问题
      // 访客趋势
      const uvxAxisData = [];
      const uvSeriesData = [];
      getDayUvList(
        { startDate: getDaysAgo(7), endDate: getDaysAgo(0) },
        (res) => {
          if (res && res.length) {
            for (const re of res) {
              uvxAxisData.push(re.visitDate);
              uvSeriesData.push(re.uv || 0);
            }
            // 访客趋势
            const uvDom = document.getElementById("uv-chart");
            if (!uvDom) {
              console.warn("uv-chart DOM 元素未找到，跳过图表初始化");
              return;
            }
            // 获取 DOM 上已存在的实例并销毁
            const existingUvChart = echarts.getInstanceByDom(uvDom);
            if (existingUvChart) existingUvChart.dispose();
            uvChart = echarts.init(uvDom);
              const uvOption = {
              xAxis: {
                type: 'category',
                data: uvxAxisData
              },
              yAxis: {
                type: 'value'
              },
              series: [
                // 柱状图（原有）
                {
                  name: '访客量（柱状）',
                  data: uvSeriesData,
                  type: 'bar',
                  itemStyle: {
                    color: '#8B91FF' ,// 柱状图颜色
                    width: 3,
                    borderRadius: [10, 10, 10, 10], // 完全圆角
                  }
                },
                // 新增的折线图（叠加在上方）
                {
                  name: '访客量（折线）',
                  data: uvSeriesData, // 折线图数据（示例）
                  type: 'line',
                  smooth: true, // 平滑曲线
                  lineStyle: {
                    color: '#FF6B81', // 折线颜色
                    width: 3 // 线宽
                  },
                  symbol: 'circle', // 数据点显示为圆形
                  symbolSize: 8, // 数据点大小
                  label: {
                    show: true, // 显示数值标签
                    position: 'top' // 标签位置（上方）
                  }
                }
              ]
            };
            
            // 绘制图表
            uvChart.setOption(uvOption);
          }
        }
      ); // 显示错误提示，帮助用户了解问题
      // ip分布
      const ipCityXAxisData = [];
      const ipCitySeriesData = [];
      getIpCitySummaryList({}, (res) => {

        if (res && res.length) {
          for (const re of res) {
            ipCityXAxisData.push(re.ipCityName);
            ipCitySeriesData.push(re.uv || 0);
          }
          // 访客分布
          const uvDistributionDom = document.getElementById("uv-distribution-chart");
          if (!uvDistributionDom) {
            console.warn("uv-distribution-chart DOM 元素未找到，跳过图表初始化");
            return;
          }
          // 获取 DOM 上已存在的实例并销毁
          const existingDistChart = echarts.getInstanceByDom(uvDistributionDom);
          if (existingDistChart) existingDistChart.dispose();
          uvDistributionChart = echarts.init(uvDistributionDom);
          // 指定图表的配置项和数据
           const uvDistributionOption = {
            xAxis: {
              type: 'category',
              data: ipCitySeriesData
            },
            yAxis: {
              type: 'value'
            },
            series: [
              {
                data: ipCitySeriesData,
                type: 'line',
                smooth: true
              }
            ]
          };
          // 使用刚指定的配置项和数据显示图表。
          uvDistributionChart.setOption(uvDistributionOption);
        }
      }
      ); // 显示错误提示，帮助用户了解问题
      
      // 统一添加 resize 事件监听
      window.addEventListener("resize", handleResize);
    });

    onUnmounted(() => {
      window.removeEventListener("resize", handleResize);
      if (pvChart && !pvChart.isDisposed()) pvChart.dispose();
      pvChart = null;
      if (uvChart && !uvChart.isDisposed()) uvChart.dispose();
      uvChart = null;
      if (uvDistributionChart && !uvDistributionChart.isDisposed()) uvDistributionChart.dispose();
      uvDistributionChart = null;
    });

    return {
      totalVisitMap,
      yesterdayVisitMap,
    };
  },
};
</script>

<style lang="scss" scoped>
.dashboard {
  margin: 10px;

  .feature-box {
    width: calc(100% - 20px);
    margin: 10px;
    min-height: 100px;
    background-color: #ffffff;
    display: inline-block;
    border-radius: 15px;
    border: 1px solid transparent;
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      border: 1px solid #f0f0f0;
    }

    .feature-box-warp {
      padding: 16px;
    }
  }

  .feature-left-box {
    width: calc(66.6666% - 20px);
  }

  .feature-right-box {
    width: calc(33.3333% - 20px);
  }

  .feature-menu-box {
  }

  .operation-box {
    .operation {
      background: #ffffff;
      width: calc(33.3333% - 52px);
      padding: 20px;
      display: inline-flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 150px;
      border-radius: 15px;
      position: relative;

      &:nth-child(2) {
        margin: 0 18px;
      }

      .operation-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        flex: 1;
        min-height: 0;
        align-self: stretch;
      }

      .stat-icon {
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        color: #ffffff;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: transform 0.3s ease, box-shadow 0.3s ease;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }
      }

      .stat-icon-pv {
        background: linear-gradient(135deg, #7F69FF 0%, #B8A9FF 100%);
      }

      .stat-icon-uv {
        background: linear-gradient(135deg, #FF6B81 0%, #FFB3BD 100%);
      }

      .stat-icon-vv {
        background: linear-gradient(135deg, #36D1DC 0%, #5BDEEA 100%);
      }

      .title {
        color: #333333;
        font-size: 18px;
        font-weight: bold;
        line-height: 1.4;
        text-align: center;
        margin: 0;
        white-space: nowrap;
      }

      .value {
        font-size: 36px;
        margin: 0;
        font-weight: 500;
        color: #8b91ff;
        line-height: 1.2;
      }

      .bottom {
        font-size: 12px;
        color: #666666;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 12px;
        width: 100%;
        flex-shrink: 0;

        .text {
          background: #f2f2f2;
          padding: 5px 16px;
          border-radius: 16px;
          display: inline-block;
        }
      }
    }
  }

  .operation-chart-box {
    // margin: 18px 0;
    background: transparent;
    border: none;
    transition: none;

    &:hover {
      box-shadow: none;
      border: none;
    }

    .operation-chart {
      background: #ffffff;
      border-radius: 15px;
      width: calc(50% - 9px);
      display: inline-block;
      border: 1px solid transparent;
      transition: all 0.3s ease;
      box-sizing: border-box;

      &:hover {
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
        border: 1px solid #f0f0f0;
      }

      &:nth-child(2) {
        margin-left: 18px;
      }

      .operation-chart-header {
        padding: 18px 18px 0 18px;
      }

      .operation-chart-canvas {
        width: 100%;
        height: 275px;
      }
    }

    .full-width {
      width: 100%;
    }
  }
}
</style>
