/**
 * Utils.gs
 * Helper functions for the Google News Tracker project.
 */

/**
 * Gets a script property by key.
 * @param {string} key The property key.
 * @return {string|null} The property value or null if not found.
 */
function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * Sets a script property.
 * @param {string} key The property key.
 * @param {string} value The property value.
 */
function setScriptProperty(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

/**
 * Parses an Atom/RSS date string into a Date object.
 * Handles ISO 8601 and common RSS formats.
 * @param {string} dateString The date string from the feed.
 * @return {Date} The parsed Date object.
 */
function parseDate(dateString) {
  return new Date(dateString);
}

/**
 * Truncates text to a specified length, adding ellipsis if needed.
 * @param {string} text The text to truncate.
 * @param {number} length The maximum length.
 * @return {string} The truncated text.
 */
function truncateText(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length - 3) + '...';
}

/**
 * Checks if a date is within the last N days.
 * @param {Date} date The date to check.
 * @param {number} days Number of days to look back.
 * @return {boolean} True if within range.
 */
function isWithinLastNDays(date, days) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  return date >= cutoff;
}

/**
 * Extracts text content from HTML string (simple strip tags).
 * @param {string} html The HTML string.
 * @return {string} Plain text.
 */
function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
