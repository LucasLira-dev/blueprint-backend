import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { youtube_v3 } from '@googleapis/youtube';

export interface VideoResult {
  title: string | undefined | null;
  videoUrl: string | undefined;
  videoId: string | undefined;
  thumbnail: string | undefined;
  channelName: string | undefined;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private readonly apiKey = process.env.YOUTUBE_API_KEY;

  constructor(private readonly http: HttpService) {}

  async search(topic: string, count: number = 10): Promise<VideoResult[]> {
    try {
      const { data } = await firstValueFrom<{
        data: youtube_v3.Schema$SearchListResponse;
      }>(
        this.http.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            key: this.apiKey,
            q: topic,
            part: 'snippet',
            maxResults: count,
            type: 'video',
            relevanceLanguage: 'pt',
            safeSearch: 'moderate',
          },
        }),
      );

      return (data.items ?? []).map((item: youtube_v3.Schema$SearchResult) => ({
        title: item?.snippet?.title,
        videoUrl: `https://www.youtube.com/watch?v=${item?.id?.videoId}`,
        videoId: item.id?.videoId ?? undefined,
        thumbnail:
          item?.snippet?.thumbnails?.maxres?.url ??
          item?.snippet?.thumbnails?.standard?.url ??
          item?.snippet?.thumbnails?.high?.url ??
          item?.snippet?.thumbnails?.medium?.url ??
          item?.snippet?.thumbnails?.default?.url ??
          undefined,
        channelName: item?.snippet?.channelTitle ?? undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Error searching for videos about topic "${topic}": ${error}`,
      );
      return [];
    }
  }
}
