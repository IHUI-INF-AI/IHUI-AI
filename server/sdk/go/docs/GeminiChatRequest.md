# GeminiChatRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Contents** | [**[]ChatMessage**](ChatMessage.md) | 对话消息列表 | 
**Model** | Pointer to **NullableString** | 模型名称 | [optional] 
**Temperature** | Pointer to **NullableFloat32** | 温度参数 0-2 | [optional] 
**MaxTokens** | Pointer to **NullableInt32** | 最大输出token数 | [optional] 
**SystemInstruction** | Pointer to **NullableString** | 系统提示词 | [optional] 

## Methods

### NewGeminiChatRequest

`func NewGeminiChatRequest(contents []ChatMessage, ) *GeminiChatRequest`

NewGeminiChatRequest instantiates a new GeminiChatRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGeminiChatRequestWithDefaults

`func NewGeminiChatRequestWithDefaults() *GeminiChatRequest`

NewGeminiChatRequestWithDefaults instantiates a new GeminiChatRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetContents

`func (o *GeminiChatRequest) GetContents() []ChatMessage`

GetContents returns the Contents field if non-nil, zero value otherwise.

### GetContentsOk

`func (o *GeminiChatRequest) GetContentsOk() (*[]ChatMessage, bool)`

GetContentsOk returns a tuple with the Contents field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContents

`func (o *GeminiChatRequest) SetContents(v []ChatMessage)`

SetContents sets Contents field to given value.


### GetModel

`func (o *GeminiChatRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *GeminiChatRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *GeminiChatRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *GeminiChatRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### SetModelNil

`func (o *GeminiChatRequest) SetModelNil(b bool)`

 SetModelNil sets the value for Model to be an explicit nil

### UnsetModel
`func (o *GeminiChatRequest) UnsetModel()`

UnsetModel ensures that no value is present for Model, not even an explicit nil
### GetTemperature

`func (o *GeminiChatRequest) GetTemperature() float32`

GetTemperature returns the Temperature field if non-nil, zero value otherwise.

### GetTemperatureOk

`func (o *GeminiChatRequest) GetTemperatureOk() (*float32, bool)`

GetTemperatureOk returns a tuple with the Temperature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTemperature

`func (o *GeminiChatRequest) SetTemperature(v float32)`

SetTemperature sets Temperature field to given value.

### HasTemperature

`func (o *GeminiChatRequest) HasTemperature() bool`

HasTemperature returns a boolean if a field has been set.

### SetTemperatureNil

`func (o *GeminiChatRequest) SetTemperatureNil(b bool)`

 SetTemperatureNil sets the value for Temperature to be an explicit nil

### UnsetTemperature
`func (o *GeminiChatRequest) UnsetTemperature()`

UnsetTemperature ensures that no value is present for Temperature, not even an explicit nil
### GetMaxTokens

`func (o *GeminiChatRequest) GetMaxTokens() int32`

GetMaxTokens returns the MaxTokens field if non-nil, zero value otherwise.

### GetMaxTokensOk

`func (o *GeminiChatRequest) GetMaxTokensOk() (*int32, bool)`

GetMaxTokensOk returns a tuple with the MaxTokens field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxTokens

`func (o *GeminiChatRequest) SetMaxTokens(v int32)`

SetMaxTokens sets MaxTokens field to given value.

### HasMaxTokens

`func (o *GeminiChatRequest) HasMaxTokens() bool`

HasMaxTokens returns a boolean if a field has been set.

### SetMaxTokensNil

`func (o *GeminiChatRequest) SetMaxTokensNil(b bool)`

 SetMaxTokensNil sets the value for MaxTokens to be an explicit nil

### UnsetMaxTokens
`func (o *GeminiChatRequest) UnsetMaxTokens()`

UnsetMaxTokens ensures that no value is present for MaxTokens, not even an explicit nil
### GetSystemInstruction

`func (o *GeminiChatRequest) GetSystemInstruction() string`

GetSystemInstruction returns the SystemInstruction field if non-nil, zero value otherwise.

### GetSystemInstructionOk

`func (o *GeminiChatRequest) GetSystemInstructionOk() (*string, bool)`

GetSystemInstructionOk returns a tuple with the SystemInstruction field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSystemInstruction

`func (o *GeminiChatRequest) SetSystemInstruction(v string)`

SetSystemInstruction sets SystemInstruction field to given value.

### HasSystemInstruction

`func (o *GeminiChatRequest) HasSystemInstruction() bool`

HasSystemInstruction returns a boolean if a field has been set.

### SetSystemInstructionNil

`func (o *GeminiChatRequest) SetSystemInstructionNil(b bool)`

 SetSystemInstructionNil sets the value for SystemInstruction to be an explicit nil

### UnsetSystemInstruction
`func (o *GeminiChatRequest) UnsetSystemInstruction()`

UnsetSystemInstruction ensures that no value is present for SystemInstruction, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


