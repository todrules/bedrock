exports.handler = async function handler() {
  return {
    statusCode: 501,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Backend build artifact missing. Provide backend/dist before deployment.' }),
  };
};
