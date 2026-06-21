# FieldRemoveRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**AgentId** | **string** |  | 
**FieldName** | **string** |  | 

## Methods

### NewFieldRemoveRequest

`func NewFieldRemoveRequest(agentId string, fieldName string, ) *FieldRemoveRequest`

NewFieldRemoveRequest instantiates a new FieldRemoveRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewFieldRemoveRequestWithDefaults

`func NewFieldRemoveRequestWithDefaults() *FieldRemoveRequest`

NewFieldRemoveRequestWithDefaults instantiates a new FieldRemoveRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAgentId

`func (o *FieldRemoveRequest) GetAgentId() string`

GetAgentId returns the AgentId field if non-nil, zero value otherwise.

### GetAgentIdOk

`func (o *FieldRemoveRequest) GetAgentIdOk() (*string, bool)`

GetAgentIdOk returns a tuple with the AgentId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAgentId

`func (o *FieldRemoveRequest) SetAgentId(v string)`

SetAgentId sets AgentId field to given value.


### GetFieldName

`func (o *FieldRemoveRequest) GetFieldName() string`

GetFieldName returns the FieldName field if non-nil, zero value otherwise.

### GetFieldNameOk

`func (o *FieldRemoveRequest) GetFieldNameOk() (*string, bool)`

GetFieldNameOk returns a tuple with the FieldName field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFieldName

`func (o *FieldRemoveRequest) SetFieldName(v string)`

SetFieldName sets FieldName field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


