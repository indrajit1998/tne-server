function formatDuration(startDate: string, endDate: string) {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();

  if (end < start) throw new Error("End date cannot be before start date");

  let diffMs = end - start;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  diffMs -= days * 1000 * 60 * 60 * 24;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  diffMs -= hours * 1000 * 60 * 60;

  const minutes = Math.floor(diffMs / (1000 * 60));
  diffMs -= minutes * 1000 * 60;

  const parts = [];
  if (days) parts.push(`${days} day${days > 1 ? "s" : ""}`);
  if (hours) parts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
  if (minutes) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);

  return parts.join(" ");
}

function calculateVolumetricWeight(
  length: number,
  width: number,
  height: number,
  unit: "cm" | "in" = "cm"
) {
  if (unit === "in") {
    length *= 2.54;
    width *= 2.54;
    height *= 2.54;
  }
  let volumetricWeight = (length * width * height) / 5000; // in kg

  return volumetricWeight;
}

export { formatDuration, calculateVolumetricWeight };
