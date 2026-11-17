// @ts-check
/**
 * @fileoverview Sanitizer Utility (Zero-Sink DOM Armor)
 *
 * Sanitizador estricto contra Cross-Site Scripting (XSS):
 * - Escapa caracteres especiales en texto plano.
 * - Envoltorio semántico contextual para tablas (TR, TD, TBODY) y selectores (OPTION).
 * - Purga activa de listeners inline (on*) y esquemas peligrosos (javascript:, data:text/html).
 * - Renderizado seguro vía DOMParser + replaceChildren() sin asignaciones innerHTML directas.
 */

export class Sanitizer {
  /**
   * Escapa caracteres HTML para texto plano seguro.
   * @param {unknown} str
   * @returns {string}
   */
  static escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Sanitiza URLs para bloquear esquemas ejecutables.
   * @param {string} url
   * @returns {string}
   */
  static sanitizeURL(url) {
    const clean = String(url || '').trim();
    if (/^(?:javascript|vbscript|data):/i.test(clean)) {
      return '#';
    }
    return clean;
  }

  /**
   * Sanitiza un fragmento HTML dinámico preservando su contexto semántico.
   * @param {string} html
   * @returns {string}
   */
  static sanitizeFragment(html) {
    const raw = String(html || '');
    return raw
      .replace(/<\s*\/?\s*(script|iframe|object|embed|applet|meta|base|link|style)\b[^>]*>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src)\s*=\s*(?:"\s*(?:javascript|vbscript):[^"]*"|'\s*(?:javascript|vbscript):[^']*')/gi, ' $1="#"');
  }

  /**
   * Envuelve un fragmento HTML en su contenedor semántico padre para evitar que DOMParser mutile filas o celdas.
   * @param {string} fragment
   * @returns {string}
   */
  static wrapSemanticContext(fragment) {
    const trimmed = String(fragment || '').trim();
    if (/^<tr[\s>]/i.test(trimmed)) {
      return `<table><tbody>${fragment}</tbody></table>`;
    }
    if (/^<t[dh][\s>]/i.test(trimmed)) {
      return `<table><tbody><tr>${fragment}</tr></tbody></table>`;
    }
    if (/^<(?:option|optgroup)[\s>]/i.test(trimmed)) {
      return `<select>${fragment}</select>`;
    }
    return fragment;
  }

  /**
   * Convierte HTML sanitizado en un DocumentFragment seguro usando DOMParser y lista blanca.
   * @param {string} dirtyHtml
   * @returns {DocumentFragment|null}
   */
  static sanitizeToFragment(dirtyHtml) {
    if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
      return null;
    }

    const trimmed = String(dirtyHtml || '').trim();
    const isTableRows = /^<tr[\s>]/i.test(trimmed);
    const isTableCells = /^<t[dh][\s>]/i.test(trimmed);
    const isOptions = /^<(?:option|optgroup)[\s>]/i.test(trimmed);

    const wrapped = this.wrapSemanticContext(this.sanitizeFragment(trimmed));
    const parser = new DOMParser();
    const doc = parser.parseFromString(wrapped, 'text/html');
    const fragment = document.createDocumentFragment();

    const allowedTags = new Set([
      'DIV', 'SPAN', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
      'STRONG', 'B', 'EM', 'I', 'U', 'SMALL', 'BUTTON', 'A', 'IMG',
      'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'NAV', 'MAIN',
      'LABEL', 'INPUT', 'SELECT', 'OPTION', 'OPTGROUP', 'TEXTAREA', 'FORM',
      'SVG', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'POLYGON', 'G'
    ]);

    const allowedAttrs = new Set([
      'class', 'id', 'name', 'type', 'value', 'placeholder', 'for', 'colspan', 'rowspan',
      'disabled', 'checked', 'selected', 'rows', 'cols', 'href', 'title',
      'aria-label', 'aria-hidden', 'aria-selected', 'aria-controls', 'role',
      'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
      'viewbox', 'xmlns', 'src', 'alt', 'target', 'rel', 'step', 'max', 'min',
      'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'style'
    ]);

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const SVG_TAGS = new Set(['SVG', 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'POLYGON', 'G']);

    /**
     * @param {Node} node
     * @param {boolean} inSvg
     * @returns {Node|null}
     */
    function cleanNode(node, inSvg = false) {
      if (node.nodeType === 3) {
        return document.createTextNode(node.textContent || '');
      }
      if (node.nodeType !== 1) {
        return null;
      }

      const el = /** @type {Element} */ (node);
      const tagName = el.tagName.toUpperCase();
      if (!allowedTags.has(tagName)) {
        return null;
      }

      const isSvg = inSvg || SVG_TAGS.has(tagName);
      const cleanEl = isSvg
        ? document.createElementNS(SVG_NS, tagName.toLowerCase())
        : document.createElement(tagName.toLowerCase());

      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const attrName = attr.name.toLowerCase();

        if (attrName.startsWith('on') || attrName === 'formaction') continue;
        if ((attrName === 'href' || attrName === 'src') && /^(?:javascript|vbscript|data):/i.test(attr.value.trim())) {
          continue;
        }

        if (allowedAttrs.has(attrName) || attrName.startsWith('data-')) {
          const outName = attrName === 'viewbox' ? 'viewBox' : attrName;
          cleanEl.setAttribute(outName, attr.value);
        }
      }

      let child = el.firstChild;
      while (child) {
        const cleanedChild = cleanNode(child, isSvg);
        if (cleanedChild) {
          cleanEl.appendChild(cleanedChild);
        }
        child = child.nextSibling;
      }

      return cleanEl;
    }

    let sourceRoot = /** @type {Element|null} */ (doc.body);
    if (isTableRows) {
      sourceRoot = doc.body.querySelector('tbody');
    } else if (isTableCells) {
      sourceRoot = doc.body.querySelector('tr');
    } else if (isOptions) {
      sourceRoot = doc.body.querySelector('select');
    }

    if (!sourceRoot) return fragment;

    let rootChild = sourceRoot.firstChild;
    while (rootChild) {
      const cleaned = cleanNode(rootChild, false);
      if (cleaned) {
        fragment.appendChild(cleaned);
      }
      rootChild = rootChild.nextSibling;
    }

    return fragment;
  }

  /**
   * Asigna HTML sanitizado a un elemento DOM sin usar innerHTML directo.
   * @param {Element|null} target
   * @param {string} html
   */
  static safeSetInnerHTML(target, html) {
    if (!target) return;
    const fragment = this.sanitizeToFragment(html);
    if (fragment && typeof target.replaceChildren === 'function') {
      target.replaceChildren(fragment);
    } else if (typeof target.replaceChildren === 'function' && typeof document !== 'undefined') {
      target.replaceChildren(document.createTextNode(this.escapeHTML(html)));
    }
  }
}
