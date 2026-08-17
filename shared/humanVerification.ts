export const HUMAN_IMAGE_OPTIONS = [
  { id: "apple", label: "Apple", emoji: "🍎" },
  { id: "car", label: "Car", emoji: "🚗" },
  { id: "house", label: "House", emoji: "🏠" },
  { id: "star", label: "Star", emoji: "⭐" },
] as const;

export type HumanImageOptionId = (typeof HUMAN_IMAGE_OPTIONS)[number]["id"];

export function humanImagePrompt(optionId: HumanImageOptionId) {
  const option = HUMAN_IMAGE_OPTIONS.find(item => item.id === optionId);
  return `Select the ${option?.label ?? "Apple"} image.`;
}
