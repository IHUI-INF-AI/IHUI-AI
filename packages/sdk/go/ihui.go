// Package ihui 提供 IHUI-AI 平台的 Go SDK,封装 105 个 /v1/* 对外开放 API 端点。
//
// 用法:
//
//	client := ihui.NewIhuiClient(
//	    ihui.WithAPIKey("ihui_xxx"),
//	    ihui.WithBaseURL("http://localhost:8802"),
//	)
//	resp, err := client.AI.Completions(ctx, &model.ChatCompletionRequest{
//	    Model:    "gpt-4o",
//	    Messages: []model.Message{{Role: "user", Content: "你好"}},
//	})
//
// 流式响应:
//
//	stream, err := client.AI.CompletionsStream(ctx, req)
//	for chunk := range stream {
//	    fmt.Printf("%v\n", chunk)
//	}
package ihui

import (
	"net/http"
	"time"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/module"
)

// IhuiClient 是 IHUI SDK 主客户端,聚合 13 个功能模块,共 106 个端点。
type IhuiClient struct {
	AI         *module.AiApi
	Agents     *module.AgentsApi
	Audio      *module.AudioApi
	Images     *module.ImagesApi
	Videos     *module.VideosApi
	ThreeD     *module.ThreeDApi
	Generation *module.GenerationApi
	Knowledge  *module.KnowledgeApi
	Tools      *module.ToolsApi
	Memory     *module.MemoryApi
	Messages   *module.MessagesApi
	Files      *module.FilesApi
	User       *module.UserApi

	base *client.BaseClient
}

// Option 是 NewIhuiClient 的函数式选项,转发到 client.Option。
type Option = client.Option

// WithAPIKey 设置 API Key(必需,格式 ihui_xxx)。
func WithAPIKey(key string) Option { return client.WithAPIKey(key) }

// WithSecret 设置可选的 API Secret。
func WithSecret(secret string) Option { return client.WithSecret(secret) }

// WithBaseURL 设置基础 URL,默认 http://localhost:8802。
func WithBaseURL(url string) Option { return client.WithBaseURL(url) }

// WithTimeout 设置请求超时,默认 30s;流式请求不受此限制。
func WithTimeout(d time.Duration) Option { return client.WithTimeout(d) }

// WithMaxRetries 设置最大重试次数,默认 2;网络错误与 5xx 自动重试,429 不重试。
func WithMaxRetries(n int) Option { return client.WithMaxRetries(n) }

// WithHTTPClient 注入自定义 http.Client(测试 / 拦截用)。
func WithHTTPClient(c *http.Client) Option { return client.WithHTTPClient(c) }

// NewIhuiClient 用 Option 构造 IhuiClient。
//
// apiKey 缺失时不返回错误,会在第一次请求时返回 AuthenticationError。
// 调用方可主动调用 client.BaseClient().Validate() 提前校验。
func NewIhuiClient(opts ...Option) *IhuiClient {
	base, _ := client.NewClient(opts...)
	return &IhuiClient{
		AI:         module.NewAiApi(base),
		Agents:     module.NewAgentsApi(base),
		Audio:      module.NewAudioApi(base),
		Images:     module.NewImagesApi(base),
		Videos:     module.NewVideosApi(base),
		ThreeD:     module.NewThreeDApi(base),
		Generation: module.NewGenerationApi(base),
		Knowledge:  module.NewKnowledgeApi(base),
		Tools:      module.NewToolsApi(base),
		Memory:     module.NewMemoryApi(base),
		Messages:   module.NewMessagesApi(base),
		Files:      module.NewFilesApi(base),
		User:       module.NewUserApi(base),
		base:       base,
	}
}

// BaseClient 返回底层 BaseClient(供高级用户扩展使用)。
func (c *IhuiClient) BaseClient() *client.BaseClient {
	return c.base
}
