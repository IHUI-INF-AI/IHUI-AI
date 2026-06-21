# VoiceprintCreateReq

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Name** | **string** |  | 
**Description** | Pointer to **NullableString** |  | [optional] 
**AudioData** | Pointer to **NullableString** |  | [optional] 

## Methods

### NewVoiceprintCreateReq

`func NewVoiceprintCreateReq(name string, ) *VoiceprintCreateReq`

NewVoiceprintCreateReq instantiates a new VoiceprintCreateReq object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewVoiceprintCreateReqWithDefaults

`func NewVoiceprintCreateReqWithDefaults() *VoiceprintCreateReq`

NewVoiceprintCreateReqWithDefaults instantiates a new VoiceprintCreateReq object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetName

`func (o *VoiceprintCreateReq) GetName() string`

GetName returns the Name field if non-nil, zero value otherwise.

### GetNameOk

`func (o *VoiceprintCreateReq) GetNameOk() (*string, bool)`

GetNameOk returns a tuple with the Name field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetName

`func (o *VoiceprintCreateReq) SetName(v string)`

SetName sets Name field to given value.


### GetDescription

`func (o *VoiceprintCreateReq) GetDescription() string`

GetDescription returns the Description field if non-nil, zero value otherwise.

### GetDescriptionOk

`func (o *VoiceprintCreateReq) GetDescriptionOk() (*string, bool)`

GetDescriptionOk returns a tuple with the Description field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDescription

`func (o *VoiceprintCreateReq) SetDescription(v string)`

SetDescription sets Description field to given value.

### HasDescription

`func (o *VoiceprintCreateReq) HasDescription() bool`

HasDescription returns a boolean if a field has been set.

### SetDescriptionNil

`func (o *VoiceprintCreateReq) SetDescriptionNil(b bool)`

 SetDescriptionNil sets the value for Description to be an explicit nil

### UnsetDescription
`func (o *VoiceprintCreateReq) UnsetDescription()`

UnsetDescription ensures that no value is present for Description, not even an explicit nil
### GetAudioData

`func (o *VoiceprintCreateReq) GetAudioData() string`

GetAudioData returns the AudioData field if non-nil, zero value otherwise.

### GetAudioDataOk

`func (o *VoiceprintCreateReq) GetAudioDataOk() (*string, bool)`

GetAudioDataOk returns a tuple with the AudioData field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAudioData

`func (o *VoiceprintCreateReq) SetAudioData(v string)`

SetAudioData sets AudioData field to given value.

### HasAudioData

`func (o *VoiceprintCreateReq) HasAudioData() bool`

HasAudioData returns a boolean if a field has been set.

### SetAudioDataNil

`func (o *VoiceprintCreateReq) SetAudioDataNil(b bool)`

 SetAudioDataNil sets the value for AudioData to be an explicit nil

### UnsetAudioData
`func (o *VoiceprintCreateReq) UnsetAudioData()`

UnsetAudioData ensures that no value is present for AudioData, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


