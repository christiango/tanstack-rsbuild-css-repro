import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run with pnpm verify:repro");

function run(args, env = {}, inherit = true) {
  const result = spawnSync(process.execPath, [pnpm, ...args], {
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  return result;
}

function browserResults() {
  const result = run(
    ["exec", "playwright", "test", "--reporter=json"],
    {},
    false,
  );
  const report = JSON.parse(result.stdout);
  const specs = report.suites.flatMap((suite) => suite.specs);
  return { exit: result.status, specs, errors: report.errors };
}

const unit = spawnSync(
  process.execPath,
  ["--test", "--test-reporter=tap", "tests/manifest.test.mjs"],
  {
    encoding: "utf8",
  },
);
if (unit.error) throw unit.error;
assert.equal(unit.status, 1);
assert.match(unit.stdout, /# pass 1/);
assert.match(unit.stdout, /# fail 2/);
assert.match(unit.stdout, /ERR_ASSERTION/);

assert.equal(run(["build"], { REPRO_SHARED: "1" }).status, 0);
const baselineGraph = JSON.parse(readFileSync("dist/repro/graph.json", "utf8"));
const baseline = browserResults();
assert.equal(
  baseline.exit,
  1,
  "Affected baseline should fail the regression tests",
);
assert.deepEqual(baseline.errors, []);
assert.equal(baseline.specs.length, 3);
assert.equal(baseline.specs.filter((spec) => spec.ok).length, 1);
assert.equal(
  baseline.specs.find((spec) => spec.title.startsWith("home"))?.ok,
  true,
);
const failures = baseline.specs.filter((spec) => !spec.ok);
assert(
  failures.every((spec) =>
    spec.tests.every((entry) =>
      entry.results.every((result) => result.status === "failed"),
    ),
  ),
);
const messages = failures
  .flatMap((spec) =>
    spec.tests.flatMap((entry) =>
      entry.results.flatMap((result) =>
        result.errors.map((error) => error.message),
      ),
    ),
  )
  .join("\n");
assert.match(
  messages,
  /--repro-(alpha|beta)/,
  "Expected unrelated route CSS leakage",
);
assert.match(messages, /grid/, "Expected missing shared header styling");

assert.equal(run(["build"], { REPRO_SHARED: "0" }).status, 0);
const control = browserResults();
assert.equal(
  control.exit,
  0,
  "Same app must pass without shared-chunk extraction",
);
assert.equal(control.specs.length, 3);
assert(control.specs.every((spec) => spec.ok));

assert.equal(run(["build"], { REPRO_SHARED: "1" }).status, 0);
writeFileSync(
  "dist/repro/verification.json",
  JSON.stringify(
    { unit: unit.stdout, baselineGraph, baseline, control },
    null,
    2,
  ) + "\n",
);
console.log(
  "Verified: shared extraction reproduces missing and unrelated CSS; control passes all three browser checks.",
);
console.log(
  "The final build retains the unpatched failing reproduction. Evidence: dist/repro/verification.json",
);
