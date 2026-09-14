function categoryNameKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-AR")
    .replace(/\s+/g, " ")
    .trim();
}

export function uniqueCategoryNames(
  values: Array<string | null | undefined>,
) {
  const unique = new Map<string, string>();

  for (const value of values) {
    const clean = value?.trim();
    if (!clean) continue;
    const key = categoryNameKey(clean);
    if (!unique.has(key)) unique.set(key, clean);
  }

  return Array.from(unique.values()).sort((a, b) =>
    a.localeCompare(b, "es-AR", { sensitivity: "base" }),
  );
}
