import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: false });

for (const route of ["alpha", "beta"]) {
  test(`${route} has complete and isolated CSS before hydration`, async ({
    page,
  }) => {
    await page.goto(`/${route}`);
    const stylesheets = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    console.log(route, stylesheets);
    await expect.soft(page.locator("header")).toHaveCSS("display", "grid");
    await expect.soft(page.locator("header")).toHaveCSS("height", "64px");
    await expect.soft(page.locator("main")).toHaveCSS(`--repro-${route}`, "1");
    const otherRoute = route === "alpha" ? "beta" : "alpha";
    const css = await Promise.all(
      stylesheets.map(async (href) => {
        if (!href) throw new Error("Stylesheet is missing href");
        return (await page.request.get(href)).text();
      }),
    );
    expect(css.join("\n")).not.toContain(`--repro-${otherRoute}`);
  });
}

test("home does not load document styles", async ({ page }) => {
  await page.goto("/");
  const stylesheets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  for (const href of stylesheets) {
    if (!href) throw new Error("Stylesheet is missing href");
    const css = await (await page.request.get(href)).text();
    expect(css).not.toContain("--repro-shared-header");
  }
});
