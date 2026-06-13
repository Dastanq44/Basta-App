import { z } from 'zod';

export const proofInput = z.object({
  challengeId: z.string().uuid(),
  /** Short user-supplied title shown on the challenge / profile / detail rows. Required since W-034. */
  title: z
    .string()
    .trim()
    .min(1, 'Add a title')
    .max(80, 'At most 80 characters'),
  /** Local file URI (`file://...`) from the picker/camera. */
  mediaLocalUri: z.string().min(1, 'Pick a photo first'),
  comment: z
    .string()
    .trim()
    .max(500, 'At most 500 characters')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  /** "Share to Global" opt-in. Default off — Global must never include content by accident. */
  isPublic: z.boolean().default(false),
});
export type ProofInput = z.infer<typeof proofInput>;
