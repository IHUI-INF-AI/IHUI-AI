# BodyUserModelChatChat

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Model** | Pointer to **string** |  | [optional] [default to "gpt-4o-mini"]
**Messages** | **[]interface{}** |  | 
**Temperature** | Pointer to **float32** |  | [optional] [default to 0.7]
**MaxTokens** | Pointer to **int32** |  | [optional] [default to 2048]
**Stream** | Pointer to **bool** |  | [optional] [default to false]

## Methods

### NewBodyUserModelChatChat

`func NewBodyUserModelChatChat(messages []interface{}, ) *BodyUserModelChatChat`

NewBodyUserModelChatChat instantiates a new BodyUserModelChatChat object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyUserModelChatChatWithDefaults

`func NewBodyUserModelChatChatWithDefaults() *BodyUserModelChatChat`

NewBodyUserModelChatChatWithDefaults instantiates a new BodyUserModelChatChat object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModel

`func (o *BodyUserModelChatChat) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyUserModelChatChat) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyUserModelChatChat) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyUserModelChatChat) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetMessages

`func (o *BodyUserModelChatChat) GetMessages() []interface{}`

GetMessages returns the Messages field if non-nil, zero value otherwise.

### GetMessagesOk

`func (o *BodyUserModelChatChat) GetMessagesOk() (*[]interface{}, bool)`

GetMessagesOk returns a tuple with the Messages field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMessages

`func (o *BodyUserModelChatChat) SetMessages(v []interface{})`

SetMessages sets Messages field to given value.


### GetTemperature

`func (o *BodyUserModelChatChat) GetTemperature() float32`

GetTemperature returns the Temperature field if non-nil, zero value otherwise.

### GetTemperatureOk

`func (o *BodyUserModelChatChat) GetTemperatureOk() (*float32, bool)`

GetTemperatureOk returns a tuple with the Temperature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTemperature

`func (o *BodyUserModelChatChat) SetTemperature(v float32)`

SetTemperature sets Temperature field to given value.

### HasTemperature

`func (o *BodyUserModelChatChat) HasTemperature() bool`

HasTemperature returns a boolean if a field has been set.

### GetMaxTokens

`func (o *BodyUserModelChatChat) GetMaxTokens() int32`

GetMaxTokens returns the MaxTokens field if non-nil, zero value otherwise.

### GetMaxTokensOk

`func (o *BodyUserModelChatChat) GetMaxTokensOk() (*int32, bool)`

GetMaxTokensOk returns a tuple with the MaxTokens field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxTokens

`func (o *BodyUserModelChatChat) SetMaxTokens(v int32)`

SetMaxTokens sets MaxTokens field to given value.

### HasMaxTokens

`func (o *BodyUserModelChatChat) HasMaxTokens() bool`

HasMaxTokens returns a boolean if a field has been set.

### GetStream

`func (o *BodyUserModelChatChat) GetStream() bool`

GetStream returns the Stream field if non-nil, zero value otherwise.

### GetStreamOk

`func (o *BodyUserModelChatChat) GetStreamOk() (*bool, bool)`

GetStreamOk returns a tuple with the Stream field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStream

`func (o *BodyUserModelChatChat) SetStream(v bool)`

SetStream sets Stream field to given value.

### HasStream

`func (o *BodyUserModelChatChat) HasStream() bool`

HasStream returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


