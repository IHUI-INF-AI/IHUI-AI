# VideoSynthesisRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | 视频生成文本提示 | 
**ImageUrl** | Pointer to **NullableString** | 图生视频的图片URL；留空则文生视频 | [optional] 
**AudioUrl** | Pointer to **NullableString** | 音频URL，用于音频驱动视频 | [optional] 
**Model** | Pointer to **string** | 视频合成模型 | [optional] [default to "wan2.1-t2v-turbo"]
**Duration** | Pointer to **int32** | 视频时长（秒） | [optional] [default to 5]
**Resolution** | Pointer to **string** | 视频分辨率，如 1280*720 | [optional] [default to "1280*720"]
**Zidingyican** | Pointer to **[]map[string]interface{}** | Extra custom parameters as name/value pairs | [optional] 

## Methods

### NewVideoSynthesisRequest

`func NewVideoSynthesisRequest(prompt string, ) *VideoSynthesisRequest`

NewVideoSynthesisRequest instantiates a new VideoSynthesisRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVideoSynthesisRequestWithDefaults

`func NewVideoSynthesisRequestWithDefaults() *VideoSynthesisRequest`

NewVideoSynthesisRequestWithDefaults instantiates a new VideoSynthesisRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *VideoSynthesisRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *VideoSynthesisRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *VideoSynthesisRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetImageUrl

`func (o *VideoSynthesisRequest) GetImageUrl() string`

GetImageUrl returns the ImageUrl field if non-nil, zero value otherwise.

### GetImageUrlOk

`func (o *VideoSynthesisRequest) GetImageUrlOk() (*string, bool)`

GetImageUrlOk returns a tuple with the ImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageUrl

`func (o *VideoSynthesisRequest) SetImageUrl(v string)`

SetImageUrl sets ImageUrl field to given value.

### HasImageUrl

`func (o *VideoSynthesisRequest) HasImageUrl() bool`

HasImageUrl returns a boolean if a field has been set.

### SetImageUrlNil

`func (o *VideoSynthesisRequest) SetImageUrlNil(b bool)`

 SetImageUrlNil sets the value for ImageUrl to be an explicit nil

### UnsetImageUrl
`func (o *VideoSynthesisRequest) UnsetImageUrl()`

UnsetImageUrl ensures that no value is present for ImageUrl, not even an explicit nil
### GetAudioUrl

`func (o *VideoSynthesisRequest) GetAudioUrl() string`

GetAudioUrl returns the AudioUrl field if non-nil, zero value otherwise.

### GetAudioUrlOk

`func (o *VideoSynthesisRequest) GetAudioUrlOk() (*string, bool)`

GetAudioUrlOk returns a tuple with the AudioUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioUrl

`func (o *VideoSynthesisRequest) SetAudioUrl(v string)`

SetAudioUrl sets AudioUrl field to given value.

### HasAudioUrl

`func (o *VideoSynthesisRequest) HasAudioUrl() bool`

HasAudioUrl returns a boolean if a field has been set.

### SetAudioUrlNil

`func (o *VideoSynthesisRequest) SetAudioUrlNil(b bool)`

 SetAudioUrlNil sets the value for AudioUrl to be an explicit nil

### UnsetAudioUrl
`func (o *VideoSynthesisRequest) UnsetAudioUrl()`

UnsetAudioUrl ensures that no value is present for AudioUrl, not even an explicit nil
### GetModel

`func (o *VideoSynthesisRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *VideoSynthesisRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *VideoSynthesisRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *VideoSynthesisRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetDuration

`func (o *VideoSynthesisRequest) GetDuration() int32`

GetDuration returns the Duration field if non-nil, zero value otherwise.

### GetDurationOk

`func (o *VideoSynthesisRequest) GetDurationOk() (*int32, bool)`

GetDurationOk returns a tuple with the Duration field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDuration

`func (o *VideoSynthesisRequest) SetDuration(v int32)`

SetDuration sets Duration field to given value.

### HasDuration

`func (o *VideoSynthesisRequest) HasDuration() bool`

HasDuration returns a boolean if a field has been set.

### GetResolution

`func (o *VideoSynthesisRequest) GetResolution() string`

GetResolution returns the Resolution field if non-nil, zero value otherwise.

### GetResolutionOk

`func (o *VideoSynthesisRequest) GetResolutionOk() (*string, bool)`

GetResolutionOk returns a tuple with the Resolution field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetResolution

`func (o *VideoSynthesisRequest) SetResolution(v string)`

SetResolution sets Resolution field to given value.

### HasResolution

`func (o *VideoSynthesisRequest) HasResolution() bool`

HasResolution returns a boolean if a field has been set.

### GetZidingyican

`func (o *VideoSynthesisRequest) GetZidingyican() []map[string]interface{}`

GetZidingyican returns the Zidingyican field if non-nil, zero value otherwise.

### GetZidingyicanOk

`func (o *VideoSynthesisRequest) GetZidingyicanOk() (*[]map[string]interface{}, bool)`

GetZidingyicanOk returns a tuple with the Zidingyican field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetZidingyican

`func (o *VideoSynthesisRequest) SetZidingyican(v []map[string]interface{})`

SetZidingyican sets Zidingyican field to given value.

### HasZidingyican

`func (o *VideoSynthesisRequest) HasZidingyican() bool`

HasZidingyican returns a boolean if a field has been set.

### SetZidingyicanNil

`func (o *VideoSynthesisRequest) SetZidingyicanNil(b bool)`

 SetZidingyicanNil sets the value for Zidingyican to be an explicit nil

### UnsetZidingyican
`func (o *VideoSynthesisRequest) UnsetZidingyican()`

UnsetZidingyican ensures that no value is present for Zidingyican, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


