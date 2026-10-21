import { z } from "zod";
import { searchSpecSchema } from "./search";

const fullName = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/, "Use the form owner/name");
const note = z
  .string()
  .trim()
  .max(2000, "Notes are limited to 2,000 characters")
  .transform((s) => (s === "" ? null : s));

export const providerRepoIdSchema = z.string().regex(/^\d{1,20}$/, "Invalid repository id");
export const idSchema = z.string().regex(/^[a-z0-9]{20,40}$/i, "Invalid id");

export const saveRepositoryInput = z.object({ fullName, note: note.optional() });
export const updateNoteInput = z.object({ note: note.nullable() });

export const collectionInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Names are limited to 100 characters"),
  description: z.string().trim().max(1000, "Descriptions are limited to 1,000 characters").nullable().optional(),
});
export const collectionPatchInput = collectionInput.partial().extend({ shared: z.boolean().optional() });
export const collectionItemInput = z.object({ fullName, note: note.optional() });

export const savedSearchInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Names are limited to 100 characters"),
  spec: searchSpecSchema,
});
