import type { ProcessArtifactPayload } from "App/Jobs/ProcessArtifact";

declare module '@ioc:Rlanz/Queue' {
  interface JobsList {
    'App/Jobs/ProcessArtifact': ProcessArtifactPayload;
  }
}
