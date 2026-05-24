export const config = { runtime: "edge" };

const API_BASE = "https://api.truelayer-sandbox.com/data/v1";

interface TLAccount {
  account_id: string;
  display_name: string;
  account_type: string;
}

interface TLTransaction {
  transaction_id: string;
  timestamp: string;
  description: string;
  amount: number;
  transaction_type: string;
  merchant_name?: string;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("access_token");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!token) {
    return new Response(JSON.stringify({ error: "No access token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = { Authorization: `Bearer ${token}` };

  const accountsRes = await fetch(`${API_BASE}/accounts`, { headers });
  if (!accountsRes.ok) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { results: accounts } = (await accountsRes.json()) as {
    results: TLAccount[];
  };

  const txByAccount = await Promise.all(
    accounts.map(async (account) => {
      const params = new URLSearchParams();
      if (from) params.set("from", `${from}T00:00:00Z`);
      if (to) params.set("to", `${to}T23:59:59Z`);

      const txRes = await fetch(
        `${API_BASE}/accounts/${account.account_id}/transactions?${params}`,
        { headers },
      );
      if (!txRes.ok) return [];

      const { results } = (await txRes.json()) as { results: TLTransaction[] };

      return results
        .filter((tx) => tx.amount < 0) // spending only
        .map((tx) => ({
          transaction_id: tx.transaction_id,
          timestamp: tx.timestamp,
          merchant: tx.merchant_name ?? tx.description ?? "Unknown",
          amount: Math.abs(tx.amount),
          account_display_name: account.display_name,
          account_type: account.account_type,
        }));
    }),
  );

  return new Response(
    JSON.stringify({ transactions: txByAccount.flat() }),
    { headers: { "Content-Type": "application/json" } },
  );
}
