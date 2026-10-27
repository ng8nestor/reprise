import { supabase } from '../lib/supabase.ts'
import { firstDueOn } from './dueDate.ts'
import type { ExtractResponse } from './extractClient.ts'
import type { DraftHighlight } from './review.ts'
import { PHOTO_BUCKET, photoPath, savePageArgs } from './save.ts'
import {
  rpcFailure,
  shouldDeletePhoto,
  uploadFailure,
  type SaveFailure,
} from './saveError.ts'

export interface SaveRequest {
  bookId: string
  pageNumber: number
  photo: Blob
  extraction: ExtractResponse
  highlights: readonly DraftHighlight[]
}

export type SaveOutcome = { ok: true } | { ok: false; failure: SaveFailure }

// Uploads the photo, then writes the page and its highlights in one
// transaction (public.save_page). Never throws.
//
// Each attempt gets a fresh page id, so a retry never collides with the
// photo of an earlier attempt (photos can't be overwritten, see the Storage
// policies).
export async function savePage(request: SaveRequest): Promise<SaveOutcome> {
  try {
    // getSession refreshes the access token first if it has expired.
    const { data } = await supabase.auth.getSession()
    const userId = data.session?.user.id
    if (!userId) return { ok: false, failure: { kind: 'other' } }

    const pageId = crypto.randomUUID()
    const path = photoPath(userId, pageId)
    const photos = supabase.storage.from(PHOTO_BUCKET)

    const upload = await photos.upload(path, request.photo, {
      contentType: 'image/jpeg',
      upsert: false,
    })
    if (upload.error) {
      return { ok: false, failure: uploadFailure(upload.error) }
    }

    const { error, status } = await supabase.rpc(
      'save_page',
      savePageArgs({
        pageId,
        userId,
        bookId: request.bookId,
        pageNumber: request.pageNumber,
        extraction: request.extraction,
        highlights: request.highlights,
        dueOn: firstDueOn(new Date()),
      }),
    )
    if (!error) return { ok: true }

    const failure = rpcFailure({ status, code: error.code })
    if (shouldDeletePhoto(failure)) {
      // Best effort: if this fails too, the photo is an orphan, which is
      // harmless. The save error is what I need to see.
      await photos.remove([path])
    }
    return { ok: false, failure }
  } catch {
    // supabase-js returns errors instead of throwing; this is for the
    // unexpected (e.g. crypto.randomUUID missing outside a secure context).
    return { ok: false, failure: { kind: 'other' } }
  }
}
