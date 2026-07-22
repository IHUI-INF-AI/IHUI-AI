// Package module 的消息模块(4 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// MessagesApi 封装消息端点(4 个):发布 / 订阅 / 取消订阅 / 状态。
type MessagesApi struct {
	client *client.BaseClient
}

// NewMessagesApi 构造 MessagesApi。
func NewMessagesApi(c *client.BaseClient) *MessagesApi {
	return &MessagesApi{client: c}
}

// Publish POST /v1/messages(发布消息)。
func (a *MessagesApi) Publish(ctx context.Context, req *model.PublishMessageRequest) (*model.PublishMessageResponse, error) {
	out := &model.PublishMessageResponse{}
	if err := a.client.Request(ctx, "POST", "/messages", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Subscribe POST /v1/messages/subscribe(订阅频道)。
func (a *MessagesApi) Subscribe(ctx context.Context, req *model.SubscribeMessageRequest) (*model.SubscribeMessageResponse, error) {
	out := &model.SubscribeMessageResponse{}
	if err := a.client.Request(ctx, "POST", "/messages/subscribe", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Unsubscribe DELETE /v1/messages/subscribe/:id(取消订阅)。
func (a *MessagesApi) Unsubscribe(ctx context.Context, subscriptionID string) (*model.UnsubscribeResponse, error) {
	out := &model.UnsubscribeResponse{}
	if err := a.client.Request(ctx, "DELETE", "/messages/subscribe/"+client.Encode(subscriptionID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetStatus GET /v1/messages/:id/status(消息状态)。
func (a *MessagesApi) GetStatus(ctx context.Context, messageID string) (*model.MessageStatusResponse, error) {
	out := &model.MessageStatusResponse{}
	if err := a.client.Request(ctx, "GET", "/messages/"+client.Encode(messageID)+"/status", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}
