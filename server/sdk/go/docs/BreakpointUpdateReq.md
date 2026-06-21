# BreakpointUpdateReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**VideoId** | **string** |  | 
**UserId** | **string** |  | 
**CurrentSeconds** | **float32** |  | 
**CurrentOffset** | Pointer to **int32** |  | [optional] [default to 0]

## Methods

### NewBreakpointUpdateReq

`func NewBreakpointUpdateReq(videoId string, userId string, currentSeconds float32, ) *BreakpointUpdateReq`

NewBreakpointUpdateReq instantiates a new BreakpointUpdateReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBreakpointUpdateReqWithDefaults

`func NewBreakpointUpdateReqWithDefaults() *BreakpointUpdateReq`

NewBreakpointUpdateReqWithDefaults instantiates a new BreakpointUpdateReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetVideoId

`func (o *BreakpointUpdateReq) GetVideoId() string`

GetVideoId returns the VideoId field if non-nil, zero value otherwise.

### GetVideoIdOk

`func (o *BreakpointUpdateReq) GetVideoIdOk() (*string, bool)`

GetVideoIdOk returns a tuple with the VideoId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoId

`func (o *BreakpointUpdateReq) SetVideoId(v string)`

SetVideoId sets VideoId field to given value.


### GetUserId

`func (o *BreakpointUpdateReq) GetUserId() string`

GetUserId returns the UserId field if non-nil, zero value otherwise.

### GetUserIdOk

`func (o *BreakpointUpdateReq) GetUserIdOk() (*string, bool)`

GetUserIdOk returns a tuple with the UserId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetUserId

`func (o *BreakpointUpdateReq) SetUserId(v string)`

SetUserId sets UserId field to given value.


### GetCurrentSeconds

`func (o *BreakpointUpdateReq) GetCurrentSeconds() float32`

GetCurrentSeconds returns the CurrentSeconds field if non-nil, zero value otherwise.

### GetCurrentSecondsOk

`func (o *BreakpointUpdateReq) GetCurrentSecondsOk() (*float32, bool)`

GetCurrentSecondsOk returns a tuple with the CurrentSeconds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCurrentSeconds

`func (o *BreakpointUpdateReq) SetCurrentSeconds(v float32)`

SetCurrentSeconds sets CurrentSeconds field to given value.


### GetCurrentOffset

`func (o *BreakpointUpdateReq) GetCurrentOffset() int32`

GetCurrentOffset returns the CurrentOffset field if non-nil, zero value otherwise.

### GetCurrentOffsetOk

`func (o *BreakpointUpdateReq) GetCurrentOffsetOk() (*int32, bool)`

GetCurrentOffsetOk returns a tuple with the CurrentOffset field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetCurrentOffset

`func (o *BreakpointUpdateReq) SetCurrentOffset(v int32)`

SetCurrentOffset sets CurrentOffset field to given value.

### HasCurrentOffset

`func (o *BreakpointUpdateReq) HasCurrentOffset() bool`

HasCurrentOffset returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


