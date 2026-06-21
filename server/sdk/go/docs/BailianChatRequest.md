# BailianChatRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | 用户输入 | 
**AppId** | Pointer to **NullableString** | 百炼应用ID, 默认从配置读取 | [optional] 
**SessionId** | Pointer to **NullableString** | 会话ID, 用于多轮对话 | [optional] 
**Stream** | Pointer to **NullableBool** | 是否流式返回 | [optional] 

## Methods

### NewBailianChatRequest

`func NewBailianChatRequest(prompt string, ) *BailianChatRequest`

NewBailianChatRequest instantiates a new BailianChatRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBailianChatRequestWithDefaults

`func NewBailianChatRequestWithDefaults() *BailianChatRequest`

NewBailianChatRequestWithDefaults instantiates a new BailianChatRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *BailianChatRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *BailianChatRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *BailianChatRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetAppId

`func (o *BailianChatRequest) GetAppId() string`

GetAppId returns the AppId field if non-nil, zero value otherwise.

### GetAppIdOk

`func (o *BailianChatRequest) GetAppIdOk() (*string, bool)`

GetAppIdOk returns a tuple with the AppId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAppId

`func (o *BailianChatRequest) SetAppId(v string)`

SetAppId sets AppId field to given value.

### HasAppId

`func (o *BailianChatRequest) HasAppId() bool`

HasAppId returns a boolean if a field has been set.

### SetAppIdNil

`func (o *BailianChatRequest) SetAppIdNil(b bool)`

 SetAppIdNil sets the value for AppId to be an explicit nil

### UnsetAppId
`func (o *BailianChatRequest) UnsetAppId()`

UnsetAppId ensures that no value is present for AppId, not even an explicit nil
### GetSessionId

`func (o *BailianChatRequest) GetSessionId() string`

GetSessionId returns the SessionId field if non-nil, zero value otherwise.

### GetSessionIdOk

`func (o *BailianChatRequest) GetSessionIdOk() (*string, bool)`

GetSessionIdOk returns a tuple with the SessionId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSessionId

`func (o *BailianChatRequest) SetSessionId(v string)`

SetSessionId sets SessionId field to given value.

### HasSessionId

`func (o *BailianChatRequest) HasSessionId() bool`

HasSessionId returns a boolean if a field has been set.

### SetSessionIdNil

`func (o *BailianChatRequest) SetSessionIdNil(b bool)`

 SetSessionIdNil sets the value for SessionId to be an explicit nil

### UnsetSessionId
`func (o *BailianChatRequest) UnsetSessionId()`

UnsetSessionId ensures that no value is present for SessionId, not even an explicit nil
### GetStream

`func (o *BailianChatRequest) GetStream() bool`

GetStream returns the Stream field if non-nil, zero value otherwise.

### GetStreamOk

`func (o *BailianChatRequest) GetStreamOk() (*bool, bool)`

GetStreamOk returns a tuple with the Stream field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStream

`func (o *BailianChatRequest) SetStream(v bool)`

SetStream sets Stream field to given value.

### HasStream

`func (o *BailianChatRequest) HasStream() bool`

HasStream returns a boolean if a field has been set.

### SetStreamNil

`func (o *BailianChatRequest) SetStreamNil(b bool)`

 SetStreamNil sets the value for Stream to be an explicit nil

### UnsetStream
`func (o *BailianChatRequest) UnsetStream()`

UnsetStream ensures that no value is present for Stream, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


