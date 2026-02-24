import { isApiError } from "./api";

export const getErrorMessage = (
  error: unknown,
  fallback = "Something went wrong",
) => {
  if (isApiError(error)) {
    return error.message || fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

export const getErrorDetails = (error: unknown) => {
  if (!isApiError(error)) return [];

  const { details } = error;
  if (!details) return [];

  if (Array.isArray(details)) {
    return details.map((detail) => {
      if (typeof detail === "string") return detail;
      if (detail && typeof detail === "object") {
        const field =
          "field" in detail && detail.field ? `${detail.field}: ` : "";
        const message =
          "message" in detail && detail.message
            ? detail.message
            : "Invalid value";
        return `${field}${message}`;
      }
      return String(detail);
    });
  }

  if (typeof details === "object") {
    return [JSON.stringify(details)];
  }

  return [String(details)];
};

export const getErrorRequestId = (error: unknown) => {
  if (isApiError(error) && error.requestId) {
    return error.requestId;
  }
  return null;
};
