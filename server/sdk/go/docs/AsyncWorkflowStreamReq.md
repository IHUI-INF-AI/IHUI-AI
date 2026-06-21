# AsyncWorkflowStreamReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**WorkflowId** | **string** |  | 
**UserId** | **string** |  | 
**InputData** | Pointer to **map[string]interface{}** |  | [optional] 
**ChatId** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewAsyncWorkflowStreamReq

`func NewAsyncWorkflowStreamReq(workflowId string, userId string, ) *AsyncWorkflowStreamReq`

NewAsyncWorkflowStreamReq instantiates a new AsyncWorkflowStreamReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewAsyncWorkflowStreamReqWithDefaults

`func NewAsyncWorkflowStreamReqWithDefaults() *AsyncWorkflowStreamReq`

NewAsyncWorkflowStreamReqWithDefaults instantiates a new AsyncWorkflowStreamReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetWorkflowId

`func (o *AsyncWorkflowStreamReq) GetWorkflowId() string`

GetWorkflowId returns the WorkflowId field if non-nil, zero value otherwise.

### GetWorkflowIdOk

`func (o *AsyncWorkflowStreamReq) GetWorkflowIdOk() (*string, bool)`

GetWorkflowIdOk returns a tuple with the WorkflowId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWorkflowId

`func (o *AsyncWorkflowStreamReq) SetWorkflowId(v string)`

SetWorkflowId sets WorkflowId field to given value.


### GetUserId

`func (o *AsyncWorkflowStreamReq) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *AsyncWorkflowStreamReq) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *AsyncWorkflowStreamReq) SetUserId(v string)`

SetUserId sets UserId field to given value.


### GetInputData

`func (o *AsyncWorkflowStreamReq) GetInputData() map[string]interface{}`

GetInputData returns the InputData field if non-nil, zero value otherwise.

### GetInputDataOk

`func (o *AsyncWorkflowStreamReq) GetInputDataOk() (*map[string]interface{}, bool)`

GetInputDataOk returns a tuple with the InputData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInputData

`func (o *AsyncWorkflowStreamReq) SetInputData(v map[string]interface{})`

SetInputData sets InputData field to given value.

### HasInputData

`func (o *AsyncWorkflowStreamReq) HasInputData() bool`

HasInputData returns a boolean if a field has been set.

### GetChatId

`func (o *AsyncWorkflowStreamReq) GetChatId() string`

GetChatId returns the ChatId field if non-nil, zero value otherwise.

### GetChatIdOk

`func (o *AsyncWorkflowStreamReq) GetChatIdOk() (*string, bool)`

GetChatIdOk returns a tuple with the ChatId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetChatId

`func (o *AsyncWorkflowStreamReq) SetChatId(v string)`

SetChatId sets ChatId field to given value.

### HasChatId

`func (o *AsyncWorkflowStreamReq) HasChatId() bool`

HasChatId returns a boolean if a field has been set.

### SetChatIdNil

`func (o *AsyncWorkflowStreamReq) SetChatIdNil(b bool)`

 SetChatIdNil sets the value for ChatId to be an explicit nil

### UnsetChatId
`func (o *AsyncWorkflowStreamReq) UnsetChatId()`

UnsetChatId ensures that no value is present for ChatId, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


