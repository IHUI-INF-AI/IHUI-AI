package ihui

import "context"

// MemoryApi 封装记忆端点(8 个):保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。
type MemoryApi struct {
	client *BaseClient
}

// NewMemoryApi 构造 MemoryApi。
func NewMemoryApi(c *BaseClient) *MemoryApi {
	return &MemoryApi{client: c}
}

// Save POST /v1/memory(保存记忆)。
func (a *MemoryApi) Save(ctx context.Context, req *SaveMemoryRequest) (*SaveMemoryResponse, error) {
	out := &SaveMemoryResponse{}
	if err := a.client.Request(ctx, "POST", "/memory", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Recall GET /v1/memory(召回记忆)。
func (a *MemoryApi) Recall(ctx context.Context) (*RecallMemoryResponse, error) {
	out := &RecallMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Search POST /v1/memory/search(语义搜索)。
func (a *MemoryApi) Search(ctx context.Context, req *MemorySearchRequest) (*MemorySearchResponse, error) {
	out := &MemorySearchResponse{}
	if err := a.client.Request(ctx, "POST", "/memory/search", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Dream POST /v1/memory/dream(Dream 梦境系统)。
func (a *MemoryApi) Dream(ctx context.Context, req *MemoryDreamRequest) (*MemoryDreamResponse, error) {
	out := &MemoryDreamResponse{}
	if err := a.client.Request(ctx, "POST", "/memory/dream", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Forget DELETE /v1/memory(遗忘记忆)。
func (a *MemoryApi) Forget(ctx context.Context, req *ForgetMemoryRequest) (*ForgetMemoryResponse, error) {
	out := &ForgetMemoryResponse{}
	if err := a.client.Request(ctx, "DELETE", "/memory", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Working GET /v1/memory/working(工作记忆)。
func (a *MemoryApi) Working(ctx context.Context) (*WorkingMemoryResponse, error) {
	out := &WorkingMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory/working", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Episodic GET /v1/memory/episodic(情景记忆)。
func (a *MemoryApi) Episodic(ctx context.Context) (*EpisodicMemoryResponse, error) {
	out := &EpisodicMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory/episodic", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Procedural GET /v1/memory/procedural(程序记忆)。
func (a *MemoryApi) Procedural(ctx context.Context) (*ProceduralMemoryResponse, error) {
	out := &ProceduralMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory/procedural", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}