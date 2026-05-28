import { describe, expect, it } from "vitest";
import { getMedicineStatus, normalizeExpiryDate } from "@/lib/dates";

const now = new Date("2026-05-28T10:00:00+05:30");

describe("normalizeExpiryDate", () => {
  it("normalizes month slash short year to last day of month", () => {
    expect(normalizeExpiryDate("9/27", now)).toBe("2027-09-30");
    expect(normalizeExpiryDate("12/27", now)).toBe("2027-12-31");
  });

  it("normalizes full dates", () => {
    expect(normalizeExpiryDate("24/05/2026", now)).toBe("2026-05-24");
    expect(normalizeExpiryDate("2027-09-12", now)).toBe("2027-09-12");
  });

  it("returns null for missing or invalid dates", () => {
    expect(normalizeExpiryDate("", now)).toBeNull();
    expect(normalizeExpiryDate("13/27", now)).toBeNull();
    expect(normalizeExpiryDate("not a date", now)).toBeNull();
  });
});

describe("getMedicineStatus", () => {
  it("marks expired, near expiry, and safe dates", () => {
    expect(getMedicineStatus("2026-05-27", now)).toBe("expired");
    expect(getMedicineStatus("2026-06-20", now)).toBe("near_expiry");
    expect(getMedicineStatus("2026-07-20", now)).toBe("safe");
  });
});
