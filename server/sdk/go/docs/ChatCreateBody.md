# ChatCreateBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ModelName** | **string** | Model name | 
**Mark** | Pointer to **NullableString** | Chat summary/label | [optional] 

## Methods

### NewChatCreateBody

`func NewChatCreateBody(modelName string, ) *ChatCreateBody`

NewChatCreateBody instantiates a new ChatCreateBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewChatCreateBodyWithDefaults

`func NewChatCreateBodyWithDefaults() *ChatCreateBody`

NewChatCreateBodyWithDefaults instantiates a new ChatCreateBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModelName

`func (o *ChatCreateBody) GetModelName() string`

GetModelName returns the ModelName field if non-nil, zero value otherwise.

### GetModelNameOk

`func (o *ChatCreateBody) GetModelNameOk() (*string, bool)`

GetModelNameOk returns a tuple with the ModelName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModelName

`func (o *ChatCreateBody) SetModelName(v string)`

SetModelName sets ModelName field to given value.


### GetMark

`func (o *ChatCreateBody) GetMark() string`

GetMark returns the Mark field if non-nil, zero value otherwise.

### GetMarkOk

`func (o *ChatCreateBody) GetMarkOk() (*string, bool)`

GetMarkOk returns a tuple with the Mark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMark

`func (o *ChatCreateBody) SetMark(v string)`

SetMark sets Mark field to given value.

### HasMark

`func (o *ChatCreateBody) HasMark() bool`

HasMark returns a boolean if a field has been set.

### SetMarkNil

`func (o *ChatCreateBody) SetMarkNil(b bool)`

 SetMarkNil sets the value for Mark to be an explicit nil

### UnsetMark
`func (o *ChatCreateBody) UnsetMark()`

UnsetMark ensures that no value is present for Mark, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


