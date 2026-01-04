import type { RequestHandler } from './$types';
import { registerClient, getStateForClient, type GradingEvent } from '$lib/server/state';

export const GET: RequestHandler = async () => {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE message
      const send = (event: GradingEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      // Send initial state
      send({
        type: 'state:full',
        data: getStateForClient(),
        timestamp: new Date().toISOString()
      });

      // Register for future events
      const unregister = registerClient(send);

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // Stream closed
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup when stream closes
      // Note: In SvelteKit, we can't easily detect client disconnect
      // The unregister will happen when the client reconnects or on error
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
};
