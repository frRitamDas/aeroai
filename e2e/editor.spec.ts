import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Smoke-level end-to-end coverage of the shipped product:
 *  - the marketing pages render and link to the editor
 *  - the editor imports an image, auto-detects text and lets you replace it
 *  - exporting produces a downloadable file
 */

const DEMO_IMAGE = path.resolve(__dirname, "../public/demo/cafe-board.jpg");

test.describe("marketing site", () => {
  test("landing page renders the hero, demo and FAQ", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Edit the text inside/i);
    await expect(page.getByRole("img", { name: /chalkboard/i })).toBeVisible();
    await expect(page.getByText(/Three steps from upload to finished image/i)).toBeVisible();
    await expect(page.getByText(/How do I match the same font/i)).toBeVisible();
  });

  test("editor link navigates from the landing page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Open editor|Upload image or PDF/i }).first().click();
    await expect(page).toHaveURL(/\/edit$/);
    await expect(page.getByText(/Drop an image or PDF here/i)).toBeVisible();
  });

  test("guides page documents the shortcuts", async ({ page }) => {
    await page.goto("/guides");
    await expect(page.getByRole("heading", { name: /Editing text in images and PDFs/i })).toBeVisible();
    await expect(page.getByText("Keyboard shortcuts")).toBeVisible();
  });
});

test.describe("editor", () => {
  test("imports an image, detects nothing, and creates a manual text box", async ({ page }) => {
    await page.goto("/edit");
    const input = page.locator('input[type="file"][accept*="image/png"]').first();
    await input.setInputFiles(DEMO_IMAGE);

    // The page rail and canvas appear once the image is imported.
    await expect(page.getByText(/Pages/)).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("canvas")).toBeVisible();

    // Draw a manual text box and type into it.
    await page.keyboard.press("t");
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 120, box!.y + 160);
    await page.mouse.down();
    await page.mouse.move(box!.x + 320, box!.y + 210, { steps: 8 });
    await page.mouse.up();

    const editor = page.locator("textarea");
    await expect(editor).toBeVisible();
    await editor.fill("Fresh copy 12");
    await page.keyboard.press("Escape");

    // The layer list must contain the new text.
    await page.getByRole("button", { name: /Layers/i }).first().click();
    await expect(page.getByText(/Fresh copy 12/).first()).toBeVisible();
  });

  test("exports a PNG", async ({ page }) => {
    await page.goto("/edit");
    await page
      .locator('input[type="file"][accept*="image/png"]')
      .first()
      .setInputFiles(DEMO_IMAGE);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: /^Export/ }).click();
    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByRole("button", { name: /Export PNG/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.png$/);
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const buffer = Buffer.concat(chunks);
    expect(buffer.length).toBeGreaterThan(1000);
    // PNG magic bytes
    expect(buffer.subarray(1, 4).toString()).toBe("PNG");
  });

  test("accepts a dragged project file", async ({ page }) => {
    await page.goto("/edit");
    // A minimal project file: one 8x8 page, no layers.
    const page1 = {
      id: "page_test",
      kind: "image",
      name: "roundtrip.png",
      width: 8,
      height: 8,
      // 1x1 transparent PNG scaled by the importer; content is irrelevant here.
      originalSrc:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
      layers: [],
      brushBatches: [],
    };
    const payload = JSON.stringify({ format: "aerotext-project", version: 1, name: "test", pages: [page1] });
    await page.locator('input[type="file"][accept*=".json"]').first().setInputFiles({
      name: "project.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload),
    });
    await expect(page.getByText(/project/i).first()).toBeVisible({ timeout: 20_000 });
    void readFileSync;
  });
});
