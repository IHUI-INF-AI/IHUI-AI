# WorkflowRunRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**WorkflowId** | Pointer to **NullableString** | 工作流ID | [optional] 
**WebhookPath** | Pointer to **NullableString** | Webhook路径, 默认使用配置中的路径 | [optional] 
**InputData** | Pointer to **map[string]interface{}** | 工作流输入数据 | [optional] 

## Methods

### NewWorkflowRunRequest

`func NewWorkflowRunRequest() *WorkflowRunRequest`

NewWorkflowRunRequest instantiates a new WorkflowRunRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewWorkflowRunRequestWithDefaults

`func NewWorkflowRunRequestWithDefaults() *WorkflowRunRequest`

NewWorkflowRunRequestWithDefaults instantiates a new WorkflowRunRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetWorkflowId

`func (o *WorkflowRunRequest) GetWorkflowId() string`

GetWorkflowId returns the WorkflowId field if non-nil, zero value otherwise.

### GetWorkflowIdOk

`func (o *WorkflowRunRequest) GetWorkflowIdOk() (*string, bool)`

GetWorkflowIdOk returns a tuple with the WorkflowId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWorkflowId

`func (o *WorkflowRunRequest) SetWorkflowId(v string)`

SetWorkflowId sets WorkflowId field to given value.

### HasWorkflowId

`func (o *WorkflowRunRequest) HasWorkflowId() bool`

HasWorkflowId returns a boolean if a field has been set.

### SetWorkflowIdNil

`func (o *WorkflowRunRequest) SetWorkflowIdNil(b bool)`

 SetWorkflowIdNil sets the value for WorkflowId to be an explicit nil

### UnsetWorkflowId
`func (o *WorkflowRunRequest) UnsetWorkflowId()`

UnsetWorkflowId ensures that no value is present for WorkflowId, not even an explicit nil
### GetWebhookPath

`func (o *WorkflowRunRequest) GetWebhookPath() string`

GetWebhookPath returns the WebhookPath field if non-nil, zero value otherwise.

### GetWebhookPathOk

`func (o *WorkflowRunRequest) GetWebhookPathOk() (*string, bool)`

GetWebhookPathOk returns a tuple with the WebhookPath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWebhookPath

`func (o *WorkflowRunRequest) SetWebhookPath(v string)`

SetWebhookPath sets WebhookPath field to given value.

### HasWebhookPath

`func (o *WorkflowRunRequest) HasWebhookPath() bool`

HasWebhookPath returns a boolean if a field has been set.

### SetWebhookPathNil

`func (o *WorkflowRunRequest) SetWebhookPathNil(b bool)`

 SetWebhookPathNil sets the value for WebhookPath to be an explicit nil

### UnsetWebhookPath
`func (o *WorkflowRunRequest) UnsetWebhookPath()`

UnsetWebhookPath ensures that no value is present for WebhookPath, not even an explicit nil
### GetInputData

`func (o *WorkflowRunRequest) GetInputData() map[string]interface{}`

GetInputData returns the InputData field if non-nil, zero value otherwise.

### GetInputDataOk

`func (o *WorkflowRunRequest) GetInputDataOk() (*map[string]interface{}, bool)`

GetInputDataOk returns a tuple with the InputData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputData

`func (o *WorkflowRunRequest) SetInputData(v map[string]interface{})`

SetInputData sets InputData field to given value.

### HasInputData

`func (o *WorkflowRunRequest) HasInputData() bool`

HasInputData returns a boolean if a field has been set.

### SetInputDataNil

`func (o *WorkflowRunRequest) SetInputDataNil(b bool)`

 SetInputDataNil sets the value for InputData to be an explicit nil

### UnsetInputData
`func (o *WorkflowRunRequest) UnsetInputData()`

UnsetInputData ensures that no value is present for InputData, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


