import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);

  private supabase: ReturnType<typeof createClient>;
  private readonly bucketName = 'study-plans';

  onModuleInit() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined',
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadPdf(buffer: Buffer, fileName: string): Promise<string> {
    const filePath = `pdfs/${fileName}`;

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      this.logger.error(`Error uploading PDF: ${error.message}`);
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }

    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }
}
