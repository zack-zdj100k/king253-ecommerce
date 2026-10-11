/**
 * Errors safe to show customers carry a friendly `userMessage`.
 * Anything else is logged and replaced with a generic message.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
    options?: { cause?: unknown; detail?: string }
  ) {
    super(options?.detail ?? userMessage, { cause: options?.cause })
    this.name = "AppError"
  }
}

export class OutOfStockError extends AppError {
  constructor(
    public readonly variantId: string,
    public readonly available: number,
    label?: string
  ) {
    super(
      "OUT_OF_STOCK",
      available <= 0
        ? `${label ? `${label} is` : "This size is"} no longer available.`
        : `Only ${available} left${label ? ` for ${label}` : ""}. Please lower the quantity.`
    )
    this.name = "OutOfStockError"
  }
}

export class NotFoundError extends AppError {
  constructor(what = "This item") {
    super("NOT_FOUND", `${what} could not be found.`)
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super("FORBIDDEN", "You are not allowed to do that.")
  }
}

export const GENERIC_ERROR = "Something went wrong while processing your request. Please try again."

/** Turn any thrown value into a message that is safe to send to the browser. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage
  console.error("[king253] unexpected error", error)
  return GENERIC_ERROR
}
