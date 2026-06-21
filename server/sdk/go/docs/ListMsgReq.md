# ListMsgReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**ConversationId** | **string** |  | 
**Limit** | Pointer to **NullableInt32** |  | [optional] 
**Offset** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewListMsgReq

`func NewListMsgReq(conversationId string, ) *ListMsgReq`

NewListMsgReq instantiates a new ListMsgReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewListMsgReqWithDefaults

`func NewListMsgReqWithDefaults() *ListMsgReq`

NewListMsgReqWithDefaults instantiates a new ListMsgReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetConversationId

`func (o *ListMsgReq) GetConversationId() string`

GetConversationId returns the ConversationId field if non-nil, zero value otherwise.

### GetConversationIdOk

`func (o *ListMsgReq) GetConversationIdOk() (*string, bool)`

GetConversationIdOk returns a tuple with the ConversationId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetConversationId

`func (o *ListMsgReq) SetConversationId(v string)`

SetConversationId sets ConversationId field to given value.


### GetLimit

`func (o *ListMsgReq) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *ListMsgReq) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *ListMsgReq) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *ListMsgReq) HasLimit() bool`

HasLimit returns a boolean if a field has been set.

### SetLimitNil

`func (o *ListMsgReq) SetLimitNil(b bool)`

 SetLimitNil sets the value for Limit to be an explicit nil

### UnsetLimit
`func (o *ListMsgReq) UnsetLimit()`

UnsetLimit ensures that no value is present for Limit, not even an explicit nil
### GetOffset

`func (o *ListMsgReq) GetOffset() int32`

GetOffset returns the Offset field if non-nil, zero value otherwise.

### GetOffsetOk

`func (o *ListMsgReq) GetOffsetOk() (*int32, bool)`

GetOffsetOk returns a tuple with the Offset field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOffset

`func (o *ListMsgReq) SetOffset(v int32)`

SetOffset sets Offset field to given value.

### HasOffset

`func (o *ListMsgReq) HasOffset() bool`

HasOffset returns a boolean if a field has been set.

### SetOffsetNil

`func (o *ListMsgReq) SetOffsetNil(b bool)`

 SetOffsetNil sets the value for Offset to be an explicit nil

### UnsetOffset
`func (o *ListMsgReq) UnsetOffset()`

UnsetOffset ensures that no value is present for Offset, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


