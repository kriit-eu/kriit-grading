/**
 * Shared API client with authorization
 */

import { loadConfig } from './config.js';

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/api/grading/getUngradedBatch')
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(endpoint, options = {}) {
  const config = loadConfig();
  const url = `${config.apiUrl}${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    ...options.headers
  };

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Make a GET request to the API
 * @param {string} endpoint
 * @param {object} options - Additional options
 * @param {number[]} options.allowedStatuses - HTTP statuses to allow without throwing (default: [])
 * @returns {Promise<object>}
 */
export async function apiGet(endpoint, { allowedStatuses = [] } = {}) {
  const response = await apiFetch(endpoint, { method: 'GET' });

  if (!response.ok && !allowedStatuses.includes(response.status)) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Make a POST request to the API
 * @param {string} endpoint
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function apiPost(endpoint, data) {
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}

/**
 * Make a PUT request to the API
 * @param {string} endpoint
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function apiPut(endpoint, data) {
  const response = await apiFetch(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.json();
}
