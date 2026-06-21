# AudioChatRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Text** | Pointer to **NullableString** | 文本输入（可选，与audio_base64二选一） | [optional] 
**AudioBase64** | Pointer to **NullableString** | 音频Base64编码（可选，与text二选一） | [optional] 
**AudioUrl** | Pointer to **NullableString** | 音频URL（可选） | [optional] 
**BotId** | Pointer to **NullableString** | Coze机器人ID（可选，不提供则使用默认AI） | [optional] 
**VoiceId** | Pointer to **string** | 回复音色ID | [optional] [default to "longxiaochun"]
**Model** | Pointer to **string** | 对话模型名称 | [optional] [default to "qwen-turbo"]
**Language** | Pointer to **string** | 语言 | [optional] [default to "zh-CN"]
**SystemPrompt** | Pointer to **NullableString** | 系统提示词 | [optional] 

## Methods

### NewAudioChatRequest

`func NewAudioChatRequest() *AudioChatRequest`

NewAudioChatRequest instantiates a new AudioChatRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAudioChatRequestWithDefaults

`func NewAudioChatRequestWithDefaults() *AudioChatRequest`

NewAudioChatRequestWithDefaults instantiates a new AudioChatRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetText

`func (o *AudioChatRequest) GetText() string`

GetText returns the Text field if non-nil, zero value otherwise.

### GetTextOk

`func (o *AudioChatRequest) GetTextOk() (*string, bool)`

GetTextOk returns a tuple with the Text field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetText

`func (o *AudioChatRequest) SetText(v string)`

SetText sets Text field to given value.

### HasText

`func (o *AudioChatRequest) HasText() bool`

HasText returns a boolean if a field has been set.

### SetTextNil

`func (o *AudioChatRequest) SetTextNil(b bool)`

 SetTextNil sets the value for Text to be an explicit nil

### UnsetText
`func (o *AudioChatRequest) UnsetText()`

UnsetText ensures that no value is present for Text, not even an explicit nil
### GetAudioBase64

`func (o *AudioChatRequest) GetAudioBase64() string`

GetAudioBase64 returns the AudioBase64 field if non-nil, zero value otherwise.

### GetAudioBase64Ok

`func (o *AudioChatRequest) GetAudioBase64Ok() (*string, bool)`

GetAudioBase64Ok returns a tuple with the AudioBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioBase64

`func (o *AudioChatRequest) SetAudioBase64(v string)`

SetAudioBase64 sets AudioBase64 field to given value.

### HasAudioBase64

`func (o *AudioChatRequest) HasAudioBase64() bool`

HasAudioBase64 returns a boolean if a field has been set.

### SetAudioBase64Nil

`func (o *AudioChatRequest) SetAudioBase64Nil(b bool)`

 SetAudioBase64Nil sets the value for AudioBase64 to be an explicit nil

### UnsetAudioBase64
`func (o *AudioChatRequest) UnsetAudioBase64()`

UnsetAudioBase64 ensures that no value is present for AudioBase64, not even an explicit nil
### GetAudioUrl

`func (o *AudioChatRequest) GetAudioUrl() string`

GetAudioUrl returns the AudioUrl field if non-nil, zero value otherwise.

### GetAudioUrlOk

`func (o *AudioChatRequest) GetAudioUrlOk() (*string, bool)`

GetAudioUrlOk returns a tuple with the AudioUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioUrl

`func (o *AudioChatRequest) SetAudioUrl(v string)`

SetAudioUrl sets AudioUrl field to given value.

### HasAudioUrl

`func (o *AudioChatRequest) HasAudioUrl() bool`

HasAudioUrl returns a boolean if a field has been set.

### SetAudioUrlNil

`func (o *AudioChatRequest) SetAudioUrlNil(b bool)`

 SetAudioUrlNil sets the value for AudioUrl to be an explicit nil

### UnsetAudioUrl
`func (o *AudioChatRequest) UnsetAudioUrl()`

UnsetAudioUrl ensures that no value is present for AudioUrl, not even an explicit nil
### GetBotId

`func (o *AudioChatRequest) GetBotId() string`

GetBotId returns the BotId field if non-nil, zero value otherwise.

### GetBotIdOk

`func (o *AudioChatRequest) GetBotIdOk() (*string, bool)`

GetBotIdOk returns a tuple with the BotId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBotId

`func (o *AudioChatRequest) SetBotId(v string)`

SetBotId sets BotId field to given value.

### HasBotId

`func (o *AudioChatRequest) HasBotId() bool`

HasBotId returns a boolean if a field has been set.

### SetBotIdNil

`func (o *AudioChatRequest) SetBotIdNil(b bool)`

 SetBotIdNil sets the value for BotId to be an explicit nil

### UnsetBotId
`func (o *AudioChatRequest) UnsetBotId()`

UnsetBotId ensures that no value is present for BotId, not even an explicit nil
### GetVoiceId

`func (o *AudioChatRequest) GetVoiceId() string`

GetVoiceId returns the VoiceId field if non-nil, zero value otherwise.

### GetVoiceIdOk

`func (o *AudioChatRequest) GetVoiceIdOk() (*string, bool)`

GetVoiceIdOk returns a tuple with the VoiceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVoiceId

`func (o *AudioChatRequest) SetVoiceId(v string)`

SetVoiceId sets VoiceId field to given value.

### HasVoiceId

`func (o *AudioChatRequest) HasVoiceId() bool`

HasVoiceId returns a boolean if a field has been set.

### GetModel

`func (o *AudioChatRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *AudioChatRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *AudioChatRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *AudioChatRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetLanguage

`func (o *AudioChatRequest) GetLanguage() string`

GetLanguage returns the Language field if non-nil, zero value otherwise.

### GetLanguageOk

`func (o *AudioChatRequest) GetLanguageOk() (*string, bool)`

GetLanguageOk returns a tuple with the Language field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLanguage

`func (o *AudioChatRequest) SetLanguage(v string)`

SetLanguage sets Language field to given value.

### HasLanguage

`func (o *AudioChatRequest) HasLanguage() bool`

HasLanguage returns a boolean if a field has been set.

### GetSystemPrompt

`func (o *AudioChatRequest) GetSystemPrompt() string`

GetSystemPrompt returns the SystemPrompt field if non-nil, zero value otherwise.

### GetSystemPromptOk

`func (o *AudioChatRequest) GetSystemPromptOk() (*string, bool)`

GetSystemPromptOk returns a tuple with the SystemPrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSystemPrompt

`func (o *AudioChatRequest) SetSystemPrompt(v string)`

SetSystemPrompt sets SystemPrompt field to given value.

### HasSystemPrompt

`func (o *AudioChatRequest) HasSystemPrompt() bool`

HasSystemPrompt returns a boolean if a field has been set.

### SetSystemPromptNil

`func (o *AudioChatRequest) SetSystemPromptNil(b bool)`

 SetSystemPromptNil sets the value for SystemPrompt to be an explicit nil

### UnsetSystemPrompt
`func (o *AudioChatRequest) UnsetSystemPrompt()`

UnsetSystemPrompt ensures that no value is present for SystemPrompt, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


