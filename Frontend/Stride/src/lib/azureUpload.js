import { BlockBlobClient } from '@azure/storage-blob'
import api from './axios'

const DEFAULT_BLOCK_SIZE = 4 * 1024 * 1024
const LARGE_FILE_BLOCK_SIZE = 8 * 1024 * 1024
const DEFAULT_CONCURRENCY = 4
const LARGE_FILE_CONCURRENCY = 6
const LARGE_FILE_THRESHOLD = 512 * 1024 * 1024
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1500
const UPLOAD_SESSION_STORAGE_KEY = 'stride.pendingDirectUpload'

const getUploadTuning = (fileSize) => {
  if (fileSize >= LARGE_FILE_THRESHOLD) {
    return {
      blockSize: LARGE_FILE_BLOCK_SIZE,
      concurrency: LARGE_FILE_CONCURRENCY,
    }
  }

  return {
    blockSize: DEFAULT_BLOCK_SIZE,
    concurrency: DEFAULT_CONCURRENCY,
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const normalizeUploadError = (error) => {
  const errorCode = error?.details?.errorCode || error?.code
  const rawMessage = error?.message || 'Upload failed'

  if (
    rawMessage.includes('Failed to fetch') ||
    errorCode === 'REQUEST_SEND_ERROR'
  ) {
    return new Error(
      'Azure upload was blocked before it reached storage. Add Blob CORS for http://localhost:5173 and your deployed frontend origin, then retry.'
    )
  }

  if (errorCode === 'AuthorizationPermissionMismatch') {
    return new Error(
      'Azure SAS permissions are not sufficient for this upload. Regenerate the upload URL and retry.'
    )
  }

  if (errorCode === 'AuthenticationFailed') {
    return new Error(
      'Azure SAS token expired or is invalid. Please retry the upload.'
    )
  }

  if (errorCode === 'BlobAlreadyExists') {
    return new Error(
      'This upload blob already exists in storage. Please retry to mint a fresh upload URL.'
    )
  }

  return error instanceof Error ? error : new Error(rawMessage)
}

const createBlobUrl = ({ sasUrl, blobName }) => {
  const accountName = import.meta.env.VITE_AZURE_STORAGE_ACCOUNT_NAME
  const containerName = import.meta.env.VITE_AZURE_STORAGE_CONTAINER_NAME

  if (accountName && containerName) {
    return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}`
  }

  return sasUrl.split('?')[0]
}

const persistUploadSession = (session) => {
  localStorage.setItem(UPLOAD_SESSION_STORAGE_KEY, JSON.stringify(session))
}

const clearUploadSession = () => {
  localStorage.removeItem(UPLOAD_SESSION_STORAGE_KEY)
}

const requestUploadUrl = async ({ filename, originalFileName, contentType, blobName }) => {
  const response = await api.post('/files/generate-upload-url', {
    filename,
    originalFileName,
    contentType,
    blobName,
  })

  return response.data
}

const uploadOnce = async ({ file, sasUrl, onProgress }) => {
  const tuning = getUploadTuning(file.size)
  const blockBlobClient = new BlockBlobClient(sasUrl)

  await blockBlobClient.uploadBrowserData(file, {
    blockSize: tuning.blockSize,
    concurrency: tuning.concurrency,
    maxSingleShotSize: tuning.blockSize,
    blobHTTPHeaders: {
      blobContentType: file.type || 'video/mp4',
    },
    metadata: {
      originalfilename: file.name,
      uploadedat: new Date().toISOString(),
    },
    onProgress: ({ loadedBytes }) => {
      if (typeof onProgress === 'function') {
        onProgress(Math.min(100, Math.round((loadedBytes / file.size) * 100)))
      }
    },
  })

  return tuning
}

const uploadToAzureWithRetry = async ({ file, filename, originalFileName, contentType, onProgress }) => {
  const pendingSession = getPendingDirectUpload()
  let activeBlobName = pendingSession?.filename === filename && pendingSession?.originalFileName === originalFileName
    ? pendingSession.blobName
    : null
  let lastError = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const uploadSession = await requestUploadUrl({
        filename,
        originalFileName,
        contentType,
        blobName: activeBlobName,
      })

      activeBlobName = uploadSession.blobName

      persistUploadSession({
        blobName: uploadSession.blobName,
        filename,
        originalFileName,
        contentType,
        size: file.size,
        savedAt: Date.now(),
      })

      const tuning = await uploadOnce({
        file,
        sasUrl: uploadSession.sasUrl,
        onProgress,
      })

      return {
        blobName: uploadSession.blobName,
        sasUrl: uploadSession.sasUrl,
        tuning,
      }
    } catch (error) {
      console.error('[Stride Upload] Azure upload attempt failed:', error)
      lastError = normalizeUploadError(error)

      if (attempt === MAX_RETRIES) {
        break
      }

      await sleep(RETRY_BASE_DELAY_MS * attempt)
    }
  }

  throw lastError
}

export const uploadVideoDirect = async ({ file, filename, sport, onProgress }) => {
  try {
    const contentType = file.type || 'video/mp4'
    const uploadResult = await uploadToAzureWithRetry({
      file,
      filename,
      originalFileName: file.name,
      contentType,
      onProgress,
    })

    const url = createBlobUrl({
      sasUrl: uploadResult.sasUrl,
      blobName: uploadResult.blobName,
    })

    const response = await api.post('/files/complete-upload', {
      filename,
      sport,
      blobName: uploadResult.blobName,
      url,
      size: file.size,
      contentType,
      originalFileName: file.name,
    })

    clearUploadSession()

    return {
      ...response.data.file,
      uploadTuning: uploadResult.tuning,
    }
  } catch (error) {
    console.error('[Stride Upload] Direct upload flow failed:', error)
    throw normalizeUploadError(error)
  }
}

export const getPendingDirectUpload = () => {
  const raw = localStorage.getItem(UPLOAD_SESSION_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    clearUploadSession()
    return null
  }
}

export const clearPendingDirectUpload = clearUploadSession
