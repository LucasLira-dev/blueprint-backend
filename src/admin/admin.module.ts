import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaService } from 'prisma.service';
import { SupabaseStorageService } from 'src/storage/supabase-storage.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PrismaService, SupabaseStorageService],
})
export class AdminModule {}
