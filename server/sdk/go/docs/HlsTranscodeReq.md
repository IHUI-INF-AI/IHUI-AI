# HlsTranscodeReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**VideoId** | **string** |  | 
**VideoPath** | Pointer to **NullableString** |  | [optional] 
**SegmentTime** | Pointer to **int32** |  | [optional] [default to 4]

## Methods

### NewHlsTranscodeReq

`func NewHlsTranscodeReq(videoId string, ) *HlsTranscodeReq`

NewHlsTranscodeReq instantiates a new HlsTranscodeReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewHlsTranscodeReqWithDefaults

`func NewHlsTranscodeReqWithDefaults() *HlsTranscodeReq`

NewHlsTranscodeReqWithDefaults instantiates a new HlsTranscodeReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetVideoId

`func (o *HlsTranscodeReq) GetVideoId() string`

GetVideoId returns the VideoId field if non-nil, zero value otherwise.

### GetVideoIdOk

`func (o *HlsTranscodeReq) GetVideoIdOk() (*string, bool)`

GetVideoIdOk returns a tuple with the VideoId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoId

`func (o *HlsTranscodeReq) SetVideoId(v string)`

SetVideoId sets VideoId field to given value.


### GetVideoPath

`func (o *HlsTranscodeReq) GetVideoPath() string`

GetVideoPath returns the VideoPath field if non-nil, zero value otherwise.

### GetVideoPathOk

`func (o *HlsTranscodeReq) GetVideoPathOk() (*string, bool)`

GetVideoPathOk returns a tuple with the VideoPath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoPath

`func (o *HlsTranscodeReq) SetVideoPath(v string)`

SetVideoPath sets VideoPath field to given value.

### HasVideoPath

`func (o *HlsTranscodeReq) HasVideoPath() bool`

HasVideoPath returns a boolean if a field has been set.

### SetVideoPathNil

`func (o *HlsTranscodeReq) SetVideoPathNil(b bool)`

 SetVideoPathNil sets the value for VideoPath to be an explicit nil

### UnsetVideoPath
`func (o *HlsTranscodeReq) UnsetVideoPath()`

UnsetVideoPath ensures that no value is present for VideoPath, not even an explicit nil
### GetSegmentTime

`func (o *HlsTranscodeReq) GetSegmentTime() int32`

GetSegmentTime returns the SegmentTime field if non-nil, zero value otherwise.

### GetSegmentTimeOk

`func (o *HlsTranscodeReq) GetSegmentTimeOk() (*int32, bool)`

GetSegmentTimeOk returns a tuple with the SegmentTime field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSegmentTime

`func (o *HlsTranscodeReq) SetSegmentTime(v int32)`

SetSegmentTime sets SegmentTime field to given value.

### HasSegmentTime

`func (o *HlsTranscodeReq) HasSegmentTime() bool`

HasSegmentTime returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


