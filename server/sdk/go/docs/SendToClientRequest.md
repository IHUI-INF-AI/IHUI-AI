# SendToClientRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Message** | **map[string]interface{}** | 要发送的消息内容 | 

## Methods

### NewSendToClientRequest

`func NewSendToClientRequest(message map[string]interface{}, ) *SendToClientRequest`

NewSendToClientRequest instantiates a new SendToClientRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSendToClientRequestWithDefaults

`func NewSendToClientRequestWithDefaults() *SendToClientRequest`

NewSendToClientRequestWithDefaults instantiates a new SendToClientRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetMessage

`func (o *SendToClientRequest) GetMessage() map[string]interface{}`

GetMessage returns the Message field if non-nil, zero value otherwise.

### GetMessageOk

`func (o *SendToClientRequest) GetMessageOk() (*map[string]interface{}, bool)`

GetMessageOk returns a tuple with the Message field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMessage

`func (o *SendToClientRequest) SetMessage(v map[string]interface{})`

SetMessage sets Message field to given value.



[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


