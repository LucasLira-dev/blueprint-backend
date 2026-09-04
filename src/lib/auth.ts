/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { PrismaClient } from '../generated/prisma/client';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { expo } from '@better-auth/expo';

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
//const isHttpsFrontend = frontendUrl.startsWith('https://');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
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
        after: async ({ data }) => {
          try {
            if (!data) {
              console.warn('delete.before: payload vazio', { data });
              return;
            }

            const userId = Array.isArray(data)
              ? data[0] && data[0].id
              : (data as any).id;

            if (!userId) {
              console.warn('delete.before: id do usuário não encontrado', {
                data,
              });
              return;
            }

            const plans = await prisma.studyPlan.findMany({
              where: { userId },
              select: { pdfUrl: true },
            });

            if (plans.length === 0) return;

            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
            );

            for (const plan of plans) {
              if (!plan.pdfUrl) continue;

              try {
                const url = new URL(plan.pdfUrl);
                const pathParts = url.pathname.split('/');
                const bucketIndex = pathParts.indexOf('study-plans');
                if (bucketIndex === -1) continue;
                const filePath = pathParts.slice(bucketIndex + 1).join('/');
                if (filePath)
                  await supabase.storage.from('study-plans').remove([filePath]);
              } catch (err) {
                console.warn('Erro removendo arquivo do supabase', {
                  err,
                  pdfUrl: plan.pdfUrl,
                });
              }
            }
          } catch (err) {
            console.error(
              'Erro no hook delete.before (não aborta a remoção):',
              err,
            );
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
  trustedOrigins: [
    frontendUrl,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean)
      : []),
    'blueprintmobile://',
    'exp://',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081',
    'http://192.168.0.107:3000',
    'http://192.168.0.107:3001',
    'http://192.168.0.107:8081',
  ],
  advanced: {
    defaultCookieAttributes: {
      sameSite: process.env.FRONTEND_URL?.startsWith('https') ? 'none' : 'lax',
      secure: process.env.BETTER_AUTH_URL?.startsWith('https') ?? false,
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
    expo(),
  ],
  hooks: {},
});
