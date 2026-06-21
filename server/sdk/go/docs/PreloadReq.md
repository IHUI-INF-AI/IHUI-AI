# PreloadReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**VideoId** | **string** |  | 
**VideoPath** | Pointer to **NullableString** |  | [optional] 
**StartSeconds** | **float32** |  | 
**PreloadSeconds** | Pointer to **float32** |  | [optional] [default to 10.0]

## Methods

### NewPreloadReq

`func NewPreloadReq(videoId string, startSeconds float32, ) *PreloadReq`

NewPreloadReq instantiates a new PreloadReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPreloadReqWithDefaults

`func NewPreloadReqWithDefaults() *PreloadReq`

NewPreloadReqWithDefaults instantiates a new PreloadReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetVideoId

`func (o *PreloadReq) GetVideoId() string`

GetVideoId returns the VideoId field if non-nil, zero value otherwise.

### GetVideoIdOk

`func (o *PreloadReq) GetVideoIdOk() (*string, bool)`

GetVideoIdOk returns a tuple with the VideoId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoId

`func (o *PreloadReq) SetVideoId(v string)`

SetVideoId sets VideoId field to given value.


### GetVideoPath

`func (o *PreloadReq) GetVideoPath() string`

GetVideoPath returns the VideoPath field if non-nil, zero value otherwise.

### GetVideoPathOk

`func (o *PreloadReq) GetVideoPathOk() (*string, bool)`

GetVideoPathOk returns a tuple with the VideoPath field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVideoPath

`func (o *PreloadReq) SetVideoPath(v string)`

SetVideoPath sets VideoPath field to given value.

### HasVideoPath

`func (o *PreloadReq) HasVideoPath() bool`

HasVideoPath returns a boolean if a field has been set.

### SetVideoPathNil

`func (o *PreloadReq) SetVideoPathNil(b bool)`

 SetVideoPathNil sets the value for VideoPath to be an explicit nil

### UnsetVideoPath
`func (o *PreloadReq) UnsetVideoPath()`

UnsetVideoPath ensures that no value is present for VideoPath, not even an explicit nil
### GetStartSeconds

`func (o *PreloadReq) GetStartSeconds() float32`

GetStartSeconds returns the StartSeconds field if non-nil, zero value otherwise.

### GetStartSecondsOk

`func (o *PreloadReq) GetStartSecondsOk() (*float32, bool)`

GetStartSecondsOk returns a tuple with the StartSeconds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetStartSeconds

`func (o *PreloadReq) SetStartSeconds(v float32)`

SetStartSeconds sets StartSeconds field to given value.


### GetPreloadSeconds

`func (o *PreloadReq) GetPreloadSeconds() float32`

GetPreloadSeconds returns the PreloadSeconds field if non-nil, zero value otherwise.

### GetPreloadSecondsOk

`func (o *PreloadReq) GetPreloadSecondsOk() (*float32, bool)`

GetPreloadSecondsOk returns a tuple with the PreloadSeconds field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPreloadSeconds

`func (o *PreloadReq) SetPreloadSeconds(v float32)`

SetPreloadSeconds sets PreloadSeconds field to given value.

### HasPreloadSeconds

`func (o *PreloadReq) HasPreloadSeconds() bool`

HasPreloadSeconds returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


