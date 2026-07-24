import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { books_v1 } from '@googleapis/books';

export interface BookResult {
  title: string | undefined | null;
  authors: string[] | undefined | null;
  description: string | undefined | null;
  infoLink: string | undefined | null;
  thumbnail: string | undefined | null;
}

interface VolumesResponse {
  kind: string;
  totalItems: number;
  items?: books_v1.Schema$Volume[];
}

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);
  private readonly apiKey = process.env.GOOGLE_BOOKS_API_KEY;

  constructor(private readonly http: HttpService) {}

  async searchBooks(topic: string, count: number = 10): Promise<BookResult[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<VolumesResponse>(
          'https://www.googleapis.com/books/v1/volumes',
          {
            params: {
              key: this.apiKey,
              q: topic,
              maxResults: count,
              langRestrict: 'pt',
            },
          },
        ),
      );

      return (data.items ?? []).map((item) => ({
        title: item?.volumeInfo?.title ?? undefined,
        authors: item?.volumeInfo?.authors ?? undefined,
        description: item?.volumeInfo?.description ?? undefined,
        infoLink: item?.volumeInfo?.infoLink ?? undefined,
        thumbnail: item?.volumeInfo?.imageLinks?.thumbnail ?? undefined,
      }));
    } catch (error) {
      this.logger.error(
        `Error searching for books about topic "${topic}": ${error}`,
      );
      return [];
    }
  }
}
