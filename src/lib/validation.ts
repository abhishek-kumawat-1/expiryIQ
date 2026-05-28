import { z } from "zod";

export const medicineInputSchema = z.object({
  medicineName: z.string().trim().min(1, "Medicine name is required"),
  batchNo: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().positive().optional().nullable(),
  expiryText: z.string().trim().optional().nullable(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  confidence: z.coerce.number().min(0).max(1).optional().nullable(),
  source: z.enum(["manual", "openai"]).default("manual"),
  sourceImageName: z.string().trim().optional().nullable()
});

export const medicineRowsSchema = z.object({
  rows: z.array(medicineInputSchema).min(1)
});

export type MedicineInput = z.infer<typeof medicineInputSchema>;
