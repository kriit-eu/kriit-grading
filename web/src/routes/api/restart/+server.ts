import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  // Schedule restart after response is sent
  setTimeout(() => {
    process.exit(0);
  }, 100);

  return json({ success: true, message: 'Server restarting...' });
};
