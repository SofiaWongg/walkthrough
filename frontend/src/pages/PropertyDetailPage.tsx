import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ChecklistItem, PropertyDetail, Walkthrough, WalkthroughSummary } from '../types';
import { api } from '../api';

export default function PropertyDetailPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [selectedWalkthrough, setSelectedWalkthrough] = useState<WalkthroughSummary | null>(null);
  const [selectedBaseItem, setSelectedBaseItem] = useState<ChecklistItem | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    api
      .getProperty(propertyId)
      .then(setProperty)
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const handleStartWalkthrough = async () => {
    if (!propertyId || starting) return;
    setStarting(true);
    try {
      const walkthrough = await api.startWalkthrough(propertyId);
      navigate(`/walkthroughs/${walkthrough.id}`, { state: { walkthrough } });
    } catch (e: unknown) {
      setError((e as Error).message);
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <BackButton onClick={() => navigate('/properties')} />
        <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>Loading...</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div style={{ padding: 16 }}>
        <BackButton onClick={() => navigate('/properties')} />
        <div style={errorBannerStyle}>{error ?? 'Property not found'}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px', paddingBottom: 40 }}>
      <BackButton onClick={() => navigate('/properties')} />

      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '16px 0 24px' }}>{property.name}</h1>

      <button
        onClick={handleStartWalkthrough}
        disabled={starting}
        style={{
          width: '100%',
          padding: 14,
          background: starting ? '#93c5fd' : 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius)',
          fontSize: 16,
          fontWeight: 600,
          cursor: starting ? 'not-allowed' : 'pointer',
          marginBottom: 24,
        }}
      >
        {starting ? 'Starting...' : 'Start Walkthrough'}
      </button>

      {/* Base Checklist */}
      {property.base_checklist && (
        <div style={{ marginBottom: 28 }}>
          <button
            onClick={() => setChecklistOpen((o) => !o)}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: checklistOpen
                ? 'var(--radius) var(--radius) 0 0'
                : 'var(--radius)',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            <span>Base Checklist ({property.base_checklist.item_list.length} items)</span>
            <span style={{ color: 'var(--text-secondary)' }}>{checklistOpen ? '▲' : '▼'}</span>
          </button>

          {checklistOpen && (
            <div
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderTop: 'none',
                borderRadius: '0 0 var(--radius) var(--radius)',
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {property.base_checklist.item_list.length === 0 ? (
                <div style={emptyStyle}>No items in base checklist.</div>
              ) : (
                property.base_checklist.item_list.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedBaseItem(item)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{item.name}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>History ›</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Past Walkthroughs */}
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Past Walkthroughs</h2>
      {property.walkthroughs.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No past walkthroughs.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {property.walkthroughs.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWalkthrough(w)}
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {new Date(w.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={statusBadgeStyle(w.status)}>{w.status}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Walkthrough Detail Modal */}
      {selectedWalkthrough && (
        <WalkthroughDetailModal
          summary={selectedWalkthrough}
          onClose={() => setSelectedWalkthrough(null)}
        />
      )}

      {/* Base Item History Modal */}
      {selectedBaseItem && property.walkthroughs.length > 0 && (
        <BaseItemHistoryModal
          item={selectedBaseItem}
          walkthroughs={property.walkthroughs}
          onClose={() => setSelectedBaseItem(null)}
        />
      )}
      {selectedBaseItem && property.walkthroughs.length === 0 && (
        <BottomSheet onClose={() => setSelectedBaseItem(null)}>
          <h2 style={sheetTitleStyle}>{selectedBaseItem.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No walkthroughs yet.</p>
        </BottomSheet>
      )}
    </div>
  );
}

function WalkthroughDetailModal({
  summary,
  onClose,
}: {
  summary: WalkthroughSummary;
  onClose: () => void;
}) {
  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWalkthrough(summary.id)
      .then(setWalkthrough)
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [summary.id]);

  const checked = walkthrough?.item_list.filter((i) => i.status === 'checked') ?? [];
  const unchecked = walkthrough?.item_list.filter((i) => i.status === 'unchecked') ?? [];

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <h2 style={sheetTitleStyle}>Walkthrough Details</h2>
        <span style={statusBadgeStyle(summary.status)}>{summary.status}</span>
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {new Date(summary.created_at).toLocaleString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</p>}
      {error && <div style={errorBannerStyle}>{error}</div>}

      {walkthrough && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            {checked.length} checked · {unchecked.length} unchecked
          </div>
          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {walkthrough.item_list.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '9px 0',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 14,
                }}
              >
                <span
                  style={{
                    marginTop: 1,
                    color: item.status === 'checked' ? 'var(--green)' : '#9ca3af',
                    flexShrink: 0,
                  }}
                >
                  {item.status === 'checked' ? '✓' : '○'}
                </span>
                <div>
                  <span>
                    {item.name}
                    {item.is_from_base && (
                      <span style={baseTagStyle}>base</span>
                    )}
                  </span>
                  {item.notes && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {item.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function BaseItemHistoryModal({
  item,
  walkthroughs,
  onClose,
}: {
  item: ChecklistItem;
  walkthroughs: WalkthroughSummary[];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<
    { summary: WalkthroughSummary; status: string | null; notes: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(
      walkthroughs.map((s) =>
        api.getWalkthrough(s.id).then((wt) => {
          const match = wt.item_list.find(
            (i) =>
              (i.checklist_item_id != null && i.checklist_item_id === item.id) ||
              i.name.toLowerCase() === item.name.toLowerCase()
          );
          return { summary: s, status: match?.status ?? null, notes: match?.notes ?? null };
        })
      )
    )
      .then(setRows)
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [item.id, walkthroughs]);

  return (
    <BottomSheet onClose={onClose}>
      <h2 style={sheetTitleStyle}>{item.name}</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Status across all walkthroughs
      </p>

      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</p>}
      {error && <div style={errorBannerStyle}>{error}</div>}

      {!loading && !error && (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {rows.map(({ summary, status, notes }) => (
            <div
              key={summary.id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                fontSize: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {new Date(summary.created_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </div>
                {notes && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {notes}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {status === null ? (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>not present</span>
                ) : (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: status === 'checked' ? 'var(--green)' : '#9ca3af',
                    }}
                  >
                    {status === 'checked' ? '✓ checked' : '○ unchecked'}
                  </span>
                )}
                <span style={statusBadgeStyle(summary.status)}>{summary.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

function BottomSheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
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
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--primary)',
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 500,
        padding: '4px 0',
      }}
    >
      ← Properties
    </button>
  );
}

const statusBadgeStyle = (status: string): React.CSSProperties => ({
  padding: '2px 10px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 500,
  background: status === 'completed' ? 'var(--green-bg)' : 'var(--yellow-bg)',
  color: status === 'completed' ? 'var(--green)' : '#92400e',
});

const sheetTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 4,
};

const baseTagStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 11,
  color: 'var(--text-secondary)',
  background: 'var(--bg)',
  padding: '1px 5px',
  borderRadius: 4,
};

const errorBannerStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--red-bg)',
  borderRadius: 'var(--radius)',
  color: 'var(--red)',
  marginBottom: 12,
  fontSize: 14,
};

const emptyStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--text-secondary)',
  fontSize: 14,
};
