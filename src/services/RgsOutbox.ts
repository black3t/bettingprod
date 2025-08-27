import { WebhookDispatcher } from './WebhookDispatcher';

export async function runOutboxOnce(): Promise<void> {
  await WebhookDispatcher.runOnce();
}

export default { runOutboxOnce };