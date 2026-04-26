(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
    return;
  }
  root.AigsChatMarkdown = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function createTools(options) {
    const settings = options || {};
    const escapeHtml = typeof settings.escapeHtml === 'function'
      ? settings.escapeHtml
      : function defaultEscapeHtml(str) {
          return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        };
    const getOrigin = typeof settings.getOrigin === 'function'
      ? settings.getOrigin
      : function defaultOrigin() {
          return 'http://localhost';
        };

    function normalizeChatMarkdownText(value) {
      return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/^\s*---+\s*$/gm, '')
        .replace(/^\s*[•·]\s*(#{1,3}\s+)/gm, '$1')
        .replace(/^\s*\*\*(#{1,3}\s+.+?)\*\*\s*$/gm, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function renderChatCodeBlock(language, code) {
      const langLabel = String(language || '').trim();
      return '\n      <div class="chat-code-block">\n        <div class="chat-code-header">\n          <span>' + (langLabel || '代码') + '</span>\n          <button class="chat-code-copy" type="button">复制代码</button>\n        </div>\n        <pre><code>' + code + '</code></pre>\n      </div>\n    ';
    }

    function renderChatFormulaSegment(rawFormula, mode) {
      const formula = String(rawFormula || '').trim();
      const className = mode === 'block' ? 'chat-formula-block' : 'chat-formula-inline';
      return '<span class="' + className + '">' + escapeHtml(formula) + '</span>';
    }

    function protectChatFormulaSegments(text) {
      const formulas = [];
      const placeholderPrefix = '__CHAT_FORMULA_';
      let nextText = String(text || '');

      function stashFormula(formula, mode) {
        const placeholder = placeholderPrefix + formulas.length + '__';
        formulas.push(renderChatFormulaSegment(formula, mode));
        return placeholder;
      }

      nextText = nextText
        .replace(/\\\[([\s\S]+?)\\\]/g, function (_, formula) { return stashFormula(formula, 'block'); })
        .replace(/\$\$([\s\S]+?)\$\$/g, function (_, formula) { return stashFormula(formula, 'block'); })
        .replace(/\\\(([\s\S]+?)\\\)/g, function (_, formula) { return stashFormula(formula, 'inline'); })
        .replace(/(^|[^\$])\$([^\n$]+?)\$/g, function (_, prefix, formula) { return '' + prefix + stashFormula(formula, 'inline'); });

      return { text: nextText, formulas: formulas, placeholderPrefix: placeholderPrefix };
    }

    function restoreChatFormulaSegments(text, formulas, placeholderPrefix) {
      let restored = String(text || '');
      const prefix = placeholderPrefix || '__CHAT_FORMULA_';
      (formulas || []).forEach(function (formulaHtml, index) {
        restored = restored.replaceAll(prefix + index + '__', formulaHtml);
      });
      return restored;
    }

    function applyInlineMarkdown(text) {
      function sanitizeLinkUrl(rawUrl) {
        try {
          const parsed = new URL(rawUrl, getOrigin());
          return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '#';
        } catch {
          return '#';
        }
      }

      const protectedFormula = protectChatFormulaSegments(text);
      const rendered = protectedFormula.text
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) { return '<a href="' + sanitizeLinkUrl(href) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'; })
        .replace(/\*\*(.+?)\*\*|__(.+?)__/g, '<strong>$1$2</strong>')
        .replace(/\*(.+?)\*|_(.+?)_/g, '<em>$1$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        .replace(/\*\*/g, '')
        .replace(/(^|>|\s)#{1,3}(?=\s*#|\s*$)/g, '$1');
      return restoreChatFormulaSegments(rendered, protectedFormula.formulas, protectedFormula.placeholderPrefix);
    }

    function getMarkdownTableCells(line) {
      const normalized = String(line || '').trim().replace(/^\|/, '').replace(/\|$/, '');
      return normalized.split('|').map(function (cell) { return cell.trim(); });
    }

    function isMarkdownTableSeparator(line) {
      const cells = getMarkdownTableCells(line);
      return cells.length > 1 && cells.every(function (cell) { return /^:?-{3,}:?$/.test(cell); });
    }

    function isMarkdownTableStart(lines, index) {
      const current = String(lines[index] || '').trim();
      const next = String(lines[index + 1] || '').trim();
      return current.includes('|') && next.includes('|') && isMarkdownTableSeparator(next);
    }

    function renderChatMarkdownTable(tableLines) {
      const headerCells = getMarkdownTableCells(tableLines[0]);
      const bodyRows = tableLines.slice(2).map(getMarkdownTableCells);
      const columnCount = Math.max.apply(Math, [headerCells.length].concat(bodyRows.map(function (row) { return row.length; })));
      function normalizeRow(row) {
        return Array.from({ length: columnCount }, function (_, index) { return row[index] || ''; });
      }

      const headerHtml = normalizeRow(headerCells)
        .map(function (cell) { return '<th>' + applyInlineMarkdown(cell) + '</th>'; })
        .join('');
      const bodyHtml = bodyRows
        .map(function (row) { return '<tr>' + normalizeRow(row).map(function (cell) { return '<td>' + applyInlineMarkdown(cell) + '</td>'; }).join('') + '</tr>'; })
        .join('');

      return '\n      <div class="chat-table-wrap">\n        <table>\n          <thead><tr>' + headerHtml + '</tr></thead>\n          <tbody>' + bodyHtml + '</tbody>\n        </table>\n      </div>\n    ';
    }

    function formatChatMessageHtml(text) {
      const normalizedText = normalizeChatMarkdownText(text);
      const escapedText = escapeHtml(normalizedText);
      const codeBlocks = [];
      const placeholderPrefix = '__CHAT_CODE_BLOCK_';
      const withPlaceholders = escapedText.replace(/```([\w-]+)?\n?([\s\S]*?)```/g, function (_, language, code) {
        const placeholder = placeholderPrefix + codeBlocks.length + '__';
        codeBlocks.push(renderChatCodeBlock(language, String(code || '').replace(/\n$/, '')));
        return placeholder;
      });

      const lines = withPlaceholders.split('\n');
      const blocks = [];
      let index = 0;

      function isSpecialBlockStart(line) {
        const trimmed = String(line || '').trim();
        return Boolean(
          trimmed.startsWith(placeholderPrefix) ||
          isMarkdownTableStart(lines, index) ||
          /^#{1,3}\s+/.test(trimmed) ||
          /^&gt;\s?/.test(trimmed) ||
          /^[-*]\s+/.test(trimmed) ||
          /^\d+\.\s+/.test(trimmed)
        );
      }

      while (index < lines.length) {
        const currentLine = lines[index];
        const trimmed = String(currentLine || '').trim();

        if (!trimmed) {
          index += 1;
          continue;
        }

        if (trimmed.startsWith(placeholderPrefix)) {
          blocks.push(trimmed);
          index += 1;
          continue;
        }

        if (isMarkdownTableStart(lines, index)) {
          const tableLines = [lines[index], lines[index + 1]];
          index += 2;
          while (index < lines.length) {
            const tableLine = String(lines[index] || '').trim();
            if (!tableLine || !tableLine.includes('|') || isSpecialBlockStart(lines[index])) break;
            tableLines.push(lines[index]);
            index += 1;
          }
          blocks.push(renderChatMarkdownTable(tableLines));
          continue;
        }

        const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          const level = Math.min(3, headingMatch[1].length);
          blocks.push('<h' + level + '>' + applyInlineMarkdown(headingMatch[2]) + '</h' + level + '>');
          index += 1;
          continue;
        }

        if (/^&gt;\s?/.test(trimmed)) {
          const quoteLines = [];
          while (index < lines.length && /^&gt;\s?/.test(String(lines[index] || '').trim())) {
            quoteLines.push(String(lines[index] || '').trim().replace(/^&gt;\s?/, ''));
            index += 1;
          }
          blocks.push('<blockquote>' + quoteLines.map(function (line) { return applyInlineMarkdown(line); }).join('<br>') + '</blockquote>');
          continue;
        }

        if (/^[-*]\s+/.test(trimmed)) {
          const items = [];
          while (index < lines.length && /^[-*]\s+/.test(String(lines[index] || '').trim())) {
            items.push(String(lines[index] || '').trim().replace(/^[-*]\s+/, ''));
            index += 1;
          }
          blocks.push('<ul>' + items.map(function (item) { return '<li>' + applyInlineMarkdown(item) + '</li>'; }).join('') + '</ul>');
          continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
          const items = [];
          while (index < lines.length && /^\d+\.\s+/.test(String(lines[index] || '').trim())) {
            items.push(String(lines[index] || '').trim().replace(/^\d+\.\s+/, ''));
            index += 1;
          }
          blocks.push('<ol>' + items.map(function (item) { return '<li>' + applyInlineMarkdown(item) + '</li>'; }).join('') + '</ol>');
          continue;
        }

        const paragraphLines = [];
        while (index < lines.length) {
          const line = String(lines[index] || '');
          if (!line.trim()) break;
          if (paragraphLines.length > 0 && isSpecialBlockStart(line)) break;
          paragraphLines.push(line.trim());
          index += 1;
        }
        blocks.push('<p>' + paragraphLines.map(function (line) { return applyInlineMarkdown(line); }).join('<br>') + '</p>');
      }

      let html = blocks.join('');
      codeBlocks.forEach(function (codeBlockHtml, codeIndex) {
        html = html.replace(placeholderPrefix + codeIndex + '__', codeBlockHtml);
      });
      return html || '<p></p>';
    }

    return {
      normalizeChatMarkdownText,
      renderChatCodeBlock,
      renderChatFormulaSegment,
      protectChatFormulaSegments,
      restoreChatFormulaSegments,
      applyInlineMarkdown,
      getMarkdownTableCells,
      isMarkdownTableSeparator,
      isMarkdownTableStart,
      renderChatMarkdownTable,
      formatChatMessageHtml
    };
  }

  return {
    createTools
  };
}));
