# SpeakerIdentifyRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**GroupId** | **string** | 声纹组ID | 
**AudioUrl** | Pointer to **NullableString** | 待识别音频URL | [optional] 
**AudioBase64** | Pointer to **NullableString** | 待识别音频Base64编码 | [optional] 

## Methods

### NewSpeakerIdentifyRequest

`func NewSpeakerIdentifyRequest(groupId string, ) *SpeakerIdentifyRequest`

NewSpeakerIdentifyRequest instantiates a new SpeakerIdentifyRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSpeakerIdentifyRequestWithDefaults

`func NewSpeakerIdentifyRequestWithDefaults() *SpeakerIdentifyRequest`

NewSpeakerIdentifyRequestWithDefaults instantiates a new SpeakerIdentifyRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetGroupId

`func (o *SpeakerIdentifyRequest) GetGroupId() string`

GetGroupId returns the GroupId field if non-nil, zero value otherwise.

### GetGroupIdOk

`func (o *SpeakerIdentifyRequest) GetGroupIdOk() (*string, bool)`

GetGroupIdOk returns a tuple with the GroupId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGroupId

`func (o *SpeakerIdentifyRequest) SetGroupId(v string)`

SetGroupId sets GroupId field to given value.


### GetAudioUrl

`func (o *SpeakerIdentifyRequest) GetAudioUrl() string`

GetAudioUrl returns the AudioUrl field if non-nil, zero value otherwise.

### GetAudioUrlOk

`func (o *SpeakerIdentifyRequest) GetAudioUrlOk() (*string, bool)`

GetAudioUrlOk returns a tuple with the AudioUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioUrl

`func (o *SpeakerIdentifyRequest) SetAudioUrl(v string)`

SetAudioUrl sets AudioUrl field to given value.

### HasAudioUrl

`func (o *SpeakerIdentifyRequest) HasAudioUrl() bool`

HasAudioUrl returns a boolean if a field has been set.

### SetAudioUrlNil

`func (o *SpeakerIdentifyRequest) SetAudioUrlNil(b bool)`

 SetAudioUrlNil sets the value for AudioUrl to be an explicit nil

### UnsetAudioUrl
`func (o *SpeakerIdentifyRequest) UnsetAudioUrl()`

UnsetAudioUrl ensures that no value is present for AudioUrl, not even an explicit nil
### GetAudioBase64

`func (o *SpeakerIdentifyRequest) GetAudioBase64() string`

GetAudioBase64 returns the AudioBase64 field if non-nil, zero value otherwise.

### GetAudioBase64Ok

`func (o *SpeakerIdentifyRequest) GetAudioBase64Ok() (*string, bool)`

GetAudioBase64Ok returns a tuple with the AudioBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioBase64

`func (o *SpeakerIdentifyRequest) SetAudioBase64(v string)`

SetAudioBase64 sets AudioBase64 field to given value.

### HasAudioBase64

`func (o *SpeakerIdentifyRequest) HasAudioBase64() bool`

HasAudioBase64 returns a boolean if a field has been set.

### SetAudioBase64Nil

`func (o *SpeakerIdentifyRequest) SetAudioBase64Nil(b bool)`

 SetAudioBase64Nil sets the value for AudioBase64 to be an explicit nil

### UnsetAudioBase64
`func (o *SpeakerIdentifyRequest) UnsetAudioBase64()`

UnsetAudioBase64 ensures that no value is present for AudioBase64, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


