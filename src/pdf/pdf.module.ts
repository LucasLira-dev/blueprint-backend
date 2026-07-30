import { Module } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { SupabaseStorageModule } from 'src/storage/supabase-storage.module';

@Module({
  imports: [SupabaseStorageModule],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
