import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  daysUntil,
  expiryStatus,
  friendlyError,
  inventoryValue,
  isToday,
  peso,
  qty,
  stockStatus,
} from "./inventory";

describe("stockStatus", () => {
  it("is out_of_stock at zero and below", () => {
    expect(stockStatus({ stock_qty: 0, min_stock: 5 })).toBe("out_of_stock");
    expect(stockStatus({ stock_qty: -1, min_stock: 5 })).toBe("out_of_stock");
  });

  it("is low_stock when at or under min_stock but above zero", () => {
    expect(stockStatus({ stock_qty: 5, min_stock: 5 })).toBe("low_stock");
    expect(stockStatus({ stock_qty: 1, min_stock: 5 })).toBe("low_stock");
  });

  it("is in_stock above min_stock", () => {
    expect(stockStatus({ stock_qty: 6, min_stock: 5 })).toBe("in_stock");
  });

  it("treats a zero min_stock as never low", () => {
    expect(stockStatus({ stock_qty: 1, min_stock: 0 })).toBe("in_stock");
  });
});

describe("daysUntil / expiryStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts whole days to a future date", () => {
    expect(daysUntil("2026-01-20")).toBe(5);
  });

  it("is zero for today", () => {
    expect(daysUntil("2026-01-15")).toBe(0);
  });

  it("is negative for a past date", () => {
    expect(daysUntil("2026-01-10")).toBe(-5);
  });

  it("is expired once past due", () => {
    expect(expiryStatus("2026-01-14", 7)).toBe("expired");
  });

  it("is near within the configured window, inclusive", () => {
    expect(expiryStatus("2026-01-22", 7)).toBe("near");
    expect(expiryStatus("2026-01-15", 7)).toBe("near");
  });

  it("is valid just past the near-expiry window", () => {
    expect(expiryStatus("2026-01-23", 7)).toBe("valid");
  });
});

describe("isToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 9, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is true for a timestamp earlier today", () => {
    expect(isToday(new Date(2026, 0, 15, 0, 0).toISOString())).toBe(true);
  });

  it("is false for yesterday or tomorrow", () => {
    expect(isToday(new Date(2026, 0, 14, 9, 30).toISOString())).toBe(false);
    expect(isToday(new Date(2026, 0, 16, 9, 30).toISOString())).toBe(false);
  });
});

describe("peso", () => {
  it("formats a positive amount as PHP currency", () => {
    expect(peso(1234.5)).toBe("₱1,234.50");
  });

  it("falls back to zero for non-numeric input", () => {
    expect(peso(Number.NaN)).toBe("₱0.00");
  });
});

describe("qty", () => {
  it("renders whole numbers without decimals", () => {
    expect(qty(10)).toBe("10");
  });

  it("renders fractional quantities to two decimals", () => {
    expect(qty(2.5)).toBe("2.50");
  });

  it("falls back to zero for non-numeric input", () => {
    expect(qty(Number.NaN)).toBe("0");
  });
});

describe("inventoryValue", () => {
  it("multiplies stock quantity by cost price", () => {
    expect(inventoryValue({ stock_qty: 10, cost_price: 2.5 })).toBe(25);
  });
});

describe("friendlyError", () => {
  it("maps a duplicate product constraint to a friendly message", () => {
    expect(
      friendlyError({ message: 'duplicate key value violates unique constraint "products_unique_name_category"' }),
    ).toBe("A product with this name already exists in that category.");
  });

  it("maps insufficient stock errors", () => {
    expect(friendlyError({ message: "P0001: Insufficient available stock for product X" })).toBe(
      "Insufficient stock: Insufficient available stock for product X",
    );
  });

  it("maps check constraint violations", () => {
    expect(friendlyError({ message: "new row violates check constraint" })).toBe(
      "Please enter valid, non-negative numbers.",
    );
  });

  it("maps foreign key violations", () => {
    expect(friendlyError({ message: "violates foreign key constraint" })).toBe(
      "The selected record no longer exists.",
    );
  });

  it("maps bad login credentials", () => {
    expect(friendlyError({ message: "Invalid login credentials" })).toBe("Incorrect email or password.");
  });

  it("passes through unrecognized messages", () => {
    expect(friendlyError({ message: "Something unexpected happened" })).toBe("Something unexpected happened");
  });

  it("falls back to a generic message when there is no message", () => {
    expect(friendlyError("")).toBe("Something went wrong. Please try again.");
  });
});
