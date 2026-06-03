'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

export default function CameraScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()
  const streamRef = useRef<MediaStream>()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }

  const tick = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const jsQR = (await import('jsqr')).default
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })
    if (result?.data) {
      stop()
      let code = result.data
      try {
        const url = new URL(result.data)
        code = url.searchParams.get('code') || result.data
      } catch {}
      onScan(code.toUpperCase())
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [onScan])

  useEffect(() => {
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch {
        setError('Camera access denied. Please allow camera permission in your browser settings.')
      }
    }
    start()
    return () => stop()
  }, [])

  useEffect(() => {
    if (ready) rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [ready, tick])

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-100 p-6 text-center">
        <p className="text-red-600 text-sm mb-3">{error}</p>
        <button onClick={onClose} className="text-sm text-gray-500 underline">Close</button>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="w-full block"
        playsInline
        muted
        style={{ maxHeight: '320px', objectFit: 'cover' }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Targeting overlay */}
      {ready && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-52 h-52">
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{ borderTopWidth: 3, borderLeftWidth: 3 }} />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" style={{ borderTopWidth: 3, borderRightWidth: 3 }} />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" style={{ borderBottomWidth: 3, borderLeftWidth: 3 }} />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" style={{ borderBottomWidth: 3, borderRightWidth: 3 }} />
            {/* Scanning line */}
            <div className="absolute left-2 right-2 h-0.5 bg-indigo-400/80 animate-pulse" style={{ top: '50%' }} />
          </div>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <p className="text-white text-sm">Starting camera…</p>
        </div>
      )}

      <button
        onClick={() => { stop(); onClose() }}
        className="absolute top-3 right-3 bg-black/50 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-black/70 transition-colors"
      >
        Cancel
      </button>

      <p className="absolute bottom-3 left-0 right-0 text-center text-white/70 text-xs pointer-events-none">
        Point camera at QR code
      </p>
    </div>
  )
}
