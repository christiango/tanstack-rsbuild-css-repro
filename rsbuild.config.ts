import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { captureGraph } from "./scripts/capture-graph.mjs";

export default defineConfig({
  plugins: [pluginReact(), tanstackStart(), captureGraph],
  tools: {
    rspack(config, { environment }) {
      if (environment.name !== "client") return;
      config.optimization ??= {};
      if (process.env.REPRO_SHARED === "0") {
        config.optimization.splitChunks = false;
        return;
      }
      config.optimization.splitChunks = {
        cacheGroups: {
          shared: {
            test: /[\\/]src[\\/]components[\\/]/,
            chunks: "async",
            minChunks: 2,
            minSize: 0,
            enforce: true,
            name: "shared-header",
          },
        },
      };
    },
  },
});
