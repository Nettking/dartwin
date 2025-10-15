export const formatLabel = (label: string) => {
  if (!label) return "";

  const spaced = label
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  const collapsed = spaced.replace(/\b([A-Z])\s+([A-Z])\b/g, "$1$2");

  return collapsed
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z]+$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
};

export const formatPortLabel = (label: string) => {
  let pretty = formatLabel(label);
  pretty = pretty.replace(/Multi Sensor/i, "Multi-sensor");
  return pretty;
};
