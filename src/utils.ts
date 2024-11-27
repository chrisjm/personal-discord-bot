// Format date into "YYYY-MM-DD (hh:mm AM/PM TZ)"
export const formatDate = (date: Date) =>
  date
    .toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    })
    .replace(",", "")
    .replace(" ", " (")
    .replace(" ", " ") + ")";

export function formatDateHumanReadable(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export const getChangeColor = function (change: number): number {
  // First check if it's already in 0-1 range
  const normalizedValue = (change >= 0 && change <= 1)
    ? change
    : (change >= -1 && change <= 1)
      ? (change + 1) / 2
      : change;

  const roundedChange = Math.round(normalizedValue * 100) / 100;

  const greenShades = [
    0xccffcc, // Very light green
    0x99ff99, // Light green
    0x66cc66, // Medium light green
    0x339933, // Medium green
    0x006600, // Dark green
  ];

  const redShades = [
    0xffcccc, // Very light red
    0xff9999, // Light red
    0xff6666, // Medium light red
    0xff3333, // Medium red
    0xcc0000, // Dark red
  ];

  if (roundedChange === 0.5) {
    return 0xffffff; // White (neutral)
  }

  if (roundedChange > 0.5) {
    // Map 0.5-1 range to 0-1 for green shades
    const normalizedChange = (roundedChange - 0.5) * 2;
    const index = Math.min(Math.floor(normalizedChange * 5), 4);
    return greenShades[index];
  }

  // Map 0-0.5 range to 0-1 for red shades
  const normalizedChange = (0.5 - roundedChange) * 2;
  const index = Math.min(Math.floor(normalizedChange * 5), 4);
  return redShades[index];
}
