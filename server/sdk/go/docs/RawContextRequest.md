# RawContextRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ModelName** | **string** | Model name | 
**ChatId** | **string** | Chat ID | 
**Limit** | Pointer to **int32** | Max rows to return | [optional] [default to 10]

## Methods

### NewRawContextRequest

`func NewRawContextRequest(modelName string, chatId string, ) *RawContextRequest`

NewRawContextRequest instantiates a new RawContextRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewRawContextRequestWithDefaults

`func NewRawContextRequestWithDefaults() *RawContextRequest`

NewRawContextRequestWithDefaults instantiates a new RawContextRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModelName

`func (o *RawContextRequest) GetModelName() string`

GetModelName returns the ModelName field if non-nil, zero value otherwise.

### GetModelNameOk

`func (o *RawContextRequest) GetModelNameOk() (*string, bool)`

GetModelNameOk returns a tuple with the ModelName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModelName

`func (o *RawContextRequest) SetModelName(v string)`

SetModelName sets ModelName field to given value.


### GetChatId

`func (o *RawContextRequest) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *RawContextRequest) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *RawContextRequest) SetChatId(v string)`

SetChatId sets ChatId field to given value.


### GetLimit

`func (o *RawContextRequest) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *RawContextRequest) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *RawContextRequest) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *RawContextRequest) HasLimit() bool`

HasLimit returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


