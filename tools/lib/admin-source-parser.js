// Deterministic admin source parser.
// - Extract inline scripts from admin HTML.
// - Parse script AST and return canonical function declarations.
// - Provide a deterministic fallback parser when AST deps are unavailable.

'use strict';

const path = require('path');

function normalizeNewlines(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

function normalizeWhitespace(value) {
  return normalizeNewlines(value)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function tryRequireModule(name) {
  try {
    return require(name);
  } catch (_) {
    // Fall through to local dependency path.
  }

  try {
    const localPath = path.join(__dirname, '..', '..', 'sale-zone', 'node_modules', name);
    return require(localPath);
  } catch (_) {
    return null;
  }
}

const parse5 = tryRequireModule('parse5');
const acorn = tryRequireModule('acorn');
const astring = tryRequireModule('astring');

function buildLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

function lineForIndex(lineStarts, index) {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lineStarts[mid] <= index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return high + 1;
}

function collectInlineScriptsWithParse5(htmlSource) {
  const scripts = [];
  const rootNode = parse5.parse(htmlSource, { sourceCodeLocationInfo: true });

  function hasSrc(node) {
    const attrs = Array.isArray(node && node.attrs) ? node.attrs : [];
    return attrs.some((attr) => String(attr && attr.name || '').toLowerCase() === 'src');
  }

  function scriptText(node) {
    if (!node || !Array.isArray(node.childNodes)) return '';
    return node.childNodes
      .filter((child) => child && child.nodeName === '#text')
      .map((child) => String(child.value || ''))
      .join('');
  }

  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (String(node.nodeName || '').toLowerCase() === 'script' && !hasSrc(node)) {
      const location = node.sourceCodeLocation || {};
      scripts.push({
        scriptIndex: scripts.length,
        startLine: Number(location.startLine || 1),
        content: normalizeNewlines(scriptText(node))
      });
    }
    if (Array.isArray(node.childNodes)) {
      for (const child of node.childNodes) {
        visit(child);
      }
    }
  }

  visit(rootNode);
  return scripts;
}

function collectInlineScriptsFallback(htmlSource) {
  const source = normalizeNewlines(htmlSource);
  const lower = source.toLowerCase();
  const lineStarts = buildLineStarts(source);
  const scripts = [];
  let cursor = 0;

  while (cursor < source.length) {
    const open = lower.indexOf('<script', cursor);
    if (open < 0) break;

    let i = open + 7;
    let quote = '';
    while (i < source.length) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === '\'') {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      i += 1;
    }
    if (i >= source.length) break;

    const openTag = source.slice(open, i + 1);
    const close = lower.indexOf('</script>', i + 1);
    const end = close >= 0 ? close : source.length;
    if (!/\bsrc\s*=/i.test(openTag)) {
      scripts.push({
        scriptIndex: scripts.length,
        startLine: lineForIndex(lineStarts, open),
        content: source.slice(i + 1, end)
      });
    }
    cursor = close >= 0 ? close + 9 : source.length;
  }

  return scripts;
}

function walkAst(node, visitor) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visitor(node);

  for (const key of Object.keys(node)) {
    const value = node[key];
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry && typeof entry.type === 'string') walkAst(entry, visitor);
      }
      continue;
    }
    if (value && typeof value.type === 'string') walkAst(value, visitor);
  }
}

function parseFunctionsFromScriptAst(script) {
  const source = normalizeNewlines(script && script.content || '');
  if (!source.trim()) return [];

  const ast = acorn.parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    allowHashBang: true,
    locations: true
  });

  const rows = [];
  function pushAstRow(name, isAsync, node) {
    if (!name || !node || !node.loc || !node.loc.start) return;
    const rawBody = normalizeNewlines(source.slice(Number(node.start || 0), Number(node.end || 0))).trim();
    rows.push({
      name: String(name).trim(),
      isAsync: Boolean(isAsync),
      line: Number(script.startLine + node.loc.start.line - 1),
      scriptIndex: Number(script.scriptIndex || 0),
      canonicalBody: normalizeWhitespace(rawBody),
      rawBody
    });
  }

  walkAst(ast, (node) => {
    if (node.type === 'FunctionDeclaration') {
      if (!node.id || !node.id.name) return;
      pushAstRow(node.id.name, node.async, node);
      return;
    }

    if (node.type !== 'VariableDeclaration') return;
    if (!Array.isArray(node.declarations) || node.declarations.length !== 1) return;

    const declaration = node.declarations[0];
    if (!declaration || !declaration.id || declaration.id.type !== 'Identifier') return;
    if (!declaration.init) return;

    const init = declaration.init;
    if (init.type !== 'FunctionExpression' && init.type !== 'ArrowFunctionExpression') return;
    if (init.type === 'ArrowFunctionExpression' && (!init.body || init.body.type !== 'BlockStatement')) return;

    pushAstRow(declaration.id.name, init.async, node);
  });

  return rows;
}

function maskCommentsAndLiterals(code) {
  const source = normalizeNewlines(code);
  const chars = source.split('');
  let i = 0;
  const stateStack = [{ type: 'normal' }];

  function currentState() {
    return stateStack[stateStack.length - 1];
  }

  function pushState(nextState) {
    stateStack.push(nextState);
  }

  function popState() {
    if (stateStack.length > 1) stateStack.pop();
  }

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1] || '';
    const state = currentState();

    if (state.type === 'normal' || state.type === 'template-expression') {
      if (state.type === 'template-expression') {
        if (ch === '{') {
          state.depth += 1;
          i += 1;
          continue;
        }
        if (ch === '}') {
          state.depth -= 1;
          if (state.depth === 0) {
            chars[i] = ' ';
            popState();
            i += 1;
            continue;
          }
          i += 1;
          continue;
        }
      }

      if (ch === '"' || ch === '\'') {
        chars[i] = ' ';
        pushState({ type: 'string', quote: ch });
        i += 1;
        continue;
      }
      if (ch === '`') {
        chars[i] = ' ';
        pushState({ type: 'template' });
        i += 1;
        continue;
      }
      if (ch === '/' && next === '/') {
        chars[i] = ' ';
        chars[i + 1] = ' ';
        pushState({ type: 'line-comment' });
        i += 2;
        continue;
      }
      if (ch === '/' && next === '*') {
        chars[i] = ' ';
        chars[i + 1] = ' ';
        pushState({ type: 'block-comment' });
        i += 2;
        continue;
      }
      if (ch === '/' && isRegexLiteralStart(source, i)) {
        chars[i] = ' ';
        pushState({ type: 'regex' });
        i += 1;
        continue;
      }
      i += 1;
      continue;
    }

    chars[i] = ch === '\n' ? '\n' : ' ';

    if (state.type === 'string') {
      if (ch === '\\') {
        if (i + 1 < source.length) {
          chars[i + 1] = source[i + 1] === '\n' ? '\n' : ' ';
        }
        i += 2;
        continue;
      }
      if (ch === state.quote) {
        popState();
      }
      i += 1;
      continue;
    }

    if (state.type === 'template') {
      if (ch === '\\') {
        if (i + 1 < source.length) {
          chars[i + 1] = source[i + 1] === '\n' ? '\n' : ' ';
        }
        i += 2;
        continue;
      }
      if (ch === '$' && next === '{') {
        chars[i + 1] = ' ';
        pushState({ type: 'template-expression', depth: 1 });
        i += 2;
        continue;
      }
      if (ch === '`') {
        popState();
      }
      i += 1;
      continue;
    }

    if (state.type === 'line-comment') {
      if (ch === '\n') {
        popState();
      }
      i += 1;
      continue;
    }

    if (state.type === 'block-comment') {
      if (ch === '*' && next === '/') {
        chars[i + 1] = ' ';
        popState();
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (state.type === 'regex') {
      if (ch === '\\') {
        if (i + 1 < source.length) {
          chars[i + 1] = source[i + 1] === '\n' ? '\n' : ' ';
        }
        i += 2;
        continue;
      }
      if (ch === '[') {
        pushState({ type: 'regex-class' });
        i += 1;
        continue;
      }
      if (ch === '/') {
        popState();
      }
      i += 1;
      continue;
    }

    if (state.type === 'regex-class') {
      if (ch === '\\') {
        if (i + 1 < source.length) {
          chars[i + 1] = source[i + 1] === '\n' ? '\n' : ' ';
        }
        i += 2;
        continue;
      }
      if (ch === ']') {
        popState();
      }
      i += 1;
      continue;
    }
  }

  return chars.join('');
}

function findMatchingBrace(maskedCode, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < maskedCode.length; i += 1) {
    if (maskedCode[i] === '{') depth += 1;
    if (maskedCode[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function previousSignificantChar(text, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!/\s/.test(text[i])) return text[i];
  }
  return '';
}

function previousSignificantToken(text, index) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = text[i];
    if (/\s/.test(ch)) continue;
    if (/[A-Za-z0-9_$]/.test(ch)) {
      let start = i;
      while (start - 1 >= 0 && /[A-Za-z0-9_$]/.test(text[start - 1])) {
        start -= 1;
      }
      return text.slice(start, i + 1);
    }
    return ch;
  }
  return '';
}

function isRegexLiteralStart(text, index) {
  const token = previousSignificantToken(text, index);
  if (!token) return true;
  if (/^[([{,;:?=!&|^~+\-*%<>]$/.test(token)) return true;
  return /^(return|case|throw|delete|typeof|instanceof|in|of|new|void|do|else|yield|await)$/.test(token);
}

function buildBraceDepthMap(maskedCode) {
  const depthMap = new Array(maskedCode.length);
  let depth = 0;
  for (let i = 0; i < maskedCode.length; i += 1) {
    depthMap[i] = depth;
    if (maskedCode[i] === '{') {
      depth += 1;
    } else if (maskedCode[i] === '}') {
      depth = Math.max(0, depth - 1);
    }
  }
  return depthMap;
}

function parseFunctionsFromScriptFallback(script) {
  const source = normalizeNewlines(script && script.content || '');
  if (!source.trim()) return [];

  const masked = maskCommentsAndLiterals(source);
  const lineStarts = buildLineStarts(masked);
  const rows = [];
  const seenStarts = new Set();
  let match;

  function pushRow(name, start, braceStart, isAsync) {
    if (!name || start < 0 || braceStart < 0 || seenStarts.has(start)) return;
    const braceEnd = findMatchingBrace(masked, braceStart);
    if (braceEnd < 0) return;
    const rawBody = source.slice(start, braceEnd + 1);
    seenStarts.add(start);
    rows.push({
      name: String(name).trim(),
      isAsync: Boolean(isAsync),
      line: Number(script.startLine + lineForIndex(lineStarts, start) - 1),
      scriptIndex: Number(script.scriptIndex || 0),
      canonicalBody: normalizeWhitespace(rawBody),
      rawBody: normalizeNewlines(rawBody).trim()
    });
  }

  const declarationRegex = /\b(async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  while ((match = declarationRegex.exec(masked)) !== null) {
    const start = match.index;
    const prev = previousSignificantChar(masked, start);
    if (/[\w$.=:[(]/.test(prev)) continue;
    const braceStart = masked.indexOf('{', declarationRegex.lastIndex);
    pushRow(match[2], start, braceStart, Boolean(match[1]));
  }

  const assignedFunctionRegex = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(async\s+)?function\b/g;
  while ((match = assignedFunctionRegex.exec(masked)) !== null) {
    const start = match.index;
    const braceStart = masked.indexOf('{', assignedFunctionRegex.lastIndex);
    pushRow(match[1], start, braceStart, Boolean(match[2]));
  }

  const assignedArrowRegex = /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(async\s+)?(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>\s*\{/g;
  while ((match = assignedArrowRegex.exec(masked)) !== null) {
    const start = match.index;
    const braceStart = masked.indexOf('{', assignedArrowRegex.lastIndex - 1);
    pushRow(match[1], start, braceStart, Boolean(match[2]));
  }

  return rows;
}

function sortFunctions(rows) {
  return [...rows].sort((a, b) => {
    const nameA = String(a && a.name || '');
    const nameB = String(b && b.name || '');
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;

    const lineA = Number(a && a.line || 0);
    const lineB = Number(b && b.line || 0);
    if (lineA !== lineB) return lineA - lineB;

    const scriptA = Number(a && a.scriptIndex || 0);
    const scriptB = Number(b && b.scriptIndex || 0);
    return scriptA - scriptB;
  });
}

function parseAdminFunctions(htmlSource) {
  if (!parse5 || !acorn || !astring) {
    const fallbackSource = normalizeNewlines(htmlSource);
    const fallbackScripts = collectInlineScriptsFallback(fallbackSource);
    const fallbackFunctions = [];
    for (const script of fallbackScripts) {
      const parsed = parseFunctionsFromScriptFallback(script);
      fallbackFunctions.push(...parsed);
    }
    return {
      parserMode: 'fallback',
      scriptsCount: fallbackScripts.length,
      functions: sortFunctions(fallbackFunctions)
    };
  }

  const source = normalizeNewlines(htmlSource);
  const scripts = collectInlineScriptsWithParse5(source);
  const functions = [];
  for (const script of scripts) {
    const parsed = parseFunctionsFromScriptAst(script);
    functions.push(...parsed);
  }

  return {
    parserMode: 'ast',
    scriptsCount: scripts.length,
    functions: sortFunctions(functions)
  };
}

module.exports = {
  normalizeNewlines,
  parseAdminFunctions
};
