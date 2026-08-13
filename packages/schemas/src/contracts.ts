import { z } from "zod";

export const ContractSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1),
  sourceText: z.string().min(1),
  cuadDocId: z.string().nullable(),
  uploadedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
});

export type Contract = z.infer<typeof ContractSchema>;

export const ContractChunkSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  text: z.string().min(1),
  startChar: z.number().int().nonnegative(),
  endChar: z.number().int().nonnegative(),
});

export type ContractChunk = z.infer<typeof ContractChunkSchema>;
