# SubmitHunyuan3DRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | Pointer to **NullableString** | 文生3D描述，最多1024字符 | [optional] 
**ImageBase64** | Pointer to **NullableString** | 输入图Base64 (&lt;&#x3D;8MB) | [optional] 
**ImageUrl** | Pointer to **NullableString** | 输入图URL (&lt;&#x3D;8MB) | [optional] 
**MultiViewImages** | Pointer to [**[]ViewImage**](ViewImage.md) |  | [optional] 
**ResultFormat** | Pointer to **NullableString** | OBJ/GLB/STL/USDZ/FBX/MP4 | [optional] 
**EnablePBR** | Pointer to **NullableBool** |  | [optional] 

## Methods

### NewSubmitHunyuan3DRequest

`func NewSubmitHunyuan3DRequest() *SubmitHunyuan3DRequest`

NewSubmitHunyuan3DRequest instantiates a new SubmitHunyuan3DRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewSubmitHunyuan3DRequestWithDefaults

`func NewSubmitHunyuan3DRequestWithDefaults() *SubmitHunyuan3DRequest`

NewSubmitHunyuan3DRequestWithDefaults instantiates a new SubmitHunyuan3DRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *SubmitHunyuan3DRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *SubmitHunyuan3DRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *SubmitHunyuan3DRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.

### HasPrompt

`func (o *SubmitHunyuan3DRequest) HasPrompt() bool`

HasPrompt returns a boolean if a field has been set.

### SetPromptNil

`func (o *SubmitHunyuan3DRequest) SetPromptNil(b bool)`

 SetPromptNil sets the value for Prompt to be an explicit nil

### UnsetPrompt
`func (o *SubmitHunyuan3DRequest) UnsetPrompt()`

UnsetPrompt ensures that no value is present for Prompt, not even an explicit nil
### GetImageBase64

`func (o *SubmitHunyuan3DRequest) GetImageBase64() string`

GetImageBase64 returns the ImageBase64 field if non-nil, zero value otherwise.

### GetImageBase64Ok

`func (o *SubmitHunyuan3DRequest) GetImageBase64Ok() (*string, bool)`

GetImageBase64Ok returns a tuple with the ImageBase64 field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageBase64

`func (o *SubmitHunyuan3DRequest) SetImageBase64(v string)`

SetImageBase64 sets ImageBase64 field to given value.

### HasImageBase64

`func (o *SubmitHunyuan3DRequest) HasImageBase64() bool`

HasImageBase64 returns a boolean if a field has been set.

### SetImageBase64Nil

`func (o *SubmitHunyuan3DRequest) SetImageBase64Nil(b bool)`

 SetImageBase64Nil sets the value for ImageBase64 to be an explicit nil

### UnsetImageBase64
`func (o *SubmitHunyuan3DRequest) UnsetImageBase64()`

UnsetImageBase64 ensures that no value is present for ImageBase64, not even an explicit nil
### GetImageUrl

`func (o *SubmitHunyuan3DRequest) GetImageUrl() string`

GetImageUrl returns the ImageUrl field if non-nil, zero value otherwise.

### GetImageUrlOk

`func (o *SubmitHunyuan3DRequest) GetImageUrlOk() (*string, bool)`

GetImageUrlOk returns a tuple with the ImageUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageUrl

`func (o *SubmitHunyuan3DRequest) SetImageUrl(v string)`

SetImageUrl sets ImageUrl field to given value.

### HasImageUrl

`func (o *SubmitHunyuan3DRequest) HasImageUrl() bool`

HasImageUrl returns a boolean if a field has been set.

### SetImageUrlNil

`func (o *SubmitHunyuan3DRequest) SetImageUrlNil(b bool)`

 SetImageUrlNil sets the value for ImageUrl to be an explicit nil

### UnsetImageUrl
`func (o *SubmitHunyuan3DRequest) UnsetImageUrl()`

UnsetImageUrl ensures that no value is present for ImageUrl, not even an explicit nil
### GetMultiViewImages

`func (o *SubmitHunyuan3DRequest) GetMultiViewImages() []ViewImage`

GetMultiViewImages returns the MultiViewImages field if non-nil, zero value otherwise.

### GetMultiViewImagesOk

`func (o *SubmitHunyuan3DRequest) GetMultiViewImagesOk() (*[]ViewImage, bool)`

GetMultiViewImagesOk returns a tuple with the MultiViewImages field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMultiViewImages

`func (o *SubmitHunyuan3DRequest) SetMultiViewImages(v []ViewImage)`

SetMultiViewImages sets MultiViewImages field to given value.

### HasMultiViewImages

`func (o *SubmitHunyuan3DRequest) HasMultiViewImages() bool`

HasMultiViewImages returns a boolean if a field has been set.

### SetMultiViewImagesNil

`func (o *SubmitHunyuan3DRequest) SetMultiViewImagesNil(b bool)`

 SetMultiViewImagesNil sets the value for MultiViewImages to be an explicit nil

### UnsetMultiViewImages
`func (o *SubmitHunyuan3DRequest) UnsetMultiViewImages()`

UnsetMultiViewImages ensures that no value is present for MultiViewImages, not even an explicit nil
### GetResultFormat

`func (o *SubmitHunyuan3DRequest) GetResultFormat() string`

GetResultFormat returns the ResultFormat field if non-nil, zero value otherwise.

### GetResultFormatOk

`func (o *SubmitHunyuan3DRequest) GetResultFormatOk() (*string, bool)`

GetResultFormatOk returns a tuple with the ResultFormat field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetResultFormat

`func (o *SubmitHunyuan3DRequest) SetResultFormat(v string)`

SetResultFormat sets ResultFormat field to given value.

### HasResultFormat

`func (o *SubmitHunyuan3DRequest) HasResultFormat() bool`

HasResultFormat returns a boolean if a field has been set.

### SetResultFormatNil

`func (o *SubmitHunyuan3DRequest) SetResultFormatNil(b bool)`

 SetResultFormatNil sets the value for ResultFormat to be an explicit nil

### UnsetResultFormat
`func (o *SubmitHunyuan3DRequest) UnsetResultFormat()`

UnsetResultFormat ensures that no value is present for ResultFormat, not even an explicit nil
### GetEnablePBR

`func (o *SubmitHunyuan3DRequest) GetEnablePBR() bool`

GetEnablePBR returns the EnablePBR field if non-nil, zero value otherwise.

### GetEnablePBROk

`func (o *SubmitHunyuan3DRequest) GetEnablePBROk() (*bool, bool)`

GetEnablePBROk returns a tuple with the EnablePBR field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetEnablePBR

`func (o *SubmitHunyuan3DRequest) SetEnablePBR(v bool)`

SetEnablePBR sets EnablePBR field to given value.

### HasEnablePBR

`func (o *SubmitHunyuan3DRequest) HasEnablePBR() bool`

HasEnablePBR returns a boolean if a field has been set.

### SetEnablePBRNil

`func (o *SubmitHunyuan3DRequest) SetEnablePBRNil(b bool)`

 SetEnablePBRNil sets the value for EnablePBR to be an explicit nil

### UnsetEnablePBR
`func (o *SubmitHunyuan3DRequest) UnsetEnablePBR()`

UnsetEnablePBR ensures that no value is present for EnablePBR, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


