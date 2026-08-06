import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

type Role = 'admin' | 'user';

// Configurar pool de conexões para Neon
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not defined.');
}

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL environment variable is not defined.');
}

const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
const isHttpsFrontend = frontendUrl.startsWith('https://');

const pool = new Pool({ connectionString });

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  additionalFields: {
    role: {
      type: 'string',
      required: true,
      defaultValue: 'user',
      input: false,
    },
  },
  databaseHooks: {
    user: {
      delete: {
        before: async ({ data }) => {
          const { id: userId } = data as { id: string };

          const plans = await prisma.studyPlan.findMany({
            where: { userId },
            select: { pdfUrl: true },
          });

          for (const plan of plans) {
            if (plan.pdfUrl) {
              const url = new URL(plan.pdfUrl);
              const pathParts = url.pathname.split('/');
              const bucketIndex = pathParts.indexOf('study-plans');
              const filePath = pathParts.slice(bucketIndex + 1).join('/');

              const { createClient } = await import('@supabase/supabase-js');
              const supabase = createClient(
                process.env.SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
              );

              await supabase.storage.from('study-plans').remove([filePath]);
            }
          }
        },
      },
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  trustedOrigins: [frontendUrl],
  advanced: {
    defaultCookieAttributes: {
      sameSite: isHttpsFrontend ? 'None' : 'Lax',
      secure: isHttpsFrontend,
    },
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  basePath: '/api/auth',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [
    admin({
      defaultRole: 'user' as Role,
      adminRoles: ['admin'] as Role[],
    }),
  ],
  hooks: {},
});
