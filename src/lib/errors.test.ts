import { describe, expect, it } from "vitest";
import { ApiRequestError } from "./api";
import { getErrorDetails, getErrorMessage, getErrorRequestId } from "./errors";

describe("error helpers", () => {
  it("extracts message and request id from ApiRequestError", () => {
    const error = new ApiRequestError({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      statusCode: 400,
      requestId: "req-123",
    });

    expect(getErrorMessage(error)).toBe("Validation failed");
    expect(getErrorRequestId(error)).toBe("req-123");
  });

  it("formats validation details from ApiRequestError", () => {
    const error = new ApiRequestError({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details: [
        { field: "title", message: "Title is required" },
        { field: "amount", message: "Amount must be positive" },
      ],
    });

    expect(getErrorDetails(error)).toEqual([
      "title: Title is required",
      "amount: Amount must be positive",
    ]);
  });

  it("falls back for non-API errors", () => {
    expect(getErrorMessage(new Error("Boom"))).toBe("Boom");
    expect(getErrorDetails(new Error("Boom"))).toEqual([]);
    expect(getErrorRequestId(new Error("Boom"))).toBeNull();
  });
});
