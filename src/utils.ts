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
