# ListConvReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**BotId** | **string** |  | 
**UserId** | **string** |  | 
**Limit** | Pointer to **NullableInt32** |  | [optional] 
**Offset** | Pointer to **NullableInt32** |  | [optional] 

## Methods

### NewListConvReq

`func NewListConvReq(botId string, userId string, ) *ListConvReq`

NewListConvReq instantiates a new ListConvReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewListConvReqWithDefaults

`func NewListConvReqWithDefaults() *ListConvReq`

NewListConvReqWithDefaults instantiates a new ListConvReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetBotId

`func (o *ListConvReq) GetBotId() string`

GetBotId returns the BotId field if non-nil, zero value otherwise.

### GetBotIdOk

`func (o *ListConvReq) GetBotIdOk() (*string, bool)`

GetBotIdOk returns a tuple with the BotId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBotId

`func (o *ListConvReq) SetBotId(v string)`

SetBotId sets BotId field to given value.


### GetUserId

`func (o *ListConvReq) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *ListConvReq) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *ListConvReq) SetUserId(v string)`

SetUserId sets UserId field to given value.


### GetLimit

`func (o *ListConvReq) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *ListConvReq) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *ListConvReq) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *ListConvReq) HasLimit() bool`

HasLimit returns a boolean if a field has been set.

### SetLimitNil

`func (o *ListConvReq) SetLimitNil(b bool)`

 SetLimitNil sets the value for Limit to be an explicit nil

### UnsetLimit
`func (o *ListConvReq) UnsetLimit()`

UnsetLimit ensures that no value is present for Limit, not even an explicit nil
### GetOffset

`func (o *ListConvReq) GetOffset() int32`

GetOffset returns the Offset field if non-nil, zero value otherwise.

### GetOffsetOk

`func (o *ListConvReq) GetOffsetOk() (*int32, bool)`

GetOffsetOk returns a tuple with the Offset field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetOffset

`func (o *ListConvReq) SetOffset(v int32)`

SetOffset sets Offset field to given value.

### HasOffset

`func (o *ListConvReq) HasOffset() bool`

HasOffset returns a boolean if a field has been set.

### SetOffsetNil

`func (o *ListConvReq) SetOffsetNil(b bool)`

 SetOffsetNil sets the value for Offset to be an explicit nil

### UnsetOffset
`func (o *ListConvReq) UnsetOffset()`

UnsetOffset ensures that no value is present for Offset, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


