import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Property } from '../types';
import { api } from '../api';

export default function PropertiesPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadProperties = () => {
    setLoading(true);
    api
      .listProperties()
      .then(setProperties)
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProperties();
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Properties</h1>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Add Property
        </button>
      </div>

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

      {showAddModal && (
        <AddPropertyModal
          properties={properties}
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            loadProperties();
          }}
        />
      )}
    </div>
  );
}

function AddPropertyModal({
  properties,
  onClose,
  onCreated,
}: {
  properties: Property[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [copyTemplate, setCopyTemplate] = useState(false);
  const [copyFromId, setCopyFromId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingNames = properties.map((p) => p.name.toLowerCase());

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Property name is required.');
      return;
    }
    if (existingNames.includes(trimmed.toLowerCase())) {
      setError('A property with this name already exists.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const newProp = await api.createProperty(trimmed);

      if (copyTemplate && copyFromId) {
        const checklist = await api.getBaseChecklist(copyFromId);
        if (checklist.item_list.length > 0) {
          await api.updateBaseChecklist(
            newProp.id,
            checklist.item_list.map((i) => ({ name: i.name }))
          );
        }
      }

      onCreated();
    } catch (e: unknown) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: '14px 14px 0 0',
          padding: '24px 20px 36px',
          width: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, marginTop: 0 }}>
          Add Property
        </h2>

        {error && <div style={errorBannerStyle}>{error}</div>}

        <label style={labelStyle}>
          Property Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 123 Main St"
            style={inputStyle}
            autoFocus
          />
        </label>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            cursor: 'pointer',
            marginBottom: copyTemplate ? 16 : 24,
            marginTop: 4,
          }}
        >
          <input
            type="checkbox"
            checked={copyTemplate}
            onChange={(e) => {
              setCopyTemplate(e.target.checked);
              if (!e.target.checked) setCopyFromId('');
            }}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          Copy base template from another property
        </label>

        {copyTemplate && (
          <label style={{ ...labelStyle, marginBottom: 24 }}>
            From
            <select
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select a property...</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1,
              padding: 12,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              flex: 1,
              padding: 12,
              background: submitting ? '#93c5fd' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: 15,
              fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 14,
  fontWeight: 500,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: 15,
  background: 'var(--bg)',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const errorBannerStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--red-bg)',
  borderRadius: 'var(--radius)',
  color: 'var(--red)',
  marginBottom: 16,
  fontSize: 14,
};
