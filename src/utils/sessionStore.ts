import { sessionStore as store } from '../config/redis';
import Redis from 'ioredis';

// Wrapper to handle both Redis and Map for session storage
export const sessionStore = {
  async get(key: string): Promise<string | null> {
    if (!store) return null;
    
    if (store instanceof Redis) {
      return await store.get(key);
    } else if (store instanceof Map) {
      return store.get(key) || null;
    }
    return null;
  },

  async setex(key: string, seconds: number, value: string): Promise<void> {
    if (!store) return;
    
    if (store instanceof Redis) {
      await store.setex(key, seconds, value);
    } else if (store instanceof Map) {
      store.set(key, value);
      // Simulate expiry in test mode
      setTimeout(() => {
        if (store instanceof Map) {
          store.delete(key);
        }
      }, seconds * 1000);
    }
  },

  async del(key: string): Promise<void> {
    if (!store) return;
    
    if (store instanceof Redis) {
      await store.del(key);
    } else if (store instanceof Map) {
      store.delete(key);
    }
  }
};