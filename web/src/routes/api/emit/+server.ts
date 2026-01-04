import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { handleEvent } from '$lib/server/state';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const event = await request.json();

    // Validate event structure
    if (!event.type || typeof event.type !== 'string') {
      return json({ error: 'Missing or invalid event type' }, { status: 400 });
    }

    // Process the event
    handleEvent({
      type: event.type,
      data: event.data || {},
      timestamp: event.timestamp || new Date().toISOString()
    });

    return json({ success: true });
  } catch (error) {
    console.error('Error processing event:', error);
    return json({ error: 'Failed to process event' }, { status: 500 });
  }
};
