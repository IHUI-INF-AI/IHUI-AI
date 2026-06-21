
# SmsVerifyRequest


## Properties

Name | Type
------------ | -------------
`phone` | string
`tempId` | number
`tempCode` | string

## Example

```typescript
import type { SmsVerifyRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "phone": null,
  "tempId": null,
  "tempCode": null,
} satisfies SmsVerifyRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SmsVerifyRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


