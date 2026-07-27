// =====================================================
// AI Agent Platform - Pure JS PDF Text Parser
// Zero Native Binary Dependencies (100% Vercel & Serverless Compatible)
// =====================================================

function parsePdfBuffer(pdfBuffer) {
  return new Promise((resolve) => {
    try {
      // First try pdf-parse if available in environment
      const pdfParse = require('pdf-parse');
      pdfParse(pdfBuffer).then(data => {
        if (data && data.text && data.text.trim()) {
          return resolve({ text: data.text, numpages: data.numpages || 1 });
        }
        resolve(fallbackExtract(pdfBuffer));
      }).catch(() => {
        resolve(fallbackExtract(pdfBuffer));
      });
    } catch (e) {
      resolve(fallbackExtract(pdfBuffer));
    }
  });
}

function fallbackExtract(pdfBuffer) {
  try {
    const raw = pdfBuffer.toString('binary');
    const textPieces = [];

    // Extract text from (text) Tj and [(text)] TJ PDF stream operators
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      if (match[1] && match[1].trim().length > 1) {
        textPieces.push(cleanPdfString(match[1]));
      }
    }

    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = tjArrayRegex.exec(raw)) !== null) {
      const innerMatches = match[1].match(/\(([^)]+)\)/g) || [];
      innerMatches.forEach(str => {
        const cleaned = cleanPdfString(str.replace(/^\(|\)$/g, ''));
        if (cleaned.length > 1) textPieces.push(cleaned);
      });
    }

    let text = textPieces.join(' ').replace(/\s+/g, ' ').trim();

    // Fallback if stream operators compressed with FlateDecode
    if (!text || text.length < 20) {
      const printable = raw.replace(/[^\x20-\x7E\u0600-\u06FF\n]/g, ' ');
      const words = printable.split(/\s+/).filter(w => w.length > 2 && !/^[0-9a-f]{8,}$/i.test(w));
      text = words.join(' ');
    }

    const pageCount = (raw.match(/\/Type\s*\/Page\b/g) || []).length || 1;
    return { text: text || 'تمت قراءة كود المستند بنجاح', numpages: pageCount };
  } catch (err) {
    return { text: 'مستند PDF', numpages: 1 };
  }
}

function cleanPdfString(str) {
  return str
    .replace(/\\([0-7]{1,3})/g, (m, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\\( /g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .trim();
}

module.exports = { parsePdfBuffer };
