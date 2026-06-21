# Jimeng4ImageRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Prompt** | **string** | Generation prompt | 
**ImageUrls** | Pointer to **[]string** | Reference images (0-10) | [optional] 
**Size** | Pointer to **NullableInt32** | Total pixel area [1024*1024, 4096*4096] | [optional] 
**Width** | Pointer to **NullableInt32** | Image width (use with height) | [optional] 
**Height** | Pointer to **NullableInt32** | Image height (use with width) | [optional] 
**Seed** | Pointer to **NullableInt32** | Random seed, default -1 | [optional] 
**Scale** | Pointer to **NullableFloat32** | Text influence [0,1], default 0.5 | [optional] 
**ForceSingle** | Pointer to **NullableBool** | Force single image | [optional] 
**MinRatio** | Pointer to **NullableFloat32** | Min width/height ratio | [optional] 
**MaxRatio** | Pointer to **NullableFloat32** | Max width/height ratio | [optional] 
**ReturnUrl** | Pointer to **NullableBool** | Return image URLs (24h validity) | [optional] 

## Methods

### NewJimeng4ImageRequest

`func NewJimeng4ImageRequest(prompt string, ) *Jimeng4ImageRequest`

NewJimeng4ImageRequest instantiates a new Jimeng4ImageRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewJimeng4ImageRequestWithDefaults

`func NewJimeng4ImageRequestWithDefaults() *Jimeng4ImageRequest`

NewJimeng4ImageRequestWithDefaults instantiates a new Jimeng4ImageRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPrompt

`func (o *Jimeng4ImageRequest) GetPrompt() string`

GetPrompt returns the Prompt field if non-nil, zero value otherwise.

### GetPromptOk

`func (o *Jimeng4ImageRequest) GetPromptOk() (*string, bool)`

GetPromptOk returns a tuple with the Prompt field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPrompt

`func (o *Jimeng4ImageRequest) SetPrompt(v string)`

SetPrompt sets Prompt field to given value.


### GetImageUrls

`func (o *Jimeng4ImageRequest) GetImageUrls() []string`

GetImageUrls returns the ImageUrls field if non-nil, zero value otherwise.

### GetImageUrlsOk

`func (o *Jimeng4ImageRequest) GetImageUrlsOk() (*[]string, bool)`

GetImageUrlsOk returns a tuple with the ImageUrls field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetImageUrls

`func (o *Jimeng4ImageRequest) SetImageUrls(v []string)`

SetImageUrls sets ImageUrls field to given value.

### HasImageUrls

`func (o *Jimeng4ImageRequest) HasImageUrls() bool`

HasImageUrls returns a boolean if a field has been set.

### SetImageUrlsNil

`func (o *Jimeng4ImageRequest) SetImageUrlsNil(b bool)`

 SetImageUrlsNil sets the value for ImageUrls to be an explicit nil

### UnsetImageUrls
`func (o *Jimeng4ImageRequest) UnsetImageUrls()`

UnsetImageUrls ensures that no value is present for ImageUrls, not even an explicit nil
### GetSize

`func (o *Jimeng4ImageRequest) GetSize() int32`

GetSize returns the Size field if non-nil, zero value otherwise.

### GetSizeOk

`func (o *Jimeng4ImageRequest) GetSizeOk() (*int32, bool)`

GetSizeOk returns a tuple with the Size field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSize

`func (o *Jimeng4ImageRequest) SetSize(v int32)`

SetSize sets Size field to given value.

### HasSize

`func (o *Jimeng4ImageRequest) HasSize() bool`

HasSize returns a boolean if a field has been set.

### SetSizeNil

`func (o *Jimeng4ImageRequest) SetSizeNil(b bool)`

 SetSizeNil sets the value for Size to be an explicit nil

### UnsetSize
`func (o *Jimeng4ImageRequest) UnsetSize()`

UnsetSize ensures that no value is present for Size, not even an explicit nil
### GetWidth

`func (o *Jimeng4ImageRequest) GetWidth() int32`

GetWidth returns the Width field if non-nil, zero value otherwise.

### GetWidthOk

`func (o *Jimeng4ImageRequest) GetWidthOk() (*int32, bool)`

GetWidthOk returns a tuple with the Width field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetWidth

`func (o *Jimeng4ImageRequest) SetWidth(v int32)`

SetWidth sets Width field to given value.

### HasWidth

`func (o *Jimeng4ImageRequest) HasWidth() bool`

HasWidth returns a boolean if a field has been set.

### SetWidthNil

`func (o *Jimeng4ImageRequest) SetWidthNil(b bool)`

 SetWidthNil sets the value for Width to be an explicit nil

### UnsetWidth
`func (o *Jimeng4ImageRequest) UnsetWidth()`

UnsetWidth ensures that no value is present for Width, not even an explicit nil
### GetHeight

`func (o *Jimeng4ImageRequest) GetHeight() int32`

GetHeight returns the Height field if non-nil, zero value otherwise.

### GetHeightOk

`func (o *Jimeng4ImageRequest) GetHeightOk() (*int32, bool)`

GetHeightOk returns a tuple with the Height field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetHeight

`func (o *Jimeng4ImageRequest) SetHeight(v int32)`

SetHeight sets Height field to given value.

### HasHeight

`func (o *Jimeng4ImageRequest) HasHeight() bool`

HasHeight returns a boolean if a field has been set.

### SetHeightNil

`func (o *Jimeng4ImageRequest) SetHeightNil(b bool)`

 SetHeightNil sets the value for Height to be an explicit nil

### UnsetHeight
`func (o *Jimeng4ImageRequest) UnsetHeight()`

UnsetHeight ensures that no value is present for Height, not even an explicit nil
### GetSeed

`func (o *Jimeng4ImageRequest) GetSeed() int32`

GetSeed returns the Seed field if non-nil, zero value otherwise.

### GetSeedOk

`func (o *Jimeng4ImageRequest) GetSeedOk() (*int32, bool)`

GetSeedOk returns a tuple with the Seed field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSeed

`func (o *Jimeng4ImageRequest) SetSeed(v int32)`

SetSeed sets Seed field to given value.

### HasSeed

`func (o *Jimeng4ImageRequest) HasSeed() bool`

HasSeed returns a boolean if a field has been set.

### SetSeedNil

`func (o *Jimeng4ImageRequest) SetSeedNil(b bool)`

 SetSeedNil sets the value for Seed to be an explicit nil

### UnsetSeed
`func (o *Jimeng4ImageRequest) UnsetSeed()`

UnsetSeed ensures that no value is present for Seed, not even an explicit nil
### GetScale

`func (o *Jimeng4ImageRequest) GetScale() float32`

GetScale returns the Scale field if non-nil, zero value otherwise.

### GetScaleOk

`func (o *Jimeng4ImageRequest) GetScaleOk() (*float32, bool)`

GetScaleOk returns a tuple with the Scale field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetScale

`func (o *Jimeng4ImageRequest) SetScale(v float32)`

SetScale sets Scale field to given value.

### HasScale

`func (o *Jimeng4ImageRequest) HasScale() bool`

HasScale returns a boolean if a field has been set.

### SetScaleNil

`func (o *Jimeng4ImageRequest) SetScaleNil(b bool)`

 SetScaleNil sets the value for Scale to be an explicit nil

### UnsetScale
`func (o *Jimeng4ImageRequest) UnsetScale()`

UnsetScale ensures that no value is present for Scale, not even an explicit nil
### GetForceSingle

`func (o *Jimeng4ImageRequest) GetForceSingle() bool`

GetForceSingle returns the ForceSingle field if non-nil, zero value otherwise.

### GetForceSingleOk

`func (o *Jimeng4ImageRequest) GetForceSingleOk() (*bool, bool)`

GetForceSingleOk returns a tuple with the ForceSingle field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetForceSingle

`func (o *Jimeng4ImageRequest) SetForceSingle(v bool)`

SetForceSingle sets ForceSingle field to given value.

### HasForceSingle

`func (o *Jimeng4ImageRequest) HasForceSingle() bool`

HasForceSingle returns a boolean if a field has been set.

### SetForceSingleNil

`func (o *Jimeng4ImageRequest) SetForceSingleNil(b bool)`

 SetForceSingleNil sets the value for ForceSingle to be an explicit nil

### UnsetForceSingle
`func (o *Jimeng4ImageRequest) UnsetForceSingle()`

UnsetForceSingle ensures that no value is present for ForceSingle, not even an explicit nil
### GetMinRatio

`func (o *Jimeng4ImageRequest) GetMinRatio() float32`

GetMinRatio returns the MinRatio field if non-nil, zero value otherwise.

### GetMinRatioOk

`func (o *Jimeng4ImageRequest) GetMinRatioOk() (*float32, bool)`

GetMinRatioOk returns a tuple with the MinRatio field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMinRatio

`func (o *Jimeng4ImageRequest) SetMinRatio(v float32)`

SetMinRatio sets MinRatio field to given value.

### HasMinRatio

`func (o *Jimeng4ImageRequest) HasMinRatio() bool`

HasMinRatio returns a boolean if a field has been set.

### SetMinRatioNil

`func (o *Jimeng4ImageRequest) SetMinRatioNil(b bool)`

 SetMinRatioNil sets the value for MinRatio to be an explicit nil

### UnsetMinRatio
`func (o *Jimeng4ImageRequest) UnsetMinRatio()`

UnsetMinRatio ensures that no value is present for MinRatio, not even an explicit nil
### GetMaxRatio

`func (o *Jimeng4ImageRequest) GetMaxRatio() float32`

GetMaxRatio returns the MaxRatio field if non-nil, zero value otherwise.

### GetMaxRatioOk

`func (o *Jimeng4ImageRequest) GetMaxRatioOk() (*float32, bool)`

GetMaxRatioOk returns a tuple with the MaxRatio field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetMaxRatio

`func (o *Jimeng4ImageRequest) SetMaxRatio(v float32)`

SetMaxRatio sets MaxRatio field to given value.

### HasMaxRatio

`func (o *Jimeng4ImageRequest) HasMaxRatio() bool`

HasMaxRatio returns a boolean if a field has been set.

### SetMaxRatioNil

`func (o *Jimeng4ImageRequest) SetMaxRatioNil(b bool)`

 SetMaxRatioNil sets the value for MaxRatio to be an explicit nil

### UnsetMaxRatio
`func (o *Jimeng4ImageRequest) UnsetMaxRatio()`

UnsetMaxRatio ensures that no value is present for MaxRatio, not even an explicit nil
### GetReturnUrl

`func (o *Jimeng4ImageRequest) GetReturnUrl() bool`

GetReturnUrl returns the ReturnUrl field if non-nil, zero value otherwise.

### GetReturnUrlOk

`func (o *Jimeng4ImageRequest) GetReturnUrlOk() (*bool, bool)`

GetReturnUrlOk returns a tuple with the ReturnUrl field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetReturnUrl

`func (o *Jimeng4ImageRequest) SetReturnUrl(v bool)`

SetReturnUrl sets ReturnUrl field to given value.

### HasReturnUrl

`func (o *Jimeng4ImageRequest) HasReturnUrl() bool`

HasReturnUrl returns a boolean if a field has been set.

### SetReturnUrlNil

`func (o *Jimeng4ImageRequest) SetReturnUrlNil(b bool)`

 SetReturnUrlNil sets the value for ReturnUrl to be an explicit nil

### UnsetReturnUrl
`func (o *Jimeng4ImageRequest) UnsetReturnUrl()`

UnsetReturnUrl ensures that no value is present for ReturnUrl, not even an explicit nil

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


