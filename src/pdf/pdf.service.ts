import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { VideoResult } from 'src/youtube/youtube.service';
import { BookResult } from 'src/books/books.service';
import { SupabaseStorageService } from 'src/storage/supabase-storage.service';

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
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(new Error(String(err))));

      doc.fontSize(22).text(`Plano de Estudos: ${topic}`);
      doc.moveDown();

      doc.fontSize(14).text('Cronograma', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11).text(syllabus, { align: 'justify' });
      doc.moveDown();

      doc.fontSize(14).text('Videos recomendados', { underline: true });
      doc.moveDown(0.5);
      videos.forEach((video, index) => {
        doc
          .fontSize(11)
          .text(`${index + 1}. ${video.title} — ${video.channelName ?? ''}`);
        doc
          .fontSize(9)
          .fillColor('blue')
          .text(video.videoUrl ?? 'URL não disponível', {
            link: video.videoUrl,
          });
        doc.fillColor('black').moveDown(0.3);
      });
      doc.moveDown();

      doc.fontSize(14).text('Livros recomendados', { underline: true });
      doc.moveDown(0.5);
      books.forEach((b, i) => {
        doc
          .fontSize(11)
          .text(`${i + 1}. ${b.title} — ${b.authors?.join(', ')}`);
        if (b.infoLink) {
          doc
            .fontSize(9)
            .fillColor('blue')
            .text(b.infoLink ?? 'Link não disponível', { link: b.infoLink });
          doc.fillColor('black');
        }
        doc.moveDown(0.3);
      });

      doc.end();
    });
  }
}
