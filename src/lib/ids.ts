const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford-ish, no ambiguous chars

function encode(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/**
 * Time-prefixed random id: sorts roughly by creation time and is URL friendly.
 * e.g. `req_01j8x7r2k4_9fq3ma`
 */
export function newId(prefix: "req" | "ep" | "dlv"): string {
  const time = Date.now().toString(32).padStart(10, "0");
  const rand = encode(crypto.getRandomValues(new Uint8Array(8)));
  return `${prefix}_${time}${rand}`;
}
