import { useNavigate, useLocation } from 'react-router-dom';

export default function NavTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 3,
        marginBottom: 24,
        gap: 2,
      }}
    >
      {([
        { label: 'Properties', path: '/properties' },
        { label: 'Todos', path: '/todos' },
      ] as const).map(({ label, path }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: active ? 600 : 400,
              background: active ? 'var(--card)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-secondary)',
              cursor: active ? 'default' : 'pointer',
              boxShadow: active ? 'var(--shadow)' : 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
