import { useState } from 'react';
import type { WalkthroughImage } from '../types';

interface ImageGalleryProps {
  images: WalkthroughImage[];
  compact?: boolean;
  onSeeAll?: () => void;
}

const MAX_COMPACT = 4;

export default function ImageGallery({ images, compact = false, onSeeAll }: ImageGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  const displayImages = compact ? images.slice(0, MAX_COMPACT) : images;
  const hiddenCount = images.length - MAX_COMPACT;

  const closeLightbox = () => setLightboxIndex(null);
  const prev = () => setLightboxIndex((i) => (i !== null ? Math.max(0, i - 1) : null));
  const next = () =>
    setLightboxIndex((i) => (i !== null ? Math.min(images.length - 1, i + 1) : null));

  return (
    <>
      <div
        style={
          compact
            ? { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }
            : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }
        }
      >
        {displayImages.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setLightboxIndex(compact ? images.indexOf(img) : i)}
            style={compact ? compactThumbStyle : fullThumbStyle}
          >
            <img
              src={img.storage_url}
              alt={img.vision_description ?? `Photo ${i + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {compact && i === MAX_COMPACT - 1 && hiddenCount > 0 && (
              <div style={moreOverlayStyle}>+{hiddenCount}</div>
            )}
          </button>
        ))}
      </div>

      {compact && onSeeAll && (
        <button onClick={onSeeAll} style={seeAllStyle}>
          See all {images.length} photo{images.length !== 1 ? 's' : ''} →
        </button>
      )}

      {lightboxIndex !== null && (
        <div style={lightboxOverlayStyle} onClick={closeLightbox}>
          <div
            style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              {lightboxIndex + 1} / {images.length}
            </span>
            <button onClick={closeLightbox} style={closeButtonStyle}>✕</button>
          </div>

          <div
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', minHeight: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={prev}
              disabled={lightboxIndex === 0}
              style={navButtonStyle(lightboxIndex === 0)}
            >
              ‹
            </button>
            <img
              src={images[lightboxIndex].storage_url}
              alt={images[lightboxIndex].vision_description ?? `Photo ${lightboxIndex + 1}`}
              style={{ flex: 1, maxHeight: '100%', objectFit: 'contain', borderRadius: 4, minWidth: 0 }}
            />
            <button
              onClick={next}
              disabled={lightboxIndex === images.length - 1}
              style={navButtonStyle(lightboxIndex === images.length - 1)}
            >
              ›
            </button>
          </div>

          {images[lightboxIndex].vision_description && (
            <div
              style={{ padding: '12px 20px 28px', color: 'rgba(255,255,255,0.65)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}
              onClick={(e) => e.stopPropagation()}
            >
              {images[lightboxIndex].vision_description}
            </div>
          )}
        </div>
      )}
    </>
  );
}

const compactThumbStyle: React.CSSProperties = {
  width: 80,
  height: 80,
  flexShrink: 0,
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  borderRadius: 8,
  overflow: 'hidden',
  position: 'relative',
  display: 'block',
};

const fullThumbStyle: React.CSSProperties = {
  aspectRatio: '1',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  borderRadius: 8,
  overflow: 'hidden',
  position: 'relative',
  display: 'block',
  width: '100%',
};

const moreOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'white',
  fontSize: 18,
  fontWeight: 600,
};

const seeAllStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  padding: '6px 0 0',
  textAlign: 'left',
};

const lightboxOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.92)',
  zIndex: 400,
  display: 'flex',
  flexDirection: 'column',
};

const closeButtonStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: '50%',
  width: 36,
  height: 36,
  color: 'white',
  fontSize: 18,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const navButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: '50%',
  width: 44,
  height: 44,
  color: disabled ? 'rgba(255,255,255,0.25)' : 'white',
  fontSize: 28,
  cursor: disabled ? 'not-allowed' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  lineHeight: 1,
});
