export type MedicineStatus = "safe" | "near_expiry" | "expired";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function lastDayOfMonth(year: number, monthOneBased: number) {
  return new Date(year, monthOneBased, 0);
}

export function normalizeExpiryDate(input: string, now = new Date()): string | null {
  const value = input.trim();
  if (!value) {
    return null;
  }

  const isoDate = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    const [, yearText, monthText, dayText] = isoDate;
    return validDate(Number(yearText), Number(monthText), Number(dayText));
  }

  const slashFull = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (slashFull) {
    const [, dayText, monthText, yearText] = slashFull;
    const year = expandYear(Number(yearText), now);
    return validDate(year, Number(monthText), Number(dayText));
  }

  const monthYear = value.match(/^(\d{1,2})[/-](\d{2}|\d{4})$/);
  if (monthYear) {
    const [, monthText, yearText] = monthYear;
    const month = Number(monthText);
    const year = expandYear(Number(yearText), now);
    if (month < 1 || month > 12) {
      return null;
    }
    return formatDate(lastDayOfMonth(year, month));
  }

  const yearMonth = value.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) {
    const [, yearText, monthText] = yearMonth;
    const month = Number(monthText);
    if (month < 1 || month > 12) {
      return null;
    }
    return formatDate(lastDayOfMonth(Number(yearText), month));
  }

  return null;
}

export function getMedicineStatus(expiryDate: Date | string, now = new Date()): MedicineStatus {
  const expiry =
    typeof expiryDate === "string" ? startOfLocalDay(new Date(`${expiryDate}T00:00:00`)) : startOfLocalDay(expiryDate);
  const today = startOfLocalDay(now);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysUntilExpiry < 0) {
    return "expired";
  }

  if (daysUntilExpiry <= 30) {
    return "near_expiry";
  }

  return "safe";
}

export function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expandYear(year: number, now: Date) {
  if (year >= 100) {
    return year;
  }

  const century = Math.floor(now.getFullYear() / 100) * 100;
  return century + year;
}

function validDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return formatDate(date);
}
