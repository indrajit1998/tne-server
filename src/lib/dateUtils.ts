/**
 * Parse DD/MM/YYYY date format to JavaScript Date object
 * @param dateStr - Date string in DD/MM/YYYY format
 * @returns Date object set to start of day (00:00:00)
 * @throws Error if date format is invalid
 */
export const parseDDMMYYYY = (dateStr: string): Date => {
  const parts = dateStr.split("/");

  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}. Expected DD/MM/YYYY`);
  }

  const day = parseInt(parts[0] as string, 10);
  const month = parseInt(parts[1] as string, 10) - 1; // Month is 0-indexed in JS
  const year = parseInt(parts[2] as string, 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid date components in: ${dateStr}`);
  }

  // Validate ranges
  if (month < 0 || month > 11) {
    throw new Error(`Invalid month: ${parts[1]} in date ${dateStr}`);
  }

  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${parts[0]} in date ${dateStr}`);
  }

  if (year < 1900 || year > 2100) {
    throw new Error(`Invalid year: ${parts[2]} in date ${dateStr}`);
  }

  const date = new Date(year, month, day);

  // Validate the date is actually valid (e.g., not Feb 31)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    throw new Error(`Invalid date: ${dateStr} (date doesn't exist)`);
  }

  return date;
};

/**
 * Get date range for a full day (00:00:00 to 23:59:59.999)
 * @param dateStr - Date string in DD/MM/YYYY format
 * @returns Object with startOfDay and endOfDay Date objects
 */
export const getDateRange = (
  dateStr: string
): { startOfDay: Date; endOfDay: Date } => {
  const startOfDay = parseDDMMYYYY(dateStr);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(startOfDay.getDate() + 1);

  return { startOfDay, endOfDay };
};

/**
 * Format Date object to DD/MM/YYYY string
 * @param date - Date object
 * @returns Formatted date string
 */
export const formatToDDMMYYYY = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};
