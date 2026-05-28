import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { formatDate, getMedicineStatus, startOfLocalDay } from "@/lib/dates";

export async function runExpiryNotificationJob() {
  const now = new Date();
  const today = startOfLocalDay(now);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + 30);

  const users = await prisma.user.findMany({
    include: {
      medicines: {
        where: {
          expiryDate: {
            lte: cutoff
          }
        },
        orderBy: { expiryDate: "asc" }
      }
    }
  });

  const transporter = createTransporter();
  const results: Array<{ email: string; count: number; delivered: "email" | "terminal" | "none" }> = [];

  for (const user of users) {
    const rows = user.medicines.filter((medicine) => {
      if (medicine.lastNotifiedAt && formatDate(medicine.lastNotifiedAt) === formatDate(today)) {
        return false;
      }
      return ["near_expiry", "expired"].includes(getMedicineStatus(medicine.expiryDate, now));
    });

    if (!rows.length) {
      results.push({ email: user.email, count: 0, delivered: "none" });
      continue;
    }

    const digest = [
      `ExpiryIQ alert for ${user.name}`,
      "",
      ...rows.map((medicine) => {
        const status = getMedicineStatus(medicine.expiryDate, now).replace("_", " ");
        return `- ${medicine.medicineName} | Batch: ${medicine.batchNo || "N/A"} | Expiry: ${formatDate(
          medicine.expiryDate
        )} | ${status}`;
      })
    ].join("\n");

    if (transporter) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || "ExpiryIQ <alerts@example.com>",
        to: user.email,
        subject: `ExpiryIQ: ${rows.length} medicine(s) need attention`,
        text: digest
      });
      results.push({ email: user.email, count: rows.length, delivered: "email" });
    } else {
      console.log("\n" + digest + "\n");
      results.push({ email: user.email, count: rows.length, delivered: "terminal" });
    }

    await prisma.medicine.updateMany({
      where: {
        id: { in: rows.map((medicine) => medicine.id) }
      },
      data: {
        lastNotifiedAt: now
      }
    });
  }

  return results;
}

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}
