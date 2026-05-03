import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Walkthrough, WalkthroughImage } from '../types';
import { api } from '../api';
import ImageGallery from '../components/ImageGallery';

export default function WalkthroughImagesPage() {
  const { walkthroughId } = useParams<{ walkthroughId: string }>();
  const navigate = useNavigate();
  const [walkthrough, setWalkthrough] = useState<Walkthrough | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walkthroughId) return;
    api
      .getWalkthrough(walkthroughId)
      .then(setWalkthrough)
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [walkthroughId]);

  const images: WalkthroughImage[] = walkthrough
    ? Object.values(walkthrough.images ?? {})
    : [];

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, paddingBottom: 40 }}>
      <button onClick={() => navigate(-1)} style={backButtonStyle}>
        ← Back
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 4px' }}>Photos</h1>
      {walkthrough && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
          {new Date(walkthrough.created_at).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
          {' · '}
          {images.length} photo{images.length !== 1 ? 's' : ''}
        </p>
      )}

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {error && (
        <div style={errorStyle}>{error}</div>
      )}

      {!loading && !error && images.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          No photos taken during this walkthrough.
        </p>
      )}

      {!loading && !error && images.length > 0 && (
        <ImageGallery images={images} />
      )}
    </div>
  );
}

const backButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 500,
  padding: '4px 0',
};

const errorStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--red-bg)',
  borderRadius: 'var(--radius)',
  color: 'var(--red)',
  fontSize: 14,
};
