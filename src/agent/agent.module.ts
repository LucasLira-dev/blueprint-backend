import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { YoutubeModule } from 'src/youtube/youtube.module';
import { BooksModule } from 'src/books/books.module';
import { PdfModule } from 'src/pdf/pdf.module';

@Module({
  imports: [YoutubeModule, BooksModule, PdfModule],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
