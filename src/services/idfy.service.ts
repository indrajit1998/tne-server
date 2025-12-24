import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import env from '../lib/env';
import logger from '../lib/logger';
import type { AuthRequest } from '../middlewares/authMiddleware';
import normalizeBase64 from '../lib/normalizeBase64';
('');

//  Environment Variables
const IDFY_BASE = env.IDFY_BASE_URL || 'https://eve.idfy.com/v3';
const ACCOUNT_ID = env.IDFY_ACCOUNT_ID!;
const API_KEY = env.IDFY_API_KEY!;

//  Basic Config
const defaultHeaders = {
  'Content-Type': 'application/json',
  'account-id': ACCOUNT_ID,
  'api-key': API_KEY,
};

function validateBase64Size(base64: string, maxMB = 3) {
  // handle URLs (skip validation)
  if (/^https?:\/\//i.test(base64)) return;

  const sizeInBytes =
    (base64.length * 3) / 4 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB > maxMB) {
    throw new Error(`Image size too large (${sizeInMB.toFixed(2)} MB). Max allowed is ${maxMB} MB`);
  }
}

/* -------------------------------------------------------------------------- */
/*                            Generic HTTP Helpers                            */
/* -------------------------------------------------------------------------- */

// POST wrapper
export const idfyPost = async (path: string, body: any) => {
  const url = `${IDFY_BASE}${path}`;
  try {
    logger.debug({ url, body }, '[IDFY] → POST Request');
    const response = await axios.post(url, body, {
      headers: defaultHeaders,
      timeout: 60_000,
    });

    logger.debug({ status: response.status, data: response.data }, '[IDFY] ← POST Response');

    return response.data;
  } catch (error: any) {
    logger.error(
      {
        url,
        error: error.response?.data || error.message,
        status: error.response?.status,
      },
      '[IDFY] ❌ POST Request Failed',
    );
    throw new Error(
      `IDFY POST failed at ${path}: ${error.response?.data?.message || error.message}`,
    );
  }
};

// GET wrapper (polling fallback)
export const idfyGet = async (path: string, params?: Record<string, any>) => {
  const url = `${IDFY_BASE}${path}`;
  try {
    logger.debug({ url, params }, '[IDFY] → GET Request');
    const response = await axios.get(url, {
      headers: defaultHeaders,
      timeout: 30_000,
      params,
    });

    logger.debug({ status: response.status, data: response.data }, '[IDFY] ← GET Response');
    return response.data;
  } catch (error: any) {
    logger.error(
      {
        url,
        error: error.response?.data || error.message,
        status: error.response?.status,
      },
      '[IDFY] ❌ GET Request Failed',
    );
    throw new Error(
      `IDFY GET failed at ${path}: ${error.response?.data?.message || error.message}`,
    );
  }
};

/* -------------------------------------------------------------------------- */
/*                      NEW OCR Extraction Task Creators                      */
/* -------------------------------------------------------------------------- */

type OcrType = 'ind_pan' | 'ind_aadhaar' | 'ind_driving_license';

interface OcrOptions {
  document1: string; // required (front side)
  document2?: string; // optional (back side)
  groupId?: string;
  extra?: Record<string, any>; // e.g., consent for aadhaar
}

/**
 * Create OCR Extraction Task (PAN, Aadhaar, DL)
 */
export const createOcrExtractionTask = async (type: OcrType, opts: OcrOptions) => {
  const { document1, document2, groupId, extra } = opts;

  if (!document1) {
    throw new Error('document1 (front image base64 or URL) is required');
  }

  // ✅ normalize first
  const doc1 = normalizeBase64(document1);
  const doc2 = document2 ? normalizeBase64(document2) : undefined;

  // ✅ then validate size
  if (doc1) validateBase64Size(doc1);
  if (doc2) validateBase64Size(doc2);

  // Map to correct OCR endpoints
  const endpointMap: Record<OcrType, string> = {
    ind_pan: '/tasks/async/extract/ind_pan',
    ind_aadhaar: '/tasks/async/extract/ind_aadhaar',
    ind_driving_license: '/tasks/async/extract/ind_driving_license',
  };

  const taskPath = endpointMap[type];
  if (!taskPath) throw new Error(`Unsupported OCR type: ${type}`);

  const taskId = uuidv4();
  const gid = groupId || uuidv4();

  // Base data object
  const data: Record<string, any> = { document1: doc1 };
  if (doc2) data.document2 = doc2;
  if (extra && typeof extra === 'object') Object.assign(data, extra);

  const payload = { task_id: taskId, group_id: gid, data };

  try {
    const response = await idfyPost(taskPath, payload);

    logger.info(
      { type, taskId, groupId: gid, requestId: response.request_id },
      '[IDFY] ✅ OCR Extraction Task Created',
    );

    return {
      taskId,
      groupId: gid,
      requestId: response.request_id,
      raw: response,
    };
  } catch (error) {
    logger.error({ type, taskId, groupId: gid, error }, '[IDFY] ❌ Failed to Create OCR Task');
    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/*                          Face Liveness (Selfie)                            */
/* -------------------------------------------------------------------------- */

export const createFaceLivenessTask = async (
  imageBase64OrUrl: string,
  groupId?: string,
  options?: Record<string, any>,
) => {
  // normalize first
  const image = normalizeBase64(imageBase64OrUrl);

  // validate size
  if (image) validateBase64Size(image);

  const taskId = uuidv4();
  const gid = groupId || uuidv4();

  const payload = {
    task_id: taskId,
    group_id: gid,
    data: {
      document1: image,
      ...(options || {}),
    },
  };

  try {
    const response = await idfyPost('/tasks/async/check_photo_liveness/face', payload);

    logger.info(
      { taskId, groupId: gid, requestId: response.request_id },
      '[IDFY] ✅ Face Liveness Task Created',
    );

    return {
      taskId,
      groupId: gid,
      requestId: response.request_id,
      raw: response,
    };
  } catch (error) {
    logger.error({ taskId, groupId: gid, error }, '[IDFY] ❌ Failed to Create Face Liveness Task');
    throw error;
  }
};

/* -------------------------------------------------------------------------- */
/*                              Polling Fallback                              */
/* -------------------------------------------------------------------------- */

export const fetchTaskResult = async (requestId: string) => {
  try {
    const response = await idfyGet('/tasks', { request_id: requestId });
    logger.info({ requestId, status: response.status }, '[IDFY] ✅ Fetched Task Result');
    return response;
  } catch (error) {
    logger.error({ requestId, error }, '[IDFY] ❌ Failed to Fetch Task Result');
    throw error;
  }
};

const IDFY_WEBHOOK_SECRET = env.IDFY_WEBHOOK_SECRET || 'default-secret'; // must set in prod

// Utility to verify the incoming webhook signature
export function verifyIdfySignature(req: AuthRequest) {
  try {
    const receivedSig = req.headers['x-idfy-signature'];
    if (!receivedSig || typeof receivedSig !== 'string') {
      logger.warn('[WEBHOOK] ❌ Missing X-Idfy-Signature header');
      return false;
    }

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const computedSig = crypto
      .createHmac('sha256', IDFY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(Buffer.from(receivedSig), Buffer.from(computedSig));

    if (!isValid) {
      logger.warn('[WEBHOOK] ⚠️ Signature mismatch');
    }

    return isValid;
  } catch (err) {
    logger.error({ err }, '[WEBHOOK] Signature verification failed');
    return false;
  }
}
