// Package client 的 SSE 流式响应解析器。
//
// 支持两种流式端点:
//   - POST /v1/chat/completions(stream:true)→ OpenAI 兼容 `data: {json}\n\n` + `data: [DONE]`
//   - POST /v1/agents/execute/stream → 逐行透传 SSE 事件
package client

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
)

// StreamSSE 解析 SSE 流,将每个 `data: ...` 行解析为 map[string]any 并发送到 channel。
//
// 行为:
//   - `data: [DONE]` 终止流并关闭 channel
//   - 解析失败的 data 行作为 {"_raw": "<payload>"} 发送
//   - 非 `data:` 开头的非空行作为 {"_raw": "<line>"} 发送
//   - resp.Body 在流结束 / context 取消时关闭
//
// 调用方:`for chunk := range stream { ... }`。
func StreamSSE(ctx context.Context, body io.ReadCloser) <-chan map[string]any {
	ch := make(chan map[string]any)
	go func() {
		defer close(ch)
		defer body.Close()

		reader := bufio.NewReaderSize(body, 64*1024)
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			line, err := reader.ReadString('\n')
			if err != nil {
				if errors.Is(err, io.EOF) {
					if line != "" {
						if chunk := parseSSELine(line); chunk != nil {
							select {
							case ch <- chunk:
							case <-ctx.Done():
								return
							}
						}
					}
					return
				}
				// 网络错误:发送错误信息后结束
				select {
				case ch <- map[string]any{"_error": err.Error()}:
				case <-ctx.Done():
				}
				return
			}

			chunk := parseSSELine(line)
			if chunk == nil {
				continue
			}
			if _, done := chunk["__done"]; done {
				return
			}
			select {
			case ch <- chunk:
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch
}

// parseSSELine 解析单行 SSE,返回 map[string]any;返回 nil 表示跳过(空行 / 注释)。
//
// `data: [DONE]` 返回 {"__done": true}(调用方检测到后终止流)。
// 解析失败时返回 {"_raw": payload}。
func parseSSELine(line string) map[string]any {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" {
		return nil
	}
	if strings.HasPrefix(trimmed, ":") {
		// SSE 注释
		return nil
	}
	if strings.HasPrefix(trimmed, "data:") {
		payload := strings.TrimSpace(strings.TrimPrefix(trimmed, "data:"))
		if payload == "[DONE]" {
			return map[string]any{"__done": true}
		}
		var obj map[string]any
		if err := json.Unmarshal([]byte(payload), &obj); err == nil {
			return obj
		}
		return map[string]any{"_raw": payload}
	}
	if strings.HasPrefix(trimmed, "event:") {
		return map[string]any{"_event": strings.TrimSpace(strings.TrimPrefix(trimmed, "event:"))}
	}
	return map[string]any{"_raw": trimmed}
}
