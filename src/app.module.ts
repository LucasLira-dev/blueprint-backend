import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { YoutubeService } from './youtube/youtube.service';
import { YoutubeModule } from './youtube/youtube.module';
import { BooksModule } from './books/books.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [AuthModule.forRoot({ auth }), YoutubeModule, BooksModule, HttpModule],
  controllers: [AppController],
  providers: [AppService, YoutubeService],
})
export class AppModule {}
