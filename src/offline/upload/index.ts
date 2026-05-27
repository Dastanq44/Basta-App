// Media upload — abstracted behind the queue (DECISIONS.md D-008).
// MVP uses standard Supabase Storage upload; tus/resumable is deferred to video.
// Keeping this an interface lets the implementation be swapped without touching features.

export interface MediaUploader {
  /** Uploads a local file and resolves to its remote storage path. */
  upload(localUri: string, opts: { bucket: string; pathPrefix: string }): Promise<string>;
}

// Concrete uploader (standard Supabase Storage) is implemented in Phase 2.
