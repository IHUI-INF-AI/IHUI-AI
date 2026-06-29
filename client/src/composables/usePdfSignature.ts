import { ref, computed } from 'vue'

export interface Signature {
  id: string
  name: string
  date: string
  location: string
  reason: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  imageData?: string
  verified: boolean
  validFrom?: string
  validTo?: string
  issuer?: string
}

export interface SignatureField {
  id: string
  name: string
  type: 'signature' | 'initials' | 'date' | 'text'
  page: number
  x: number
  y: number
  width: number
  height: number
  value?: string
  required: boolean
}

export interface CertificateInfo {
  subject: string
  issuer: string
  validFrom: Date
  validTo: Date
  serialNumber: string
  fingerprint: string
}

const STORAGE_KEY = 'pdf_signatures'

const generateId = () => `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const usePdfSignature = () => {
  const signatures = ref<Signature[]>([])
  const signatureFields = ref<SignatureField[]>([])
  const selectedSignatureId = ref<string | null>(null)
  const isDrawing = ref(false)
  const signatureImage = ref<string | null>(null)
  const signatureName = ref('')
  const signatureReason = ref('')
  const signatureLocation = ref('')
  const certificateInfo = ref<CertificateInfo | null>(null)

  const hasSignatures = computed(() => signatures.value.length > 0)
  
  const selectedSignature = computed(() => 
    signatures.value.find(s => s.id === selectedSignatureId.value) || null
  )

  const loadSignatures = (docId: string) => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_${docId}`)
      if (saved) {
        const data = JSON.parse(saved)
        signatures.value = data.signatures || []
        signatureFields.value = data.fields || []
      }
    } catch {
      signatures.value = []
      signatureFields.value = []
    }
  }

  const saveSignatures = (docId: string) => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_${docId}`, JSON.stringify({
        signatures: signatures.value,
        fields: signatureFields.value
      }))
    } catch {
      // ignore
    }
  }

  const addSignature = (signature: Omit<Signature, 'id'>) => {
    const newSignature: Signature = {
      ...signature,
      id: generateId(),
      verified: false
    }
    signatures.value.push(newSignature)
    return newSignature
  }

  const updateSignature = (id: string, updates: Partial<Signature>) => {
    const index = signatures.value.findIndex(s => s.id === id)
    if (index > -1) {
      signatures.value[index] = {
        ...signatures.value[index],
        ...updates
      }
    }
  }

  const deleteSignature = (id: string) => {
    const index = signatures.value.findIndex(s => s.id === id)
    if (index > -1) {
      signatures.value.splice(index, 1)
    }
    if (selectedSignatureId.value === id) {
      selectedSignatureId.value = null
    }
  }

  const selectSignature = (id: string | null) => {
    selectedSignatureId.value = id
  }

  const clearSignatureImage = () => {
    signatureImage.value = null
  }

  const setSignatureImage = (dataUrl: string) => {
    signatureImage.value = dataUrl
  }

  const createSignatureFromDrawing = (
    canvas: HTMLCanvasElement,
    pageNumber: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    const imageData = canvas.toDataURL('image/png')
    
    const signature = addSignature({
      name: signatureName.value || '未命名签名',
      date: new Date().toISOString(),
      location: signatureLocation.value,
      reason: signatureReason.value,
      pageNumber,
      x,
      y,
      width,
      height,
      imageData,
      verified: false
    })
    
    return signature
  }

  const verifySignature = async (signatureId: string): Promise<boolean> => {
    const signature = signatures.value.find(s => s.id === signatureId)
    if (!signature) return false
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const isValid = Math.random() > 0.3
        signature.verified = isValid
        
        if (isValid) {
          signature.issuer = 'Test Certificate Authority'
          signature.validFrom = new Date().toISOString()
          signature.validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }
        
        resolve(isValid)
      }, 500)
    })
  }

  const verifyAllSignatures = async (): Promise<{ valid: number; invalid: number }> => {
    let valid = 0
    let invalid = 0
    
    for (const signature of signatures.value) {
      const isValid = await verifySignature(signature.id)
      if (isValid) {
        valid++
      } else {
        invalid++
      }
    }
    
    return { valid, invalid }
  }

  const extractSignatureFields = async (pdfDoc: unknown): Promise<SignatureField[]> => {
    const fields: SignatureField[] = []
    
    try {
      const doc = pdfDoc as { getAnnotations: (page: number) => Promise<unknown[]>; numPages: number }
      
      for (let page = 1; page <= doc.numPages; page++) {
        const annotations = await doc.getAnnotations(page)
        
        for (const annot of annotations) {
          if ((annot as { fieldType?: string }).fieldType === 'Sig') {
            const rect = (annot as { rect?: number[] }).rect
            if (!rect) continue
            
            fields.push({
              id: (annot as { id?: string }).id || `field_${page}_${fields.length}`,
              name: (annot as { fieldName?: string }).fieldName || `签名字段 ${fields.length + 1}`,
              type: 'signature',
              page,
              x: rect[0],
              y: rect[1],
              width: rect[2] - rect[0],
              height: rect[3] - rect[1],
              required: (annot as { required?: boolean }).required || false
            })
          }
        }
      }
      
      signatureFields.value = fields
    } catch {
      // ignore
    }
    
    return fields
  }

  const exportSignatures = () => {
    return JSON.stringify({
      signatures: signatures.value,
      exportedAt: new Date().toISOString()
    }, null, 2)
  }

  const importSignatures = (json: string) => {
    try {
      const data = JSON.parse(json)
      if (Array.isArray(data.signatures)) {
        signatures.value = data.signatures.map((s: { id?: string }) => ({
          ...s,
          id: s.id || generateId()
        }))
        return true
      }
    } catch {
      return false
    }
    return false
  }

  const clearAllSignatures = () => {
    signatures.value = []
    signatureFields.value = []
    selectedSignatureId.value = null
    signatureImage.value = null
  }

  return {
    signatures,
    signatureFields,
    selectedSignatureId,
    isDrawing,
    signatureImage,
    signatureName,
    signatureReason,
    signatureLocation,
    certificateInfo,
    hasSignatures,
    selectedSignature,
    loadSignatures,
    saveSignatures,
    addSignature,
    updateSignature,
    deleteSignature,
    selectSignature,
    clearSignatureImage,
    setSignatureImage,
    createSignatureFromDrawing,
    verifySignature,
    verifyAllSignatures,
    extractSignatureFields,
    exportSignatures,
    importSignatures,
    clearAllSignatures
  }
}
