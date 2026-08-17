const DEVICE_MARKER_KEY = "pep-device-marker";

export function getDeviceMarker() {
  const existing = localStorage.getItem(DEVICE_MARKER_KEY);
  if (existing) return existing;
  const marker = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  localStorage.setItem(DEVICE_MARKER_KEY, marker);
  return marker;
}
