import { useEffect, useState, useRef, useMemo } from 'react';
import type { Property, TodoItem, WalkthroughImage } from '../types';
import { api } from '../api';
import NavTabs from '../components/NavTabs';
import ImageGallery from '../components/ImageGallery';

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function isDifferentTime(a: string, b: string): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) > 1000;
}

export default function TodosPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [addingTodo, setAddingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPropertyId, setNewTodoPropertyId] = useState<string>('');
  const [filterPropertyId, setFilterPropertyId] = useState<string>('');
  const [swipedTodoId, setSwipedTodoId] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deletingTodo, setDeletingTodo] = useState<TodoItem | null>(null);
  const [viewImagesTodo, setViewImagesTodo] = useState<TodoItem | null>(null);

  useEffect(() => {
    Promise.all([api.listTodoItems(), api.listProperties()])
      .then(([todosData, propertiesData]) => {
        setTodos(todosData);
        setProperties(propertiesData);
        if (propertiesData.length > 0) {
          setNewTodoPropertyId(propertiesData[0].id);
        }
      })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleTodo = async (todo: TodoItem) => {
    setUpdatingIds((prev) => new Set(prev).add(todo.id));
    try {
      const updated = await api.updateTodoItem(todo.id, {
        is_completed: !todo.is_completed,
      });
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? updated : t))
      );
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(todo.id);
        return next;
      });
    }
  };

  const handleAddTodo = async () => {
    if (!newTodoText.trim() || !newTodoPropertyId) return;
    try {
      const created = await api.createTodoItem({
        text: newTodoText.trim(),
        property_id: newTodoPropertyId,
      });
      setTodos((prev) => [...prev, created]);
      setNewTodoText('');
      setAddingTodo(false);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const handleEditTodo = async (todoId: string) => {
    if (!editText.trim()) return;
    setUpdatingIds((prev) => new Set(prev).add(todoId));
    try {
      const updated = await api.updateTodoItem(todoId, { text: editText.trim() });
      setTodos((prev) => prev.map((t) => (t.id === todoId ? updated : t)));
      setEditingTodoId(null);
      setEditText('');
      setSwipedTodoId(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(todoId);
        return next;
      });
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    setUpdatingIds((prev) => new Set(prev).add(todoId));
    try {
      await api.deleteTodoItem(todoId);
      setTodos((prev) => prev.filter((t) => t.id !== todoId));
      setDeletingTodo(null);
      setSwipedTodoId(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(todoId);
        return next;
      });
    }
  };

  const startEditing = (todo: TodoItem) => {
    setEditingTodoId(todo.id);
    setEditText(todo.text);
    setSwipedTodoId(null);
  };

  const cancelAdding = () => {
    setAddingTodo(false);
    setNewTodoText('');
  };

  const getPropertyName = (propertyId: string) => {
    return properties.find((p) => p.id === propertyId)?.name ?? 'Unknown';
  };

  // Filter and sort todos
  const filteredTodos = todos
    .filter((t) => !filterPropertyId || t.property_id === filterPropertyId)
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) {
        return a.is_completed ? 1 : -1;
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const incompleteTodos = filteredTodos.filter((t) => !t.is_completed);
  const completedTodos = filteredTodos.filter((t) => t.is_completed);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <NavTabs />
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>All Todos</h1>

      {/* Property Filter */}
      <div style={filterContainerStyle}>
        <select
          value={filterPropertyId}
          onChange={(e) => setFilterPropertyId(e.target.value)}
          style={filterSelectStyle}
        >
          <option value="">All Properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {error && <div style={errorBannerStyle}>{error}</div>}

      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Top "+ New Todo" */}
          {addingTodo ? (
            <AddTodoRow
              value={newTodoText}
              onChange={setNewTodoText}
              onSubmit={handleAddTodo}
              onCancel={cancelAdding}
              properties={properties}
              selectedPropertyId={newTodoPropertyId}
              onPropertyChange={setNewTodoPropertyId}
            />
          ) : (
            <NewTodoButton onClick={() => setAddingTodo(true)} faded={incompleteTodos.length > 0} />
          )}

          {incompleteTodos.map((todo) => (
            editingTodoId === todo.id ? (
              <EditTodoRow
                key={todo.id}
                value={editText}
                onChange={setEditText}
                onSubmit={() => handleEditTodo(todo.id)}
                onCancel={() => {
                  setEditingTodoId(null);
                  setEditText('');
                }}
              />
            ) : (
              <TodoCard
                key={todo.id}
                todo={todo}
                propertyName={getPropertyName(todo.property_id)}
                updating={updatingIds.has(todo.id)}
                onToggle={() => handleToggleTodo(todo)}
                isSwiped={swipedTodoId === todo.id}
                onSwipe={(swiped) => setSwipedTodoId(swiped ? todo.id : null)}
                onEdit={() => startEditing(todo)}
                onDelete={() => setDeletingTodo(todo)}
                onViewImages={(todo.image_urls ?? []).length > 0 ? () => setViewImagesTodo(todo) : undefined}
              />
            )
          ))}

          {/* Bottom "+ New Todo" - only show if there are incomplete todos */}
          {!addingTodo && incompleteTodos.length > 0 && (
            <NewTodoButton onClick={() => setAddingTodo(true)} />
          )}

          {completedTodos.length > 0 && (
            <>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                style={showCompletedButtonStyle}
              >
                {showCompleted
                  ? `Hide completed (${completedTodos.length})`
                  : `Show completed (${completedTodos.length})`}
              </button>

              {showCompleted &&
                completedTodos.map((todo) => (
                  editingTodoId === todo.id ? (
                    <EditTodoRow
                      key={todo.id}
                      value={editText}
                      onChange={setEditText}
                      onSubmit={() => handleEditTodo(todo.id)}
                      onCancel={() => {
                        setEditingTodoId(null);
                        setEditText('');
                      }}
                    />
                  ) : (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      propertyName={getPropertyName(todo.property_id)}
                      updating={updatingIds.has(todo.id)}
                      onToggle={() => handleToggleTodo(todo)}
                      isSwiped={swipedTodoId === todo.id}
                      onSwipe={(swiped) => setSwipedTodoId(swiped ? todo.id : null)}
                      onEdit={() => startEditing(todo)}
                      onDelete={() => setDeletingTodo(todo)}
                      onViewImages={(todo.image_urls ?? []).length > 0 ? () => setViewImagesTodo(todo) : undefined}
                    />
                  )
                ))}
            </>
          )}

          {filteredTodos.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', padding: '12px 8px' }}>
              No todos found.
            </p>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTodo && (
        <div style={modalOverlayStyle} onClick={() => setDeletingTodo(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <p style={{ marginBottom: 16, fontSize: 15 }}>
              Delete "{deletingTodo.text}"?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletingTodo(null)}
                style={modalButtonStyle}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTodo(deletingTodo.id)}
                style={{ ...modalButtonStyle, background: 'var(--red)', color: 'white' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Todo Images Sheet */}
      {viewImagesTodo && (
        <TodoImageSheet
          todo={viewImagesTodo}
          onClose={() => setViewImagesTodo(null)}
        />
      )}
    </div>
  );
}

interface TodoCardProps {
  todo: TodoItem;
  propertyName: string;
  updating: boolean;
  onToggle: () => void;
  isSwiped: boolean;
  onSwipe: (swiped: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewImages?: () => void;
}

function TodoCard({
  todo,
  propertyName,
  updating,
  onToggle,
  isSwiped,
  onSwipe,
  onEdit,
  onDelete,
  onViewImages,
}: TodoCardProps) {
  const showUpdatedAt = isDifferentTime(todo.created_at, todo.updated_at);
  const [hovered, setHovered] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    []
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 0) {
      setDragOffset(Math.min(diff, 120));
    } else if (isSwiped) {
      setDragOffset(Math.max(120 + diff, 0));
    }
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 60) {
      onSwipe(true);
      setDragOffset(120);
    } else if (diff < -60 && isSwiped) {
      onSwipe(false);
      setDragOffset(0);
    } else {
      setDragOffset(isSwiped ? 120 : 0);
    }
  };

  const offset = isSwiped ? 120 : dragOffset;

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Mobile swipe action buttons behind - only visible when swiping */}
      {offset > 0 && (
        <div style={swipeActionsStyle}>
          <button onClick={onEdit} style={editButtonStyle}>
            Edit
          </button>
          <button onClick={onDelete} style={deleteButtonStyle}>
            Delete
          </button>
        </div>
      )}

      {/* Main content */}
      <div
        style={{
          ...rowStyle,
          background: hovered ? 'rgba(0, 0, 0, 0.05)' : 'var(--bg)',
          transform: `translateX(-${offset}px)`,
          transition: dragOffset === 0 || dragOffset === 120 ? 'transform 0.2s' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={todo.is_completed}
            onChange={onToggle}
            disabled={updating}
            style={checkboxStyle}
          />
          <span
            style={{
              ...todoTextStyle,
              textDecoration: todo.is_completed ? 'line-through' : 'none',
              color: todo.is_completed ? 'var(--text-secondary)' : 'var(--text)',
            }}
          >
            {todo.text}
          </span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={propertyPillStyle}>{propertyName}</span>
          <span style={timestampStyle}>
            {showUpdatedAt ? timeAgo(todo.updated_at) : timeAgo(todo.created_at)}
          </span>
          {onViewImages && (
            <button
              onClick={(e) => { e.stopPropagation(); onViewImages(); }}
              title="View photos"
              style={cameraIconButtonStyle}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>
                {(todo.image_urls ?? []).length}
              </span>
            </button>
          )}
          {/* Desktop hover actions */}
          {!isTouchDevice && (
            <span style={{ ...desktopActionsStyle, opacity: hovered ? 1 : 0 }}>
              <button onClick={onEdit} style={desktopActionButtonStyle}>
                Edit
              </button>
              <DesktopDeleteButton onClick={onDelete} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DesktopDeleteButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...desktopActionButtonStyle,
        color: hovered ? 'var(--red)' : 'var(--text-secondary)',
      }}
    >
      Delete
    </button>
  );
}

interface EditTodoRowProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function EditTodoRow({ value, onChange, onSubmit, onCancel }: EditTodoRowProps) {
  return (
    <div style={{ ...rowStyle, background: 'rgba(0, 0, 0, 0.05)' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        autoFocus
        style={addInputStyle}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={onSubmit} style={addActionButtonStyle}>
          Save
        </button>
        <button onClick={onCancel} style={{ ...addActionButtonStyle, color: 'var(--text-secondary)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

interface NewTodoButtonProps {
  onClick: () => void;
  faded?: boolean;
}

function NewTodoButton({ onClick, faded }: NewTodoButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      style={{
        ...rowStyle,
        ...newTodoButtonStyle,
        opacity: faded ? 0.5 : 0.7,
        background: hovered ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      + New Todo
    </button>
  );
}

interface AddTodoRowProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  properties: Property[];
  selectedPropertyId: string;
  onPropertyChange: (id: string) => void;
}

function AddTodoRow({
  value,
  onChange,
  onSubmit,
  onCancel,
  properties,
  selectedPropertyId,
  onPropertyChange,
}: AddTodoRowProps) {
  return (
    <div style={{ ...rowStyle, background: 'rgba(0, 0, 0, 0.05)', flexWrap: 'wrap', gap: 8 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="New todo..."
        autoFocus
        style={addInputStyle}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select
          value={selectedPropertyId}
          onChange={(e) => onPropertyChange(e.target.value)}
          style={propertySelectStyle}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={onSubmit} style={addActionButtonStyle}>
          Add
        </button>
        <button onClick={onCancel} style={{ ...addActionButtonStyle, color: 'var(--text-secondary)' }}>
          Cancel
        </button>
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

const filterContainerStyle: React.CSSProperties = {
  marginBottom: 16,
};

const filterSelectStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--card)',
  color: 'var(--text)',
  cursor: 'pointer',
  minWidth: 150,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 8px',
  transition: 'background 0.1s',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  flex: 1,
  minWidth: 0,
};

const checkboxStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  cursor: 'pointer',
  accentColor: 'var(--primary)',
  flexShrink: 0,
};

const todoTextStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const propertyPillStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--primary)',
  background: 'rgba(37, 99, 235, 0.1)',
  padding: '2px 8px',
  borderRadius: 12,
  whiteSpace: 'nowrap',
};

const timestampStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
};

const showCompletedButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: 13,
  cursor: 'pointer',
  padding: '6px 8px',
  textAlign: 'left',
};

const newTodoButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 14,
  cursor: 'pointer',
  textAlign: 'left',
  justifyContent: 'flex-start',
};

const addInputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  fontSize: 14,
  padding: '2px 0',
  outline: 'none',
  minWidth: 120,
};

const propertySelectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--card)',
  color: 'var(--text)',
  cursor: 'pointer',
};

const addActionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--primary)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  padding: '2px 6px',
};

const swipeActionsStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'stretch',
};

const editButtonStyle: React.CSSProperties = {
  width: 60,
  border: 'none',
  background: 'var(--primary)',
  color: 'white',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const deleteButtonStyle: React.CSSProperties = {
  width: 60,
  border: 'none',
  background: 'var(--red)',
  color: 'white',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--card)',
  borderRadius: 'var(--radius)',
  padding: 20,
  maxWidth: 300,
  width: '90%',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
};

const modalButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  background: 'var(--card)',
  fontSize: 14,
  cursor: 'pointer',
};

const desktopActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginLeft: 4,
  transition: 'opacity 0.1s',
};

const desktopActionButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};

const cameraIconButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--primary)',
  cursor: 'pointer',
  padding: '2px 4px',
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  flexShrink: 0,
};

interface TodoImageSheetProps {
  todo: TodoItem;
  onClose: () => void;
}

function TodoImageSheet({ todo, onClose }: TodoImageSheetProps) {
  const images: WalkthroughImage[] = (todo.image_urls ?? []).map((url, i) => ({
    id: `img-${i}`,
    timestamp_taken: '',
    transcript_index: 0,
    walkthrough_item_id: null,
    storage_url: url,
    vision_description: null,
  }));

  return (
    <div style={todoImageOverlayStyle} onClick={onClose}>
      <div style={todoImageSheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Photos</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{todo.text}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        <ImageGallery images={images} />
      </div>
    </div>
  );
}

const todoImageOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-end',
  zIndex: 100,
};

const todoImageSheetStyle: React.CSSProperties = {
  background: 'var(--card)',
  borderRadius: '14px 14px 0 0',
  padding: '20px 20px 36px',
  width: '100%',
  maxHeight: '80vh',
  overflowY: 'auto',
};
