const DEVICE_IMAGES_BY_MODEL: Record<string, string> = {
  OVIS: `${import.meta.env.BASE_URL}images/devices/ovis.png`,
};

export function getDeviceImage(model: string): string | null {
  return DEVICE_IMAGES_BY_MODEL[model.trim().toUpperCase()] ?? null;
}
