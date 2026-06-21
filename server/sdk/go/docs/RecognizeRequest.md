# RecognizeRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**AudioUrl** | Pointer to **NullableString** | 音频文件URL | [optional] 
**AudioBase64** | Pointer to **NullableString** | 音频文件Base64编码 (mp3/wav/pcm) | [optional] 
**Model** | Pointer to **string** | ASR模型: paraformer-v2 / qwen3-asr-flash | [optional] [default to "paraformer-v2"]
**Language** | Pointer to **NullableString** | 语言代码: zh / en 等，留空自动检测 | [optional] 
**SampleRate** | Pointer to **NullableInt32** | 采样率 (仅PCM格式需要) | [optional] 

## Methods

### NewRecognizeRequest

`func NewRecognizeRequest() *RecognizeRequest`

NewRecognizeRequest instantiates a new RecognizeRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewRecognizeRequestWithDefaults

`func NewRecognizeRequestWithDefaults() *RecognizeRequest`

NewRecognizeRequestWithDefaults instantiates a new RecognizeRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAudioUrl

`func (o *RecognizeRequest) GetAudioUrl() string`

GetAudioUrl returns the AudioUrl field if non-nil, zero value otherwise.

### GetAudioUrlOk

`func (o *RecognizeRequest) GetAudioUrlOk() (*string, bool)`

GetAudioUrlOk returns a tuple with the AudioUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioUrl

`func (o *RecognizeRequest) SetAudioUrl(v string)`

SetAudioUrl sets AudioUrl field to given value.

### HasAudioUrl

`func (o *RecognizeRequest) HasAudioUrl() bool`

HasAudioUrl returns a boolean if a field has been set.

### SetAudioUrlNil

`func (o *RecognizeRequest) SetAudioUrlNil(b bool)`

 SetAudioUrlNil sets the value for AudioUrl to be an explicit nil

### UnsetAudioUrl
`func (o *RecognizeRequest) UnsetAudioUrl()`

UnsetAudioUrl ensures that no value is present for AudioUrl, not even an explicit nil
### GetAudioBase64

`func (o *RecognizeRequest) GetAudioBase64() string`

GetAudioBase64 returns the AudioBase64 field if non-nil, zero value otherwise.

### GetAudioBase64Ok

`func (o *RecognizeRequest) GetAudioBase64Ok() (*string, bool)`

GetAudioBase64Ok returns a tuple with the AudioBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioBase64

`func (o *RecognizeRequest) SetAudioBase64(v string)`

SetAudioBase64 sets AudioBase64 field to given value.

### HasAudioBase64

`func (o *RecognizeRequest) HasAudioBase64() bool`

HasAudioBase64 returns a boolean if a field has been set.

### SetAudioBase64Nil

`func (o *RecognizeRequest) SetAudioBase64Nil(b bool)`

 SetAudioBase64Nil sets the value for AudioBase64 to be an explicit nil

### UnsetAudioBase64
`func (o *RecognizeRequest) UnsetAudioBase64()`

UnsetAudioBase64 ensures that no value is present for AudioBase64, not even an explicit nil
### GetModel

`func (o *RecognizeRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *RecognizeRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *RecognizeRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *RecognizeRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetLanguage

`func (o *RecognizeRequest) GetLanguage() string`

GetLanguage returns the Language field if non-nil, zero value otherwise.

### GetLanguageOk

`func (o *RecognizeRequest) GetLanguageOk() (*string, bool)`

GetLanguageOk returns a tuple with the Language field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLanguage

`func (o *RecognizeRequest) SetLanguage(v string)`

SetLanguage sets Language field to given value.

### HasLanguage

`func (o *RecognizeRequest) HasLanguage() bool`

HasLanguage returns a boolean if a field has been set.

### SetLanguageNil

`func (o *RecognizeRequest) SetLanguageNil(b bool)`

 SetLanguageNil sets the value for Language to be an explicit nil

### UnsetLanguage
`func (o *RecognizeRequest) UnsetLanguage()`

UnsetLanguage ensures that no value is present for Language, not even an explicit nil
### GetSampleRate

`func (o *RecognizeRequest) GetSampleRate() int32`

GetSampleRate returns the SampleRate field if non-nil, zero value otherwise.

### GetSampleRateOk

`func (o *RecognizeRequest) GetSampleRateOk() (*int32, bool)`

GetSampleRateOk returns a tuple with the SampleRate field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSampleRate

`func (o *RecognizeRequest) SetSampleRate(v int32)`

SetSampleRate sets SampleRate field to given value.

### HasSampleRate

`func (o *RecognizeRequest) HasSampleRate() bool`

HasSampleRate returns a boolean if a field has been set.

### SetSampleRateNil

`func (o *RecognizeRequest) SetSampleRateNil(b bool)`

 SetSampleRateNil sets the value for SampleRate to be an explicit nil

### UnsetSampleRate
`func (o *RecognizeRequest) UnsetSampleRate()`

UnsetSampleRate ensures that no value is present for SampleRate, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


