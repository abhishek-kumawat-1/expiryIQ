import { NextRequest, NextResponse } from "next/server";
import { runExpiryNotificationJob } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const secret = process.env.JOB_SECRET;
  if (secret) {
    const provided = request.headers.get("x-job-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results = await runExpiryNotificationJob();
  return NextResponse.json({ results });
}
