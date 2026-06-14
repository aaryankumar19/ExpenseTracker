// src/lib/api.js
const BASE_URL = "http://localhost:8000/api";

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || JSON.stringify(errorData) || "API request failed");
  }
  return response.json();
};

// Users
export const getUsers = () => fetch(`${BASE_URL}/users/`).then(handleResponse);
export const createUser = (data) =>
  fetch(`${BASE_URL}/users/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(handleResponse);

// Groups
export const getGroups = () => fetch(`${BASE_URL}/groups/`).then(handleResponse);
export const createGroup = (data) =>
  fetch(`${BASE_URL}/groups/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(handleResponse);

// Memberships
export const getMemberships = () => fetch(`${BASE_URL}/memberships/`).then(handleResponse);
export const createMembership = (data) =>
  fetch(`${BASE_URL}/memberships/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(handleResponse);

// Expenses
export const getExpenses = () => fetch(`${BASE_URL}/expenses/`).then(handleResponse);
export const createExpense = (data) =>
  fetch(`${BASE_URL}/expenses/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(handleResponse);

// Expense Splits
export const getExpenseSplits = () => fetch(`${BASE_URL}/expense-splits/`).then(handleResponse);

// Settlements
export const getSettlements = () => fetch(`${BASE_URL}/settlements/`).then(handleResponse);
export const createSettlement = (data) =>
  fetch(`${BASE_URL}/settlements/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(handleResponse);

// Balances & Recommended
export const getBalances = () => fetch(`${BASE_URL}/balances/`).then(handleResponse);
export const getRecommendedSettlements = () => fetch(`${BASE_URL}/recommended-settlements/`).then(handleResponse);

// Import
export const uploadExpenseFile = (file) => {
  const form = new FormData();
  form.append("file", file);
  return fetch(`${BASE_URL}/import-expenses/`, { method: "POST", body: form }).then(handleResponse);
};

// Anomalies
export const getAnomalies = () => fetch(`${BASE_URL}/anomalies/`).then(handleResponse);
