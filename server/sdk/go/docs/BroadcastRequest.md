# BroadcastRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Message** | **map[string]interface{}** | 要广播的消息内容 | 
**RoomId** | Pointer to **NullableString** | 指定房间ID，为空则全局广播 | [optional] 

## Methods

### NewBroadcastRequest

`func NewBroadcastRequest(message map[string]interface{}, ) *BroadcastRequest`

NewBroadcastRequest instantiates a new BroadcastRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBroadcastRequestWithDefaults

`func NewBroadcastRequestWithDefaults() *BroadcastRequest`

NewBroadcastRequestWithDefaults instantiates a new BroadcastRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetMessage

`func (o *BroadcastRequest) GetMessage() map[string]interface{}`

GetMessage returns the Message field if non-nil, zero value otherwise.

### GetMessageOk

`func (o *BroadcastRequest) GetMessageOk() (*map[string]interface{}, bool)`

GetMessageOk returns a tuple with the Message field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMessage

`func (o *BroadcastRequest) SetMessage(v map[string]interface{})`

SetMessage sets Message field to given value.


### GetRoomId

`func (o *BroadcastRequest) GetRoomId() string`

GetRoomId returns the RoomId field if non-nil, zero value otherwise.

### GetRoomIdOk

`func (o *BroadcastRequest) GetRoomIdOk() (*string, bool)`

GetRoomIdOk returns a tuple with the RoomId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRoomId

`func (o *BroadcastRequest) SetRoomId(v string)`

SetRoomId sets RoomId field to given value.

### HasRoomId

`func (o *BroadcastRequest) HasRoomId() bool`

HasRoomId returns a boolean if a field has been set.

### SetRoomIdNil

`func (o *BroadcastRequest) SetRoomIdNil(b bool)`

 SetRoomIdNil sets the value for RoomId to be an explicit nil

### UnsetRoomId
`func (o *BroadcastRequest) UnsetRoomId()`

UnsetRoomId ensures that no value is present for RoomId, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


