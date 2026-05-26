import { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
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


export default function TodosPage() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [addingTodo, setAddingTodo] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPropertyId, setNewTodoPropertyId] = useState<string>('');
  const [filterPropertyId, setFilterPropertyId] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('');
  const [swipedTodoId, setSwipedTodoId] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [viewImagesTodo, setViewImagesTodo] = useState<TodoItem | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropBeforeId, setDropBeforeId] = useState<string | 'end' | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const incompleteTodosRef = useRef<TodoItem[]>([]);
  const dropBeforeIdRef = useRef<string | 'end' | null>(null);

  useEffect(() => {
    Promise.all([api.listTodoItems(), api.listProperties(), api.listTags()])
      .then(([todosData, propertiesData, tagsData]) => {
        setTodos(todosData);
        setProperties(propertiesData);
        setAllTags(tagsData);
        if (propertiesData.length > 0) {
          setNewTodoPropertyId(propertiesData[0].id);
        }
      })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const handleAddTagToTodo = async (todo: TodoItem, tag: string) => {
    if (todo.tags.includes(tag)) return;
    const newTags = [...todo.tags, tag];
    setUpdatingIds((prev) => new Set(prev).add(todo.id));
    try {
      const updated = await api.updateTodoItem(todo.id, { tags: newTags });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUpdatingIds((prev) => { const n = new Set(prev); n.delete(todo.id); return n; });
    }
  };

  const handleRemoveTagFromTodo = async (todo: TodoItem, tag: string) => {
    const newTags = todo.tags.filter((t) => t !== tag);
    setUpdatingIds((prev) => new Set(prev).add(todo.id));
    try {
      const updated = await api.updateTodoItem(todo.id, { tags: newTags });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setUpdatingIds((prev) => { const n = new Set(prev); n.delete(todo.id); return n; });
    }
  };

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

  const handleDragHandlePointerDown = (id: string) => {
    setDraggingId(id);
    setDropBeforeId('end');
    setSwipedTodoId(null);
  };

  useEffect(() => {
    if (!draggingId) return;

    const handleMove = (e: PointerEvent) => {
      const clientY = e.clientY;
      let found: string | 'end' = 'end';
      for (const todo of incompleteTodosRef.current) {
        const el = itemRefs.current.get(todo.id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
          found = todo.id;
          break;
        }
      }
      dropBeforeIdRef.current = found;
      setDropBeforeId(found);
    };

    const handleUp = () => {
      const dropTarget = dropBeforeIdRef.current;
      const dragId = draggingId;
      if (dragId && dropTarget !== null) {
        const current = incompleteTodosRef.current;
        const without = current.filter((t) => t.id !== dragId);
        const dragged = current.find((t) => t.id === dragId)!;
        if (dragged) {
          const insertIdx = dropTarget === 'end' ? without.length : without.findIndex((t) => t.id === dropTarget);
          const newOrder = [...without];
          newOrder.splice(insertIdx === -1 ? without.length : insertIdx, 0, dragged);
          const payload = newOrder.map((t, i) => ({ id: t.id, sort_order: (i + 1) * 1000 }));
          setTodos((prev) => {
            const byId = new Map(prev.map((t) => [t.id, t]));
            payload.forEach(({ id, sort_order }) => {
              const t = byId.get(id);
              if (t) byId.set(id, { ...t, sort_order });
            });
            return Array.from(byId.values());
          });
          api.reorderTodoItems(payload).catch((e: unknown) => setError((e as Error).message));
        }
      }
      setDraggingId(null);
      setDropBeforeId(null);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
  }, [draggingId]);

  // Filter and sort todos — sort_order ASC, tiebreak created_at DESC
  const filteredTodos = todos
    .filter((t) => !filterPropertyId || t.property_id === filterPropertyId)
    .filter((t) => !filterTag || t.tags.includes(filterTag))
    .sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const incompleteTodos = filteredTodos.filter((t) => !t.is_completed);
  const completedTodos = filteredTodos.filter((t) => t.is_completed);

  // Keep ref in sync for drag handler closure
  incompleteTodosRef.current = incompleteTodos;
  dropBeforeIdRef.current = dropBeforeId;

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
      <NavTabs />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>All Todos</h1>
        <button onClick={() => setShowTagManager(true)} style={manageTagsButtonStyle}>
          Manage Tags
        </button>
      </div>

      {/* Filters */}
      <div style={filterContainerStyle}>
        <FilterDropdown
          value={filterPropertyId}
          onChange={setFilterPropertyId}
          placeholder="All Properties"
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
        />
        <FilterDropdown
          value={filterTag}
          onChange={setFilterTag}
          placeholder="All Tags"
          options={allTags.map((t) => ({ value: t, label: t }))}
        />
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
              <div
                key={todo.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(todo.id, el);
                  else itemRefs.current.delete(todo.id);
                }}
                style={{
                  borderTop: dropBeforeId === todo.id ? '2px solid var(--primary)' : '2px solid transparent',
                  opacity: draggingId === todo.id ? 0.45 : 1,
                  transition: 'opacity 0.1s',
                }}
              >
                <TodoCard
                  todo={todo}
                  propertyName={getPropertyName(todo.property_id)}
                  allTags={allTags}
                  updating={updatingIds.has(todo.id)}
                  onToggle={() => handleToggleTodo(todo)}
                  isSwiped={swipedTodoId === todo.id}
                  onSwipe={(swiped) => setSwipedTodoId(swiped ? todo.id : null)}
                  onEdit={() => startEditing(todo)}
                  onDelete={() => handleDeleteTodo(todo.id)}
                  onViewImages={(todo.image_urls ?? []).length > 0 ? () => setViewImagesTodo(todo) : undefined}
                  onAddTag={(tag) => handleAddTagToTodo(todo, tag)}
                  onRemoveTag={(tag) => handleRemoveTagFromTodo(todo, tag)}
                  onDragHandlePointerDown={() => handleDragHandlePointerDown(todo.id)}
                />
              </div>
            )
          ))}
          {/* Drop indicator at end of list */}
          {draggingId && dropBeforeId === 'end' && (
            <div style={{ height: 2, background: 'var(--primary)', borderRadius: 1, margin: '0 0 2px' }} />
          )}

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
                      allTags={allTags}
                      updating={updatingIds.has(todo.id)}
                      onToggle={() => handleToggleTodo(todo)}
                      isSwiped={swipedTodoId === todo.id}
                      onSwipe={(swiped) => setSwipedTodoId(swiped ? todo.id : null)}
                      onEdit={() => startEditing(todo)}
                      onDelete={() => handleDeleteTodo(todo.id)}
                      onViewImages={(todo.image_urls ?? []).length > 0 ? () => setViewImagesTodo(todo) : undefined}
                      onAddTag={(tag) => handleAddTagToTodo(todo, tag)}
                      onRemoveTag={(tag) => handleRemoveTagFromTodo(todo, tag)}
                      onDragHandlePointerDown={() => {}}
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

      {/* Todo Images Sheet */}
      {viewImagesTodo && (
        <TodoImageSheet
          todo={viewImagesTodo}
          onClose={() => setViewImagesTodo(null)}
        />
      )}

      {/* Tag Manager Modal */}
      {showTagManager && (
        <TagManagerModal
          tags={allTags}
          onClose={() => setShowTagManager(false)}
          onTagsChange={setAllTags}
          onTagDeleted={(deleted) => {
            setTodos((prev) =>
              prev.map((t) => ({ ...t, tags: t.tags.filter((tag) => tag !== deleted) }))
            );
          }}
        />
      )}
    </div>
  );
}

interface TodoCardProps {
  todo: TodoItem;
  propertyName: string;
  allTags: string[];
  updating: boolean;
  onToggle: () => void;
  isSwiped: boolean;
  onSwipe: (swiped: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewImages?: () => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onDragHandlePointerDown: () => void;
}


function TodoCard({
  todo,
  propertyName,
  allTags,
  updating,
  onToggle,
  isSwiped,
  onSwipe,
  onEdit,
  onDelete,
  onViewImages,
  onAddTag,
  onRemoveTag,
  onDragHandlePointerDown,
}: TodoCardProps) {
  const [hovered, setHovered] = useState(false);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const pickerPortalRef = useRef<HTMLDivElement>(null);
  const tagsOuterRef = useRef<HTMLDivElement>(null);
  const tagsInnerRef = useRef<HTMLDivElement>(null);
  const [tagsOverflow, setTagsOverflow] = useState(false);
  const [showTagPopover, setShowTagPopover] = useState(false);
  const [tagPopoverPos, setTagPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = useMemo(
    () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    []
  );

  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!plusButtonRef.current?.contains(target) && !pickerPortalRef.current?.contains(target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  useEffect(() => {
    if (!showTagPopover) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!tagsOuterRef.current?.contains(target) && !tagPopoverRef.current?.contains(target)) {
        setShowTagPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTagPopover]);

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
      setDragOffset(180);
    } else if (diff < -60 && isSwiped) {
      onSwipe(false);
      setDragOffset(0);
    } else {
      setDragOffset(isSwiped ? 180 : 0);
    }
  };

  const offset = isSwiped ? 180 : dragOffset;

  const tags = todo.tags ?? [];
  const availableTags = allTags.filter((t) => !tags.includes(t));

  useEffect(() => {
    const outer = tagsOuterRef.current;
    const inner = tagsInnerRef.current;
    if (!outer || !inner) return;
    const check = () => setTagsOverflow(inner.scrollWidth > outer.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [tags, propertyName]);

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
          background: hovered ? 'rgba(0, 0, 0, 0.05)' : 'var(--bg)',
          transform: `translateX(-${offset}px)`,
          transition: dragOffset === 0 || dragOffset === 180 ? 'transform 0.2s' : 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ ...rowStyle, padding: isTouchDevice ? '6px 8px' : '9px 12px' }}>
          {/* Drag handle */}
          <div
            onPointerDown={(e) => {
              e.preventDefault();
              onDragHandlePointerDown();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              flexShrink: 0,
              cursor: 'grab',
              color: 'var(--text-secondary)',
              fontSize: 14,
              opacity: 0.5,
              userSelect: 'none',
              touchAction: 'none',
              marginRight: 2,
            }}
          >
            ⠿
          </div>
          {/* Left: flex column — line 1: [checkbox + text], line 2: [tags full width] */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 5 }}>
            {/* Line 1 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <button
                onClick={onToggle}
                disabled={updating}
                style={checkboxStyle}
                aria-label={todo.is_completed ? 'Mark incomplete' : 'Mark complete'}
              >
                {todo.is_completed && (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1.5,5.5 4.2,8.5 9.5,2" />
                  </svg>
                )}
              </button>
              <span
                style={{
                  ...todoTextStyle,
                  display: 'block',
                  flex: 1,
                  minWidth: 0,
                  textDecoration: todo.is_completed ? 'line-through' : 'none',
                  color: todo.is_completed ? 'var(--text-secondary)' : 'var(--text)',
                }}
              >
                {todo.text}
              </span>
            </div>

            {/* Line 2: tags — spans full width, no indent */}
            <div
              ref={tagsOuterRef}
              style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (showTagPopover) { setShowTagPopover(false); return; }
                const rect = tagsOuterRef.current!.getBoundingClientRect();
                setTagPopoverPos({ top: rect.bottom + 6, left: rect.left });
                setShowTagPopover(true);
              }}
            >
              <div ref={tagsInnerRef} style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap', paddingRight: tagsOverflow ? 42 : 0 }}>
                {availableTags.length > 0 && (
                  <>
                    <button
                      ref={plusButtonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (showPicker) { setShowPicker(false); return; }
                        const rect = plusButtonRef.current!.getBoundingClientRect();
                        setPickerPos({ top: rect.bottom + 4, left: rect.left });
                        setShowPicker(true);
                      }}
                      style={addTagBubbleStyle}
                      title="Add tag"
                    >
                      +
                    </button>
                    {showPicker && pickerPos && createPortal(
                      <div ref={pickerPortalRef} style={{ ...tagPickerStyle, position: 'fixed', top: pickerPos.top, left: pickerPos.left }}>
                        {availableTags.map((tag) => (
                          <button
                            key={tag}
                            onClick={(e) => { e.stopPropagation(); onAddTag(tag); setShowPicker(false); }}
                            style={tagPickerItemStyle}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </>
                )}
                {propertyName && (
                  <span style={propertyPillStyle}>{propertyName}</span>
                )}
                {todo.location && (
                  <span style={locationPillStyle}>{todo.location}</span>
                )}
                {tags.map((tag) => (
                  <span key={tag} style={{ ...tagPillStyle, ...tagColor(tag) }}>
                    {tag}
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveTag(tag); }}
                      style={{ ...tagRemoveButtonStyle, color: tagColor(tag).color }}
                      title={`Remove tag "${tag}"`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {tagsOverflow && (
                <div style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 42,
                  background: `linear-gradient(to right, transparent, var(--bg))`,
                  pointerEvents: 'none',
                }} />
              )}
            </div>
            {showTagPopover && tagPopoverPos && createPortal(
              <div
                ref={tagPopoverRef}
                style={{ ...tagPickerStyle, position: 'fixed', top: tagPopoverPos.top, left: tagPopoverPos.left, padding: 10, minWidth: 180 }}
                onClick={(e) => e.stopPropagation()}
              >
                {propertyName && (
                  <span style={{ ...propertyPillStyle, display: 'inline-block', marginBottom: 6 }}>{propertyName}</span>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{ ...tagPillStyle, ...tagColor(tag) }}>
                      {tag}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveTag(tag); }}
                        style={{ ...tagRemoveButtonStyle, color: tagColor(tag).color }}
                        title={`Remove "${tag}"`}
                      >×</button>
                    </span>
                  ))}
                  {tags.length === 0 && (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No tags</span>
                  )}
                </div>
                {availableTags.length > 0 && (
                  <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={(e) => { e.stopPropagation(); onAddTag(tag); }}
                        style={{ ...tagPickerItemStyle, padding: '5px 10px' }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>

          {/* Right: time, camera, actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, alignSelf: 'flex-start' }}>
            {!isTouchDevice && (
              <span style={timestampStyle}>
                {timeAgo(todo.created_at)}
              </span>
            )}
            {onViewImages && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewImages(); }}
                title="View photos"
                style={cameraIconButtonStyle}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1 }}>
                  {(todo.image_urls ?? []).length}
                </span>
              </button>
            )}
            {!isTouchDevice && (
              <span style={{ ...desktopActionsStyle, opacity: hovered ? 1 : 0 }}>
                <button onClick={onEdit} style={desktopActionButtonStyle}>Edit</button>
                <DesktopDeleteButton onClick={onDelete} />
              </span>
            )}
          </div>
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
        <FilterDropdown
          value={selectedPropertyId}
          onChange={onPropertyChange}
          placeholder="Property"
          showPlaceholderOption={false}
          options={properties.map((p) => ({ value: p.id, label: p.name }))}
        />
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

interface FilterDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  showPlaceholderOption?: boolean;
}

function FilterDropdown({ value, onChange, options, placeholder, showPlaceholderOption = true }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          fontSize: 15,
          fontWeight: 500,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: 'var(--card)',
          color: value ? 'var(--text)' : 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {showPlaceholderOption && (
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ ...filterOptionStyle, color: value === '' ? 'var(--primary)' : 'var(--text-secondary)' }}
            >
              {placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{ ...filterOptionStyle, color: value === opt.value ? 'var(--primary)' : 'var(--text)' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const filterOptionStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'none',
  border: 'none',
  padding: '10px 14px',
  fontSize: 15,
  textAlign: 'left',
  cursor: 'pointer',
};

const filterContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 16,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: '9px 12px',
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
  width: 18,
  height: 18,
  borderRadius: 4,
  border: '2px solid var(--text-secondary)',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  padding: 0,
  marginTop: 2,
};

const todoTextStyle: React.CSSProperties = {
  fontSize: 17,
  lineHeight: 1.3,
};

const propertyPillStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--primary)',
  background: 'rgba(37, 99, 235, 0.1)',
  padding: '2px 9px',
  borderRadius: 14,
  whiteSpace: 'nowrap',
};

const locationPillStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  background: 'var(--border)',
  padding: '2px 9px',
  borderRadius: 14,
  whiteSpace: 'nowrap',
};

const timestampStyle: React.CSSProperties = {
  fontSize: 18,
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
  width: 90,
  border: 'none',
  background: 'var(--primary)',
  color: 'white',
  fontSize: 19,
  fontWeight: 500,
  cursor: 'pointer',
};

const deleteButtonStyle: React.CSSProperties = {
  width: 90,
  border: 'none',
  background: 'var(--red)',
  color: 'white',
  fontSize: 19,
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
  fontSize: 18,
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
  gap: 4,
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

interface TagManagerModalProps {
  tags: string[];
  onClose: () => void;
  onTagsChange: (tags: string[]) => void;
  onTagDeleted: (tag: string) => void;
}

function TagManagerModal({ tags, onClose, onTagsChange, onTagDeleted }: TagManagerModalProps) {
  const [newTagName, setNewTagName] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [deletingTag, setDeletingTag] = useState<string | null>(null);

  const handleCreate = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setTagError(null);
    try {
      const updated = await api.createTag(name);
      onTagsChange(updated);
      setNewTagName('');
    } catch (e: unknown) {
      setTagError((e as Error).message);
    }
  };

  const handleDelete = async (tag: string) => {
    setDeletingTag(tag);
    setTagError(null);
    try {
      const updated = await api.deleteTag(tag);
      onTagsChange(updated);
      onTagDeleted(tag);
    } catch (e: unknown) {
      setTagError((e as Error).message);
    } finally {
      setDeletingTag(null);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 380, width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Manage Tags</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, padding: 4, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {tagError && <div style={{ ...errorBannerStyle, marginBottom: 12 }}>{tagError}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, minHeight: 32 }}>
          {tags.length === 0 && <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No tags yet.</span>}
          {tags.map((tag) => (
            <span key={tag} style={{ ...tagPillStyle, ...tagColor(tag), opacity: deletingTag === tag ? 0.5 : 1 }}>
              {tag}
              <button
                onClick={() => handleDelete(tag)}
                style={{ ...tagRemoveButtonStyle, color: tagColor(tag).color }}
                disabled={deletingTag === tag}
                title={`Delete tag "${tag}"`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            placeholder="New tag name..."
            style={{ ...addInputStyle, border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 10px', flex: 1 }}
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={!newTagName.trim()}
            style={{ ...addActionButtonStyle, border: '1px solid var(--primary)', borderRadius: 'var(--radius)', padding: '6px 12px', opacity: newTagName.trim() ? 1 : 0.4 }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

const manageTagsButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-secondary)',
  fontSize: 13,
  cursor: 'pointer',
  padding: '6px 12px',
};

const addTagBubbleStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: '1px dashed var(--border)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 16,
  lineHeight: 1,
  cursor: 'pointer',
  padding: 0,
  flexShrink: 0,
};

const tagPickerStyle: React.CSSProperties = {
  zIndex: 9999,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 135,
  overflow: 'hidden',
};

const tagPickerItemStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '8px 14px',
  fontSize: 14,
  cursor: 'pointer',
  textAlign: 'left',
  color: 'var(--text)',
};

function tagColor(tag: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return {
    background: `hsl(${hue}, 60%, 88%)`,
    color: `hsl(${hue}, 50%, 32%)`,
  };
}

const tagPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 13,
  fontWeight: 500,
  padding: '2px 7px 2px 9px',
  borderRadius: 11,
  whiteSpace: 'nowrap',
};

const tagRemoveButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  fontSize: 16,
  lineHeight: 1,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
};


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
