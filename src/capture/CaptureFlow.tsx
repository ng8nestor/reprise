import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.ts'
import { BookStep } from './BookStep.tsx'
import type { Book } from './books.ts'
import {
  requestExtraction,
  type ExtractOutcome,
  type ExtractResponse,
} from './extractClient.ts'
import { extractErrorView, type ExtractErrorView } from './extractError.ts'
import { PageStep } from './PageStep.tsx'
import { blobToBase64, shrinkPhoto } from './photo.ts'
import { PhotoStep } from './PhotoStep.tsx'
import { FailedStep, ReadingStep } from './ReadingStep.tsx'
import { ReviewScreen } from './ReviewScreen.tsx'
import './capture.css'

interface Photo {
  // Object URL of the shrunk JPEG, for showing it on screen.
  url: string
  // The same JPEG as plain base64, for /api/extract.
  base64: string
}

type Step =
  | { name: 'book' }
  | { name: 'page'; book: Book; pageNumber: number | null }
  | {
      name: 'photo'
      book: Book
      pageNumber: number
      preparing: boolean
      error: string | null
    }
  | { name: 'reading'; book: Book; pageNumber: number; photo: Photo }
  | {
      name: 'failed'
      book: Book
      pageNumber: number
      photo: Photo
      error: ExtractErrorView
    }
  | {
      name: 'review'
      book: Book
      pageNumber: number
      photo: Photo
      extraction: ExtractResponse
    }

interface CaptureFlowProps {
  onExit: () => void
}

// One page from book choice to review. Steps live in component state (no
// router): leaving the flow drops everything, and nothing is saved yet
// except a newly added book.
export function CaptureFlow({ onExit }: CaptureFlowProps) {
  const [step, setStep] = useState<Step>({ name: 'book' })
  const requestRef = useRef<AbortController | null>(null)
  const photoUrlRef = useRef<string | null>(null)

  // Leaving the flow cancels a running request and frees the photo.
  useEffect(
    () => () => {
      requestRef.current?.abort()
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    },
    [],
  )

  function keepPhotoUrl(blob: Blob): string {
    if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current)
    photoUrlRef.current = URL.createObjectURL(blob)
    return photoUrlRef.current
  }

  function cancelRequest() {
    requestRef.current?.abort()
    requestRef.current = null
  }

  async function extract(book: Book, pageNumber: number, photo: Photo) {
    cancelRequest()
    const controller = new AbortController()
    requestRef.current = controller
    setStep({ name: 'reading', book, pageNumber, photo })

    let outcome: ExtractOutcome
    try {
      // getSession refreshes the access token first if it has expired.
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      outcome = token
        ? await requestExtraction(photo.base64, token, controller.signal)
        : { ok: false, failure: { kind: 'http', status: 401 } }
    } catch {
      outcome = { ok: false, failure: { kind: 'network' } }
    }

    // Cancelled or replaced while waiting: whatever came back is stale.
    if (controller.signal.aborted) return
    requestRef.current = null
    setStep(
      outcome.ok
        ? { name: 'review', book, pageNumber, photo, extraction: outcome.data }
        : {
            name: 'failed',
            book,
            pageNumber,
            photo,
            error: extractErrorView(outcome.failure),
          },
    )
  }

  async function handlePhoto(book: Book, pageNumber: number, file: File) {
    setStep({ name: 'photo', book, pageNumber, preparing: true, error: null })
    let photo: Photo
    try {
      const jpeg = await shrinkPhoto(file)
      photo = { url: keepPhotoUrl(jpeg), base64: await blobToBase64(jpeg) }
    } catch {
      setStep({
        name: 'photo',
        book,
        pageNumber,
        preparing: false,
        error: "Couldn't open this photo. Try another one.",
      })
      return
    }
    await extract(book, pageNumber, photo)
  }

  function toPhotoStep(book: Book, pageNumber: number) {
    cancelRequest()
    setStep({ name: 'photo', book, pageNumber, preparing: false, error: null })
  }

  switch (step.name) {
    case 'book':
      return (
        <BookStep
          onPick={(book) => setStep({ name: 'page', book, pageNumber: null })}
          onBack={onExit}
        />
      )
    case 'page':
      return (
        <PageStep
          book={step.book}
          initialPage={step.pageNumber}
          onSubmit={(pageNumber) => toPhotoStep(step.book, pageNumber)}
          onBack={() => setStep({ name: 'book' })}
        />
      )
    case 'photo':
      return (
        <PhotoStep
          book={step.book}
          pageNumber={step.pageNumber}
          preparing={step.preparing}
          error={step.error}
          onPhoto={(file) => void handlePhoto(step.book, step.pageNumber, file)}
          onBack={() =>
            setStep({
              name: 'page',
              book: step.book,
              pageNumber: step.pageNumber,
            })
          }
        />
      )
    case 'reading':
      return (
        <ReadingStep
          photoUrl={step.photo.url}
          onCancel={() => toPhotoStep(step.book, step.pageNumber)}
        />
      )
    case 'failed':
      return (
        <FailedStep
          photoUrl={step.photo.url}
          error={step.error}
          onRetry={() => void extract(step.book, step.pageNumber, step.photo)}
          onRetake={() => toPhotoStep(step.book, step.pageNumber)}
          // App swaps to the sign-in form once the session is gone.
          onSignIn={() => void supabase.auth.signOut({ scope: 'local' })}
        />
      )
    case 'review':
      return (
        <ReviewScreen
          book={step.book}
          pageNumber={step.pageNumber}
          photoUrl={step.photo.url}
          extraction={step.extraction}
          onRetake={() => toPhotoStep(step.book, step.pageNumber)}
          onDiscard={onExit}
        />
      )
  }
}
