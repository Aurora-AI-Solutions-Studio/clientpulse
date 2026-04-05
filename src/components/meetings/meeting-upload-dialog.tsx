'use client'

import { useState, useRef } from 'react'
import { Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const MOCK_CLIENTS = [
  { id: '1', name: 'Acme Corp' },
  { id: '2', name: 'Globex Inc' },
  { id: '3', name: 'Initech' },
  { id: '4', name: 'Umbrella Corp' },
  { id: '5', name: 'Stark Industries' },
  { id: '6', name: 'Wayne Enterprises' },
]

export function MeetingUploadDialog() {
  const [open, setOpen] = useState(false)
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'select' | 'upload' | 'transcribe'>('select')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.add('border-[#e74c3c]', 'bg-[#1a2540]')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.remove('border-[#e74c3c]', 'bg-[#1a2540]')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.remove('border-[#e74c3c]', 'bg-[#1a2540]')

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const droppedFile = files[0]
      const validTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'video/mp4']
      if (validTypes.includes(droppedFile.type)) {
        setFile(droppedFile)
        setError(null)
      } else {
        setError('Please upload an audio file (.mp3, .m4a, .wav, .webm, .mp4)')
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!clientId || !title || !date || !file) {
      setError('Please fill in all fields and select a file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Step 1: Create meeting record
      setStep('select')
      const createResponse = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          title,
          date,
          status: 'processing',
        }),
      })

      if (!createResponse.ok) throw new Error('Failed to create meeting')
      const meetingData = await createResponse.json()
      const meetingId = meetingData.id

      // Step 2: Upload file
      setStep('upload')
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await fetch(`/api/meetings/${meetingId}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) throw new Error('Failed to upload file')

      // Step 3: Transcribe
      setStep('transcribe')
      const transcribeResponse = await fetch(`/api/meetings/${meetingId}/transcribe`, {
        method: 'POST',
      })

      if (!transcribeResponse.ok) throw new Error('Failed to transcribe')

      // Reset form and close
      setClientId('')
      setTitle('')
      setDate('')
      setFile(null)
      setStep('select')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#e74c3c] hover:bg-[#c0392b] text-white">
          <Upload className="w-4 h-4 mr-2" />
          Upload Recording
        </Button>
      </DialogTrigger>

      <DialogContent className="bg-[#111d35] border-[#1a2540] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl">Upload Meeting Recording</DialogTitle>
          <DialogDescription className="text-[#7a88a8]">
            Upload an audio or video file to extract meeting intelligence
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Selector */}
          <div className="space-y-2">
            <Label className="text-white">Client</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={loading}>
              <SelectTrigger className="bg-[#0a1628] border-[#1a2540] text-white">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent className="bg-[#111d35] border-[#1a2540]">
                {MOCK_CLIENTS.map((client) => (
                  <SelectItem key={client.id} value={client.id} className="text-white">
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title Input */}
          <div className="space-y-2">
            <Label className="text-white">Meeting Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="e.g., Q2 Planning Session"
              className="bg-[#0a1628] border-[#1a2540] text-white placeholder:text-[#7a88a8]"
            />
          </div>

          {/* Date Input */}
          <div className="space-y-2">
            <Label className="text-white">Meeting Date</Label>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
              className="bg-[#0a1628] border-[#1a2540] text-white"
            />
          </div>

          {/* File Drop Zone */}
          <div className="space-y-2">
            <Label className="text-white">Audio File</Label>
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#1a2540] rounded-lg p-6 text-center cursor-pointer transition-colors bg-[#0a1628]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.m4a,.wav,.webm,.mp4,audio/*,video/mp4"
                onChange={handleFileSelect}
                disabled={loading}
                className="hidden"
              />
              {file ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">{file.name}</div>
                  <div className="text-xs text-[#7a88a8]">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-5 h-5 mx-auto text-[#e74c3c]" />
                  <div className="text-sm text-[#7a88a8]">Drag and drop or click to select</div>
                  <div className="text-xs text-[#7a88a8]">MP3, WAV, M4A, WebM, or MP4</div>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && <div className="text-sm text-[#e74c3c]">{error}</div>}

          {/* Loading States */}
          {loading && (
            <div className="space-y-2 text-sm text-[#7a88a8]">
              {step === 'select' && <div className="flex items-center">
                <span className="inline-block w-2 h-2 bg-[#e74c3c] rounded-full mr-2 animate-pulse"></span>
                Creating meeting record...
              </div>}
              {step === 'upload' && <div className="flex items-center">
                <span className="inline-block w-2 h-2 bg-[#e74c3c] rounded-full mr-2 animate-pulse"></span>
                Uploading file...
              </div>}
              {step === 'transcribe' && <div className="flex items-center">
                <span className="inline-block w-2 h-2 bg-[#e74c3c] rounded-full mr-2 animate-pulse"></span>
                Processing transcript...
              </div>}
            </div>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={loading || !clientId || !title || !date || !file}
            className="w-full bg-[#e74c3c] hover:bg-[#c0392b] text-white"
          >
            {loading ? 'Processing...' : 'Upload & Process'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
