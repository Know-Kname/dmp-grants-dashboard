import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatStatus,
  toCamelCaseKeys,
  toSnakeCaseKeys,
} from "./utils";

describe("utils", () => {
  it("converts object keys to snake_case", () => {
    const input = {
      firstName: "Ada",
      lastName: "Lovelace",
      addressInfo: { zipCode: "12345" },
    };

    expect(toSnakeCaseKeys(input)).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      address_info: { zip_code: "12345" },
    });
  });

  it("converts object keys to camelCase", () => {
    const input = {
      first_name: "Ada",
      last_name: "Lovelace",
      address_info: { zip_code: "12345" },
    };

    expect(toCamelCaseKeys(input)).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
      addressInfo: { zipCode: "12345" },
    });
  });

  it("formats currency and status", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatStatus("in_progress")).toBe("In Progress");
  });
});
