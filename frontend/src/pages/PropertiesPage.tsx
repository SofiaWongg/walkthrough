import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Property } from '../types';
import { api } from '../api';

export default function PropertiesPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProperties()
      .then(setProperties)
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>Properties</h1>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {error && (
        <div style={errorBannerStyle}>{error}</div>
      )}

      {!loading && !error && properties.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>No properties found.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/properties/${p.id}`)}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {p.base_checklist_id ? 'Has base checklist' : 'No base checklist yet'}
              </div>
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: 20 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const errorBannerStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--red-bg)',
  borderRadius: 'var(--radius)',
  color: 'var(--red)',
  marginBottom: 16,
  fontSize: 14,
};
