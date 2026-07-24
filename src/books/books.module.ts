import { Module } from '@nestjs/common';
import { BooksService } from './books.service';
import { HttpModule } from '@nestjs/axios';
import { BooksController } from './books.controller';

@Module({
  imports: [HttpModule],
  providers: [BooksService],
  exports: [BooksService],
  controllers: [BooksController],
})
export class BooksModule {}
