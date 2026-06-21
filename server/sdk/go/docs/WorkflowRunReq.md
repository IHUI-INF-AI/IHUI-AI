# WorkflowRunReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**WorkflowId** | **string** |  | 
**Parameters** | Pointer to **map[string]interface{}** |  | [optional] 
**IsAsync** | Pointer to **bool** |  | [optional] [default to false]

## Methods

### NewWorkflowRunReq

`func NewWorkflowRunReq(workflowId string, ) *WorkflowRunReq`

NewWorkflowRunReq instantiates a new WorkflowRunReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewWorkflowRunReqWithDefaults

`func NewWorkflowRunReqWithDefaults() *WorkflowRunReq`

NewWorkflowRunReqWithDefaults instantiates a new WorkflowRunReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetWorkflowId

`func (o *WorkflowRunReq) GetWorkflowId() string`

GetWorkflowId returns the WorkflowId field if non-nil, zero value otherwise.

### GetWorkflowIdOk

`func (o *WorkflowRunReq) GetWorkflowIdOk() (*string, bool)`

GetWorkflowIdOk returns a tuple with the WorkflowId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWorkflowId

`func (o *WorkflowRunReq) SetWorkflowId(v string)`

SetWorkflowId sets WorkflowId field to given value.


### GetParameters

`func (o *WorkflowRunReq) GetParameters() map[string]interface{}`

GetParameters returns the Parameters field if non-nil, zero value otherwise.

### GetParametersOk

`func (o *WorkflowRunReq) GetParametersOk() (*map[string]interface{}, bool)`

GetParametersOk returns a tuple with the Parameters field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetParameters

`func (o *WorkflowRunReq) SetParameters(v map[string]interface{})`

SetParameters sets Parameters field to given value.

### HasParameters

`func (o *WorkflowRunReq) HasParameters() bool`

HasParameters returns a boolean if a field has been set.

### SetParametersNil

`func (o *WorkflowRunReq) SetParametersNil(b bool)`

 SetParametersNil sets the value for Parameters to be an explicit nil

### UnsetParameters
`func (o *WorkflowRunReq) UnsetParameters()`

UnsetParameters ensures that no value is present for Parameters, not even an explicit nil
### GetIsAsync

`func (o *WorkflowRunReq) GetIsAsync() bool`

GetIsAsync returns the IsAsync field if non-nil, zero value otherwise.

### GetIsAsyncOk

`func (o *WorkflowRunReq) GetIsAsyncOk() (*bool, bool)`

GetIsAsyncOk returns a tuple with the IsAsync field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetIsAsync

`func (o *WorkflowRunReq) SetIsAsync(v bool)`

SetIsAsync sets IsAsync field to given value.

### HasIsAsync

`func (o *WorkflowRunReq) HasIsAsync() bool`

HasIsAsync returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


