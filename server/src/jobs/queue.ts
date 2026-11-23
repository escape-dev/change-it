import pLimit from 'p-limit';
import { config } from '../config.js';

export const conversionLimit = pLimit(config.maxConcurrent);
