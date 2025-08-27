// Health degrade simulation for testing
import fs from 'fs';

let degradeState = {
  db: false,
  redis: false
};

export function setDegradeState(component: 'db' | 'redis', state: boolean) {
  degradeState[component] = state;
}

export function getDegradeState() {
  return { ...degradeState };
}

export function resetDegradeState() {
  degradeState.db = false;
  degradeState.redis = false;
}

export function isDbDegradeOn(): boolean {
  return process.env.DEGRADE_DB === '1' || fs.existsSync('/tmp/rawwar_degrade_db');
}