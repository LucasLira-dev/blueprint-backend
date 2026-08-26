import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { YoutubeService } from 'src/youtube/youtube.service';
import { StudyPlanStateType } from '../state/study-plan.state';

export function buildFetchVideosNode(youtubeService: YoutubeService) {
  return async (state: StudyPlanStateType, config: LangGraphRunnableConfig) => {
    config.writer?.({
      step: 'fetchVideos',
      status: 'start',
      label: 'Buscando os 10 melhores videos sobre o tema...',
    });

    const videos = await youtubeService.search(state.search.subject, 10);

    config.writer?.({
      step: 'fetchVideos',
      status: 'done',
      label: `Foram encontrados ${videos.length} videos sobre o tema "${truncar(state.topic, 50)}".`,
    });

    return { videos };
  };
}

export function truncar(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;

  return text.slice(0, maxLength - 3).trimEnd() + '...';
}
