import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to prevent XSS attacks while allowing rich text formatting.
 * @param {string} dirtyHtml - The untrusted HTML string to sanitize.
 * @returns {string} - The sanitized HTML string safe for dangerouslySetInnerHTML.
 */
export const sanitizeHtml = (dirtyHtml) => {
  if (!dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'img', 'span', 'div'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
  });
};

/**
 * Specifically for CSS injection in <style> tags
 * A very rudimentary approach - DOMPurify isn't ideal for CSS directly, 
 * but for our style tag injection, we just need to strip potentially harmful characters.
 * Alternatively, we could just avoid putting user input into a <style> tag, 
 * but we will provide a basic sanitizer for the community theme CSS.
 */
export const sanitizeCss = (dirtyCss) => {
  if (!dirtyCss) return '';
  // Remove </style> to prevent breaking out of the style block
  return dirtyCss.replace(/<\/style>/gi, '');
};
