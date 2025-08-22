/**
 * Standardized tool error shape to align with the rest of the codebase.
 * (Matches the thrown object shape used in WriteToFileTool.)
 */
export function throwToolError(code: string | number, type: string, message: string): never {
  throw new ToolError(code, type, message);
}

export class ToolError extends Error {
  code: string | number;
  type: string;

  constructor(code: string | number, type: string, message: string) {
    super(message);

    // Use the provided type both for error name and type
    this.name = type;
    this.code = code;
    this.type = type;

    // restore prototype chain when targeting ES5
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toResponse() {
    return {
      response: {
        data: {
          error_code: this.code,
          error_type: this.type,
          error_message: this.message,
        },
      },
    };
  }
}
