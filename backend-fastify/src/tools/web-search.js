// Web Search Tool - Uses DuckDuckGo HTML search (no API key needed)

function extractRealUrl(ddgUrl) {
  try {
    const url = new URL(ddgUrl, 'https://duckduckgo.com');
    const uddg = url.searchParams.get('uddg');
    if (uddg) {
      return decodeURIComponent(uddg);
    }
  } catch {}
  return ddgUrl;
}

async function webSearch(query) {
  try {
    const encoded = encodeURIComponent(query);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encoded}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return { error: `Search failed with status ${response.status}` };
    }

    const html = await response.text();
    const results = [];

    const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs;
    let match;
    while ((match = resultRegex.exec(html)) !== null) {
      results.push({
        url: extractRealUrl(match[1]),
        title: match[2].replace(/<[^>]*>/g, '').trim(),
        snippet: match[3].replace(/<[^>]*>/g, '').trim(),
      });
      if (results.length >= 5) break;
    }

    if (results.length === 0) {
      return { results: [], message: 'No results found' };
    }

    return {
      query,
      count: results.length,
      results,
    };
  } catch (err) {
    return { error: `Web search failed: ${err.message}` };
  }
}

module.exports = { webSearch };
