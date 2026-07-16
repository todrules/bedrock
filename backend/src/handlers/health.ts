import { APIGatewayProxyHandler } from 'aws-lambda';

import { success } from '../utils/response';

export const handler: APIGatewayProxyHandler = () =>
  Promise.resolve(
    success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }),
  );
