import { io } from 'socket.io-client';

// One socket per page that needs realtime. Caller must call socket.disconnect() on unmount.
export function createSocket() {
  return io(import.meta.env.VITE_SOCKET_URL, {
    auth: { token: localStorage.getItem('token') },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
