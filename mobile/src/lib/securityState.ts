/**
 * Hafif olay yayını — telefon doğrulandığında kök layout'taki gate'i tetikler
 * (verified_phone'u yeniden çekmeden, anında /(tabs)'a geçiş için).
 */

type Listener = () => void;
let listeners: Listener[] = [];

export function notifyPhoneVerified(): void {
  listeners.slice().forEach((l) => l());
}

export function subscribePhoneVerified(cb: Listener): () => void {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}
