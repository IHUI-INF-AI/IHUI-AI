# BodyLuyalaChat

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Messages** | **[]interface{}** |  | 
**Model** | Pointer to **string** |  | [optional] [default to "luyala-pro"]
**Temperature** | Pointer to **float32** |  | [optional] [default to 0.7]
**MaxTokens** | Pointer to **int32** |  | [optional] [default to 2048]

## Methods

### NewBodyLuyalaChat

`func NewBodyLuyalaChat(messages []interface{}, ) *BodyLuyalaChat`

NewBodyLuyalaChat instantiates a new BodyLuyalaChat object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyLuyalaChatWithDefaults

`func NewBodyLuyalaChatWithDefaults() *BodyLuyalaChat`

NewBodyLuyalaChatWithDefaults instantiates a new BodyLuyalaChat object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetMessages

`func (o *BodyLuyalaChat) GetMessages() []interface{}`

GetMessages returns the Messages field if non-nil, zero value otherwise.

### GetMessagesOk

`func (o *BodyLuyalaChat) GetMessagesOk() (*[]interface{}, bool)`

GetMessagesOk returns a tuple with the Messages field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMessages

`func (o *BodyLuyalaChat) SetMessages(v []interface{})`

SetMessages sets Messages field to given value.


### GetModel

`func (o *BodyLuyalaChat) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyLuyalaChat) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyLuyalaChat) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyLuyalaChat) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetTemperature

`func (o *BodyLuyalaChat) GetTemperature() float32`

GetTemperature returns the Temperature field if non-nil, zero value otherwise.

### GetTemperatureOk

`func (o *BodyLuyalaChat) GetTemperatureOk() (*float32, bool)`

GetTemperatureOk returns a tuple with the Temperature field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTemperature

`func (o *BodyLuyalaChat) SetTemperature(v float32)`

SetTemperature sets Temperature field to given value.

### HasTemperature

`func (o *BodyLuyalaChat) HasTemperature() bool`

HasTemperature returns a boolean if a field has been set.

### GetMaxTokens

`func (o *BodyLuyalaChat) GetMaxTokens() int32`

GetMaxTokens returns the MaxTokens field if non-nil, zero value otherwise.

### GetMaxTokensOk

`func (o *BodyLuyalaChat) GetMaxTokensOk() (*int32, bool)`

GetMaxTokensOk returns a tuple with the MaxTokens field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxTokens

`func (o *BodyLuyalaChat) SetMaxTokens(v int32)`

SetMaxTokens sets MaxTokens field to given value.

### HasMaxTokens

`func (o *BodyLuyalaChat) HasMaxTokens() bool`

HasMaxTokens returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


