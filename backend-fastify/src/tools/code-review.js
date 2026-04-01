// Code Review Tool - Analyzes code for bugs, style issues, and improvements

function codeReview(code, language) {
  const issues = [];
  const suggestions = [];

  if (!code || code.trim().length === 0) {
    return { error: 'No code provided' };
  }

  const lang = (language || 'javascript').toLowerCase();

  // Language-agnostic checks
  if (code.includes('eval(')) {
    issues.push({ severity: 'critical', message: 'Use of eval() is a security vulnerability' });
  }
  if (code.includes('innerHTML')) {
    issues.push({ severity: 'high', message: 'innerHTML can lead to XSS vulnerabilities, use textContent or safe DOM methods' });
  }
  if (code.includes('document.write(')) {
    issues.push({ severity: 'high', message: 'document.write() is dangerous and can overwrite the entire page' });
  }

  // JavaScript-specific checks
  if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
    // Check for common JS bugs
    if (/==(?!=)/.test(code)) {
      suggestions.push({ severity: 'medium', message: 'Use === instead of == for strict equality comparison' });
    }
    if (/var\s+/.test(code)) {
      suggestions.push({ severity: 'low', message: 'Consider using let/const instead of var for block scoping' });
    }
    if (code.includes('console.log(') && !code.includes('/*') && !code.includes('//')) {
      suggestions.push({ severity: 'low', message: 'Remove console.log() statements before production' });
    }
    if (code.includes('new Array(')) {
      suggestions.push({ severity: 'low', message: 'Use array literal [] instead of new Array() for clarity' });
    }
    if (code.includes('setTimeout(') && !code.includes('clearTimeout')) {
      suggestions.push({ severity: 'medium', message: 'Consider storing setTimeout ID for cleanup to prevent memory leaks' });
    }
    if (code.includes('fetch(') && !code.includes('.catch') && !code.includes('try')) {
      suggestions.push({ severity: 'medium', message: 'Add error handling for fetch() calls' });
    }
    if (code.includes('JSON.parse(') && !code.includes('try')) {
      suggestions.push({ severity: 'medium', message: 'Wrap JSON.parse() in try/catch to handle invalid JSON' });
    }
    if (code.includes('for (') && code.includes('.length')) {
      suggestions.push({ severity: 'low', message: 'Cache array.length in a variable for better performance in loops' });
    }
  }

  // Python-specific checks
  if (lang === 'python' || lang === 'py') {
    if (code.includes('import os') && code.includes('os.system(')) {
      issues.push({ severity: 'critical', message: 'os.system() is vulnerable to command injection, use subprocess.run() instead' });
    }
    if (code.includes('pickle.load(')) {
      issues.push({ severity: 'high', message: 'pickle.load() can execute arbitrary code, consider using json or safer alternatives' });
    }
    if (/except\s*:/.test(code)) {
      suggestions.push({ severity: 'medium', message: 'Bare except clause catches all exceptions including SystemExit and KeyboardInterrupt. Use except Exception:' });
    }
    if (code.includes('input(') && code.includes('eval(')) {
      issues.push({ severity: 'critical', message: 'eval(input()) allows arbitrary code execution' });
    }
    if (code.includes('open(') && !code.includes('with ')) {
      suggestions.push({ severity: 'low', message: 'Use context manager (with open(...)) to ensure files are properly closed' });
    }
  }

  // General code quality
  const lineCount = code.split('\n').length;
  if (lineCount > 100) {
    suggestions.push({ severity: 'low', message: `Function is ${lineCount} lines long. Consider breaking it into smaller functions` });
  }

  return {
    language: lang,
    lines: lineCount,
    issues,
    suggestions,
    summary: issues.length === 0 && suggestions.length === 0
      ? 'No issues found'
      : `Found ${issues.length} issue(s) and ${suggestions.length} suggestion(s)`,
  };
}

module.exports = { codeReview };
