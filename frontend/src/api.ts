import type { BaseChecklist, Property, PropertyDetail, TodoItem, Walkthrough } from './types';

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
  if (res.status === 204) return undefined as T;
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

  createProperty: (name: string) =>
    req<Property>('/properties/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteProperty: (id: string) =>
    req<{ message: string }>(`/properties/${id}`, { method: 'DELETE' }),

  getBaseChecklist: (propertyId: string) =>
    req<BaseChecklist>(`/properties/${propertyId}/base_checklist`),

  updateBaseChecklist: (propertyId: string, items: { name: string }[]) =>
    req<BaseChecklist>(`/properties/${propertyId}/base_checklist`, {
      method: 'PUT',
      body: JSON.stringify(items),
    }),

  uploadImage: async (walkthrough_id: string, image: File): Promise<Walkthrough> => {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('timestamp_taken', new Date().toISOString());
    const res = await fetch(`${BASE}/walkthroughs/${walkthrough_id}/images`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      throw new Error(body.detail ?? `HTTP ${res.status}`);
    }
    return res.json() as Promise<Walkthrough>;
  },

  listTodoItems: () => req<TodoItem[]>('/todo_items/'),

  createTodoItem: (data: { text: string; property_id: string }) =>
    req<TodoItem>('/todo_items/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTodoItem: (id: string, updates: Partial<TodoItem>) =>
    req<TodoItem>(`/todo_items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteTodoItem: (id: string) =>
    req<void>(`/todo_items/${id}`, {
      method: 'DELETE',
    }),

  reorderTodoItems: (items: { id: string; sort_order: number }[]) =>
    req<void>('/todo_items/reorder', {
      method: 'POST',
      body: JSON.stringify(items),
    }),

  listTags: () => req<string[]>('/tags/'),

  createTag: (name: string) =>
    req<string[]>('/tags/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteTag: (name: string) =>
    req<string[]>(`/tags/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};
