# CategoryCreateBody

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**AgentId** | **string** |  | 
**Group** | Pointer to **int32** |  | [optional] [default to 2]
**Type** | Pointer to **string** |  | [optional] [default to "1"]
**TypeChild** | Pointer to **string** |  | [optional] [default to "1"]
**LimitFree** | Pointer to **NullableString** |  | [optional] 
**Account** | Pointer to **int32** |  | [optional] [default to 0]

## Methods

### NewCategoryCreateBody

`func NewCategoryCreateBody(agentId string, ) *CategoryCreateBody`

NewCategoryCreateBody instantiates a new CategoryCreateBody object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewCategoryCreateBodyWithDefaults

`func NewCategoryCreateBodyWithDefaults() *CategoryCreateBody`

NewCategoryCreateBodyWithDefaults instantiates a new CategoryCreateBody object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAgentId

`func (o *CategoryCreateBody) GetAgentId() string`

GetAgentId returns the AgentId field if non-nil, zero value otherwise.

### GetAgentIdOk

`func (o *CategoryCreateBody) GetAgentIdOk() (*string, bool)`

GetAgentIdOk returns a tuple with the AgentId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentId

`func (o *CategoryCreateBody) SetAgentId(v string)`

SetAgentId sets AgentId field to given value.


### GetGroup

`func (o *CategoryCreateBody) GetGroup() int32`

GetGroup returns the Group field if non-nil, zero value otherwise.

### GetGroupOk

`func (o *CategoryCreateBody) GetGroupOk() (*int32, bool)`

GetGroupOk returns a tuple with the Group field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGroup

`func (o *CategoryCreateBody) SetGroup(v int32)`

SetGroup sets Group field to given value.

### HasGroup

`func (o *CategoryCreateBody) HasGroup() bool`

HasGroup returns a boolean if a field has been set.

### GetType

`func (o *CategoryCreateBody) GetType() string`

GetType returns the Type field if non-nil, zero value otherwise.

### GetTypeOk

`func (o *CategoryCreateBody) GetTypeOk() (*string, bool)`

GetTypeOk returns a tuple with the Type field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetType

`func (o *CategoryCreateBody) SetType(v string)`

SetType sets Type field to given value.

### HasType

`func (o *CategoryCreateBody) HasType() bool`

HasType returns a boolean if a field has been set.

### GetTypeChild

`func (o *CategoryCreateBody) GetTypeChild() string`

GetTypeChild returns the TypeChild field if non-nil, zero value otherwise.

### GetTypeChildOk

`func (o *CategoryCreateBody) GetTypeChildOk() (*string, bool)`

GetTypeChildOk returns a tuple with the TypeChild field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTypeChild

`func (o *CategoryCreateBody) SetTypeChild(v string)`

SetTypeChild sets TypeChild field to given value.

### HasTypeChild

`func (o *CategoryCreateBody) HasTypeChild() bool`

HasTypeChild returns a boolean if a field has been set.

### GetLimitFree

`func (o *CategoryCreateBody) GetLimitFree() string`

GetLimitFree returns the LimitFree field if non-nil, zero value otherwise.

### GetLimitFreeOk

`func (o *CategoryCreateBody) GetLimitFreeOk() (*string, bool)`

GetLimitFreeOk returns a tuple with the LimitFree field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimitFree

`func (o *CategoryCreateBody) SetLimitFree(v string)`

SetLimitFree sets LimitFree field to given value.

### HasLimitFree

`func (o *CategoryCreateBody) HasLimitFree() bool`

HasLimitFree returns a boolean if a field has been set.

### SetLimitFreeNil

`func (o *CategoryCreateBody) SetLimitFreeNil(b bool)`

 SetLimitFreeNil sets the value for LimitFree to be an explicit nil

### UnsetLimitFree
`func (o *CategoryCreateBody) UnsetLimitFree()`

UnsetLimitFree ensures that no value is present for LimitFree, not even an explicit nil
### GetAccount

`func (o *CategoryCreateBody) GetAccount() int32`

GetAccount returns the Account field if non-nil, zero value otherwise.

### GetAccountOk

`func (o *CategoryCreateBody) GetAccountOk() (*int32, bool)`

GetAccountOk returns a tuple with the Account field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAccount

`func (o *CategoryCreateBody) SetAccount(v int32)`

SetAccount sets Account field to given value.

### HasAccount

`func (o *CategoryCreateBody) HasAccount() bool`

HasAccount returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


