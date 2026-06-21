# AsyncWorkflowReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**WorkflowId** | **string** |  | 
**UserId** | **string** |  | 
**InputData** | Pointer to **map[string]interface{}** |  | [optional] 

## Methods

### NewAsyncWorkflowReq

`func NewAsyncWorkflowReq(workflowId string, userId string, ) *AsyncWorkflowReq`

NewAsyncWorkflowReq instantiates a new AsyncWorkflowReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAsyncWorkflowReqWithDefaults

`func NewAsyncWorkflowReqWithDefaults() *AsyncWorkflowReq`

NewAsyncWorkflowReqWithDefaults instantiates a new AsyncWorkflowReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetWorkflowId

`func (o *AsyncWorkflowReq) GetWorkflowId() string`

GetWorkflowId returns the WorkflowId field if non-nil, zero value otherwise.

### GetWorkflowIdOk

`func (o *AsyncWorkflowReq) GetWorkflowIdOk() (*string, bool)`

GetWorkflowIdOk returns a tuple with the WorkflowId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWorkflowId

`func (o *AsyncWorkflowReq) SetWorkflowId(v string)`

SetWorkflowId sets WorkflowId field to given value.


### GetUserId

`func (o *AsyncWorkflowReq) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *AsyncWorkflowReq) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *AsyncWorkflowReq) SetUserId(v string)`

SetUserId sets UserId field to given value.


### GetInputData

`func (o *AsyncWorkflowReq) GetInputData() map[string]interface{}`

GetInputData returns the InputData field if non-nil, zero value otherwise.

### GetInputDataOk

`func (o *AsyncWorkflowReq) GetInputDataOk() (*map[string]interface{}, bool)`

GetInputDataOk returns a tuple with the InputData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputData

`func (o *AsyncWorkflowReq) SetInputData(v map[string]interface{})`

SetInputData sets InputData field to given value.

### HasInputData

`func (o *AsyncWorkflowReq) HasInputData() bool`

HasInputData returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


