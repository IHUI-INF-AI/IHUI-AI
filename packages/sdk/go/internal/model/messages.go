// Package model 的消息(发布 / 订阅 / 状态)类型。
package model

// PublishMessageRequest 是 POST /v1/messages 请求体(消息发布)。
type PublishMessageRequest struct {
	Channel    string         `json:"channel"`
	Content    string         `json:"content"`
	Recipients []string       `json:"recipients,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// PublishMessageResponse 是 POST /v1/messages 响应体。
type PublishMessageResponse struct {
	MessageID       string `json:"messageId"`
	Status          string `json:"status"`
	SubscriberCount int    `json:"subscriberCount"`
}

// SubscribeMessageRequest 是 POST /v1/messages/subscribe 请求体。
type SubscribeMessageRequest struct {
	Channel     string `json:"channel"`
	CallbackURL string `json:"callbackUrl"`
}

// SubscribeMessageResponse 是 POST /v1/messages/subscribe 响应体。
type SubscribeMessageResponse struct {
	SubscriptionID string `json:"subscriptionId"`
	Status         string `json:"status"`
}

// UnsubscribeResponse 是 DELETE /v1/messages/subscribe/:id 响应体。
type UnsubscribeResponse struct {
	SubscriptionID string `json:"subscriptionId"`
	Status         string `json:"status"`
}

// MessageStatusResponse 是 GET /v1/messages/:id/status 响应体。
type MessageStatusResponse struct {
	MessageID      string `json:"messageId"`
	Status         string `json:"status"`
	DeliveredCount int    `json:"deliveredCount"`
	FailedCount    int    `json:"failedCount"`
}
