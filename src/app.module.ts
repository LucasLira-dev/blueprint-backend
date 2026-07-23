import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './lib/auth';
import { YoutubeService } from './youtube/youtube.service';
import { YoutubeModule } from './youtube/youtube.module';

@Module({
  imports: [AuthModule.forRoot({ auth }), YoutubeModule],
  controllers: [AppController],
  providers: [AppService, YoutubeService],
})
export class AppModule {}
