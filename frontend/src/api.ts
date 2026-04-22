import type { Property, PropertyDetail, Walkthrough } from './types';

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/api`;

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listProperties: () => req<Property[]>('/properties/'),

  getProperty: (id: string) => req<PropertyDetail>(`/properties/${id}`),

  getWalkthrough: (id: string) => req<Walkthrough>(`/walkthroughs/${id}`),

  startWalkthrough: (property_id: string) =>
    req<Walkthrough>('/walkthroughs/', {
      method: 'POST',
      body: JSON.stringify({ property_id }),
    }),

  addTranscriptChunk: (walkthrough_id: string, chunk: string) =>
    req<Walkthrough>(`/walkthroughs/${walkthrough_id}/transcript_chunk`, {
      method: 'POST',
      body: JSON.stringify({ chunk }),
    }),

  endWalkthrough: (walkthrough_id: string, walkthrough: Walkthrough) =>
    req<Walkthrough>(`/walkthroughs/${walkthrough_id}/end`, {
      method: 'POST',
      body: JSON.stringify(walkthrough),
    }),
};
