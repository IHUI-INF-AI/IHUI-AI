# BodyTongyiImageEdit

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Model** | Pointer to **string** |  | [optional] [default to "qwen-image-edit"]
**ImageUrl** | Pointer to **NullableString** |  | [optional] 
**ImageBase64** | Pointer to **NullableString** |  | [optional] 
**Prompt** | **string** |  | 
**NegativePrompt** | Pointer to **NullableString** |  | [optional] 
**N** | Pointer to **int32** |  | [optional] [default to 1]

## Methods

### NewBodyTongyiImageEdit

`func NewBodyTongyiImageEdit(prompt string, ) *BodyTongyiImageEdit`

NewBodyTongyiImageEdit instantiates a new BodyTongyiImageEdit object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyTongyiImageEditWithDefaults

`func NewBodyTongyiImageEditWithDefaults() *BodyTongyiImageEdit`

NewBodyTongyiImageEditWithDefaults instantiates a new BodyTongyiImageEdit object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModel

`func (o *BodyTongyiImageEdit) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyTongyiImageEdit) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyTongyiImageEdit) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyTongyiImageEdit) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetImageUrl

`func (o *BodyTongyiImageEdit) GetImageUrl() string`

GetImageUrl returns the ImageUrl field if non-nil, zero value otherwise.

### GetImageUrlOk

`func (o *BodyTongyiImageEdit) GetImageUrlOk() (*string, bool)`

GetImageUrlOk returns a tuple with the ImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageUrl

`func (o *BodyTongyiImageEdit) SetImageUrl(v string)`

SetImageUrl sets ImageUrl field to given value.

### HasImageUrl

`func (o *BodyTongyiImageEdit) HasImageUrl() bool`

HasImageUrl returns a boolean if a field has been set.

### SetImageUrlNil

`func (o *BodyTongyiImageEdit) SetImageUrlNil(b bool)`

 SetImageUrlNil sets the value for ImageUrl to be an explicit nil

### UnsetImageUrl
`func (o *BodyTongyiImageEdit) UnsetImageUrl()`

UnsetImageUrl ensures that no value is present for ImageUrl, not even an explicit nil
### GetImageBase64

`func (o *BodyTongyiImageEdit) GetImageBase64() string`

GetImageBase64 returns the ImageBase64 field if non-nil, zero value otherwise.

### GetImageBase64Ok

`func (o *BodyTongyiImageEdit) GetImageBase64Ok() (*string, bool)`

GetImageBase64Ok returns a tuple with the ImageBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageBase64

`func (o *BodyTongyiImageEdit) SetImageBase64(v string)`

SetImageBase64 sets ImageBase64 field to given value.

### HasImageBase64

`func (o *BodyTongyiImageEdit) HasImageBase64() bool`

HasImageBase64 returns a boolean if a field has been set.

### SetImageBase64Nil

`func (o *BodyTongyiImageEdit) SetImageBase64Nil(b bool)`

 SetImageBase64Nil sets the value for ImageBase64 to be an explicit nil

### UnsetImageBase64
`func (o *BodyTongyiImageEdit) UnsetImageBase64()`

UnsetImageBase64 ensures that no value is present for ImageBase64, not even an explicit nil
### GetPrompt

`func (o *BodyTongyiImageEdit) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *BodyTongyiImageEdit) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *BodyTongyiImageEdit) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetNegativePrompt

`func (o *BodyTongyiImageEdit) GetNegativePrompt() string`

GetNegativePrompt returns the NegativePrompt field if non-nil, zero value otherwise.

### GetNegativePromptOk

`func (o *BodyTongyiImageEdit) GetNegativePromptOk() (*string, bool)`

GetNegativePromptOk returns a tuple with the NegativePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetNegativePrompt

`func (o *BodyTongyiImageEdit) SetNegativePrompt(v string)`

SetNegativePrompt sets NegativePrompt field to given value.

### HasNegativePrompt

`func (o *BodyTongyiImageEdit) HasNegativePrompt() bool`

HasNegativePrompt returns a boolean if a field has been set.

### SetNegativePromptNil

`func (o *BodyTongyiImageEdit) SetNegativePromptNil(b bool)`

 SetNegativePromptNil sets the value for NegativePrompt to be an explicit nil

### UnsetNegativePrompt
`func (o *BodyTongyiImageEdit) UnsetNegativePrompt()`

UnsetNegativePrompt ensures that no value is present for NegativePrompt, not even an explicit nil
### GetN

`func (o *BodyTongyiImageEdit) GetN() int32`

GetN returns the N field if non-nil, zero value otherwise.

### GetNOk

`func (o *BodyTongyiImageEdit) GetNOk() (*int32, bool)`

GetNOk returns a tuple with the N field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetN

`func (o *BodyTongyiImageEdit) SetN(v int32)`

SetN sets N field to given value.

### HasN

`func (o *BodyTongyiImageEdit) HasN() bool`

HasN returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


