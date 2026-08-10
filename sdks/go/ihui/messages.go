package ihui

import "context"

// MessagesApi 封装消息端点(4 个):发布 / 订阅 / 取消订阅 / 状态。
type MessagesApi struct {
	client *BaseClient
}

// NewMessagesApi 构造 MessagesApi。
func NewMessagesApi(c *BaseClient) *MessagesApi {
	return &MessagesApi{client: c}
}

// Publish POST /v1/messages(发布消息)。
func (a *MessagesApi) Publish(ctx context.Context, req *PublishMessageRequest) (*PublishMessageResponse, error) {
	out := &PublishMessageResponse{}
	if err := a.client.Request(ctx, "POST", "/messages", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Subscribe POST /v1/messages/subscribe(订阅频道)。
func (a *MessagesApi) Subscribe(ctx context.Context, req *SubscribeMessageRequest) (*SubscribeMessageResponse, error) {
	out := &SubscribeMessageResponse{}
	if err := a.client.Request(ctx, "POST", "/messages/subscribe", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Unsubscribe DELETE /v1/messages/subscribe/:id(取消订阅)。
func (a *MessagesApi) Unsubscribe(ctx context.Context, subscriptionID string) (*UnsubscribeResponse, error) {
	out := &UnsubscribeResponse{}
	if err := a.client.Request(ctx, "DELETE", "/messages/subscribe/"+Encode(subscriptionID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetStatus GET /v1/messages/:id/status(消息状态)。
func (a *MessagesApi) GetStatus(ctx context.Context, messageID string) (*MessageStatusResponse, error) {
	out := &MessageStatusResponse{}
	if err := a.client.Request(ctx, "GET", "/messages/"+Encode(messageID)+"/status", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}