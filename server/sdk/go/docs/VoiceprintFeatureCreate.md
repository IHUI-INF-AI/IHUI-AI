# VoiceprintFeatureCreate

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** | 用户/声纹名称 | 
**Desc** | Pointer to **NullableString** | 描述 | [optional] 
**AudioUrl** | Pointer to **NullableString** | 声纹音频URL | [optional] 
**AudioBase64** | Pointer to **NullableString** | 声纹音频Base64编码 | [optional] 

## Methods

### NewVoiceprintFeatureCreate

`func NewVoiceprintFeatureCreate(name string, ) *VoiceprintFeatureCreate`

NewVoiceprintFeatureCreate instantiates a new VoiceprintFeatureCreate object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVoiceprintFeatureCreateWithDefaults

`func NewVoiceprintFeatureCreateWithDefaults() *VoiceprintFeatureCreate`

NewVoiceprintFeatureCreateWithDefaults instantiates a new VoiceprintFeatureCreate object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *VoiceprintFeatureCreate) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *VoiceprintFeatureCreate) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *VoiceprintFeatureCreate) SetName(v string)`

SetName sets Name field to given value.


### GetDesc

`func (o *VoiceprintFeatureCreate) GetDesc() string`

GetDesc returns the Desc field if non-nil, zero value otherwise.

### GetDescOk

`func (o *VoiceprintFeatureCreate) GetDescOk() (*string, bool)`

GetDescOk returns a tuple with the Desc field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDesc

`func (o *VoiceprintFeatureCreate) SetDesc(v string)`

SetDesc sets Desc field to given value.

### HasDesc

`func (o *VoiceprintFeatureCreate) HasDesc() bool`

HasDesc returns a boolean if a field has been set.

### SetDescNil

`func (o *VoiceprintFeatureCreate) SetDescNil(b bool)`

 SetDescNil sets the value for Desc to be an explicit nil

### UnsetDesc
`func (o *VoiceprintFeatureCreate) UnsetDesc()`

UnsetDesc ensures that no value is present for Desc, not even an explicit nil
### GetAudioUrl

`func (o *VoiceprintFeatureCreate) GetAudioUrl() string`

GetAudioUrl returns the AudioUrl field if non-nil, zero value otherwise.

### GetAudioUrlOk

`func (o *VoiceprintFeatureCreate) GetAudioUrlOk() (*string, bool)`

GetAudioUrlOk returns a tuple with the AudioUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioUrl

`func (o *VoiceprintFeatureCreate) SetAudioUrl(v string)`

SetAudioUrl sets AudioUrl field to given value.

### HasAudioUrl

`func (o *VoiceprintFeatureCreate) HasAudioUrl() bool`

HasAudioUrl returns a boolean if a field has been set.

### SetAudioUrlNil

`func (o *VoiceprintFeatureCreate) SetAudioUrlNil(b bool)`

 SetAudioUrlNil sets the value for AudioUrl to be an explicit nil

### UnsetAudioUrl
`func (o *VoiceprintFeatureCreate) UnsetAudioUrl()`

UnsetAudioUrl ensures that no value is present for AudioUrl, not even an explicit nil
### GetAudioBase64

`func (o *VoiceprintFeatureCreate) GetAudioBase64() string`

GetAudioBase64 returns the AudioBase64 field if non-nil, zero value otherwise.

### GetAudioBase64Ok

`func (o *VoiceprintFeatureCreate) GetAudioBase64Ok() (*string, bool)`

GetAudioBase64Ok returns a tuple with the AudioBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioBase64

`func (o *VoiceprintFeatureCreate) SetAudioBase64(v string)`

SetAudioBase64 sets AudioBase64 field to given value.

### HasAudioBase64

`func (o *VoiceprintFeatureCreate) HasAudioBase64() bool`

HasAudioBase64 returns a boolean if a field has been set.

### SetAudioBase64Nil

`func (o *VoiceprintFeatureCreate) SetAudioBase64Nil(b bool)`

 SetAudioBase64Nil sets the value for AudioBase64 to be an explicit nil

### UnsetAudioBase64
`func (o *VoiceprintFeatureCreate) UnsetAudioBase64()`

UnsetAudioBase64 ensures that no value is present for AudioBase64, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


