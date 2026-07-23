import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { YoutubeService, VideoResult } from './youtube.service';

const mockHttpService = {
  get: jest.fn(),
};

describe('YoutubeService', () => {
  let service: YoutubeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();

    service = module.get<YoutubeService>(YoutubeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return mapped videos on success', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            id: { videoId: 'abc123' },
            snippet: {
              title: 'Video Teste',
              channelTitle: 'Canal Teste',
              thumbnails: {
                default: { url: 'https://thumb.url' },
              },
            },
          },
          {
            id: { videoId: 'def456' },
            snippet: {
              title: 'Outro Video',
              channelTitle: 'Outro Canal',
              thumbnails: {},
            },
          },
        ],
      },
    };

    mockHttpService.get.mockReturnValue(of(mockResponse));

    const result = await service.search('teste', 2);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual<VideoResult>({
      title: 'Video Teste',
      videoUrl: 'https://www.youtube.com/watch?v=abc123',
      thumbnail: 'https://thumb.url',
      channelName: 'Canal Teste',
    });
    expect(result[1]).toEqual<VideoResult>({
      title: 'Outro Video',
      videoUrl: 'https://www.youtube.com/watch?v=def456',
      thumbnail: undefined,
      channelName: 'Outro Canal',
    });
  });

  it('should return empty array when no items', async () => {
    mockHttpService.get.mockReturnValue(of({ data: { items: [] } }));

    const result = await service.search('teste');

    expect(result).toEqual([]);
  });

  it('should return empty array on error', async () => {
    mockHttpService.get.mockReturnValue(
      throwError(() => new Error('API error')),
    );

    const result = await service.search('teste');

    expect(result).toEqual([]);
  });
});
