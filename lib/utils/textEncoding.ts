const MOJIBAKE_REPLACEMENTS: Record<string, string> = {
  "Ã¡": "á",
  "Ã©": "é",
  "Ã­": "í",
  "Ã³": "ó",
  Ãº: "ú",
  "Ã": "Á",
  "Ã‰": "É",
  "Ã": "Í",
  "Ã“": "Ó",
  Ãš: "Ú",
  "Ã±": "ñ",
  "Ã‘": "Ñ",
  "Ã¼": "ü",
  Ãœ: "Ü",
  "Â¿": "¿",
  "Â¡": "¡",
  "â€¦": "…",
  "â€™": "’",
  "â€“": "–",
  "â€”": "—",
};

const MOJIBAKE_PATTERN = new RegExp(
  Object.keys(MOJIBAKE_REPLACEMENTS).join("|"),
  "g",
);

export function repairSpanishMojibake(value: string) {
  return value.replace(
    MOJIBAKE_PATTERN,
    (match) => MOJIBAKE_REPLACEMENTS[match] ?? match,
  );
}
