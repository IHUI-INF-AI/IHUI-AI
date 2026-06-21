
# FileUploadBody


## Properties

Name | Type
------------ | -------------
`fileName` | string
`filePath` | string
`fileSize` | number
`fileType` | string
`bucket` | string

## Example

```typescript
import type { FileUploadBody } from ''

// TODO: Update the object below with actual values
const example = {
  "fileName": null,
  "filePath": null,
  "fileSize": null,
  "fileType": null,
  "bucket": null,
} satisfies FileUploadBody

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as FileUploadBody
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


