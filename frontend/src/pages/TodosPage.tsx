import { useEffect, useState } from 'react';
import type { Property, TodoItem } from '../types';
import { api } from '../api';

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

interface PropertyTodos {
  property: Property;
  todos: TodoItem[];
}

export default function TodosPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState<Record<string, boolean>>({});
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [addingToProperty, setAddingToProperty] = useState<string | null>(null);
  const [newTodoText, setNewTodoText] = useState('');

  useEffect(() => {
    Promise.all([api.listTodoItems(), api.listProperties()])
      .then(([todosData, propertiesData]) => {
        setTodos(todosData);
        setProperties(propertiesData);
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

  const groupedTodos: PropertyTodos[] = properties
    .map((property) => {
      const propertyTodos = todos
        .filter((t) => t.property_id === property.id)
        .sort((a, b) => {
          if (a.is_completed !== b.is_completed) {
            return a.is_completed ? 1 : -1;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      return { property, todos: propertyTodos };
    })
    .filter((group) => group.todos.length > 0);

  const toggleShowCompleted = (propertyId: string) => {
    setShowCompleted((prev) => ({
      ...prev,
      [propertyId]: !prev[propertyId],
    }));
  };

  const handleAddTodo = async (propertyId: string) => {
    if (!newTodoText.trim()) return;
    try {
      const created = await api.createTodoItem({
        text: newTodoText.trim(),
        property_id: propertyId,
      });
      setTodos((prev) => [...prev, created]);
      setNewTodoText('');
      setAddingToProperty(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  const startAdding = (propertyId: string) => {
    setAddingToProperty(propertyId);
    setNewTodoText('');
  };

  const cancelAdding = () => {
    setAddingToProperty(null);
    setNewTodoText('');
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 24 }}>All Todos</h1>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {error && <div style={errorBannerStyle}>{error}</div>}

      {!loading && !error && groupedTodos.length === 0 && (
        <p style={{ color: 'var(--text-secondary)' }}>No todos found.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {groupedTodos.map(({ property, todos: propertyTodos }) => {
          const incompleteTodos = propertyTodos.filter((t) => !t.is_completed);
          const completedTodos = propertyTodos.filter((t) => t.is_completed);
          const showCompletedForProperty = showCompleted[property.id] ?? false;
          const isAdding = addingToProperty === property.id;

          return (
            <div key={property.id}>
              <h2 style={propertySectionHeaderStyle}>{property.name}</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {/* Top "+ New Todo" row */}
                {isAdding ? (
                  <AddTodoRow
                    value={newTodoText}
                    onChange={setNewTodoText}
                    onSubmit={() => handleAddTodo(property.id)}
                    onCancel={cancelAdding}
                  />
                ) : (
                  <NewTodoButton onClick={() => startAdding(property.id)} faded />
                )}

                {incompleteTodos.map((todo) => (
                  <TodoCard
                    key={todo.id}
                    todo={todo}
                    updating={updatingIds.has(todo.id)}
                    onToggle={() => handleToggleTodo(todo)}
                  />
                ))}

                {/* Bottom "+ New Todo" row */}
                {!isAdding && (
                  <NewTodoButton onClick={() => startAdding(property.id)} />
                )}

                {completedTodos.length > 0 && (
                  <>
                    <button
                      onClick={() => toggleShowCompleted(property.id)}
                      style={showCompletedButtonStyle}
                    >
                      {showCompletedForProperty
                        ? `Hide completed (${completedTodos.length})`
                        : `Show completed (${completedTodos.length})`}
                    </button>

                    {showCompletedForProperty &&
                      completedTodos.map((todo) => (
                        <TodoCard
                          key={todo.id}
                          todo={todo}
                          updating={updatingIds.has(todo.id)}
                          onToggle={() => handleToggleTodo(todo)}
                        />
                      ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TodoCardProps {
  todo: TodoItem;
  updating: boolean;
  onToggle: () => void;
}

function TodoCard({ todo, updating, onToggle }: TodoCardProps) {
  const showUpdatedAt = isDifferentTime(todo.created_at, todo.updated_at);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...rowStyle,
        background: hovered ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
      <span style={timestampStyle}>
        {showUpdatedAt ? timeAgo(todo.updated_at) : timeAgo(todo.created_at)}
      </span>
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
}

function AddTodoRow({ value, onChange, onSubmit, onCancel }: AddTodoRowProps) {
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
        placeholder="New todo..."
        autoFocus
        style={addInputStyle}
      />
      <div style={{ display: 'flex', gap: 4 }}>
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

const propertySectionHeaderStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  marginBottom: 8,
  color: 'var(--text)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 8px',
  borderRadius: 4,
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

const timestampStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  marginLeft: 12,
  flexShrink: 0,
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
