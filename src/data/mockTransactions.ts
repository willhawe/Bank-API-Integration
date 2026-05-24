import type { Transaction } from "../domain/types";
import { todayIso } from "../domain/spending";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayIso(d);
}

const d0 = daysAgo(0);
const d1 = daysAgo(1);
const d2 = daysAgo(2);
const d3 = daysAgo(3);
const d4 = daysAgo(4);
const d5 = daysAgo(5);
const d6 = daysAgo(6);

/** Seed data mimicking Amex + Chase card activity across the past 7 days. */
export const MOCK_TRANSACTIONS: Transaction[] = [
  // ── Today ──────────────────────────────────────────────────────────────
  { id: "tx-1",  merchant: "Pret",          amount: 4.85,  date: d0, account: "amex",  category: null },
  { id: "tx-2",  merchant: "TfL",           amount: 2.80,  date: d0, account: "chase", category: null },
  { id: "tx-3",  merchant: "Sainsbury's",   amount: 23.47, date: d0, account: "chase", category: null },
  { id: "tx-4",  merchant: "The Crown",     amount: 18.50, date: d0, account: "amex",  category: null },
  { id: "tx-5",  merchant: "Spotify",       amount: 11.99, date: d0, account: "amex",  category: "Bills" },
  { id: "tx-6",  merchant: "Pret",          amount: 5.20,  date: d0, account: "amex",  category: null },
  { id: "tx-7",  merchant: "Uber",          amount: 12.40, date: d0, account: "chase", category: null },
  { id: "tx-8",  merchant: "Starbucks",     amount: 4.75,  date: d0, account: "chase", category: "Coffee" },
  { id: "tx-9",  merchant: "Amazon Prime",  amount: 8.99,  date: d0, account: "amex",  category: null },

  // ── Yesterday ──────────────────────────────────────────────────────────
  { id: "tx-10", merchant: "Costa",         amount: 3.60,  date: d1, account: "amex",  category: "Coffee" },
  { id: "tx-11", merchant: "Tesco",         amount: 31.20, date: d1, account: "chase", category: "Food" },
  { id: "tx-12", merchant: "TfL",           amount: 2.80,  date: d1, account: "chase", category: "Transport" },
  { id: "tx-13", merchant: "Nando's",       amount: 16.50, date: d1, account: "amex",  category: "Food" },
  { id: "tx-14", merchant: "Brewdog",       amount: 22.40, date: d1, account: "amex",  category: "Alcohol" },

  // ── 2 days ago ─────────────────────────────────────────────────────────
  { id: "tx-15", merchant: "Pret",          amount: 5.10,  date: d2, account: "amex",  category: "Coffee" },
  { id: "tx-16", merchant: "Uber",          amount: 9.80,  date: d2, account: "chase", category: "Transport" },
  { id: "tx-17", merchant: "M&S Food",      amount: 18.90, date: d2, account: "chase", category: "Food" },
  { id: "tx-18", merchant: "Netflix",       amount: 6.99,  date: d2, account: "amex",  category: "Bills" },
  { id: "tx-19", merchant: "Lime",          amount: 3.50,  date: d2, account: "chase", category: "Transport" },

  // ── 3 days ago ─────────────────────────────────────────────────────────
  { id: "tx-20", merchant: "Costa",         amount: 3.90,  date: d3, account: "amex",  category: "Coffee" },
  { id: "tx-21", merchant: "Sainsbury's",   amount: 42.10, date: d3, account: "chase", category: "Food" },
  { id: "tx-22", merchant: "National Rail", amount: 28.50, date: d3, account: "chase", category: "Transport" },
  { id: "tx-23", merchant: "The Crown",     amount: 31.80, date: d3, account: "amex",  category: "Alcohol" },

  // ── 4 days ago ─────────────────────────────────────────────────────────
  { id: "tx-24", merchant: "Pret",          amount: 4.50,  date: d4, account: "amex",  category: "Coffee" },
  { id: "tx-25", merchant: "TfL",           amount: 4.20,  date: d4, account: "chase", category: "Transport" },
  { id: "tx-26", merchant: "Leon",          amount: 11.30, date: d4, account: "amex",  category: "Food" },
  { id: "tx-27", merchant: "Amazon",        amount: 32.99, date: d4, account: "amex",  category: "Other" },
  { id: "tx-28", merchant: "Wetherspoons",  amount: 14.60, date: d4, account: "chase", category: "Alcohol" },

  // ── 5 days ago ─────────────────────────────────────────────────────────
  { id: "tx-29", merchant: "Starbucks",     amount: 5.20,  date: d5, account: "chase", category: "Coffee" },
  { id: "tx-30", merchant: "Waitrose",      amount: 27.40, date: d5, account: "amex",  category: "Food" },
  { id: "tx-31", merchant: "Uber",          amount: 15.60, date: d5, account: "chase", category: "Transport" },
  { id: "tx-32", merchant: "Sky",           amount: 25.00, date: d5, account: "amex",  category: "Bills" },

  // ── 6 days ago ─────────────────────────────────────────────────────────
  { id: "tx-33", merchant: "Pret",          amount: 4.85,  date: d6, account: "amex",  category: "Coffee" },
  { id: "tx-34", merchant: "TfL",           amount: 3.50,  date: d6, account: "chase", category: "Transport" },
  { id: "tx-35", merchant: "McDonald's",    amount: 8.90,  date: d6, account: "chase", category: "Food" },
  { id: "tx-36", merchant: "Gym Direct",    amount: 35.00, date: d6, account: "amex",  category: "Bills" },
  { id: "tx-37", merchant: "M&S Wine",      amount: 15.80, date: d6, account: "amex",  category: "Alcohol" },
];
