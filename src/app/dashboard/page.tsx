import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMedicineStatus } from "@/lib/dates";
import { Dashboard } from "@/components/dashboard";

export default async function DashboardPage() {
  const user = await requireUser();
  const medicines = await prisma.medicine.findMany({
    where: { userId: user.id },
    orderBy: { expiryDate: "asc" }
  });

  return (
    <Dashboard
      user={user}
      initialMedicines={medicines.map((medicine) => ({
        id: medicine.id,
        medicineName: medicine.medicineName,
        batchNo: medicine.batchNo || "",
        quantity: medicine.quantity,
        expiryText: medicine.expiryText || "",
        expiryDate: medicine.expiryDate.toISOString().slice(0, 10),
        confidence: medicine.confidence,
        source: medicine.source as "manual" | "openai",
        sourceImageName: medicine.sourceImageName || "",
        status: getMedicineStatus(medicine.expiryDate)
      }))}
    />
  );
}
