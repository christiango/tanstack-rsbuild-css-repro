import { mkdirSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

const pluginEntry = import.meta.resolve("@tanstack/start-plugin-core/rsbuild");
const { registerClientBuildCapture } = await import(
  new URL("./normalized-client-build.js", pluginEntry)
);

export const captureGraph = {
  name: "capture-repro-graph",
  setup(api) {
    const capture = registerClientBuildCapture(api);
    api.processAssets(
      { stage: "report", environments: ["client"] },
      ({ compilation }) => {
        const build = capture.getClientBuild();
        if (!build) throw new Error("Client graph was not captured");
        const chunks = [...build.chunksByFileName.values()].map((chunk) => ({
          file: chunk.fileName,
          imports: chunk.imports,
          css: chunk.css,
          routes: chunk.routeFilePaths.map((file) =>
            relative(process.cwd(), file),
          ),
        }));
        const sourceChunks = [...compilation.chunks]
          .map((chunk) => {
            const modules = [];
            const visit = (module) => {
              const source = module.nameForCondition();
              if (
                source &&
                relative(process.cwd(), source).startsWith("src/")
              ) {
                modules.push({
                  source: relative(process.cwd(), source),
                  staticDependencies: module.dependencies.flatMap(
                    (dependency) => {
                      const target = compilation.moduleGraph
                        .getModule(dependency)
                        ?.nameForCondition();
                      return target &&
                        relative(process.cwd(), target).startsWith("src/")
                        ? [relative(process.cwd(), target)]
                        : [];
                    },
                  ),
                });
              }
              for (const nested of module.modules ?? []) visit(nested);
            };
            for (const module of compilation.chunkGraph.getChunkModules(chunk))
              visit(module);
            return { files: [...chunk.files], modules };
          })
          .filter((chunk) => chunk.modules.length > 0);
        mkdirSync("dist/repro", { recursive: true });
        writeFileSync(
          "dist/repro/graph.json",
          JSON.stringify({ chunks, sourceChunks }, null, 2) + "\n",
        );
      },
    );
  },
};
