import assert from "node:assert/strict";
import test from "node:test";

const pluginEntry = import.meta.resolve("@tanstack/start-plugin-core/rsbuild");
const { buildStartManifest } = await import(
  new URL("../start-manifest-plugin/manifestBuilder.js", pluginEntry)
);
const { registerClientBuildCapture } = await import(
  new URL("./normalized-client-build.js", pluginEntry)
);

function makeChunk(name, imports = []) {
  return {
    fileName: `${name}.js`,
    imports,
    css: [`${name}.css`],
    routeFilePaths: [`/${name}.tsx`],
    dynamicImports: [],
    hydrationIds: [],
  };
}

function manifestFromChunks(routes) {
  const root = makeChunk("root");
  return buildStartManifest({
    basePath: "/",
    clientBuild: {
      entryChunkFileName: root.fileName,
      chunksByFileName: new Map(
        [root, ...routes].map((chunk) => [chunk.fileName, chunk]),
      ),
    },
    routeTreeRoutes: {
      __root__: {
        children: routes.map(
          (chunk) => "/" + chunk.fileName.replace(".js", ""),
        ),
      },
      ...Object.fromEntries(
        routes.map((chunk) => [
          "/" + chunk.fileName.replace(".js", ""),
          { filePath: chunk.routeFilePaths[0] },
        ]),
      ),
    },
  });
}

test("each route in a dependency cycle receives every reachable stylesheet", () => {
  const alpha = makeChunk("alpha", ["beta.js"]);
  const beta = makeChunk("beta", ["alpha.js"]);
  for (const order of [
    [alpha, beta],
    [beta, alpha],
  ]) {
    const manifest = manifestFromChunks(order);
    for (const route of ["/alpha", "/beta"]) {
      assert.deepEqual(
        new Set(manifest.routes[route].css),
        new Set(["/alpha.css", "/beta.css"]),
      );
    }
  }
});

test("acyclic dependencies retain route isolation", () => {
  const manifest = manifestFromChunks([
    makeChunk("alpha", ["shared.js"]),
    makeChunk("beta", ["shared.js"]),
    makeChunk("shared"),
  ]);
  assert.deepEqual(
    new Set(manifest.routes["/alpha"].css),
    new Set(["/alpha.css", "/shared.css"]),
  );
  assert.deepEqual(
    new Set(manifest.routes["/beta"].css),
    new Set(["/beta.css", "/shared.css"]),
  );
  assert.deepEqual(manifest.routes.__root__.css, ["/root.css"]);
});

test("a shared chunk does not import the routes consuming it", () => {
  const makeModule = (name, dependencies = []) => ({
    identifier: () => `/${name}.tsx?tsr-split=component`,
    nameForCondition: () => `/${name}.tsx`,
    dependencies,
  });
  const shared = makeModule("shared");
  const alpha = makeModule("alpha", [{ target: shared }]);
  const beta = makeModule("beta", [{ target: shared }]);
  const root = makeModule("root");
  const makeRspackChunk = (name) => ({
    name,
    files: new Set([`${name}.js`, `${name}.css`]),
    auxiliaryFiles: new Set(),
    groupsIterable: new Set(),
  });
  const rootChunk = makeRspackChunk("index");
  const alphaChunk = makeRspackChunk("alpha");
  const betaChunk = makeRspackChunk("beta");
  const sharedChunk = makeRspackChunk("shared");
  for (const routeChunk of [alphaChunk, betaChunk]) {
    const group = { chunks: [sharedChunk, routeChunk], childrenIterable: [] };
    routeChunk.groupsIterable.add(group);
    sharedChunk.groupsIterable.add(group);
  }
  const modulesByChunk = new Map([
    [rootChunk, [root]],
    [alphaChunk, [alpha]],
    [betaChunk, [beta]],
    [sharedChunk, [shared]],
  ]);
  let captureBuild;
  const capture = registerClientBuildCapture({
    processAssets: (_options, callback) => {
      captureBuild = callback;
    },
  });
  captureBuild({
    compilation: {
      chunks: [...modulesByChunk.keys()],
      entrypoints: new Map([["index", { chunks: [rootChunk] }]]),
      getAssets: () => [],
      moduleGraph: { getModule: (dependency) => dependency.target },
      chunkGraph: {
        getChunkModules: (chunk) => modulesByChunk.get(chunk),
        getModuleChunksIterable: (module) =>
          [...modulesByChunk]
            .filter(([, modules]) => modules.includes(module))
            .map(([chunk]) => chunk),
      },
    },
  });
  const build = capture.getClientBuild();
  assert.deepEqual(build.chunksByFileName.get("alpha.js").imports, [
    "shared.js",
  ]);
  assert.deepEqual(build.chunksByFileName.get("beta.js").imports, [
    "shared.js",
  ]);
  assert.deepEqual(build.chunksByFileName.get("shared.js").imports, []);
});
