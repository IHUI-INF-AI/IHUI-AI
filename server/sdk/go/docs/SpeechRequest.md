# SpeechRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Text** | **string** | 要合成的文字内容 | 
**VoiceId** | Pointer to **string** | 音色ID | [optional] [default to "longxiaochun"]
**ResponseFormat** | Pointer to **string** | 输出格式: mp3 / wav / pcm | [optional] [default to "mp3"]
**Rate** | Pointer to **NullableString** | 语速，范围 0.5~2.0，1.0为正常 | [optional] 
**Volume** | Pointer to **NullableString** | 音量，范围 0.5~2.0，1.0为正常 | [optional] 
**Pitch** | Pointer to **NullableString** | 音调，范围 0.5~2.0，1.0为正常 | [optional] 

## Methods

### NewSpeechRequest

`func NewSpeechRequest(text string, ) *SpeechRequest`

NewSpeechRequest instantiates a new SpeechRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSpeechRequestWithDefaults

`func NewSpeechRequestWithDefaults() *SpeechRequest`

NewSpeechRequestWithDefaults instantiates a new SpeechRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetText

`func (o *SpeechRequest) GetText() string`

GetText returns the Text field if non-nil, zero value otherwise.

### GetTextOk

`func (o *SpeechRequest) GetTextOk() (*string, bool)`

GetTextOk returns a tuple with the Text field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetText

`func (o *SpeechRequest) SetText(v string)`

SetText sets Text field to given value.


### GetVoiceId

`func (o *SpeechRequest) GetVoiceId() string`

GetVoiceId returns the VoiceId field if non-nil, zero value otherwise.

### GetVoiceIdOk

`func (o *SpeechRequest) GetVoiceIdOk() (*string, bool)`

GetVoiceIdOk returns a tuple with the VoiceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVoiceId

`func (o *SpeechRequest) SetVoiceId(v string)`

SetVoiceId sets VoiceId field to given value.

### HasVoiceId

`func (o *SpeechRequest) HasVoiceId() bool`

HasVoiceId returns a boolean if a field has been set.

### GetResponseFormat

`func (o *SpeechRequest) GetResponseFormat() string`

GetResponseFormat returns the ResponseFormat field if non-nil, zero value otherwise.

### GetResponseFormatOk

`func (o *SpeechRequest) GetResponseFormatOk() (*string, bool)`

GetResponseFormatOk returns a tuple with the ResponseFormat field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetResponseFormat

`func (o *SpeechRequest) SetResponseFormat(v string)`

SetResponseFormat sets ResponseFormat field to given value.

### HasResponseFormat

`func (o *SpeechRequest) HasResponseFormat() bool`

HasResponseFormat returns a boolean if a field has been set.

### GetRate

`func (o *SpeechRequest) GetRate() string`

GetRate returns the Rate field if non-nil, zero value otherwise.

### GetRateOk

`func (o *SpeechRequest) GetRateOk() (*string, bool)`

GetRateOk returns a tuple with the Rate field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRate

`func (o *SpeechRequest) SetRate(v string)`

SetRate sets Rate field to given value.

### HasRate

`func (o *SpeechRequest) HasRate() bool`

HasRate returns a boolean if a field has been set.

### SetRateNil

`func (o *SpeechRequest) SetRateNil(b bool)`

 SetRateNil sets the value for Rate to be an explicit nil

### UnsetRate
`func (o *SpeechRequest) UnsetRate()`

UnsetRate ensures that no value is present for Rate, not even an explicit nil
### GetVolume

`func (o *SpeechRequest) GetVolume() string`

GetVolume returns the Volume field if non-nil, zero value otherwise.

### GetVolumeOk

`func (o *SpeechRequest) GetVolumeOk() (*string, bool)`

GetVolumeOk returns a tuple with the Volume field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVolume

`func (o *SpeechRequest) SetVolume(v string)`

SetVolume sets Volume field to given value.

### HasVolume

`func (o *SpeechRequest) HasVolume() bool`

HasVolume returns a boolean if a field has been set.

### SetVolumeNil

`func (o *SpeechRequest) SetVolumeNil(b bool)`

 SetVolumeNil sets the value for Volume to be an explicit nil

### UnsetVolume
`func (o *SpeechRequest) UnsetVolume()`

UnsetVolume ensures that no value is present for Volume, not even an explicit nil
### GetPitch

`func (o *SpeechRequest) GetPitch() string`

GetPitch returns the Pitch field if non-nil, zero value otherwise.

### GetPitchOk

`func (o *SpeechRequest) GetPitchOk() (*string, bool)`

GetPitchOk returns a tuple with the Pitch field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPitch

`func (o *SpeechRequest) SetPitch(v string)`

SetPitch sets Pitch field to given value.

### HasPitch

`func (o *SpeechRequest) HasPitch() bool`

HasPitch returns a boolean if a field has been set.

### SetPitchNil

`func (o *SpeechRequest) SetPitchNil(b bool)`

 SetPitchNil sets the value for Pitch to be an explicit nil

### UnsetPitch
`func (o *SpeechRequest) UnsetPitch()`

UnsetPitch ensures that no value is present for Pitch, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


