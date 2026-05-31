import { z } from 'zod';

export const proofInput = z.object({
  challengeId: z.string().uuid(),
  /** Local file URI (`file://...`) from the picker/camera. */
  mediaLocalUri: z.string().min(1, 'Pick a photo first'),
  comment: z
    .string()
    .trim()
    .max(500, 'At most 500 characters')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type ProofInput = z.infer<typeof proofInput>;
