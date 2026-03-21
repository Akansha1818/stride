import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/axios'
import IosLoader from '../components/IosLoader'
import { getPendingDirectUpload, uploadVideoDirect } from '../lib/azureUpload'

const UploadFile = () => {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [filename, setFilename] = useState('')
  const [sport, setSport] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const previewRef = useRef(null)

  useEffect(() => {
    const pendingUpload = getPendingDirectUpload()

    if (pendingUpload) {
      setFilename((current) => current || pendingUpload.filename || '')
      setSport((current) => current || pendingUpload.sport || '')
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current)
      }
    }
  }, [])

  const handleClick = () => {
    if (!loading) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]

    if (!selectedFile) {
      return
    }

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile)
    previewRef.current = nextPreviewUrl

    setFile(selectedFile)
    setPreview(nextPreviewUrl)
    setError('')
  }

  const resetForm = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }

    setFile(null)
    setPreview(null)
    setFilename('')
    setSport('')
    setProgress(0)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    setError('')

    if (!file) {
      setError('Please select a video')
      return
    }

    if (!filename.trim()) {
      setError('Please enter filename')
      return
    }

    if (!sport.trim()) {
      setError('Please enter sport')
      return
    }

    try {
      setLoading(true)
      setProgress(0)

      const savedFile = await uploadVideoDirect({
        file,
        filename: filename.trim(),
        sport: sport.trim(),
        onProgress: setProgress,
      })

      const analysisRes = await api.post('/analysis/analyze', { videoId: savedFile._id })
      const analysisId = analysisRes.data.analysis._id

      resetForm()
      navigate(`/feedback/${analysisId}`)
    } catch (err) {
      setError(err?.customMessage || err?.message || 'Upload failed. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = Boolean(file && filename.trim() && sport.trim())

  return (
    <div className='flex h-full w-full items-center justify-center'>
      {loading && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-[1px]'>
          <IosLoader />
        </div>
      )}

      <div className='flex flex-col'>
        <img
          className='ml-2 mb-8 h-10 w-31'
          src='https://ik.imagekit.io/g2fqofeyv/logo_with_name.png'
          alt='logo'
        />

        <form
          onSubmit={handleUpload}
          className='flex w-90 flex-col gap-3 rounded-xl bg-white py-3 font-medium'
        >
          <p className='ml-6 text-2xl text-black'>Name your file</p>

          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className='ml-5 mr-4 rounded-xl bg-[#E9E9E9] px-3 py-2 text-sm text-[#6F7177] focus:outline-none'
            type='text'
            placeholder='Enter file name..'
          />

          <input
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className='ml-5 mr-4 rounded-xl bg-[#E9E9E9] px-3 py-2 text-sm text-[#6F7177] focus:outline-none'
            type='text'
            placeholder='Type in your sport..'
          />

          <div
            onClick={handleClick}
            className={`relative ml-5 mr-4 overflow-hidden rounded-xl ${
              loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            {preview ? (
              <video
                src={preview}
                className='h-46.75 w-full object-cover'
                controls
              />
            ) : (
              <img
                className='h-46.75 w-full object-cover'
                src='/src/assets/videoImage.png'
                alt='video placeholder'
              />
            )}

            {!preview && (
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='flex flex-col items-center'>
                  <img
                    className='h-12.75 w-9'
                    src='/src/assets/upload.png'
                    alt='upload'
                  />
                  <p className='text-xs text-white'>Upload Video</p>
                </div>
              </div>
            )}

            <input
              type='file'
              accept='video/*'
              ref={fileInputRef}
              onChange={handleFileChange}
              className='hidden'
            />
          </div>

          {loading && (
            <div className='ml-5 mr-4'>
              <div className='h-2 w-full rounded-full bg-gray-200'>
                <div
                  className='h-2 rounded-full bg-black transition-all'
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className='mt-1 text-xs text-gray-500'>
                {progress}% uploading directly to secure storage...
              </p>
            </div>
          )}

          {error && <p className='ml-5 text-xs text-red-500'>{error}</p>}

          <button
            disabled={loading || !isFormValid}
            type='submit'
            className={`ml-5 mr-4 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm transition-all duration-200 ${
              isFormValid
                ? 'bg-[#E5E5E5] text-[#4A4B50] hover:bg-[#DCDCDC] active:scale-[0.98]'
                : 'bg-[#F8F8F8] text-[#9B9CA1]'
            } ${loading ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {loading ? 'Uploading...' : 'Confirm'}
            <img className='w-3 h-3'src='src\assets\􀁣.png'></img>
          </button>
        </form>
      </div>
    </div>
  )
}

export default UploadFile
