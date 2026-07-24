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

    const videos = await youtubeService.search(state.topic, 10);

    config.writer?.({
      step: 'fetchVideos',
      status: 'done',
      label: `Foram encontrados ${videos.length} videos sobre o tema "${state.topic}".`,
    });

    return { videos };
  };
}
