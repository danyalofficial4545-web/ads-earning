const DEVICE_MARKER_KEY = "pep-device-marker";

export function getDeviceMarker() {
  const createMarker = () => {
    const randomPart =
      typeof crypto?.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${randomPart}-${Date.now()}`;
  };

  try {
    const existing = localStorage.getItem(DEVICE_MARKER_KEY);
    if (existing) return existing;
    const marker = createMarker();
    localStorage.setItem(DEVICE_MARKER_KEY, marker);
    return marker;
  } catch {
    // Mobile private-mode browsers can block storage. Registration should still
    // reach the server-side validation path instead of failing in the UI.
    return createMarker();
  }
}
