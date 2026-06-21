# AudioRecognizeRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**AudioUrl** | **string** | 音频文件URL | 
**Model** | Pointer to **string** | 语音识别模型名称 | [optional] [default to "qwen3-asr-flash"]
**Language** | Pointer to **NullableString** | 音频语言代码，如 zh / en；留空自动检测 | [optional] 
**EnableLid** | Pointer to **bool** | 启用语言检测 | [optional] [default to true]
**EnableItn** | Pointer to **bool** | 启用逆文本标准化 | [optional] [default to false]
**SystemPrompt** | Pointer to **string** | 系统提示词 | [optional] [default to ""]
**UserUuid** | Pointer to **NullableString** | 用户UUID（兼容字段） | [optional] 
**UserId** | Pointer to **NullableString** | 用户ID（兼容字段） | [optional] 
**ChatId** | Pointer to **NullableString** | 对话ID | [optional] 
**ConversationId** | Pointer to **NullableString** | 对话ID（兼容字段） | [optional] 
**AsrOptions** | Pointer to **map[string]interface{}** | ASR选项（兼容字段，优先于 enable_lid/enable_itn/language） | [optional] 

## Methods

### NewAudioRecognizeRequest

`func NewAudioRecognizeRequest(audioUrl string, ) *AudioRecognizeRequest`

NewAudioRecognizeRequest instantiates a new AudioRecognizeRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAudioRecognizeRequestWithDefaults

`func NewAudioRecognizeRequestWithDefaults() *AudioRecognizeRequest`

NewAudioRecognizeRequestWithDefaults instantiates a new AudioRecognizeRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAudioUrl

`func (o *AudioRecognizeRequest) GetAudioUrl() string`

GetAudioUrl returns the AudioUrl field if non-nil, zero value otherwise.

### GetAudioUrlOk

`func (o *AudioRecognizeRequest) GetAudioUrlOk() (*string, bool)`

GetAudioUrlOk returns a tuple with the AudioUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioUrl

`func (o *AudioRecognizeRequest) SetAudioUrl(v string)`

SetAudioUrl sets AudioUrl field to given value.


### GetModel

`func (o *AudioRecognizeRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *AudioRecognizeRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *AudioRecognizeRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *AudioRecognizeRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetLanguage

`func (o *AudioRecognizeRequest) GetLanguage() string`

GetLanguage returns the Language field if non-nil, zero value otherwise.

### GetLanguageOk

`func (o *AudioRecognizeRequest) GetLanguageOk() (*string, bool)`

GetLanguageOk returns a tuple with the Language field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLanguage

`func (o *AudioRecognizeRequest) SetLanguage(v string)`

SetLanguage sets Language field to given value.

### HasLanguage

`func (o *AudioRecognizeRequest) HasLanguage() bool`

HasLanguage returns a boolean if a field has been set.

### SetLanguageNil

`func (o *AudioRecognizeRequest) SetLanguageNil(b bool)`

 SetLanguageNil sets the value for Language to be an explicit nil

### UnsetLanguage
`func (o *AudioRecognizeRequest) UnsetLanguage()`

UnsetLanguage ensures that no value is present for Language, not even an explicit nil
### GetEnableLid

`func (o *AudioRecognizeRequest) GetEnableLid() bool`

GetEnableLid returns the EnableLid field if non-nil, zero value otherwise.

### GetEnableLidOk

`func (o *AudioRecognizeRequest) GetEnableLidOk() (*bool, bool)`

GetEnableLidOk returns a tuple with the EnableLid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnableLid

`func (o *AudioRecognizeRequest) SetEnableLid(v bool)`

SetEnableLid sets EnableLid field to given value.

### HasEnableLid

`func (o *AudioRecognizeRequest) HasEnableLid() bool`

HasEnableLid returns a boolean if a field has been set.

### GetEnableItn

`func (o *AudioRecognizeRequest) GetEnableItn() bool`

GetEnableItn returns the EnableItn field if non-nil, zero value otherwise.

### GetEnableItnOk

`func (o *AudioRecognizeRequest) GetEnableItnOk() (*bool, bool)`

GetEnableItnOk returns a tuple with the EnableItn field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnableItn

`func (o *AudioRecognizeRequest) SetEnableItn(v bool)`

SetEnableItn sets EnableItn field to given value.

### HasEnableItn

`func (o *AudioRecognizeRequest) HasEnableItn() bool`

HasEnableItn returns a boolean if a field has been set.

### GetSystemPrompt

`func (o *AudioRecognizeRequest) GetSystemPrompt() string`

GetSystemPrompt returns the SystemPrompt field if non-nil, zero value otherwise.

### GetSystemPromptOk

`func (o *AudioRecognizeRequest) GetSystemPromptOk() (*string, bool)`

GetSystemPromptOk returns a tuple with the SystemPrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSystemPrompt

`func (o *AudioRecognizeRequest) SetSystemPrompt(v string)`

SetSystemPrompt sets SystemPrompt field to given value.

### HasSystemPrompt

`func (o *AudioRecognizeRequest) HasSystemPrompt() bool`

HasSystemPrompt returns a boolean if a field has been set.

### GetUserUuid

`func (o *AudioRecognizeRequest) GetUserUuid() string`

GetUserUuid returns the UserUuid field if non-nil, zero value otherwise.

### GetUserUuidOk

`func (o *AudioRecognizeRequest) GetUserUuidOk() (*string, bool)`

GetUserUuidOk returns a tuple with the UserUuid field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserUuid

`func (o *AudioRecognizeRequest) SetUserUuid(v string)`

SetUserUuid sets UserUuid field to given value.

### HasUserUuid

`func (o *AudioRecognizeRequest) HasUserUuid() bool`

HasUserUuid returns a boolean if a field has been set.

### SetUserUuidNil

`func (o *AudioRecognizeRequest) SetUserUuidNil(b bool)`

 SetUserUuidNil sets the value for UserUuid to be an explicit nil

### UnsetUserUuid
`func (o *AudioRecognizeRequest) UnsetUserUuid()`

UnsetUserUuid ensures that no value is present for UserUuid, not even an explicit nil
### GetUserId

`func (o *AudioRecognizeRequest) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *AudioRecognizeRequest) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *AudioRecognizeRequest) SetUserId(v string)`

SetUserId sets UserId field to given value.

### HasUserId

`func (o *AudioRecognizeRequest) HasUserId() bool`

HasUserId returns a boolean if a field has been set.

### SetUserIdNil

`func (o *AudioRecognizeRequest) SetUserIdNil(b bool)`

 SetUserIdNil sets the value for UserId to be an explicit nil

### UnsetUserId
`func (o *AudioRecognizeRequest) UnsetUserId()`

UnsetUserId ensures that no value is present for UserId, not even an explicit nil
### GetChatId

`func (o *AudioRecognizeRequest) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *AudioRecognizeRequest) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *AudioRecognizeRequest) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *AudioRecognizeRequest) HasChatId() bool`

HasChatId returns a boolean if a field has been set.

### SetChatIdNil

`func (o *AudioRecognizeRequest) SetChatIdNil(b bool)`

 SetChatIdNil sets the value for ChatId to be an explicit nil

### UnsetChatId
`func (o *AudioRecognizeRequest) UnsetChatId()`

UnsetChatId ensures that no value is present for ChatId, not even an explicit nil
### GetConversationId

`func (o *AudioRecognizeRequest) GetConversationId() string`

GetConversationId returns the ConversationId field if non-nil, zero value otherwise.

### GetConversationIdOk

`func (o *AudioRecognizeRequest) GetConversationIdOk() (*string, bool)`

GetConversationIdOk returns a tuple with the ConversationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConversationId

`func (o *AudioRecognizeRequest) SetConversationId(v string)`

SetConversationId sets ConversationId field to given value.

### HasConversationId

`func (o *AudioRecognizeRequest) HasConversationId() bool`

HasConversationId returns a boolean if a field has been set.

### SetConversationIdNil

`func (o *AudioRecognizeRequest) SetConversationIdNil(b bool)`

 SetConversationIdNil sets the value for ConversationId to be an explicit nil

### UnsetConversationId
`func (o *AudioRecognizeRequest) UnsetConversationId()`

UnsetConversationId ensures that no value is present for ConversationId, not even an explicit nil
### GetAsrOptions

`func (o *AudioRecognizeRequest) GetAsrOptions() map[string]interface{}`

GetAsrOptions returns the AsrOptions field if non-nil, zero value otherwise.

### GetAsrOptionsOk

`func (o *AudioRecognizeRequest) GetAsrOptionsOk() (*map[string]interface{}, bool)`

GetAsrOptionsOk returns a tuple with the AsrOptions field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAsrOptions

`func (o *AudioRecognizeRequest) SetAsrOptions(v map[string]interface{})`

SetAsrOptions sets AsrOptions field to given value.

### HasAsrOptions

`func (o *AudioRecognizeRequest) HasAsrOptions() bool`

HasAsrOptions returns a boolean if a field has been set.

### SetAsrOptionsNil

`func (o *AudioRecognizeRequest) SetAsrOptionsNil(b bool)`

 SetAsrOptionsNil sets the value for AsrOptions to be an explicit nil

### UnsetAsrOptions
`func (o *AudioRecognizeRequest) UnsetAsrOptions()`

UnsetAsrOptions ensures that no value is present for AsrOptions, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


