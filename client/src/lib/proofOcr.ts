import { isValidPakistanMobileNumber, normalizePhoneNumber } from "./formValidation";

export function extractPakistanMobileNumbers(text: string) {
  const candidates = text.match(/(?:\+?\s*92|0)?\s*3[\d\s-]{8,14}/g) ?? [];
  return Array.from(
    new Set(candidates.map(normalizePhoneNumber).filter(isValidPakistanMobileNumber))
  );
}

export function proofContainsAccountNumber(
  proofNumbers: string[],
  enteredAccountNumber: string
) {
  const entered = normalizePhoneNumber(enteredAccountNumber);
  return Boolean(entered) && proofNumbers.includes(entered);
}

export async function readPaymentProofNumbers(file: File) {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(file, "eng", {
    logger: () => undefined,
  });
  return extractPakistanMobileNumbers(result.data.text);
}
