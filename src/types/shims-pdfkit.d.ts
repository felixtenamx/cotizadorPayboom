// pdfkit no incluye types oficiales — declaración mínima para que TypeScript compile.
declare module "pdfkit" {
  const PDFDocument: any;
  export default PDFDocument;
}
