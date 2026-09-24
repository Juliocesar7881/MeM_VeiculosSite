import { createLibsqlDatabase } from '@/lib/db/libsql';
import { createStorage } from '@/lib/storage';
import { ResendLeadNotifier } from '@/services/notifier';
import { getServerConfig, type ServerConfig } from './config';
import { buildServices, type Services } from './services';

export interface Container extends Services {
  config: ServerConfig;
}

let containerPromise: Promise<Container> | null = null;

/** Criado uma vez por instância serverless e reutilizado entre requisições. */
export function getContainer(requestOrigin: string): Promise<Container> {
  if (!containerPromise) {
    containerPromise = (async () => {
      const config = getServerConfig();
      const [db, storage] = await Promise.all([createLibsqlDatabase(config.database), createStorage(config.storage)]);
      const { resendApiKey, to, from } = config.notifications;
      const notifier =
        resendApiKey && to
          ? new ResendLeadNotifier({ apiKey: resendApiKey, to, from, siteUrl: config.siteUrl ?? requestOrigin })
          : null;
      return { config, ...buildServices({ db, storage, ipHashSalt: config.ipHashSalt, notifier }) };
    })().catch((error: unknown) => {
      containerPromise = null;
      throw error;
    });
  }
  return containerPromise;
}
