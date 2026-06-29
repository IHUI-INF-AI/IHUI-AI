/* 顶部导航栏 通用组件 * @author: TONG * @date: 2025-04-29 */

<template>
  <view>
    <ai-template @pack="onPack">
      <template v-slot:center>
        <!-- 欢迎区域 -->

        <!-- 消息列表  -->
        <view class="messages-container">
          <!-- 用户提问与AI回复的记录 -->
          <view
            v-for="(response, index) in completedResponses"
            :key="index"
            class="conversation-item"
          >
            <!-- 用户消息 -->
            <view class="user-message">
              <view class="message-bubble user-bubble">
                <view class="message-text">{{ response.prompt }}</view>
              </view>
              <view class="user-avatar">
                <image
                  src="/static/tabbar/user-avatar.png"
                  mode="aspectFit"
                ></image>
              </view>
            </view>

            <!-- 机器人消息 -->
            <view class="robot-message">
              <view class="robot-avatar">
                <image
                  src="/static/tabbar/xiaozhi.png"
                  mode="aspectFit"
                ></image>
              </view>
              <view class="message-bubble">
                <view
                  class="message-text"
                  v-if="response.text"
                  v-html="formatContentWithHighlight(response.text)"
                ></view>
                <view class="message-actions" v-if="response.text">
                  <button class="action-btn" @tap="copyContent(response.text)">
                    复制内容
                  </button>
                </view>
                <view class="message-time">{{
                  formatTime(response.timestamp)
                }}</view>
              </view>
            </view>
          </view>

          <!-- 正在加载中的消息，只在有输入且加载中时显示 -->
          <view v-if="loading && prompt" class="conversation-item">
            <!-- 用户最新的消息 -->
            <view class="user-message">
              <view class="message-bubble user-bubble">
                <view class="message-text">{{ prompt }}</view>
              </view>
              <view class="user-avatar">
                <image
                  src="/static/tabbar/user-avatar.png"
                  mode="aspectFit"
                ></image>
              </view>
            </view>

            <!-- 正在加载中的机器人回复 -->
            <view class="robot-message">
              <view class="robot-avatar">
                <image
                  src="/static/tabbar/xiaozhi.png"
                  mode="aspectFit"
                ></image>
              </view>
              <view class="message-bubble">
                <view class="message-text loading-text">正在思考中...</view>
              </view>
            </view>
          </view>
        </view>
      </template>
      <template v-slot:button>
        <!-- 底部输入区域 -->
        <view class="input-area">
          <input
            type="text"
            v-model="prompt"
            :disabled="loading"
            placeholder="请输入产品或服务需求"
            placeholder-class="placeholder-style"
            @confirm="generateWenan"
          />
          <button
            class="send-btn"
            :disabled="loading || !prompt.trim()"
            @tap="generateWenan"
          >
            <image
              src="https://file.aizhs.top/sys-mini/fasong.png"
              mode="aspectFit"
              class="send-icon"
            ></image>
          </button>
        </view>
      </template>
    </ai-template>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import AiTemplate from "@/components/ai-template/index.vue"

const prompt = ref("")
const loading = ref(false)
const scrollTop = ref(0)
const completedResponses = ref([])
const taskId = ref(null)
let checkStatusInterval = null

function onPack() {
  console.log("点击了返回");
}

function cleanAndFormatText(text) {
  if (!text) return "";

  let cleanText = text.replace(/\n{3,}/g, "\n\n");

  cleanText = cleanText
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/```.*?```/gs, "")
    .replace(/\.{10,}/g, "")
    .trim();

  if (!cleanText.includes("【文案") && !cleanText.includes("【标题")) {
    cleanText = cleanText.replace(/^(\d+)\.\s+(.+)$/gm, "【文案 $1】\n$2");
    cleanText = cleanText.replace(/^标题[：:]\s*(.+)$/gm, "【标题: $1】");
  }

  const paragraphs = cleanText.split("\n\n");
  if (
    paragraphs.length > 1 &&
    !cleanText.includes("【文案") &&
    !cleanText.includes("【标题")
  ) {
    cleanText = paragraphs
      .map((p, index) => {
        if (p.trim()) {
          return `【文案 ${index + 1}】\n${p}`;
        }
        return p;
      })
      .join("\n\n");
  }

  return cleanText;
}

function formatContentWithHighlight(text) {
  if (!text) return "";

  let formattedText = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/```(.*?)```/gs, "<pre><code>$1</code></pre>")
    .replace(/`(.*?)`/g, "<code>$1</code>");

  if (formattedText.includes("【标题列表】")) {
    formattedText = formattedText.replace(
      "【标题列表】",
      '<div class="title-list-header">标题列表</div>'
    );
    formattedText = formattedText.replace(
      /【标题:\s*(.*?)】/g,
      '<div class="title-item">$1</div>'
    );
  }

  if (formattedText.includes("【文案内容】")) {
    formattedText = formattedText.replace(
      "【文案内容】",
      '<div class="content-header">文案内容</div>'
    );
  }

  if (formattedText.includes("【话题标签】")) {
    formattedText = formattedText.replace(
      "【话题标签】",
      '<div class="topic-header">推荐话题标签</div><div class="topic-container">'
    );

    const tagPattern = /#([^#\s]+)#/g;
    let match;
    let processedText = formattedText;
    let allTags = [];

    while ((match = tagPattern.exec(formattedText)) !== null) {
      allTags.push(`<span class="topic-tag">${match[0]}</span>`);
    }

    if (allTags.length > 0) {
      const lastIndex = processedText.lastIndexOf("#");
      if (lastIndex !== -1) {
        const beforeTags = processedText.substring(
          0,
          processedText.indexOf("#")
        );
        processedText = beforeTags + allTags.join("") + "</div>";
      }
    }
    formattedText = processedText;
  }

  formattedText = formattedText.replace(
    /【文案\s+(\d+)】/g,
    '<div class="content-section-title">文案 $1</div><div class="content-item">'
  );

  formattedText = formattedText.replace(
    /\n\n(?=【文案|【话题|<div class="topic-header")/g,
    "</div>\n\n"
  );

  if (
    formattedText.includes('<div class="content-item">') &&
    !formattedText.endsWith("</div>")
  ) {
    formattedText += "</div>";
  }

  formattedText = formattedText.replace(/\n/g, "<br>");
  console.log("3333", formattedText);
  return formattedText;
}

function onInput(e) {
  prompt.value = e.detail.value;
}

function handleSend() {
  if (!prompt.value.trim() || loading.value) return;
  generateWenan();
}

async function generateWenan() {
  if (!prompt.value.trim()) {
    uni.showToast({
      title: "请输入内容",
      icon: "none",
    });
    return;
  }

  if (loading.value) return;

  const savedPrompt = prompt.value;
  prompt.value = "";
  loading.value = true;
  taskId.value = null;

  try {
    const result = await uniCloud.callFunction({
      name: "coze_request",
      data: {
        token:
          "pat_0xEolkgnJeamfkzN8MzMuwrx0OeiwvNYzszc8odRUSRPa3tvfa1Azjl5w6n0zmDT",
        workflowId: "7490583402404839439",
        parameters: {
          prompt: savedPrompt,
        },
      },
    });

    console.log("API创建任务结果:", JSON.stringify(result));

    if (
      result.result &&
      result.result.code === 0 &&
      result.result.data &&
      result.result.data.execute_id
    ) {
      taskId.value = result.result.data.execute_id;
      console.log("获取到执行ID:", taskId.value);
      startCheckingStatus(savedPrompt);
    } else {
      throw new Error("创建任务失败: " + JSON.stringify(result));
    }
  } catch (error) {
    console.error("生成文案失败:", error);
    uni.showToast({
      title: "生成文案失败，请重试",
      icon: "none",
    });
    loading.value = false;
  }
}

async function startCheckingStatus(savedPrompt) {
  if (checkStatusInterval) {
    clearInterval(checkStatusInterval);
  }

  if (!taskId.value) {
    console.error("没有有效的执行ID");
    uni.showToast({
      title: "任务ID无效",
      icon: "none",
    });
    loading.value = false;
    return;
  }

  console.log("开始检查任务状态，执行ID:", taskId.value);

  checkStatusInterval = setInterval(async () => {
    try {
      console.log("正在查询任务状态...");
      const result = await uniCloud.callFunction({
        name: "coze_worker",
        data: {
          token:
            "pat_0xEolkgnJeamfkzN8MzMuwrx0OeiwvNYzszc8odRUSRPa3tvfa1Azjl5w6n0zmDT",
          workflowId: "7490583402404839439",
          execute_id: taskId.value,
        },
      });

      console.log("任务状态检查结果:", JSON.stringify(result));

      if (result.result && result.result.code === 0) {
        const task = result.result.data;
        console.log("任务状态:", task.status);

        if (task.status === "Success") {
          clearInterval(checkStatusInterval);
          loading.value = false;

          let textContent = "";

          if (task.rawOutput) {
            try {
              console.log("从rawOutput中提取内容:");

              if (typeof task.rawOutput === "string") {
                textContent = task.rawOutput;
              }
              else if (typeof task.rawOutput === "object") {
                const parsedResponse = parseApiResponse(task.rawOutput);
                if (parsedResponse) {
                  textContent = parsedResponse;
                } else {
                  textContent =
                    task.rawOutput.Output ||
                    task.rawOutput.data ||
                    task.rawOutput.text ||
                    JSON.stringify(task.rawOutput);
                }
              }
            } catch (error) {
              console.error("解析rawOutput出错:", error);
              textContent =
                typeof task.rawOutput === "string"
                  ? task.rawOutput
                  : JSON.stringify(task.rawOutput);
            }
          }

          if (!textContent && task.originalData) {
            try {
              console.log("从originalData中提取内容");
              const originalData = task.originalData;

              if (originalData.output) {
                try {
                  const outputObj = JSON.parse(originalData.output);

                  if (outputObj && outputObj.Output) {
                    try {
                      const parsedOutput = JSON.parse(outputObj.Output);

                      const specificFormatOutput =
                        parseApiResponse(parsedOutput);
                      if (specificFormatOutput) {
                        textContent = specificFormatOutput;
                      } else {
                        textContent =
                          parsedOutput.text ||
                          parsedOutput.content ||
                          JSON.stringify(parsedOutput);
                      }
                    } catch (err) {
                      const directParsed = parseApiResponse({
                        output: outputObj.Output,
                      });
                      if (directParsed) {
                        textContent = directParsed;
                      } else {
                        textContent = outputObj.Output;
                      }
                    }
                  }
                } catch (err) {
                  textContent = originalData.output;
                }
              }
            } catch (error) {
              console.error("从originalData提取内容失败:", error);
            }
          }

          if (!textContent && task.output) {
            textContent =
              typeof task.output === "string"
                ? task.output
                : JSON.stringify(task.output);
          }

          if (textContent) {
            textContent = cleanAndFormatText(textContent);
          }

          const responseItem = {
            prompt: savedPrompt,
            text: textContent,
            timestamp: Date.now(),
          };

          if (!completedResponses.value) {
            completedResponses.value = [];
          }
          completedResponses.value.unshift(responseItem);

          if (!textContent) {
            uni.showModal({
              title: "提示",
              content: "生成内容为空，请重试",
              showCancel: false,
            });
          } else {
            scrollToTop();

            uni.showToast({
              title: "内容生成成功",
              icon: "success",
            });
          }
        } else if (task.status === "Failed") {
          clearInterval(checkStatusInterval);
          loading.value = false;
          uni.showModal({
            title: "错误",
            content: task.error || "生成文案失败，请重试",
            showCancel: false,
          });
        }
      } else {
        console.error("API返回错误:", result.result);
        clearInterval(checkStatusInterval);
        loading.value = false;
        uni.showModal({
          title: "错误",
          content: result.result?.msg || "任务状态查询失败",
          showCancel: false,
        });
      }
    } catch (error) {
      console.error("检查任务状态失败:", error);
      clearInterval(checkStatusInterval);
      loading.value = false;
      uni.showModal({
        title: "错误",
        content:
          "检查任务状态失败，请重试: " + (error.message || "未知错误"),
        showCancel: false,
      });
    }
  }, 3000);
}

function scrollToTop() {
  scrollTop.value = 0;
}

function copyContent(text) {
  uni.setClipboardData({
    data: text,
    success: function () {
      uni.showToast({
        title: "内容已复制到剪贴板",
        icon: "success",
      });
    },
    fail: function (err) {
      console.error("复制内容失败:", err);
      uni.showToast({
        title: "复制内容失败，请手动复制",
        icon: "none",
      });
    },
  });
}

function parseApiResponse(text) {
  if (!text) return "";

  try {
    let data = text;
    if (typeof text === "string") {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log("不是有效的JSON格式，作为普通文本处理");
      }
    }

    if (typeof data === "object" && data.output) {
      console.log("解析output字段内容");

      let output = data.output;
      let formattedContent = "";

      let titleSection = "";
      let contentSection = "";
      let topicSection = "";

      if (output.includes("### 标题") && output.includes("### 文案")) {
        const titleMatch = output.match(
          /### 标题\n([\s\S]*?)(?=\n### 文案|\n### 话题词|$)/
        );
        if (titleMatch && titleMatch[1]) {
          titleSection = titleMatch[1].trim();
        }

        const contentMatch = output.match(
          /### 文案\n([\s\S]*?)(?=\n### 话题词|$)/
        );
        if (contentMatch && contentMatch[1]) {
          contentSection = contentMatch[1].trim();
        }

        const topicMatch = output.match(/### 话题词\n([\s\S]*?)$/);
        if (topicMatch && topicMatch[1]) {
          topicSection = topicMatch[1].trim();
        }

        if (titleSection) {
          formattedContent += "【标题列表】\n";
          const titles = titleSection.split("\n").filter((t) => t.trim());
          titles.forEach((title) => {
            formattedContent += title.replace(
              /^\d+\.\s*《(.*)》$/,
              "【标题: $1】\n"
            );
          });
          formattedContent += "\n";
        }

        if (contentSection) {
          formattedContent += "【文案内容】\n";
          const contents = contentSection
            .split("\n")
            .filter((c) => c.trim());
          let currentIndex = 1;

          contents.forEach((content) => {
            const match = content.match(/^(\d+)\.\s+(.*)/);
            if (match) {
              formattedContent += `【文案 ${match[1]}】\n${match[2]}\n\n`;
              currentIndex = parseInt(match[1]) + 1;
            } else {
              formattedContent += `【文案 ${currentIndex}】\n${content}\n\n`;
              currentIndex++;
            }
          });
        }

        if (topicSection) {
          formattedContent += "【话题标签】\n";
          const tags = topicSection
            .split(" ")
            .filter((t) => t.startsWith("#"));
          formattedContent += tags.join(" ");
        }

        return formattedContent;
      }
    }

    return typeof text === "string" ? text : JSON.stringify(data);
  } catch (error) {
    console.error("解析API响应失败:", error);
    return typeof text === "string" ? text : JSON.stringify(text);
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}
</script>

<style scoped lang="scss">
/* 输入区域样式 */
.input-area {
  width: 100%;
  padding: 20rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  border-top: 1px solid rgb(0 242 255 / 0.15);
  box-shadow: 0 0 10rpx rgb(0 0 0 / 0.05);

  input {
    flex: 1;
    height: 80rpx;
    padding: 0 30rpx;
    background-color: #e6f3fa;
    border-radius: 30rpx;
    font-size: 28rpx;
    color: #333;
  }

  .placeholder-style {
    color: #999;
    font-size: 28rpx;
  }

  .send-btn {
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border-radius: 30rpx;
    border: none;

    &::after {
      border: none;
    }

    .send-icon {
      width: 100rpx;
      height: 100rpx;
    }

    &:disabled {
      opacity: 0.6;
    }
  }
}

.container {
  background-color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;

  &::before {
    content: "";
    position: fixed;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 1;
  }

  /* 内容区域样式 */
  .content-area {
    flex: 1;
    padding: 30rpx 30rpx calc(120rpx + constant(safe-area-inset-bottom));
    padding: 30rpx 30rpx calc(120rpx + env(safe-area-inset-bottom));
    box-sizing: border-box;
    position: relative;
    z-index: 2;

    .welcome-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 40rpx;
      width: 100%;
      min-height: 100vh;
      position: relative;

      .logo-area {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 600rpx;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3;

        .logo-image {
          width: 500rpx;
          height: 500rpx;
          opacity: 0.95;
          filter: drop-shadow(0 0 20rpx rgb(255 255 255 / 0.3));
        }
      }

      .robot-message {
        position: absolute;
        top: 40rpx;
        left: 0;
        padding-left: 20rpx;
        width: 100%;
        box-sizing: border-box;
        z-index: 2;
        display: flex;
        align-items: flex-start;

        .robot-avatar {
          width: 80rpx;
          height: 80rpx;
          flex-shrink: 0;
          margin-right: 20rpx;

          image {
            width: 100%;
            height: 100%;
          }
        }

        .message-bubble {
          background-color: #fff;
          border-radius: 20rpx;
          padding: 20rpx;
          box-shadow: 0 0 16rpx rgb(0 0 0 / 0.1);
          max-width: 70%;

          .message-text {
            font-size: 28rpx;
            color: #000;
            line-height: 1.5;
          }
        }
      }
    }

    /* 对话容器样式 */
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 20rpx;
      padding: 20rpx 0;
    }

    /* 对话项样式 */
    .conversation-item {
      display: flex;
      flex-direction: column;
      gap: 20rpx;
      margin-bottom: 40rpx;
    }

    .user-message {
      display: flex;
      align-items: flex-start;
      justify-content: flex-end;
      padding: 0 20rpx;

      .user-avatar {
        width: 80rpx;
        height: 80rpx;
        flex-shrink: 0;
        margin-left: 20rpx;

        image {
          width: 100%;
          height: 100%;
        }
      }

      .message-bubble {
        background-color: #dcf8c6;
        border-radius: 20rpx;
        padding: 20rpx;
        box-shadow: 0 0 16rpx rgb(0 0 0 / 0.1);
        max-width: 70%;

        .message-text {
          font-size: 28rpx;
          color: #333;
          line-height: 1.5;
        }
      }
    }

    .robot-message {
      display: flex;
      align-items: flex-start;
      padding: 0 20rpx;

      .robot-avatar {
        width: 80rpx;
        height: 80rpx;
        flex-shrink: 0;
        margin-right: 20rpx;

        image {
          width: 100%;
          height: 100%;
        }
      }

      .message-bubble {
        background-color: #fff;
        border-radius: 20rpx;
        padding: 20rpx;
        box-shadow: 0 0 16rpx rgb(0 0 0 / 0.1);
        max-width: 80%;

        .message-text {
          font-size: 28rpx;
          color: #333;
          line-height: 1.5;
          margin-bottom: 15rpx;

          &.loading-text {
            color: #666;
            font-style: italic;
          }
        }

        .message-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 15rpx;

          .action-btn {
            background-color: #f5f5f5;
            color: #333;
            font-size: 24rpx;
            padding: 5rpx 15rpx;
            border-radius: 30rpx;
            border: none;
            line-height: 1.5;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;

            &:active {
              background-color: #e0e0e0;
              transform: scale(0.98);
            }
          }
        }

        .message-time {
          font-size: 22rpx;
          color: #999;
          margin-top: 10rpx;
          text-align: right;
        }
      }
    }
  }

  /* 内容样式 */
  .content-section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #007aff;
    margin: 20rpx 0 10rpx;
    padding: 6rpx 0;
    border-bottom: 1px solid rgb(0 122 255 / 0.2);
  }

  .section-title {
    font-size: 32rpx;
    font-weight: bold;
    color: #333;
    margin: 16rpx 0 8rpx;
    padding-bottom: 4rpx;
    border-bottom: 1px solid #eee;
  }

  .topic-tag {
    display: inline-block;
    background-color: #e6f3ff;
    color: #007aff;
    padding: 4rpx 12rpx;
    border-radius: 30rpx;
    margin: 8rpx 8rpx 8rpx 0;
    font-size: 24rpx;
    line-height: 1.2;
  }

  /* 标题列表样式 */
  .title-list-header {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
    margin: 20rpx 0 10rpx;
    padding: 10rpx 0;
    border-bottom: 2px solid #007aff;
  }

  .title-item {
    background-color: rgb(248 249 252 / 0.65);
    padding: 12rpx 16rpx;
    margin-bottom: 10rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
    border-left: 4rpx solid #007aff;
  }

  /* 文案内容样式 */
  .content-header {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
    margin: 30rpx 0 15rpx;
    padding: 10rpx 0;
    border-bottom: 2px solid #007aff;
  }

  .content-item {
    background-color: #f9f9f9;
    padding: 15rpx;
    margin-bottom: 15rpx;
    border-radius: 8rpx;
    box-shadow: 0 0 6rpx rgb(0 0 0 / 0.05);
  }

  /* 话题标签区域 */
  .topic-header {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
    margin: 30rpx 0 15rpx;
    padding: 10rpx 0;
    border-bottom: 2px solid #007aff;
  }

  .topic-container {
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
    margin-top: 10rpx;
  }
}
</style>
