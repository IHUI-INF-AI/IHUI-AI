# BodyDoubaoImageEdit

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Model** | Pointer to **string** |  | [optional] [default to "doubao-seededit-3-0-i2i-250628"]
**ImageUrl** | Pointer to **NullableString** |  | [optional] 
**ImageBase64** | Pointer to **NullableString** |  | [optional] 
**Prompt** | **string** |  | 
**Seed** | Pointer to **int32** |  | [optional] [default to -1]
**GuidanceScale** | Pointer to **float32** |  | [optional] [default to 5.0]
**Watermark** | Pointer to **bool** |  | [optional] [default to false]

## Methods

### NewBodyDoubaoImageEdit

`func NewBodyDoubaoImageEdit(prompt string, ) *BodyDoubaoImageEdit`

NewBodyDoubaoImageEdit instantiates a new BodyDoubaoImageEdit object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewBodyDoubaoImageEditWithDefaults

`func NewBodyDoubaoImageEditWithDefaults() *BodyDoubaoImageEdit`

NewBodyDoubaoImageEditWithDefaults instantiates a new BodyDoubaoImageEdit object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetModel

`func (o *BodyDoubaoImageEdit) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *BodyDoubaoImageEdit) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *BodyDoubaoImageEdit) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *BodyDoubaoImageEdit) HasModel() bool`

HasModel returns a boolean if a field has been set.

### GetImageUrl

`func (o *BodyDoubaoImageEdit) GetImageUrl() string`

GetImageUrl returns the ImageUrl field if non-nil, zero value otherwise.

### GetImageUrlOk

`func (o *BodyDoubaoImageEdit) GetImageUrlOk() (*string, bool)`

GetImageUrlOk returns a tuple with the ImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageUrl

`func (o *BodyDoubaoImageEdit) SetImageUrl(v string)`

SetImageUrl sets ImageUrl field to given value.

### HasImageUrl

`func (o *BodyDoubaoImageEdit) HasImageUrl() bool`

HasImageUrl returns a boolean if a field has been set.

### SetImageUrlNil

`func (o *BodyDoubaoImageEdit) SetImageUrlNil(b bool)`

 SetImageUrlNil sets the value for ImageUrl to be an explicit nil

### UnsetImageUrl
`func (o *BodyDoubaoImageEdit) UnsetImageUrl()`

UnsetImageUrl ensures that no value is present for ImageUrl, not even an explicit nil
### GetImageBase64

`func (o *BodyDoubaoImageEdit) GetImageBase64() string`

GetImageBase64 returns the ImageBase64 field if non-nil, zero value otherwise.

### GetImageBase64Ok

`func (o *BodyDoubaoImageEdit) GetImageBase64Ok() (*string, bool)`

GetImageBase64Ok returns a tuple with the ImageBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageBase64

`func (o *BodyDoubaoImageEdit) SetImageBase64(v string)`

SetImageBase64 sets ImageBase64 field to given value.

### HasImageBase64

`func (o *BodyDoubaoImageEdit) HasImageBase64() bool`

HasImageBase64 returns a boolean if a field has been set.

### SetImageBase64Nil

`func (o *BodyDoubaoImageEdit) SetImageBase64Nil(b bool)`

 SetImageBase64Nil sets the value for ImageBase64 to be an explicit nil

### UnsetImageBase64
`func (o *BodyDoubaoImageEdit) UnsetImageBase64()`

UnsetImageBase64 ensures that no value is present for ImageBase64, not even an explicit nil
### GetPrompt

`func (o *BodyDoubaoImageEdit) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *BodyDoubaoImageEdit) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *BodyDoubaoImageEdit) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetSeed

`func (o *BodyDoubaoImageEdit) GetSeed() int32`

GetSeed returns the Seed field if non-nil, zero value otherwise.

### GetSeedOk

`func (o *BodyDoubaoImageEdit) GetSeedOk() (*int32, bool)`

GetSeedOk returns a tuple with the Seed field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSeed

`func (o *BodyDoubaoImageEdit) SetSeed(v int32)`

SetSeed sets Seed field to given value.

### HasSeed

`func (o *BodyDoubaoImageEdit) HasSeed() bool`

HasSeed returns a boolean if a field has been set.

### GetGuidanceScale

`func (o *BodyDoubaoImageEdit) GetGuidanceScale() float32`

GetGuidanceScale returns the GuidanceScale field if non-nil, zero value otherwise.

### GetGuidanceScaleOk

`func (o *BodyDoubaoImageEdit) GetGuidanceScaleOk() (*float32, bool)`

GetGuidanceScaleOk returns a tuple with the GuidanceScale field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGuidanceScale

`func (o *BodyDoubaoImageEdit) SetGuidanceScale(v float32)`

SetGuidanceScale sets GuidanceScale field to given value.

### HasGuidanceScale

`func (o *BodyDoubaoImageEdit) HasGuidanceScale() bool`

HasGuidanceScale returns a boolean if a field has been set.

### GetWatermark

`func (o *BodyDoubaoImageEdit) GetWatermark() bool`

GetWatermark returns the Watermark field if non-nil, zero value otherwise.

### GetWatermarkOk

`func (o *BodyDoubaoImageEdit) GetWatermarkOk() (*bool, bool)`

GetWatermarkOk returns a tuple with the Watermark field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWatermark

`func (o *BodyDoubaoImageEdit) SetWatermark(v bool)`

SetWatermark sets Watermark field to given value.

### HasWatermark

`func (o *BodyDoubaoImageEdit) HasWatermark() bool`

HasWatermark returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


