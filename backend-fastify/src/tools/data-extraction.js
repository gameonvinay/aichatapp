// Data Extraction Tool - Extracts structured data from text

function extractData(text, type) {
  if (!text || text.trim().length === 0) {
    return { error: 'No text provided' };
  }

  const results = { urls: [], emails: [], phones: [], dates: [], numbers: [], keywords: [] };

  // URLs
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  results.urls = text.match(urlRegex) || [];

  // Emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  results.emails = text.match(emailRegex) || [];

  // Phone numbers
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  results.phones = text.match(phoneRegex) || [];

  // Dates
  const dateRegex = /\b(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\b/gi;
  results.dates = text.match(dateRegex) || [];

  // Numbers with units
  const numberRegex = /\b\d+(?:\.\d+)?\s*(?:%|USD|EUR|GBP|kg|lb|m|km|ft|in|°C|°F)\b/gi;
  results.numbers = text.match(numberRegex) || [];

  // Keywords (frequent words > 3 chars)
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  words.forEach(w => { if (!['this','that','with','have','from','they','been','their','would','there','about','which','could','should','would','other','these','those','what','when','where','after','before','through','between','under','above','below'].includes(w)) { freq[w] = (freq[w] || 0) + 1; } });
  results.keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count }));

  if (type && results[type]) {
    return { [type]: results[type] };
  }

  return results;
}

module.exports = { extractData };
