import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { YoutubeService } from './youtube/youtube.service';
import { YoutubeModule } from './youtube/youtube.module';
import { BooksModule } from './books/books.module';
import { HttpModule } from '@nestjs/axios';
import { PdfModule } from './pdf/pdf.module';
import { AgentModule } from './agent/agent.module';
import { StudyPlansModule } from './study-plans/study-plans.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { ConversationsModule } from './conversations/conversations.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 30,
      },
    ]),
    YoutubeModule,
    BooksModule,
    HttpModule,
    PdfModule,
    AgentModule,
    StudyPlansModule,
    AdminModule,
    ConversationsModule,
  ],
  controllers: [AppController],
  providers: [AppService, YoutubeService],
})
export class AppModule {}
