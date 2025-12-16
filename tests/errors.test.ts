import { describe, it, expect, vi } from "vitest";
import { formatError, logger } from "../src/core/errors";

describe("errors", () => {
    describe("formatError()", () => {
        it("should format Error instances with message", () => {
            const error = new Error("Something went wrong");
            const result = formatError(error);

            expect(result.isError).toBe(true);
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe("text");
            expect(result.content[0]).toHaveProperty("text");
            expect((result.content[0] as { text: string }).text).toContain("Something went wrong");
        });

        it("should format string errors", () => {
            const result = formatError("String error message");

            expect(result.isError).toBe(true);
            expect((result.content[0] as { text: string }).text).toContain("String error message");
        });

        it("should format non-error objects", () => {
            const result = formatError({ custom: "error" });

            expect(result.isError).toBe(true);
            expect(result.content).toHaveLength(1);
        });

        it("should format null and undefined", () => {
            expect(formatError(null).isError).toBe(true);
            expect(formatError(undefined).isError).toBe(true);
        });
    });

    describe("logger", () => {
        it("should have info, warn, and error methods", () => {
            expect(typeof logger.info).toBe("function");
            expect(typeof logger.warn).toBe("function");
            expect(typeof logger.error).toBe("function");
        });

        it("should write to stderr", () => {
            const spy = vi.spyOn(console, "error").mockImplementation(() => { });

            logger.info("test message");
            expect(spy).toHaveBeenCalled();

            logger.warn("warning message");
            expect(spy).toHaveBeenCalled();

            logger.error("error message");
            expect(spy).toHaveBeenCalled();

            spy.mockRestore();
        });
    });
});
