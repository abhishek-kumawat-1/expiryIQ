import { runExpiryNotificationJob } from "../src/lib/notifications";
import { prisma } from "../src/lib/prisma";

async function main() {
  const results = await runExpiryNotificationJob();
  console.table(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
