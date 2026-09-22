export function formatMoney(amount: number): string {
  const isWholeNumber = amount % 1 === 0;
  const options = {
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: isWholeNumber ? 0 : 2,
    useGrouping: true,
  };
  return new Intl.NumberFormat("es-AR", options).format(amount);
}

/** Interpreta importes argentinos o internacionales sin confundir 5.000 con 5. */
export function parseMoneyInput(value: string): number | null {
  const compact = value
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!compact || compact.startsWith("-") || !/\d/.test(compact)) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    normalized = compact.split(groupingSeparator).join("");
    normalized = normalized.replace(decimalSeparator, ".");
  } else {
    const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
    if (separator) {
      const groups = compact.split(separator);
      const lastGroup = groups.at(-1) ?? "";
      const isThousandsGrouping =
        groups.length > 2
          ? groups.slice(1).every((group) => group.length === 3)
          : groups.length === 2 && lastGroup.length === 3;
      normalized = isThousandsGrouping
        ? groups.join("")
        : `${groups.slice(0, -1).join("")}.${lastGroup}`;
    }
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}
