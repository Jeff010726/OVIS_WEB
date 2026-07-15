import { expect, test } from "@playwright/test";

async function readCanvasSignal(page: import("@playwright/test").Page) {
  return page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      return {
        width: 0,
        height: 0,
        visiblePixels: 0,
        hash: 0,
        minY: 0,
        maxY: 0,
      };
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    let visiblePixels = 0;
    let hash = 2166136261;
    let minY = height;
    let maxY = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 24) {
        visiblePixels += 1;
        const y = Math.floor(index / 4 / width);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (index % 388 === 0) {
        hash ^= pixels[index] + pixels[index + 1] * 3 + pixels[index + 2] * 7;
        hash = Math.imul(hash, 16777619) >>> 0;
      }
    }
    return { width, height, visiblePixels, hash, minY, maxY };
  });
}

const deviceInfo = {
  protocol: "ovis-device",
  api_version: 1,
  device_id: "OVIS-1842-00123456",
  name: "OVIS Camera",
  model: "OVIS",
  serial: "OVIS-1842-00123456",
  firmware_version: "1.0.0",
  manager_version: "1.0.0",
};

test("shows the initial connection workspace", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("heading", { name: "设备连接" })).toBeVisible();
  await expect(page.getByRole("button", { name: "连接设备" })).toBeVisible();
  await expect(page.getByText("等待连接")).toBeVisible();
  await expect(page.getByText("参数配置")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/ovis-idle-desktop.png", fullPage: true });
});

test("renders and rotates the optimized product model", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("./");
  const model = page.getByRole("img", { name: "OVIS 相机模组 3D 展示" });
  await expect(model).toHaveAttribute("data-model-status", "ready", {
    timeout: 15_000,
  });
  const canvas = model.locator("canvas");
  await expect(canvas).toBeVisible();

  await page.waitForTimeout(250);
  const firstFrame = await readCanvasSignal(page);
  expect(firstFrame.width).toBeGreaterThan(400);
  expect(firstFrame.height).toBeGreaterThan(400);
  expect(firstFrame.visiblePixels).toBeGreaterThan(
    firstFrame.width * firstFrame.height * 0.02,
  );

  await page.waitForTimeout(900);
  const rotatedFrame = await readCanvasSignal(page);
  expect(rotatedFrame.hash).not.toBe(firstFrame.hash);
  expect(rotatedFrame.minY).toBeGreaterThan(rotatedFrame.height * 0.03);
  expect(rotatedFrame.maxY).toBeLessThan(rotatedFrame.height * 0.97);
  await page.screenshot({ path: "/tmp/ovis-model-framed.png", fullPage: true });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.44, {
      steps: 8,
    });
    await page.mouse.up();
  }
  await page.waitForTimeout(250);
  const draggedFrame = await readCanvasSignal(page);
  expect(draggedFrame.hash).not.toBe(rotatedFrame.hash);
  expect(draggedFrame.minY).toBeGreaterThan(draggedFrame.height * 0.03);
  expect(draggedFrame.maxY).toBeLessThan(draggedFrame.height * 0.97);
  await page.screenshot({ path: "/tmp/ovis-model-desktop.png", fullPage: true });
});

test("connects, displays device metadata, and disconnects locally", async ({
  page,
}) => {
  await page.route("**/api/v1/device/info", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(deviceInfo) }),
  );
  await page.goto("./");
  await page.getByRole("button", { name: "连接设备" }).click();

  await expect(page.getByText("设备在线")).toBeVisible();
  await expect(page.getByRole("heading", { name: "OVIS Camera" })).toBeVisible();
  await expect(page.getByText("OVIS-1842-00123456").first()).toBeVisible();
  await expect(page.getByText("Manager 版本")).toBeVisible();
  await expect(page.getByText("v1", { exact: true })).toBeVisible();
  await page.screenshot({ path: "/tmp/ovis-connected-desktop.png", fullPage: true });

  await page.getByRole("button", { name: "断开连接" }).click();
  await expect(page.getByRole("button", { name: "连接设备" })).toBeVisible();
  await expect(page.getByText("等待连接")).toBeVisible();
});

test("reports an incompatible device API", async ({ page }) => {
  await page.route("**/api/v1/device/info", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...deviceInfo, api_version: 2 }),
    }),
  );
  await page.goto("./");
  await page.getByRole("button", { name: "连接设备" }).click();

  await expect(page.getByText("API 版本不兼容")).toBeVisible();
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
});

test("marks the device disconnected after two heartbeat failures", async ({
  page,
}) => {
  let requestCount = 0;
  await page.route("**/api/v1/device/info", (route) => {
    requestCount += 1;
    if (requestCount === 1) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(deviceInfo),
      });
    }
    return route.abort("connectionrefused");
  });
  await page.goto("./");
  await page.getByRole("button", { name: "连接设备" }).click();

  await expect(page.getByText("设备在线")).toBeVisible();
  await expect(page.getByText("设备连接已中断")).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText("连接已断开")).toBeVisible();
  expect(requestCount).toBe(3);
});

test("keeps the mobile workspace within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");

  await expect(page.getByRole("button", { name: "连接设备" })).toBeVisible();
  const model = page.getByRole("img", { name: "OVIS 相机模组 3D 展示" });
  await expect(model).toHaveAttribute("data-model-status", "ready", {
    timeout: 15_000,
  });
  const canvasSignal = await readCanvasSignal(page);
  expect(canvasSignal.visiblePixels).toBeGreaterThan(
    canvasSignal.width * canvasSignal.height * 0.02,
  );
  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    contentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.contentWidth).toBe(dimensions.viewportWidth);
  await page.screenshot({ path: "/tmp/ovis-idle-mobile.png", fullPage: true });
});
