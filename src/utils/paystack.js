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

/**
 * @param {object} params
 * @param {{ subaccount: string, shareKobo: number }[]} [params.splitSubaccounts]
 *   When provided, initializes a Paystack "dynamic split" - the listed
 *   subaccounts each get a flat kobo share, and whatever's left of the
 *   total amount stays with the main (platform) account automatically.
 */
export async function initializeTransaction({ email, amountKobo, reference, callback_url, metadata, splitSubaccounts }) {
  const payload = { email, amount: amountKobo, reference, callback_url, metadata };

  if (splitSubaccounts?.length) {
    payload.split = {
      type: 'flat',
      bearer_type: 'account', // platform absorbs Paystack's transaction fee
      subaccounts: splitSubaccounts.map((s) => ({ subaccount: s.subaccount, share: s.shareKobo })),
    };
  }

  const { data } = await client().post('/transaction/initialize', payload);
  return data;
}

export async function verifyTransaction(reference) {
  const { data } = await client().get(`/transaction/verify/${encodeURIComponent(reference)}`);
  return data;
}

export async function listBanks() {
  const { data } = await client().get('/bank?country=nigeria&currency=NGN');
  return data;
}

export async function createSubaccount({ businessName, bankCode, accountNumber, percentageCharge }) {
  const { data } = await client().post('/subaccount', {
    business_name: businessName,
    settlement_bank: bankCode,
    account_number: accountNumber,
    percentage_charge: percentageCharge,
  });
  return data;
}

export async function createTransferRecipient({ name, bankCode, accountNumber }) {
  const { data } = await client().post('/transferrecipient', {
    type: 'nuban',
    name,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  });
  return data;
}

export async function initiateTransfer({ amountKobo, recipientCode, reason, reference }) {
  const { data } = await client().post('/transfer', {
    source: 'balance',
    amount: amountKobo,
    recipient: recipientCode,
    reason,
    reference,
  });
  return data;
    }
