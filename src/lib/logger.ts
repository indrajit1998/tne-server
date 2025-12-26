import pino from 'pino';
import env from './env';

const isProd = env.NODE_ENV === 'production';

const logger = pino({
  level: isProd ? 'info' : 'debug',
  base: {
    pid: true,
    hostname: true,
    app: env.APP_NAME || 'my-app',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password'],
    censor: '[REDACTED]',
  },
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
});

export default logger;
