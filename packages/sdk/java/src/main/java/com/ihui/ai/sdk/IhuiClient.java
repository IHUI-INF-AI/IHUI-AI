package com.ihui.ai.sdk;

import com.ihui.ai.sdk.module.AgentsApi;
import com.ihui.ai.sdk.module.AiApi;
import com.ihui.ai.sdk.module.AudioApi;
import com.ihui.ai.sdk.module.FilesApi;
import com.ihui.ai.sdk.module.GenerationApi;
import com.ihui.ai.sdk.module.ImagesApi;
import com.ihui.ai.sdk.module.KnowledgeApi;
import com.ihui.ai.sdk.module.MemoryApi;
import com.ihui.ai.sdk.module.MessagesApi;
import com.ihui.ai.sdk.module.ThreeDApi;
import com.ihui.ai.sdk.module.ToolsApi;
import com.ihui.ai.sdk.module.UserApi;
import com.ihui.ai.sdk.module.VideosApi;

import java.time.Duration;

/**
 * IHUI SDK 客户端,聚合 13 个功能模块,封装 105 个 /v1/* API 端点。
 *
 * <p>用法:
 * <pre>
 * IhuiClient client = IhuiClient.builder()
 *     .apiKey("ihui_xxx")
 *     .baseUrl("http://localhost:8802")
 *     .build();
 *
 * ChatCompletionResponse resp = client.ai.completions(
 *     ChatCompletionRequest.builder()
 *         .model("gpt-4o")
 *         .addMessage("user", "你好")
 *         .build()
 * );
 * </pre>
 *
 * <p>流式响应(try-with-resources):
 * <pre>
 * try (StreamResponse stream = client.ai.completionsStream(req)) {
 *     while (stream.hasNext()) {
 *         JsonNode chunk = stream.next();
 *         // 处理 chunk
 *     }
 * }
 * </pre>
 */
public final class IhuiClient {

    /** AI 核心:chat / embeddings / vision / moa / models / userModels(13 端点)。 */
    public final AiApi ai;

    /** Agent:列表 / 调用 / 高级执行 / Pipeline / 并行(12 端点)。 */
    public final AgentsApi agents;

    /** 音频:TTS / ASR / 语音对话 / 声纹 / 音乐(8 端点)。 */
    public final AudioApi audio;

    /** 图像:文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景(6 端点)。 */
    public final ImagesApi images;

    /** 视频:生成 / 任务查询 / 编排(3 端点)。 */
    public final VideosApi videos;

    /** 3D 模型生成(1 端点)。 */
    public final ThreeDApi threed;

    /** 生成队列:入队 / 状态 / 取消(3 端点)。 */
    public final GenerationApi generation;

    /** 知识库 / RAG / 知识图谱(13 端点)。 */
    public final KnowledgeApi knowledge;

    /** MCP 工具 / 技能 / 人格 / 代码搜索 / 截图(16 端点)。 */
    public final ToolsApi tools;

    /** 记忆:保存 / 召回 / 搜索 / Dream / 分类记忆(8 端点)。 */
    public final MemoryApi memory;

    /** 消息:发布 / 订阅 / 状态(4 端点)。 */
    public final MessagesApi messages;

    /** 文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传(9 端点)。 */
    public final FilesApi files;

    /** 用户 / 工作区 / 工作流 / 统计(9 端点)。 */
    public final UserApi user;

    private final BaseClient baseClient;

    /**
     * 用 SdkConfig 构造 IhuiClient。
     *
     * @param config SDK 配置
     */
    public IhuiClient(SdkConfig config) {
        this.baseClient = new BaseClient(config);
        this.ai = new AiApi(baseClient);
        this.agents = new AgentsApi(baseClient);
        this.audio = new AudioApi(baseClient);
        this.images = new ImagesApi(baseClient);
        this.videos = new VideosApi(baseClient);
        this.threed = new ThreeDApi(baseClient);
        this.generation = new GenerationApi(baseClient);
        this.knowledge = new KnowledgeApi(baseClient);
        this.tools = new ToolsApi(baseClient);
        this.memory = new MemoryApi(baseClient);
        this.messages = new MessagesApi(baseClient);
        this.files = new FilesApi(baseClient);
        this.user = new UserApi(baseClient);
    }

    /** @return 底层 BaseClient(供高级用户扩展)。 */
    public BaseClient getBaseClient() {
        return baseClient;
    }

    /**
     * 创建 Builder。
     *
     * @return 新的 Builder 实例
     */
    public static Builder builder() {
        return new Builder();
    }

    /** IhuiClient builder。 */
    public static final class Builder {

        private final SdkConfig.Builder configBuilder = SdkConfig.builder();

        private Builder() {
        }

        /**
         * 设置 API Key(必需)。
         *
         * @param apiKey API Key(格式 ihui_xxx)
         * @return 当前 builder
         */
        public Builder apiKey(String apiKey) {
            configBuilder.apiKey(apiKey);
            return this;
        }

        /**
         * 设置 API Secret(可选)。
         *
         * @param secret API Secret
         * @return 当前 builder
         */
        public Builder secret(String secret) {
            configBuilder.secret(secret);
            return this;
        }

        /**
         * 设置基础 URL。
         *
         * @param baseUrl 基础 URL(默认 http://localhost:8802)
         * @return 当前 builder
         */
        public Builder baseUrl(String baseUrl) {
            configBuilder.baseUrl(baseUrl);
            return this;
        }

        /**
         * 设置请求超时。
         *
         * @param timeout 超时时长(默认 30s)
         * @return 当前 builder
         */
        public Builder timeout(Duration timeout) {
            configBuilder.timeout(timeout);
            return this;
        }

        /**
         * 设置最大重试次数。
         *
         * @param maxRetries 最大重试次数(默认 2)
         * @return 当前 builder
         */
        public Builder maxRetries(int maxRetries) {
            configBuilder.maxRetries(maxRetries);
            return this;
        }

        /**
         * 构建 IhuiClient。
         *
         * @return IhuiClient 实例
         */
        public IhuiClient build() {
            return new IhuiClient(configBuilder.build());
        }
    }
}
