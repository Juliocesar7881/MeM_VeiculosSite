import { createPlatform, type Platform } from '@/server/platform';
import { ResendLeadNotifier } from '@/services/notifier';
import { getServerConfig, type ServerConfig } from './config';
import { buildServices, type Services } from './services';

export interface Container extends Services {
  config: ServerConfig;
  platform: Platform;
}

let containerPromise: Promise<Container> | null = null;

/** Criado uma vez por instância (serverless/isolate) e reutilizado entre requisições. */
export function getContainer(requestOrigin: string): Promise<Container> {
  if (!containerPromise) {
    containerPromise = (async () => {
      const config = getServerConfig();
      const platform = await createPlatform(config);
      const { resendApiKey, to, from } = config.notifications;
      const notifier =
        resendApiKey && to
          ? new ResendLeadNotifier({ apiKey: resendApiKey, to, from, siteUrl: config.siteUrl ?? requestOrigin })
          : null;
      return {
        config,
        platform,
        ...buildServices({ db: platform.db, storage: platform.storage, ipHashSalt: config.ipHashSalt, notifier }),
      };
    })().catch((error: unknown) => {
      containerPromise = null;
      throw error;
    });
  }
  return containerPromise;
}
