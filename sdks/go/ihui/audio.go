package ihui

import "context"

// AudioApi 封装音频端点(8 个):TTS / ASR / 语音对话 / 声纹 / 音乐。
type AudioApi struct {
	client *BaseClient
}

// NewAudioApi 构造 AudioApi。
func NewAudioApi(c *BaseClient) *AudioApi {
	return &AudioApi{client: c}
}

// ListVoices GET /v1/audio/voices(音色列表)。
func (a *AudioApi) ListVoices(ctx context.Context) (*AudioVoicesResponse, error) {
	out := &AudioVoicesResponse{}
	if err := a.client.Request(ctx, "GET", "/audio/voices", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Speech POST /v1/audio/speech(文字转语音)。
func (a *AudioApi) Speech(ctx context.Context, req *AudioSpeechRequest) (*AudioSpeechResponse, error) {
	out := &AudioSpeechResponse{}
	if err := a.client.Request(ctx, "POST", "/audio/speech", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Transcriptions POST /v1/audio/transcriptions(语音转文字)。
func (a *AudioApi) Transcriptions(ctx context.Context, req *AudioTranscriptionsRequest) (*AudioTranscriptionsResponse, error) {
	out := &AudioTranscriptionsResponse{}
	if err := a.client.Request(ctx, "POST", "/audio/transcriptions", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Chat POST /v1/audio/chat(语音对话)。
func (a *AudioApi) Chat(ctx context.Context, req *AudioChatRequest) (*AudioChatResponse, error) {
	out := &AudioChatResponse{}
	if err := a.client.Request(ctx, "POST", "/audio/chat", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListSpeakers GET /v1/audio/speakers(声纹列表)。
func (a *AudioApi) ListSpeakers(ctx context.Context) (*SpeakersListResponse, error) {
	out := &SpeakersListResponse{}
	if err := a.client.Request(ctx, "GET", "/audio/speakers", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RegisterSpeaker POST /v1/audio/speakers(声纹注册)。
func (a *AudioApi) RegisterSpeaker(ctx context.Context, req *RegisterSpeakerRequest) (*RegisterSpeakerResponse, error) {
	out := &RegisterSpeakerResponse{}
	if err := a.client.Request(ctx, "POST", "/audio/speakers", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// CompareSpeakers POST /v1/audio/speakers/compare(声纹比对)。
func (a *AudioApi) CompareSpeakers(ctx context.Context, req *CompareSpeakersRequest) (*CompareSpeakersResponse, error) {
	out := &CompareSpeakersResponse{}
	if err := a.client.Request(ctx, "POST", "/audio/speakers/compare", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Music POST /v1/audio/music(音乐生成)。
func (a *AudioApi) Music(ctx context.Context, req *MusicGenerationsRequest) (*MusicGenerationsResponse, error) {
	out := &MusicGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/audio/music", req, out); err != nil {
		return nil, err
	}
	return out, nil
}