// Package model 的记忆(保存 / 召回 / 搜索 / Dream / 分类记忆)类型。
package model

// SaveMemoryRequest 是 POST /v1/memory 请求体(保存记忆)。
type SaveMemoryRequest struct {
	Content  string         `json:"content"`
	Type     string         `json:"type,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// SaveMemoryResponse 是保存记忆响应。
type SaveMemoryResponse struct {
	MemoryID string `json:"memoryId"`
	Status   string `json:"status"`
}

// RecallMemoryItem 是召回记忆项。
type RecallMemoryItem struct {
	ID        string         `json:"id"`
	Content   string         `json:"content"`
	Type      string         `json:"type"`
	Score     float64        `json:"score"`
	CreatedAt string         `json:"createdAt"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// RecallMemoryResponse 是 GET /v1/memory 响应体(召回记忆)。
type RecallMemoryResponse struct {
	Object string             `json:"object"`
	Data   []RecallMemoryItem `json:"data"`
}

// MemorySearchRequest 是 POST /v1/memory/search 请求体(语义搜索)。
type MemorySearchRequest struct {
	Query string `json:"query"`
	TopK  *int   `json:"topK,omitempty"`
	Type  string `json:"type,omitempty"`
}

// MemorySearchResponse 是 POST /v1/memory/search 响应体。
type MemorySearchResponse struct {
	Object string             `json:"object"`
	Data   []RecallMemoryItem `json:"data"`
}

// MemoryDreamRequest 是 POST /v1/memory/dream 请求体(Dream 梦境系统)。
type MemoryDreamRequest struct {
	Mode string `json:"mode,omitempty"`
}

// MemoryDreamResponse 是 POST /v1/memory/dream 响应体。
type MemoryDreamResponse struct {
	DreamID     string   `json:"dreamId"`
	Insights    []string `json:"insights"`
	NewMemories int      `json:"newMemories"`
}

// ForgetMemoryRequest 是 DELETE /v1/memory 请求体(遗忘记忆)。
type ForgetMemoryRequest struct {
	MemoryID string `json:"memoryId"`
}

// ForgetMemoryResponse 是遗忘记忆响应。
type ForgetMemoryResponse struct {
	MemoryID string `json:"memoryId"`
	Status   string `json:"status"`
}

// WorkingMemoryItem 是工作记忆项。
type WorkingMemoryItem struct {
	ID        string `json:"id"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

// WorkingMemoryResponse 是 GET /v1/memory/working 响应体。
type WorkingMemoryResponse struct {
	Items []WorkingMemoryItem `json:"items"`
}

// EpisodicMemoryItem 是情景记忆项。
type EpisodicMemoryItem struct {
	ID           string   `json:"id"`
	Summary      string   `json:"summary"`
	Timestamp    string   `json:"timestamp"`
	Participants []string `json:"participants"`
}

// EpisodicMemoryResponse 是 GET /v1/memory/episodic 响应体。
type EpisodicMemoryResponse struct {
	Episodes []EpisodicMemoryItem `json:"episodes"`
}

// ProceduralMemoryItem 是程序记忆项。
type ProceduralMemoryItem struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Steps       []string `json:"steps"`
	SuccessRate float64  `json:"successRate"`
}

// ProceduralMemoryResponse 是 GET /v1/memory/procedural 响应体。
type ProceduralMemoryResponse struct {
	Procedures []ProceduralMemoryItem `json:"procedures"`
}
