import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Character, Player } from "../types";

interface Props {
  player: Player;
  characters: Character[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectCharacter: (id: string) => void;
  onEditCharacter: (id: string) => void;
  onAddCharacter: (name: string) => Promise<void>;
  onDeletePlayer: () => void;
  onRenamePlayer: (name: string) => Promise<void>;
  onReorderCharacters: (characters: Character[]) => Promise<void>;
}

function formatConditions(char: Character) {
  return char.conditions
    .map((c) =>
      (c.name === "Exhausted" || c.name === "Diseased") && c.count > 1
        ? `${c.name} ×${c.count}`
        : c.name,
    )
    .join(", ");
}

function hpPillStyle(char: Character) {
  const pct = char.hp_current / char.hp_max;
  return {
    background: pct > 0.5 ? "#dcfce7" : pct > 0.25 ? "#fef9c3" : "#fee2e2",
    color: pct > 0.5 ? "#166534" : pct > 0.25 ? "#854d0e" : "#991b1b",
    border: `0.5px solid ${pct > 0.5 ? "#86efac" : pct > 0.25 ? "#fde047" : "#fca5a5"}`,
  };
}

function stressPillStyle(stress: number) {
  return {
    background: stress < 100 ? "#dcfce7" : stress < 150 ? "#fef9c3" : "#fee2e2",
    color: stress < 100 ? "#166534" : stress < 150 ? "#854d0e" : "#991b1b",
    border: `0.5px solid ${stress < 100 ? "#86efac" : stress < 150 ? "#fde047" : "#fca5a5"}`,
  };
}

function SortableCharRow({
  char,
  isActive,
  isSelecting,
  onEdit,
  onSelect,
}: {
  char: Character;
  isActive: boolean;
  isSelecting: boolean;
  onEdit: () => void;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: char.id });

  return (
    <div
      ref={setNodeRef}
      className="char-row"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        ⠿
      </div>

      <div className={`char-info ${isActive ? "active" : ""}`} onClick={onEdit}>
        <span className="char-name">{char.name}</span>
        <span className="summary-pill" style={hpPillStyle(char)}>
          {char.hp_current}/{char.hp_max} HP
        </span>
        {char.temp_hp > 0 && (
          <span
            className="summary-pill"
            style={{
              background: "#dbeafe",
              color: "#1e40af",
              border: "0.5px solid #93c5fd",
            }}
          >
            +{char.temp_hp} THP
          </span>
        )}
        {char.stress > 0 && (
          <span className="summary-pill" style={stressPillStyle(char.stress)}>
            {char.stress} Stress
          </span>
        )}
        {char.conditions.length > 0 && (
          <span className="condition-pill">{formatConditions(char)}</span>
        )}
      </div>

      {!isActive &&
        (isSelecting ? (
          <div className="spinner" />
        ) : (
          <button
            className="edit-btn select-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            Select
          </button>
        ))}
    </div>
  );
}

export default function PlayerRow({
  player,
  characters,
  isExpanded,
  onToggleExpand,
  onSelectCharacter,
  onEditCharacter,
  onAddCharacter,
  onDeletePlayer,
  onRenamePlayer,
  onReorderCharacters,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState(player.name);
  const [selectingCharId, setSelectingCharId] = useState<string | null>(null);

  const activeChar = characters.find(
    (c) => c.id === player.active_character_id,
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  useEffect(() => {
    if (selectingCharId === player.active_character_id) {
      const timeout = setTimeout(() => setSelectingCharId(null), 0);
      return () => clearTimeout(timeout);
    }
  }, [player.active_character_id, selectingCharId]);

  useEffect(() => {
    if (!isExpanded) {
      const timeout = setTimeout(() => {
        setEditingName(false);
        setEditName(player.name);
        setAdding(false);
        setNewName("");
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [isExpanded, player.name]);

  async function handleRename() {
    if (!editName.trim()) return;
    await onRenamePlayer(editName.trim());
    setEditingName(false);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    await onAddCharacter(newName.trim());
    setNewName("");
    setAdding(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = characters.findIndex((c) => c.id === active.id);
    const newIndex = characters.findIndex((c) => c.id === over.id);
    const reordered = [...characters];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onReorderCharacters(reordered.map((c, position) => ({ ...c, position })));
  }

  return (
    <div className={`player-row ${isExpanded ? "expanded" : ""}`}>
      <div className="player-header" onClick={onToggleExpand}>
        <div
          className="player-name-col"
          onClick={(e) => editingName && e.stopPropagation()}
        >
          {editingName && isExpanded ? (
            <input
              autoFocus
              value={editName}
              className="player-name-edit"
              style={{ width: 80 }}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setEditingName(false);
                  setEditName(player.name);
                }
              }}
            />
          ) : (
            <span className="player-name">{player.name}</span>
          )}
        </div>

        {!isExpanded &&
          (activeChar ? (
            <div className="player-char-summary">
              <span className="char-name">{activeChar.name}</span>
              <span className="summary-pill" style={hpPillStyle(activeChar)}>
                {activeChar.hp_current}/{activeChar.hp_max} HP
              </span>
              {activeChar.temp_hp > 0 && (
                <span
                  className="summary-pill"
                  style={{
                    background: "#dbeafe",
                    color: "#1e40af",
                    border: "0.5px solid #93c5fd",
                  }}
                >
                  +{activeChar.temp_hp} THP
                </span>
              )}
              {activeChar.stress > 0 && (
                <span
                  className="summary-pill"
                  style={stressPillStyle(activeChar.stress)}
                >
                  {activeChar.stress} Stress
                </span>
              )}
              {activeChar.conditions.length > 0 && (
                <span className="condition-pill">
                  {formatConditions(activeChar)}
                </span>
              )}
            </div>
          ) : (
            <div className="player-char-summary">
              <span
                style={{
                  color: "var(--color-text-tertiary, #aaa)",
                  fontSize: 12,
                  fontStyle: "italic",
                }}
              >
                No character selected
              </span>
            </div>
          ))}

        <div className="player-header-right">
          {isExpanded &&
            (editingName ? (
              <>
                <button
                  className="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename();
                  }}
                >
                  Save
                </button>
                <button
                  className="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingName(false);
                    setEditName(player.name);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingName(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePlayer();
                  }}
                >
                  Delete
                </button>
              </>
            ))}
          <span className="chevron">{isExpanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {isExpanded && (
        <div className="char-list">
          {characters.length === 0 && !adding && (
            <p className="empty-hint">No characters yet</p>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={characters.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {characters.map((char) => (
                <SortableCharRow
                  key={char.id}
                  char={char}
                  isActive={player.active_character_id === char.id}
                  isSelecting={selectingCharId === char.id}
                  onEdit={() => onEditCharacter(char.id)}
                  onSelect={() => {
                    setSelectingCharId(char.id);
                    onSelectCharacter(char.id);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>

          {adding ? (
            <div className="add-char-form">
              <input
                autoFocus
                placeholder="Character name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <button onClick={handleAdd}>Add</button>
              <button onClick={() => setAdding(false)}>Cancel</button>
            </div>
          ) : (
            <button className="add-char-btn" onClick={() => setAdding(true)}>
              + Add character
            </button>
          )}
        </div>
      )}
    </div>
  );
}
