import { NextRequest, NextResponse } from "next/server";
import { getMedicineStatus } from "@/lib/dates";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { medicineRowsSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const user = await requireApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const medicines = await prisma.medicine.findMany({
    where: { userId: user.id },
    orderBy: { expiryDate: "asc" }
  });

  return NextResponse.json({
    medicines: medicines.map((medicine) => ({
      ...medicine,
      status: getMedicineStatus(medicine.expiryDate)
    }))
  });
}

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = medicineRowsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const medicines = await prisma.$transaction(
    parsed.data.rows.map((row) =>
      prisma.medicine.create({
        data: {
          userId: user.id,
          medicineName: row.medicineName,
          batchNo: row.batchNo || null,
          quantity: row.quantity || null,
          expiryText: row.expiryText || null,
          expiryDate: new Date(`${row.expiryDate}T00:00:00.000Z`),
          confidence: row.confidence ?? null,
          source: row.source,
          sourceImageName: row.sourceImageName || null
        }
      })
    )
  );

  return NextResponse.json({ medicines }, { status: 201 });
}
