// Package client 的核心 HTTP 客户端实现。
package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// 默认配置常量。
const (
	DefaultBaseURL    = "http://localhost:8802"
	DefaultTimeout    = 30 * time.Second
	DefaultMaxRetries = 2
)

// retryDelays 为重试退避时长,对应第 1 次 / 第 2 次重试。
var retryDelays = []time.Duration{500 * time.Millisecond, 1000 * time.Millisecond}

// Config 是 SDK 客户端配置,通过 Option 函数式选项构建。
type Config struct {
	APIKey     string
	Secret     string
	BaseURL    string
	Timeout    time.Duration
	MaxRetries int
	HTTPClient *http.Client
}

// Option 是 NewClient 的函数式选项。
type Option func(*Config)

// WithAPIKey 设置 API Key(必需,格式 ihui_xxx)。
func WithAPIKey(key string) Option {
	return func(c *Config) { c.APIKey = key }
}

// WithSecret 设置可选的 API Secret。
func WithSecret(secret string) Option {
	return func(c *Config) { c.Secret = secret }
}

// WithBaseURL 设置基础 URL,默认 http://localhost:8802。
func WithBaseURL(u string) Option {
	return func(c *Config) { c.BaseURL = u }
}

// WithTimeout 设置请求超时,默认 30s;流式请求不受此限制。
func WithTimeout(d time.Duration) Option {
	return func(c *Config) { c.Timeout = d }
}

// WithMaxRetries 设置最大重试次数,默认 2;网络错误与 5xx 自动重试,429 不重试。
func WithMaxRetries(n int) Option {
	return func(c *Config) { c.MaxRetries = n }
}

// WithHTTPClient 注入自定义 http.Client(测试 / 拦截用)。
func WithHTTPClient(h *http.Client) Option {
	return func(c *Config) { c.HTTPClient = h }
}

// BaseClient 是 SDK 基础客户端,封装鉴权、重试、超时与错误处理。
//
// 所有业务模块共享一个 BaseClient 实例。
type BaseClient struct {
	apiKey     string
	secret     string
	baseURL    string
	timeout    time.Duration
	maxRetries int
	httpClient *http.Client
}

// NewClient 用 Option 构造 BaseClient。
//
// apiKey 缺失时不返回错误(让请求时返回 AuthenticationError),
// 这样可以支持 NewIhuiClient 单返回值风格。
// 调用方应在调用 NewClient 后用 Validate() 主动校验。
func NewClient(opts ...Option) (*BaseClient, error) {
	cfg := &Config{
		BaseURL:    DefaultBaseURL,
		Timeout:    DefaultTimeout,
		MaxRetries: DefaultMaxRetries,
	}
	for _, opt := range opts {
		opt(cfg)
	}
	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: cfg.Timeout}
	}
	return &BaseClient{
		apiKey:     cfg.APIKey,
		secret:     cfg.Secret,
		baseURL:    normalizeBaseURL(cfg.BaseURL),
		timeout:    cfg.Timeout,
		maxRetries: cfg.MaxRetries,
		httpClient: httpClient,
	}, nil
}

// normalizeBaseURL 去除尾部斜杠。
func normalizeBaseURL(u string) string {
	return strings.TrimRight(u, "/")
}

// BaseURL 返回当前基础 URL(无尾部斜杠)。
func (c *BaseClient) BaseURL() string {
	return c.baseURL
}

// Validate 校验配置(apiKey 必需),返回错误时表示配置不完整。
func (c *BaseClient) Validate() error {
	return c.checkAPIKey()
}

// checkAPIKey 在请求前校验 apiKey,缺失时返回 AuthenticationError。
func (c *BaseClient) checkAPIKey() error {
	if strings.TrimSpace(c.apiKey) == "" {
		return &AuthenticationError{SdkError{
			Status:  401,
			Code:    "missing_api_key",
			Details: map[string]any{"message": "apiKey is required"},
		}}
	}
	return nil
}

// buildHeaders 构造鉴权 + Content-Type 头。
func (c *BaseClient) buildHeaders() http.Header {
	h := http.Header{}
	h.Set("Authorization", "Bearer "+c.apiKey)
	h.Set("Content-Type", "application/json")
	if c.secret != "" {
		h.Set("X-Api-Secret", c.secret)
	}
	return h
}

// buildURL 拼接完整 URL,basePath 不含 /v1 前缀(由本方法添加)。
func (c *BaseClient) buildURL(path string) string {
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return c.baseURL + "/v1" + path
}

// Encode 对路径段进行 URL 编码,封装 url.PathEscape 便于业务层调用。
func Encode(segment string) string {
	return url.PathEscape(segment)
}

// Request 发起 JSON 请求并将响应反序列化到 out。
//
// method 为 HTTP 方法;path 不含 /v1 前缀;body 为请求体对象(可为 nil)。
// 网络错误与 5xx 自动重试(指数退避 500ms / 1000ms),429 与 4xx 不重试。
// 空响应体保留 out 不变(调用方应传入预初始化的对象或 nil)。
func (c *BaseClient) Request(ctx context.Context, method, path string, body, out any) error {
	raw, err := c.requestRaw(ctx, method, path, body)
	if err != nil {
		return err
	}
	if len(raw) == 0 {
		return nil
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(raw, out)
}

// RequestRaw 发起 JSON 请求并返回原始响应字节。
func (c *BaseClient) RequestRaw(ctx context.Context, method, path string, body any) ([]byte, error) {
	return c.requestRaw(ctx, method, path, body)
}

// requestRaw 是核心请求实现,含重试逻辑。
func (c *BaseClient) requestRaw(ctx context.Context, method, path string, body any) ([]byte, error) {
	if err := c.checkAPIKey(); err != nil {
		return nil, err
	}
	var bodyBuf []byte
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("ihui sdk: marshal request body: %w", err)
		}
		bodyBuf = buf
	}

	maxAttempts := c.maxRetries
	if maxAttempts < 0 {
		maxAttempts = 0
	}

	var lastErr error
	for attempt := 0; attempt <= maxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if attempt > 0 {
			delay := retryDelay(attempt - 1)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		var reqBody io.Reader
		if body != nil {
			reqBody = bytes.NewReader(bodyBuf)
		}
		req, err := http.NewRequestWithContext(ctx, method, c.buildURL(path), reqBody)
		if err != nil {
			lastErr = NewNetworkError(err.Error())
			continue
		}
		req.Header = c.buildHeaders()

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = NewNetworkError(err.Error())
			continue
		}

		respBody, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = NewNetworkError(readErr.Error())
			continue
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return respBody, nil
		}

		lastErr = NewErrorFromStatus(resp.StatusCode, respBody)
		// 429 与 4xx 不重试
		if resp.StatusCode == 429 || resp.StatusCode < 500 {
			break
		}
		// 5xx 继续重试
	}

	if lastErr == nil {
		lastErr = &SdkError{
			Status:  500,
			Code:    "unknown_error",
			Details: map[string]any{"message": "Unknown error"},
		}
	}
	return nil, lastErr
}

// RequestStream 发起流式请求,返回原始 HTTP 响应(调用方负责关闭 Body)。
//
// 流式请求不重试(无法安全回放流),但 timeout 仍生效(除非用 context 控制)。
// 调用方应使用 StreamSSE 解析响应体。
func (c *BaseClient) RequestStream(ctx context.Context, method, path string, body any) (*http.Response, error) {
	if err := c.checkAPIKey(); err != nil {
		return nil, err
	}
	var reqBody io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("ihui sdk: marshal stream body: %w", err)
		}
		reqBody = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.buildURL(path), reqBody)
	if err != nil {
		return nil, NewNetworkError(err.Error())
	}
	req.Header = c.buildHeaders()
	req.Header.Set("Accept", "text/event-stream")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, NewNetworkError(err.Error())
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		return nil, NewErrorFromStatus(resp.StatusCode, respBody)
	}
	return resp, nil
}

// RequestMultipart 发起 multipart/form-data 上传请求。
//
// contentType 必须包含 boundary(如 multipart.Writer 的 FormDataContentType())。
// bodyBuf 为已构造好的 multipart 字节缓冲。
func (c *BaseClient) RequestMultipart(ctx context.Context, path, contentType string, bodyBuf []byte, out any) error {
	if err := c.checkAPIKey(); err != nil {
		return err
	}
	maxAttempts := c.maxRetries
	if maxAttempts < 0 {
		maxAttempts = 0
	}

	var lastErr error
	for attempt := 0; attempt <= maxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		if attempt > 0 {
			delay := retryDelay(attempt - 1)
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(delay):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.buildURL(path), bytes.NewReader(bodyBuf))
		if err != nil {
			lastErr = NewNetworkError(err.Error())
			continue
		}
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		if c.secret != "" {
			req.Header.Set("X-Api-Secret", c.secret)
		}
		req.Header.Set("Content-Type", contentType)

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = NewNetworkError(err.Error())
			continue
		}

		respBody, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = NewNetworkError(readErr.Error())
			continue
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if out == nil || len(respBody) == 0 {
				return nil
			}
			return json.Unmarshal(respBody, out)
		}

		lastErr = NewErrorFromStatus(resp.StatusCode, respBody)
		if resp.StatusCode == 429 || resp.StatusCode < 500 {
			break
		}
	}
	if lastErr == nil {
		lastErr = &SdkError{
			Status:  500,
			Code:    "unknown_error",
			Details: map[string]any{"message": "Unknown error"},
		}
	}
	return lastErr
}

// RequestBytes 发起 GET 请求并返回原始字节数组(用于文件内容下载)。
func (c *BaseClient) RequestBytes(ctx context.Context, path string) ([]byte, error) {
	if err := c.checkAPIKey(); err != nil {
		return nil, err
	}
	maxAttempts := c.maxRetries
	if maxAttempts < 0 {
		maxAttempts = 0
	}

	var lastErr error
	for attempt := 0; attempt <= maxAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if attempt > 0 {
			delay := retryDelay(attempt - 1)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(delay):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.buildURL(path), nil)
		if err != nil {
			lastErr = NewNetworkError(err.Error())
			continue
		}
		req.Header = c.buildHeaders()

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = NewNetworkError(err.Error())
			continue
		}
		respBody, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			lastErr = NewNetworkError(readErr.Error())
			continue
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return respBody, nil
		}
		lastErr = NewErrorFromStatus(resp.StatusCode, respBody)
		if resp.StatusCode == 429 || resp.StatusCode < 500 {
			break
		}
	}
	if lastErr == nil {
		lastErr = &SdkError{
			Status:  500,
			Code:    "unknown_error",
			Details: map[string]any{"message": "Unknown error"},
		}
	}
	return nil, lastErr
}

// retryDelay 返回第 idx 次重试的退避时长(超出数组范围时取最后一项)。
func retryDelay(idx int) time.Duration {
	if idx < 0 {
		return retryDelays[0]
	}
	if idx >= len(retryDelays) {
		return retryDelays[len(retryDelays)-1]
	}
	return retryDelays[idx]
}
