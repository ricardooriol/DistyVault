// File parsing utilities
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function parseFile(fileData, fileType) {
  if (fileType === 'pdf') {
    const data = await pdfParse(fileData);
    return data.text;
  } else if (fileType === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: fileData });
    return value;
  } else if (fileType === 'txt') {
    return fileData.toString();
  }
  return '';
}

module.exports = { parseFile };
