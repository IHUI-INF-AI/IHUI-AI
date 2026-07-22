// Package model 的音频(TTS / ASR / 语音对话 / 声纹 / 音乐)类型。
package model

// AudioSpeechRequest 是 POST /v1/audio/speech 请求体(TTS)。
type AudioSpeechRequest struct {
	Model          string  `json:"model"`
	Input          string  `json:"input"`
	Voice          string  `json:"voice"`
	ResponseFormat string  `json:"responseFormat,omitempty"`
	Speed          float64 `json:"speed,omitempty"`
}

// AudioSpeechResponse 是 POST /v1/audio/speech 响应体(二进制音频流,base64 编码)。
type AudioSpeechResponse struct {
	Audio      string `json:"audio"`
	Format     string `json:"format"`
	DurationMs int64  `json:"durationMs"`
}

// AudioTranscriptionsRequest 是 POST /v1/audio/transcriptions 请求体(ASR)。
type AudioTranscriptionsRequest struct {
	Model    string `json:"model"`
	Audio    string `json:"audio"`
	Language string `json:"language,omitempty"`
	Prompt   string `json:"prompt,omitempty"`
}

// AudioTranscriptionSegment 是 ASR 转录片段。
type AudioTranscriptionSegment struct {
	ID    int     `json:"id"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
}

// AudioTranscriptionsResponse 是 POST /v1/audio/transcriptions 响应体。
type AudioTranscriptionsResponse struct {
	Text     string                      `json:"text"`
	Language string                      `json:"language"`
	Duration float64                     `json:"duration"`
	Segments []AudioTranscriptionSegment `json:"segments,omitempty"`
}

// AudioVoiceItem 是音色列表项。
type AudioVoiceItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Gender   string `json:"gender"`
	Language string `json:"language"`
	Preview  string `json:"preview,omitempty"`
}

// AudioVoicesResponse 是 GET /v1/audio/voices 响应体。
type AudioVoicesResponse struct {
	Object string           `json:"object"`
	Data   []AudioVoiceItem `json:"data"`
}

// AudioChatRequest 是 POST /v1/audio/chat 请求体(语音对话)。
type AudioChatRequest struct {
	Audio     string `json:"audio"`
	Model     string `json:"model"`
	SessionID string `json:"sessionId,omitempty"`
}

// AudioChatResponse 是 POST /v1/audio/chat 响应体。
type AudioChatResponse struct {
	Text      string `json:"text"`
	Audio     string `json:"audio"`
	SessionID string `json:"sessionId"`
}

// RegisterSpeakerRequest 是 POST /v1/audio/speakers 请求体(声纹注册)。
type RegisterSpeakerRequest struct {
	Name  string `json:"name"`
	Audio string `json:"audio"`
}

// RegisterSpeakerResponse 是声纹注册响应。
type RegisterSpeakerResponse struct {
	SpeakerID string `json:"speakerId"`
	Status    string `json:"status"`
}

// SpeakersListResponse 是 GET /v1/audio/speakers 响应体(声纹列表)。
type SpeakersListResponse struct {
	Object string `json:"object"`
	Data   []struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		RegisteredAt string `json:"registeredAt"`
	} `json:"data"`
}

// CompareSpeakersRequest 是 POST /v1/audio/speakers/compare 请求体(声纹比对)。
type CompareSpeakersRequest struct {
	SpeakerID string `json:"speakerId"`
	Audio     string `json:"audio"`
}

// CompareSpeakersResponse 是 POST /v1/audio/speakers/compare 响应体。
type CompareSpeakersResponse struct {
	Score   float64 `json:"score"`
	Matched bool    `json:"matched"`
}

// MusicGenerationsRequest 是 POST /v1/audio/music 请求体(音乐生成)。
type MusicGenerationsRequest struct {
	Prompt   string `json:"prompt"`
	Lyrics   string `json:"lyrics,omitempty"`
	Duration *int   `json:"duration,omitempty"`
}

// MusicGenerationsResponse 是 POST /v1/audio/music 响应体。
type MusicGenerationsResponse struct {
	TaskID string `json:"taskId"`
	Status string `json:"status"`
}
