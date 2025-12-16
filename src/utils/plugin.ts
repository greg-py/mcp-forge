import { ForgePlugin } from "../core/Forge";

/**
 * Helper function to define a plugin with proper typing.
 *
 * This is a convenience function that provides better IDE support
 * when creating plugins. It simply returns the plugin function as-is.
 *
 * @param plugin - The plugin function to define.
 * @returns The same plugin function with proper typing.
 *
 * @example
 * ```typescript
 * import { definePlugin } from "mcp-forge";
 * import { z } from "zod";
 *
 * export const myPlugin = definePlugin((forge) => {
 *   forge.tool("my_tool", { schema: z.object({}) }, () => "result");
 * });
 * ```
 */
export function definePlugin(plugin: ForgePlugin): ForgePlugin {
    return plugin;
}

/**
 * Helper function to define a configurable plugin factory.
 *
 * Use this when your plugin needs configuration options.
 *
 * @param factory - A function that takes config and returns a plugin.
 * @returns The same factory function with proper typing.
 *
 * @example
 * ```typescript
 * import { definePluginFactory } from "mcp-forge";
 * import { z } from "zod";
 *
 * interface MyPluginConfig {
 *   apiKey: string;
 *   endpoint?: string;
 * }
 *
 * export const myPlugin = definePluginFactory<MyPluginConfig>((config) => (forge) => {
 *   forge.tool("call_api", { schema }, async () => {
 *     return fetch(config.endpoint ?? "https://api.example.com", {
 *       headers: { Authorization: config.apiKey }
 *     });
 *   });
 * });
 *
 * // Usage
 * forge.plugin(myPlugin({ apiKey: "..." }));
 * ```
 */
export function definePluginFactory<T>(
    factory: (config: T) => ForgePlugin
): (config: T) => ForgePlugin {
    return factory;
}
