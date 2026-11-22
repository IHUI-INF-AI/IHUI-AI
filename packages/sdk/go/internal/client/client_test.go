// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

package client

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)
// newTestClient 构造指向 httptest server 的客户端。
func newTestClient(t *testing.T, serverURL string, maxRetries int) *BaseClient {
	t.Helper()
	c, err := NewClient(WithAPIKey("ihui_test_key"), WithBaseURL(serverURL), WithMaxRetries(maxRetries))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return c
}

func TestRequestAssembly(t *testing.T) {
	var gotPath, gotAuth, gotSecret, gotMethod, gotBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		gotSecret = r.Header.Get("X-Api-Secret")
		gotMethod = r.Method
		b, _ := io.ReadAll(r.Body)
		gotBody = string(b)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	c, err := NewClient(WithAPIKey("ihui_test_key"), WithBaseURL(srv.URL), WithMaxRetries(0), WithSecret("sec_123"))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	var out map[string]any
	body := map[string]any{"model": "gpt-4o", "messages": []map[string]string{{"role": "user", "content": "hi"}}}
	if err := c.Request(context.Background(), "POST", "/chat/completions", body, &out); err != nil {
		t.Fatalf("Request: %v", err)
	}
	if gotPath != "/v1/chat/completions" {
		t.Errorf("path = %q, want /v1/chat/completions", gotPath)
	}
	if gotMethod != "POST" {
		t.Errorf("method = %q, want POST", gotMethod)
	}
	if gotAuth != "Bearer ihui_test_key" {
		t.Errorf("Authorization = %q", gotAuth)
	}
	if gotSecret != "sec_123" {
		t.Errorf("X-Api-Secret = %q, want sec_123", gotSecret)
	}
	var sent map[string]any
	if err := json.Unmarshal([]byte(gotBody), &sent); err != nil {
		t.Fatalf("request body not valid JSON: %v", err)
	}
	if sent["model"] != "gpt-4o" {
		t.Errorf("request body model = %v", sent["model"])
	}
	if out["ok"] != true {
		t.Errorf("response out = %v", out)
	}
}

func TestRequestNoSecretHeaderWhenEmpty(t *testing.T) {
	var gotSecret string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotSecret = r.Header.Get("X-Api-Secret")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv.URL, 0)
	if err := c.Request(context.Background(), "GET", "/models", nil, nil); err != nil {
		t.Fatalf("Request: %v", err)
	}
	if gotSecret != "" {
		t.Errorf("X-Api-Secret = %q, want empty", gotSecret)
	}
}

func TestRequestGETNoBody(t *testing.T) {
	var gotMethod string
	var gotBodyLen int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod = r.Method
		b, _ := io.ReadAll(r.Body)
		gotBodyLen = len(b)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv.URL, 0)
	if err := c.Request(context.Background(), "GET", "/models", nil, nil); err != nil {
		t.Fatalf("Request: %v", err)
	}
	if gotMethod != "GET" || gotBodyLen != 0 {
		t.Errorf("method=%s bodyLen=%d, want GET/0", gotMethod, gotBodyLen)
	}
}

func TestErrorMapping(t *testing.T) {
	// 嵌入的是 SdkError 值类型,concrete 错误不能 errors.As 到 **SdkError,
	// 因此每个闭包返回内嵌的 *SdkError 供断言。
	asAuth := func(err error) *SdkError { var e *AuthenticationError; if errors.As(err, &e) { return &e.SdkError }; return nil }
	asNotFound := func(err error) *SdkError { var e *NotFoundError; if errors.As(err, &e) { return &e.SdkError }; return nil }
	asQuota := func(err error) *SdkError { var e *QuotaExceededError; if errors.As(err, &e) { return &e.SdkError }; return nil }
	asServer := func(err error) *SdkError { var e *ServerError; if errors.As(err, &e) { return &e.SdkError }; return nil }
	asPermission := func(err error) *SdkError { var e *PermissionError; if errors.As(err, &e) { return &e.SdkError }; return nil }

	cases := []struct {
		name     string
		status   int
		body     string
		wantType func(error) *SdkError
		wantCode string
	}{
		{"401 flat", 401, `{"code":"auth_invalid_api_key","message":"bad key"}`, asAuth, "auth_invalid_api_key"},
		{"404 nested", 404, `{"error":{"code":"model_not_found","message":"no such model"}}`, asNotFound, "model_not_found"},
		{"429 quota", 429, `{"code":"rate_limited","message":"slow"}`, asQuota, "rate_limited"},
		{"500 server", 500, `{"code":"boom","message":"x"}`, asServer, "boom"},
		{"403 permission", 403, `{"code":"forbidden","message":"no"}`, asPermission, "forbidden"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				_, _ = w.Write([]byte(tc.body))
			}))
			defer srv.Close()

			c := newTestClient(t, srv.URL, 0)
			err := c.Request(context.Background(), "GET", "/x", nil, nil)
			if err == nil {
				t.Fatal("want error, got nil")
			}
			se := tc.wantType(err)
			if se == nil {
				t.Fatalf("error type = %T, unexpected", err)
			}
			if se.Code != tc.wantCode {
				t.Errorf("code = %q, want %q", se.Code, tc.wantCode)
			}
		})
	}
}

func TestInvalidJSONErrorBodyFallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(418)
		_, _ = w.Write([]byte("<html>teapot</html>"))
	}))
	defer srv.Close()

	c := newTestClient(t, srv.URL, 0)
	err := c.Request(context.Background(), "GET", "/x", nil, nil)
	var se *SdkError
	if !errors.As(err, &se) {
		t.Fatalf("want SdkError, got %T", err)
	}
	if se.Status != 418 || se.Code != "http_418" {
		t.Errorf("status=%d code=%q, want 418/http_418", se.Status, se.Code)
	}
}

func Test429NoRetry(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(429)
		_, _ = w.Write([]byte(`{"code":"rate_limited"}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv.URL, 2)
	_, _ = c.RequestRaw(context.Background(), "GET", "/x", nil)
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Errorf("calls = %d, want 1 (429 must not retry)", got)
	}
}

func Test500Retries(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.WriteHeader(500)
		_, _ = w.Write([]byte(`{"code":"boom"}`))
	}))
	defer srv.Close()

	c := newTestClient(t, srv.URL, 2)
	_, err := c.RequestRaw(context.Background(), "GET", "/x", nil)
	var se *ServerError
	if !errors.As(err, &se) {
		t.Fatalf("want ServerError, got %T", err)
	}
	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Errorf("calls = %d, want 3 (1 original + 2 retries)", got)
	}
}

func TestNetworkErrorRetries(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	url := srv.URL
	srv.Close() // 立即关闭,制造连接失败

	c := newTestClient(t, url, 1)
	_, err := c.RequestRaw(context.Background(), "GET", "/x", nil)
	var se *SdkError
	if !errors.As(err, &se) {
		t.Fatalf("want SdkError, got %T", err)
	}
	if se.Status != 0 || se.Code != "network_error" {
		t.Errorf("status=%d code=%q, want 0/network_error", se.Status, se.Code)
	}
}

func TestMissingAPIKey(t *testing.T) {
	c, err := NewClient(WithBaseURL("http://localhost:1"))
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	if err := c.Validate(); err == nil {
		t.Fatal("Validate should fail without api key")
	}
	_, reqErr := c.RequestRaw(context.Background(), "GET", "/x", nil)
	var authErr *AuthenticationError
	if !errors.As(reqErr, &authErr) {
		t.Fatalf("want AuthenticationError, got %T", reqErr)
	}
	if authErr.Code != "missing_api_key" {
		t.Errorf("code = %q, want missing_api_key", authErr.Code)
	}
}

// TestStreamSSECrossChunk 验证 SSE 解析:多帧、跨写断帧、[DONE] 终止、raw 回退。
func TestStreamSSECrossChunk(t *testing.T) {
	frame := `data: {"id":"a","choices":[{"delta":{"content":"x"}}]}` + "\n\n"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher := w.(http.Flusher)
		// 同一帧分两次写出(模拟网络分块)
		_, _ = w.Write([]byte(frame[:20]))
		flusher.Flush()
		_, _ = w.Write([]byte(frame[20:] + "\n"))
		flusher.Flush()
		_, _ = w.Write([]byte("data: <<raw>>\n\n"))
		flusher.Flush()
		_, _ = w.Write([]byte("data: [DONE]\n\n"))
		flusher.Flush()
		// [DONE] 后不应再被消费
		_, _ = w.Write([]byte("data: {\"id\":\"never\"}\n\n"))
		flusher.Flush()
	}))
	defer srv.Close()

	resp, err := http.Get(srv.URL)
	if err != nil {
		t.Fatalf("http.Get: %v", err)
	}
	defer resp.Body.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var got []map[string]any
	for chunk := range StreamSSE(ctx, resp.Body) {
		if _, done := chunk["__done"]; done {
			break
		}
		got = append(got, chunk)
	}

	if len(got) != 2 {
		t.Fatalf("got %d chunks, want 2; got=%v", len(got), got)
	}
	if got[0]["id"] != "a" {
		t.Errorf("first chunk id = %v, want a", got[0]["id"])
	}
	if raw, ok := got[1]["_raw"].(string); !ok || raw != "<<raw>>" {
		t.Errorf("second chunk = %v, want _raw=<<raw>>", got[1])
	}
}

func TestBaseURLTrailingSlash(t *testing.T) {
	c, _ := NewClient(WithAPIKey("k"), WithBaseURL("http://test.local///"))
	if got := c.BaseURL(); got != "http://test.local" {
		t.Errorf("BaseURL = %q, want http://test.local", got)
	}
	if !strings.HasPrefix(c.buildURL("/x"), "http://test.local/v1/x") {
		t.Errorf("buildURL = %q", c.buildURL("/x"))
	}
}
