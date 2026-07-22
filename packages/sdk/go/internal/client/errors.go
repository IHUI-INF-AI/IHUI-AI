// Package client 提供 SDK 基础客户端,封装鉴权、重试、超时、错误处理与流式响应解析。
//
// 错误层级:
//
//	SdkError                // 基类
//	├── AuthenticationError // 401 未授权
//	├── PermissionError     // 403 禁止访问
//	├── NotFoundError       // 404 资源不存在
//	├── QuotaExceededError  // 429 配额超限
//	└── ServerError         // 5xx 服务端错误
package client

import (
	"encoding/json"
	"fmt"
)

// SdkError 是所有 SDK 错误的基类,携带 HTTP 状态码、错误码与详情。
type SdkError struct {
	Status  int
	Code    string
	Details any
}

// Error 实现 error 接口。
func (e *SdkError) Error() string {
	return fmt.Sprintf("ihui sdk error: status=%d code=%s message=%s", e.Status, e.Code, e.messageOrEmpty())
}

func (e *SdkError) messageOrEmpty() string {
	if e.Details == nil {
		return ""
	}
	if m, ok := e.Details.(map[string]any); ok {
		if v, ok := m["message"].(string); ok {
			return v
		}
	}
	return ""
}

// AuthenticationError 表示 401 未授权错误。
type AuthenticationError struct {
	SdkError
}

// PermissionError 表示 403 禁止访问错误。
type PermissionError struct {
	SdkError
}

// QuotaExceededError 表示 429 配额超限错误。
type QuotaExceededError struct {
	SdkError
}

// NotFoundError 表示 404 资源不存在错误。
type NotFoundError struct {
	SdkError
}

// ServerError 表示 5xx 服务端错误。
type ServerError struct {
	SdkError
}

// NewErrorFromStatus 根据 HTTP 状态码与响应体构造对应的错误子类。
//
// status 为 HTTP 状态码(网络错误传 0);body 为响应体原始字节(可为空)。
// 解析失败时回退为通用 SdkError。
func NewErrorFromStatus(status int, body []byte) error {
	code := fmt.Sprintf("http_%d", status)
	message := fmt.Sprintf("HTTP %d", status)
	var details any

	if len(body) > 0 {
		var root map[string]any
		if err := json.Unmarshal(body, &root); err == nil {
			errObj, _ := root["error"].(map[string]any)
			if c, ok := getString(root, errObj, "code"); ok {
				code = c
			}
			if m, ok := getString(root, errObj, "message"); ok {
				message = m
			}
			if d, ok := root["details"]; ok {
				details = d
			} else if errObj != nil {
				if d, ok := errObj["details"]; ok {
					details = d
				}
			}
			if details == nil && message != "" {
				details = map[string]any{"message": message}
			}
		}
	}

	base := SdkError{Status: status, Code: code, Details: details}
	switch {
	case status == 401:
		return &AuthenticationError{SdkError: base}
	case status == 403:
		return &PermissionError{SdkError: base}
	case status == 404:
		return &NotFoundError{SdkError: base}
	case status == 429:
		return &QuotaExceededError{SdkError: base}
	case status >= 500:
		return &ServerError{SdkError: base}
	default:
		// 保留 message 在 Details 中便于上层取用
		if details == nil {
			base.Details = map[string]any{"message": message}
		}
		return &base
	}
}

// getString 从 root 或 errObj 中读取字符串字段,优先 errObj。
func getString(root, errObj map[string]any, key string) (string, bool) {
	if errObj != nil {
		if v, ok := errObj[key].(string); ok {
			return v, true
		}
	}
	if root != nil {
		if v, ok := root[key].(string); ok {
			return v, true
		}
	}
	return "", false
}

// NewNetworkError 构造网络错误(状态码 0)。
func NewNetworkError(message string) error {
	return &SdkError{
		Status:  0,
		Code:    "network_error",
		Details: map[string]any{"message": message},
	}
}
