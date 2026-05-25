import axios from 'axios';
import env from '../lib/env';
import logger from '../lib/logger';

//  Environment Variables
const CASHFREE_BASE_URL = env.CASHFREE_BASE_URL;
const CASHFREE_CLIENT_ID = env.CASHFREE_CLIENT_ID!;
const CASHFREE_CLIENT_SECRET = env.CASHFREE_CLIENT_SECRET!;

//  Basic Config
const defaultHeaders = {
  'Content-Type': 'application/json',
  'x-client-id': CASHFREE_CLIENT_ID,
  'x-client-secret': CASHFREE_CLIENT_SECRET,
};

// POST wrapper
export const cashfreePost = async (path: string, body: any) => {
  const url = `${CASHFREE_BASE_URL}${path}`;
  try {
    logger.debug({ url, body }, '[CASHFREE] → POST Request');
    const response = await axios.post(url, body, {
      headers: defaultHeaders,
      timeout: 60_000,
    });
   
    logger.debug({ status: response.status, data: response.data }, '[CASHFREE] ← POST Response');

    return response.data;
  } catch (error: any) {
    logger.error(
      {
        url,
        error: error.response?.data || error.message,
        status: error.response?.status,
      },
      '[CASHFREE] ❌ POST Request Failed',
    );
    throw new Error(
      `CASHFREE POST failed at ${path}: ${error.response?.data?.message || error.message}`,
    );
  }
};

// GET wrapper (polling fallback)
export const cashfreeGet = async (path: string, params?: Record<string, any>) => {
  const url = `${CASHFREE_BASE_URL}${path}`;
  try {
    logger.debug({ url, params }, '[CASHFREE] → GET Request');
    const response = await axios.get(url, {
      headers: defaultHeaders,
      timeout: 30_000,
      params,
    });

    logger.debug({ status: response.status, data: response.data }, '[CASHFREE] ← GET Response');
    return response.data;
  } catch (error: any) {
    logger.error(
      {
        url,
        error: error.response?.data || error.message,
        status: error.response?.status,
      },
      '[CASHFREE] ❌ GET Request Failed',
    );
    throw new Error(
      `CASHFREE GET failed at ${path}: ${error.response?.data?.message || error.message}`,
    );
  }
};
