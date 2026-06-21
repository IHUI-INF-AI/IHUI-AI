# GenerateVideoRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | 视频描述提示 | 
**Images** | Pointer to **[]string** | 参考图片URL列表 (图生视频) | [optional] 
**Model** | Pointer to **NullableString** | 模型名称 | [optional] 
**AspectRatio** | Pointer to **NullableString** | 宽高比 | [optional] 
**EnhancePrompt** | Pointer to **NullableBool** | 是否增强提示词 | [optional] 
**EnableUpsample** | Pointer to **NullableBool** | 是否启用上采样 | [optional] 

## Methods

### NewGenerateVideoRequest

`func NewGenerateVideoRequest(prompt string, ) *GenerateVideoRequest`

NewGenerateVideoRequest instantiates a new GenerateVideoRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewGenerateVideoRequestWithDefaults

`func NewGenerateVideoRequestWithDefaults() *GenerateVideoRequest`

NewGenerateVideoRequestWithDefaults instantiates a new GenerateVideoRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *GenerateVideoRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *GenerateVideoRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *GenerateVideoRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetImages

`func (o *GenerateVideoRequest) GetImages() []string`

GetImages returns the Images field if non-nil, zero value otherwise.

### GetImagesOk

`func (o *GenerateVideoRequest) GetImagesOk() (*[]string, bool)`

GetImagesOk returns a tuple with the Images field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImages

`func (o *GenerateVideoRequest) SetImages(v []string)`

SetImages sets Images field to given value.

### HasImages

`func (o *GenerateVideoRequest) HasImages() bool`

HasImages returns a boolean if a field has been set.

### SetImagesNil

`func (o *GenerateVideoRequest) SetImagesNil(b bool)`

 SetImagesNil sets the value for Images to be an explicit nil

### UnsetImages
`func (o *GenerateVideoRequest) UnsetImages()`

UnsetImages ensures that no value is present for Images, not even an explicit nil
### GetModel

`func (o *GenerateVideoRequest) GetModel() string`

GetModel returns the Model field if non-nil, zero value otherwise.

### GetModelOk

`func (o *GenerateVideoRequest) GetModelOk() (*string, bool)`

GetModelOk returns a tuple with the Model field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetModel

`func (o *GenerateVideoRequest) SetModel(v string)`

SetModel sets Model field to given value.

### HasModel

`func (o *GenerateVideoRequest) HasModel() bool`

HasModel returns a boolean if a field has been set.

### SetModelNil

`func (o *GenerateVideoRequest) SetModelNil(b bool)`

 SetModelNil sets the value for Model to be an explicit nil

### UnsetModel
`func (o *GenerateVideoRequest) UnsetModel()`

UnsetModel ensures that no value is present for Model, not even an explicit nil
### GetAspectRatio

`func (o *GenerateVideoRequest) GetAspectRatio() string`

GetAspectRatio returns the AspectRatio field if non-nil, zero value otherwise.

### GetAspectRatioOk

`func (o *GenerateVideoRequest) GetAspectRatioOk() (*string, bool)`

GetAspectRatioOk returns a tuple with the AspectRatio field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAspectRatio

`func (o *GenerateVideoRequest) SetAspectRatio(v string)`

SetAspectRatio sets AspectRatio field to given value.

### HasAspectRatio

`func (o *GenerateVideoRequest) HasAspectRatio() bool`

HasAspectRatio returns a boolean if a field has been set.

### SetAspectRatioNil

`func (o *GenerateVideoRequest) SetAspectRatioNil(b bool)`

 SetAspectRatioNil sets the value for AspectRatio to be an explicit nil

### UnsetAspectRatio
`func (o *GenerateVideoRequest) UnsetAspectRatio()`

UnsetAspectRatio ensures that no value is present for AspectRatio, not even an explicit nil
### GetEnhancePrompt

`func (o *GenerateVideoRequest) GetEnhancePrompt() bool`

GetEnhancePrompt returns the EnhancePrompt field if non-nil, zero value otherwise.

### GetEnhancePromptOk

`func (o *GenerateVideoRequest) GetEnhancePromptOk() (*bool, bool)`

GetEnhancePromptOk returns a tuple with the EnhancePrompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnhancePrompt

`func (o *GenerateVideoRequest) SetEnhancePrompt(v bool)`

SetEnhancePrompt sets EnhancePrompt field to given value.

### HasEnhancePrompt

`func (o *GenerateVideoRequest) HasEnhancePrompt() bool`

HasEnhancePrompt returns a boolean if a field has been set.

### SetEnhancePromptNil

`func (o *GenerateVideoRequest) SetEnhancePromptNil(b bool)`

 SetEnhancePromptNil sets the value for EnhancePrompt to be an explicit nil

### UnsetEnhancePrompt
`func (o *GenerateVideoRequest) UnsetEnhancePrompt()`

UnsetEnhancePrompt ensures that no value is present for EnhancePrompt, not even an explicit nil
### GetEnableUpsample

`func (o *GenerateVideoRequest) GetEnableUpsample() bool`

GetEnableUpsample returns the EnableUpsample field if non-nil, zero value otherwise.

### GetEnableUpsampleOk

`func (o *GenerateVideoRequest) GetEnableUpsampleOk() (*bool, bool)`

GetEnableUpsampleOk returns a tuple with the EnableUpsample field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnableUpsample

`func (o *GenerateVideoRequest) SetEnableUpsample(v bool)`

SetEnableUpsample sets EnableUpsample field to given value.

### HasEnableUpsample

`func (o *GenerateVideoRequest) HasEnableUpsample() bool`

HasEnableUpsample returns a boolean if a field has been set.

### SetEnableUpsampleNil

`func (o *GenerateVideoRequest) SetEnableUpsampleNil(b bool)`

 SetEnableUpsampleNil sets the value for EnableUpsample to be an explicit nil

### UnsetEnableUpsample
`func (o *GenerateVideoRequest) UnsetEnableUpsample()`

UnsetEnableUpsample ensures that no value is present for EnableUpsample, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


