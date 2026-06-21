# SpeechReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Input** | **string** |  | 
**VoiceId** | **string** |  | 
**ResponseFormat** | Pointer to **NullableString** |  | [optional] 
**Speed** | Pointer to **NullableFloat32** | 起始时间戳 | [optional] 

## Methods

### NewSpeechReq

`func NewSpeechReq(input string, voiceId string, ) *SpeechReq`

NewSpeechReq instantiates a new SpeechReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSpeechReqWithDefaults

`func NewSpeechReqWithDefaults() *SpeechReq`

NewSpeechReqWithDefaults instantiates a new SpeechReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetInput

`func (o *SpeechReq) GetInput() string`

GetInput returns the Input field if non-nil, zero value otherwise.

### GetInputOk

`func (o *SpeechReq) GetInputOk() (*string, bool)`

GetInputOk returns a tuple with the Input field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetInput

`func (o *SpeechReq) SetInput(v string)`

SetInput sets Input field to given value.


### GetVoiceId

`func (o *SpeechReq) GetVoiceId() string`

GetVoiceId returns the VoiceId field if non-nil, zero value otherwise.

### GetVoiceIdOk

`func (o *SpeechReq) GetVoiceIdOk() (*string, bool)`

GetVoiceIdOk returns a tuple with the VoiceId field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetVoiceId

`func (o *SpeechReq) SetVoiceId(v string)`

SetVoiceId sets VoiceId field to given value.


### GetResponseFormat

`func (o *SpeechReq) GetResponseFormat() string`

GetResponseFormat returns the ResponseFormat field if non-nil, zero value otherwise.

### GetResponseFormatOk

`func (o *SpeechReq) GetResponseFormatOk() (*string, bool)`

GetResponseFormatOk returns a tuple with the ResponseFormat field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetResponseFormat

`func (o *SpeechReq) SetResponseFormat(v string)`

SetResponseFormat sets ResponseFormat field to given value.

### HasResponseFormat

`func (o *SpeechReq) HasResponseFormat() bool`

HasResponseFormat returns a boolean if a field has been set.

### SetResponseFormatNil

`func (o *SpeechReq) SetResponseFormatNil(b bool)`

 SetResponseFormatNil sets the value for ResponseFormat to be an explicit nil

### UnsetResponseFormat
`func (o *SpeechReq) UnsetResponseFormat()`

UnsetResponseFormat ensures that no value is present for ResponseFormat, not even an explicit nil
### GetSpeed

`func (o *SpeechReq) GetSpeed() float32`

GetSpeed returns the Speed field if non-nil, zero value otherwise.

### GetSpeedOk

`func (o *SpeechReq) GetSpeedOk() (*float32, bool)`

GetSpeedOk returns a tuple with the Speed field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSpeed

`func (o *SpeechReq) SetSpeed(v float32)`

SetSpeed sets Speed field to given value.

### HasSpeed

`func (o *SpeechReq) HasSpeed() bool`

HasSpeed returns a boolean if a field has been set.

### SetSpeedNil

`func (o *SpeechReq) SetSpeedNil(b bool)`

 SetSpeedNil sets the value for Speed to be an explicit nil

### UnsetSpeed
`func (o *SpeechReq) UnsetSpeed()`

UnsetSpeed ensures that no value is present for Speed, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


