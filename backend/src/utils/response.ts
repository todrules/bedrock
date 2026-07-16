import { APIGatewayProxyResult } from 'aws-lambda';

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json',
};

export const success = (data: unknown, statusCode = 200): APIGatewayProxyResult => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify(data),
});

export const error = (
  message: string,
  statusCode: number,
  details?: unknown,
): APIGatewayProxyResult => ({
  statusCode,
  headers: baseHeaders,
  body: JSON.stringify({
    message,
    details,
  }),
});
