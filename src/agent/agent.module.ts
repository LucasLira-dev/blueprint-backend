import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { PdfService } from 'src/pdf/pdf.service';
import { BooksService } from 'src/books/books.service';
import { YoutubeService } from 'src/youtube/youtube.service';

@Module({
  imports: [YoutubeService, BooksService, PdfService],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
