import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { normalizeExpiryDate } from "@/lib/dates";
import { requireApiUser } from "@/lib/auth";

const extractionSchema = {
  name: "medicine_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            medicineName: { type: "string" },
            batchNo: { type: "string" },
            quantity: { type: ["integer", "null"] },
            expiryText: { type: "string" },
            confidence: { type: "number" }
          },
          required: ["medicineName", "batchNo", "quantity", "expiryText", "confidence"]
        }
      }
    },
    required: ["rows"]
  }
} as const;

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is missing. Add it to .env.local or .env." }, { status: 400 });
  }

  const formData = (await request.formData()) as unknown as globalThis.FormData;
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload an image file." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported." }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be smaller than 8 MB." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const base64 = bytes.toString("base64");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    response_format: {
      type: "json_schema",
      json_schema: extractionSchema
    },
    messages: [
      {
        role: "system",
        content:
          "Extract medicine inventory rows from invoices, cartons, or labels. Return only actual product rows. Expiry may appear as Exp, EXP, expiry, or month/year. Do not guess unreadable rows."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Extract all medicine rows. For each row include product/medicine name, batch number if visible, quantity if visible, original expiry text, and confidence from 0 to 1."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${file.type};base64,${base64}`
            }
          }
        ]
      }
    ]
  });

  const raw = completion.choices[0]?.message.content;
  if (!raw) {
    return NextResponse.json({ error: "OpenAI did not return extraction data." }, { status: 502 });
  }

  const parsed = JSON.parse(raw) as {
    rows: Array<{
      medicineName: string;
      batchNo: string;
      quantity: number | null;
      expiryText: string;
      confidence: number;
    }>;
  };

  const rows = parsed.rows
    .map((row) => ({
      medicineName: row.medicineName.trim(),
      batchNo: row.batchNo.trim(),
      quantity: row.quantity,
      expiryText: row.expiryText.trim(),
      expiryDate: normalizeExpiryDate(row.expiryText) || "",
      confidence: Math.max(0, Math.min(1, row.confidence)),
      source: "openai" as const,
      sourceImageName: file.name
    }))
    .filter((row) => row.medicineName);

  return NextResponse.json({ rows });
}
