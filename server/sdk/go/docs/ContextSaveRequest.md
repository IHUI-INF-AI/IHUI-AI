# ContextSaveRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**AgentId** | **string** |  | 
**ContextKey** | **string** |  | 
**ContextValue** | **string** |  | 
**FieldName** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewContextSaveRequest

`func NewContextSaveRequest(agentId string, contextKey string, contextValue string, ) *ContextSaveRequest`

NewContextSaveRequest instantiates a new ContextSaveRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewContextSaveRequestWithDefaults

`func NewContextSaveRequestWithDefaults() *ContextSaveRequest`

NewContextSaveRequestWithDefaults instantiates a new ContextSaveRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAgentId

`func (o *ContextSaveRequest) GetAgentId() string`

GetAgentId returns the AgentId field if non-nil, zero value otherwise.

### GetAgentIdOk

`func (o *ContextSaveRequest) GetAgentIdOk() (*string, bool)`

GetAgentIdOk returns a tuple with the AgentId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentId

`func (o *ContextSaveRequest) SetAgentId(v string)`

SetAgentId sets AgentId field to given value.


### GetContextKey

`func (o *ContextSaveRequest) GetContextKey() string`

GetContextKey returns the ContextKey field if non-nil, zero value otherwise.

### GetContextKeyOk

`func (o *ContextSaveRequest) GetContextKeyOk() (*string, bool)`

GetContextKeyOk returns a tuple with the ContextKey field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContextKey

`func (o *ContextSaveRequest) SetContextKey(v string)`

SetContextKey sets ContextKey field to given value.


### GetContextValue

`func (o *ContextSaveRequest) GetContextValue() string`

GetContextValue returns the ContextValue field if non-nil, zero value otherwise.

### GetContextValueOk

`func (o *ContextSaveRequest) GetContextValueOk() (*string, bool)`

GetContextValueOk returns a tuple with the ContextValue field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetContextValue

`func (o *ContextSaveRequest) SetContextValue(v string)`

SetContextValue sets ContextValue field to given value.


### GetFieldName

`func (o *ContextSaveRequest) GetFieldName() string`

GetFieldName returns the FieldName field if non-nil, zero value otherwise.

### GetFieldNameOk

`func (o *ContextSaveRequest) GetFieldNameOk() (*string, bool)`

GetFieldNameOk returns a tuple with the FieldName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFieldName

`func (o *ContextSaveRequest) SetFieldName(v string)`

SetFieldName sets FieldName field to given value.

### HasFieldName

`func (o *ContextSaveRequest) HasFieldName() bool`

HasFieldName returns a boolean if a field has been set.

### SetFieldNameNil

`func (o *ContextSaveRequest) SetFieldNameNil(b bool)`

 SetFieldNameNil sets the value for FieldName to be an explicit nil

### UnsetFieldName
`func (o *ContextSaveRequest) UnsetFieldName()`

UnsetFieldName ensures that no value is present for FieldName, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


