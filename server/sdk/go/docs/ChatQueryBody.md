# ChatQueryBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ModelName** | Pointer to **NullableString** | Model name (optional filter) | [optional] 

## Methods

### NewChatQueryBody

`func NewChatQueryBody() *ChatQueryBody`

NewChatQueryBody instantiates a new ChatQueryBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewChatQueryBodyWithDefaults

`func NewChatQueryBodyWithDefaults() *ChatQueryBody`

NewChatQueryBodyWithDefaults instantiates a new ChatQueryBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModelName

`func (o *ChatQueryBody) GetModelName() string`

GetModelName returns the ModelName field if non-nil, zero value otherwise.

### GetModelNameOk

`func (o *ChatQueryBody) GetModelNameOk() (*string, bool)`

GetModelNameOk returns a tuple with the ModelName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModelName

`func (o *ChatQueryBody) SetModelName(v string)`

SetModelName sets ModelName field to given value.

### HasModelName

`func (o *ChatQueryBody) HasModelName() bool`

HasModelName returns a boolean if a field has been set.

### SetModelNameNil

`func (o *ChatQueryBody) SetModelNameNil(b bool)`

 SetModelNameNil sets the value for ModelName to be an explicit nil

### UnsetModelName
`func (o *ChatQueryBody) UnsetModelName()`

UnsetModelName ensures that no value is present for ModelName, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


