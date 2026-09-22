const SIGNATURE_MAX_AGE_SECONDS = 10 * 60;

function parseSignature(header: string) {
  return Object.fromEntries(
    header
      .split(",")
      .map((part) => part.trim().split("=", 2))
      .filter(([key, value]) => Boolean(key && value)),
  );
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function verifyMercadoPagoSignature(input: {
  secret: string;
  signatureHeader: string;
  requestId: string;
  paymentId: string;
  nowSeconds?: number;
}) {
  const { ts, v1 } = parseSignature(input.signatureHeader);
  const timestamp = Number(ts);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (
    !ts ||
    !v1 ||
    !Number.isInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > SIGNATURE_MAX_AGE_SECONDS
  ) {
    return false;
  }

  const manifest =
    `id:${input.paymentId};request-id:${input.requestId};ts:${timestamp};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest),
  );
  const expected = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return timingSafeEqual(expected.toLowerCase(), v1.toLowerCase());
}
