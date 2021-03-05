import { multinetApi } from 'multinet';
import { host } from '@/environment';

export function generateAPI(querystringHost: string | undefined) {
  if (querystringHost !== undefined) {
    return multinetApi(`${querystringHost}/api`);
  }
  return multinetApi(`${host}/api`);
}
