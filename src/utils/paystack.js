import axios from 'axios';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function client() {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_SECRET_KEY is not set in the environment.');
  }
  return axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

export async function initializeTransaction({ email, amountKobo, reference, callback_url, metadata }) {
  const { data } = await client().post('/transaction/initialize', {
    email,
    amount: amountKobo,
    reference,
    callback_url,
    metadata,
  });
  return data;
}

export async function verifyTransaction(reference) {
  const { data } = await client().get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data;
}
