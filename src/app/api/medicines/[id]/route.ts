import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { medicineInputSchema } from "@/lib/validation";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = medicineInputSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.medicine.findFirst({ where: { id, userId: user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Medicine not found." }, { status: 404 });
  }

  const row = parsed.data;
  const medicine = await prisma.medicine.update({
    where: { id },
    data: {
      medicineName: row.medicineName,
      batchNo: row.batchNo || null,
      quantity: row.quantity || null,
      expiryText: row.expiryText || null,
      expiryDate: new Date(`${row.expiryDate}T00:00:00.000Z`),
      confidence: row.confidence ?? null,
      source: row.source,
      sourceImageName: row.sourceImageName || null
    }
  });

  return NextResponse.json({ medicine });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const user = await requireApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.medicine.findFirst({ where: { id, userId: user.id } });
  if (!existing) {
    return NextResponse.json({ error: "Medicine not found." }, { status: 404 });
  }

  await prisma.medicine.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
