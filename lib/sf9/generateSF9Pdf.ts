import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function downloadSF9Pdf(element: HTMLElement, filename: string) {
  const nonPrintable = Array.from(element.querySelectorAll<HTMLElement>('.no-print'));
  const previousDisplay = nonPrintable.map(node => node.style.display);
  nonPrintable.forEach(node => { node.style.display = 'none'; });
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
  } finally {
    nonPrintable.forEach((node, index) => { node.style.display = previousDisplay[index]; });
  }
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 6;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const ratio = Math.min(contentWidth / canvas.width, contentHeight / canvas.height);
  const renderedWidth = canvas.width * ratio;
  const renderedHeight = canvas.height * ratio;
  const x = (pageWidth - renderedWidth) / 2;
  const y = (pageHeight - renderedHeight) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, renderedWidth, renderedHeight, undefined, 'FAST');
  pdf.save(filename);
}
