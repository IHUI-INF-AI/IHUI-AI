# BreakpointReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**VideoId** | **string** |  | 
**BreakpointSeconds** | **float32** |  | 
**PreloadSeconds** | Pointer to **float32** |  | [optional] [default to 10.0]

## Methods

### NewBreakpointReq

`func NewBreakpointReq(videoId string, breakpointSeconds float32, ) *BreakpointReq`

NewBreakpointReq instantiates a new BreakpointReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBreakpointReqWithDefaults

`func NewBreakpointReqWithDefaults() *BreakpointReq`

NewBreakpointReqWithDefaults instantiates a new BreakpointReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetVideoId

`func (o *BreakpointReq) GetVideoId() string`

GetVideoId returns the VideoId field if non-nil, zero value otherwise.

### GetVideoIdOk

`func (o *BreakpointReq) GetVideoIdOk() (*string, bool)`

GetVideoIdOk returns a tuple with the VideoId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoId

`func (o *BreakpointReq) SetVideoId(v string)`

SetVideoId sets VideoId field to given value.


### GetBreakpointSeconds

`func (o *BreakpointReq) GetBreakpointSeconds() float32`

GetBreakpointSeconds returns the BreakpointSeconds field if non-nil, zero value otherwise.

### GetBreakpointSecondsOk

`func (o *BreakpointReq) GetBreakpointSecondsOk() (*float32, bool)`

GetBreakpointSecondsOk returns a tuple with the BreakpointSeconds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetBreakpointSeconds

`func (o *BreakpointReq) SetBreakpointSeconds(v float32)`

SetBreakpointSeconds sets BreakpointSeconds field to given value.


### GetPreloadSeconds

`func (o *BreakpointReq) GetPreloadSeconds() float32`

GetPreloadSeconds returns the PreloadSeconds field if non-nil, zero value otherwise.

### GetPreloadSecondsOk

`func (o *BreakpointReq) GetPreloadSecondsOk() (*float32, bool)`

GetPreloadSecondsOk returns a tuple with the PreloadSeconds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPreloadSeconds

`func (o *BreakpointReq) SetPreloadSeconds(v float32)`

SetPreloadSeconds sets PreloadSeconds field to given value.

### HasPreloadSeconds

`func (o *BreakpointReq) HasPreloadSeconds() bool`

HasPreloadSeconds returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


