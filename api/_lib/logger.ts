export const logger = {
  info(event: string, context?: Record<string, unknown>) {
    console.log(
      JSON.stringify({
        level: "info",
        event,
        timestamp: new Date().toISOString(),
        ...context,
      }),
    );
  },
  warn(event: string, context?: Record<string, unknown>) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event,
        timestamp: new Date().toISOString(),
        ...context,
      }),
    );
  },
  error(event: string, error?: unknown, context?: Record<string, unknown>) {
    const errorDetails =
      error instanceof Error
        ? { message: error.message, name: error.name, stack: error.stack }
        : { error };
    console.error(
      JSON.stringify({
        level: "error",
        event,
        timestamp: new Date().toISOString(),
        ...errorDetails,
        ...context,
      }),
    );
  },
};
