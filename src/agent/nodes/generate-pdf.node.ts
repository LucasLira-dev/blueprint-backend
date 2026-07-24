import { LangGraphRunnableConfig } from '@langchain/langgraph';
import { PdfService } from 'src/pdf/pdf.service';
import { StudyPlanStateType } from '../state/study-plan.state';

export function buildGeneratePdfNode(pdfService: PdfService) {
  return async (state: StudyPlanStateType, config: LangGraphRunnableConfig) => {
    config.writer?.({
      step: 'generatePdf',
      status: 'start',
      label: 'Gerando o PDF do plano de estudos...',
    });

    const pdfUrl = await pdfService.generate(
      state.topic,
      state.syllabus,
      state.videos,
      state.books,
    );

    config.writer?.({
      step: 'generatePdf',
      status: 'done',
      label: 'O PDF do plano de estudos foi gerado com sucesso.',
    });

    return { pdfUrl };
  };
}
