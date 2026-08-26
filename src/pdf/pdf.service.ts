import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { VideoResult } from 'src/youtube/youtube.service';
import { BookResult } from 'src/books/books.service';
import { SupabaseStorageService } from 'src/storage/supabase-storage.service';

type LineType = 'h1' | 'h2' | 'bullet' | 'numbered' | 'paragraph' | 'spacer';

interface ParsedLine {
  type: LineType;
  text: string;
}

const TURQUESA = '#0D9488';
const TEXT_DARK = '#1a1a2e';
const TEXT_BODY = '#333333';
const TEXT_MUTED = '#666666';
const TEXT_FOOTER = '#999999';

function parseMarkdownLines(syllabus: string): ParsedLine[] {
  const rawLines = syllabus.split('\n');
  const lines: ParsedLine[] = [];

  for (const raw of rawLines) {
    const trimmed = raw.trimEnd();

    if (trimmed === '') {
      if (lines.length > 0 && lines[lines.length - 1].type !== 'spacer') {
        lines.push({ type: 'spacer', text: '' });
      }
      continue;
    }

    if (/^#{2,3}\s+/.test(trimmed)) {
      lines.push({ type: 'h2', text: trimmed.replace(/^#{2,3}\s+/, '') });
    } else if (/^#\s+/.test(trimmed)) {
      lines.push({ type: 'h1', text: trimmed.replace(/^#\s+/, '') });
    } else if (/^[-*]\s+/.test(trimmed)) {
      lines.push({ type: 'bullet', text: trimmed.replace(/^[-*]\s+/, '') });
    } else if (/^(\d+)\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s+/)!;
      lines.push({
        type: 'numbered',
        text: `${match[1]}. ${trimmed.slice(match[0].length)}`,
      });
    } else {
      lines.push({ type: 'paragraph', text: trimmed });
    }
  }

  return lines;
}

function renderBoldInline(
  doc: PDFKit.PDFDocument,
  text: string,
  baseFontSize: number,
  baseColor: string,
  options?: { lineGap?: number },
) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);

  const hasBold = segments.some((s) => s.startsWith('**') && s.endsWith('**'));

  if (!hasBold) {
    doc
      .font('Helvetica')
      .fontSize(baseFontSize)
      .fillColor(baseColor)
      .text(text, { lineGap: options?.lineGap ?? 0 });
    return;
  }

  for (const segment of segments) {
    if (segment.length === 0) continue;

    const isBold = segment.startsWith('**') && segment.endsWith('**');
    const content = isBold ? segment.slice(2, -2) : segment;

    doc
      .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(baseFontSize)
      .fillColor(baseColor)
      .text(content, {
        lineGap: options?.lineGap ?? 0,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });
  }
}

function renderSyllabus(doc: PDFKit.PDFDocument, lines: ParsedLine[]) {
  const bottomMargin = doc.page.height - doc.page.margins.bottom;
  let prevType: LineType | null = null;

  for (const line of lines) {
    if (line.type === 'spacer') {
      if (prevType !== 'spacer') {
        doc.moveDown(0.4);
      }
      prevType = line.type;
      continue;
    }

    if (doc.y + 30 > bottomMargin) {
      doc.addPage();
    }

    switch (line.type) {
      case 'h1':
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(18).fillColor(TURQUESA);
        doc.text(line.text, { lineGap: 4 });
        doc.moveDown(0.3);
        break;

      case 'h2':
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(14).fillColor(TURQUESA);
        doc.text(line.text, { lineGap: 3 });
        doc.moveDown(0.2);
        break;

      case 'bullet':
        renderBoldInline(doc, `•    ${line.text}`, 11, TEXT_BODY, {
          lineGap: 2,
        });
        break;

      case 'numbered':
        renderBoldInline(doc, `     ${line.text}`, 11, TEXT_BODY, {
          lineGap: 2,
        });
        break;

      case 'paragraph':
        renderBoldInline(doc, line.text, 11, TEXT_BODY, { lineGap: 3 });
        break;
    }

    prevType = line.type;
  }
}

function renderVideoItem(
  doc: PDFKit.PDFDocument,
  video: VideoResult,
  index: number,
) {
  const bottomMargin = doc.page.height - doc.page.margins.bottom;
  if (doc.y + 60 > bottomMargin) {
    doc.addPage();
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(TEXT_DARK)
    .text(`${index + 1}. ${video.title ?? 'Sem título'}`);

  if (video.channelName) {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(TEXT_MUTED)
      .text(video.channelName);
  }

  if (video.videoUrl) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(TURQUESA)
      .text(video.videoUrl, { link: video.videoUrl, underline: true });
  }

  doc.fillColor(TEXT_BODY).moveDown(0.5);
}

function renderBookItem(
  doc: PDFKit.PDFDocument,
  book: BookResult,
  index: number,
) {
  const bottomMargin = doc.page.height - doc.page.margins.bottom;
  if (doc.y + 60 > bottomMargin) {
    doc.addPage();
  }

  const authors = book.authors?.join(', ');
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(TEXT_DARK)
    .text(`${index + 1}. ${book.title ?? 'Sem título'}`);

  if (authors) {
    doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(authors);
  }

  if (book.infoLink) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(TURQUESA)
      .text(book.infoLink, { link: book.infoLink, underline: true });
  }

  doc.fillColor(TEXT_BODY).moveDown(0.5);
}

@Injectable()
export class PdfService {
  constructor(
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  async generate(
    topic: string,
    syllabus: string,
    videos: VideoResult[],
    books: BookResult[],
  ): Promise<string> {
    const buffer = await this.buildPdfBuffer(topic, syllabus, videos, books);
    const fileName = `plano-${topic
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()}-${Date.now()}.pdf`;
    return this.supabaseStorageService.uploadPdf(buffer, fileName);
  }

  private buildPdfBuffer(
    topic: string,
    syllabus: string,
    videos: VideoResult[],
    books: BookResult[],
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', (err) => reject(new Error(String(err))));
      doc.on('end', () => {
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
          doc.switchToPage(i);
          doc.font('Helvetica').fontSize(9).fillColor(TEXT_FOOTER);
          doc.text(`${i + 1} / ${pageCount}`, 0, doc.page.height - 30, {
            align: 'center',
          });
        }
        resolve(Buffer.concat(chunks));
      });

      // Título do plano
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor(TEXT_DARK)
        .text(`Plano de Estudos: ${topic}`, { lineGap: 2 });
      doc.moveDown(1.5);

      // Seção: Cronograma
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(TURQUESA)
        .text('Cronograma', { lineGap: 4 });
      doc.moveDown(0.5);

      const parsedLines = parseMarkdownLines(syllabus);
      renderSyllabus(doc, parsedLines);

      // Seção: Vídeos
      doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(TURQUESA)
        .text('Vídeos Recomendados', { lineGap: 4 });
      doc.moveDown(0.5);

      videos.forEach((video, index) => {
        renderVideoItem(doc, video, index);
      });

      // Seção: Livros
      doc.addPage();
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(TURQUESA)
        .text('Livros Recomendados', { lineGap: 4 });
      doc.moveDown(0.5);

      books.forEach((book, index) => {
        renderBookItem(doc, book, index);
      });

      doc.end();
    });
  }
}
