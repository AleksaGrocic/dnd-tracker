import { useEffect, useRef, useState } from "react";
import type { Character } from "../types";

const PRESET_EFFECTS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

const SPECIAL_EFFECTS = ["Diseased", "Exhausted"];

const AFFLICTIONS = [
  "Fearful",
  "Paranoid",
  "Selfish",
  "Masochistic",
  "Abusive",
  "Hopeless",
  "Irrational",
  "Bloodthirsty",
];

const VIRTUES = ["Stalwart", "Courageous", "Focused", "Powerful", "Vigorous"];

const MAX_STACKS: Record<string, number> = {
  Exhausted: 6,
  Diseased: 10,
};

interface Props {
  character: Character;
  playerName: string;
  onUpdate: (c: Character) => void;
  onBack: () => void;
  onDelete: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function conditionLabel(name: string, count: number) {
  return (name === "Exhausted" || name === "Diseased") && count > 1
    ? `${name} ×${count}`
    : name;
}

export default function CharacterDetail({
  character,
  playerName,
  onUpdate,
  onBack,
  onDelete,
}: Props) {
  const [hpFocus, setHpFocus] = useState<"current" | "max">("current");
  const [conditionsExpanded, setConditionsExpanded] = useState(false);
  const [specialExpanded, setSpecialExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState(character.name);
  const [traitOpen, setTraitOpen] = useState(false);
  const [traitPos, setTraitPos] = useState({ top: 0, left: 0, width: 0 });
  const traitBtnRef = useRef<HTMLButtonElement>(null);

  const selectedTrait = character.trait
    ? {
        name: character.trait,
        type: AFFLICTIONS.includes(character.trait)
          ? ("affliction" as const)
          : ("virtue" as const),
      }
    : null;

  const hpPct = clamp((character.hp_current / character.hp_max) * 100, 0, 100);
  const stressPct = clamp((character.stress / 200) * 100, 0, 100);
  const regularConditions = character.conditions.filter(
    (c) => !SPECIAL_EFFECTS.includes(c.name),
  );
  const specialConditions = character.conditions.filter((c) =>
    SPECIAL_EFFECTS.includes(c.name),
  );
  const activeEffectNames = new Set(character.conditions.map((c) => c.name));
  const hpBarColor =
    hpPct > 50 ? "#4ade80" : hpPct > 25 ? "#facc15" : "#f87171";
  const stressBarColor =
    character.stress < 50
      ? "#4ade80"
      : character.stress < 75
        ? "#facc15"
        : "#f87171";

  useEffect(() => {
    if (!traitOpen) return;
    function handleClick(e: MouseEvent | TouchEvent) {
      if (traitBtnRef.current?.contains(e.target as Node)) {
        justClosedRef.current = true;
      }
      setTraitOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [traitOpen]);

  function useNumberInput(value: number, onChange: (n: number) => void) {
    const [display, setDisplay] = useState(String(value));

    useEffect(() => {
      setDisplay(String(value));
    }, [value]);

    return {
      value: display,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setDisplay(e.target.value),
      onBlur: () => {
        const n = Number(display);
        onChange(isNaN(n) ? 0 : n);
        setDisplay(String(isNaN(n) ? 0 : n));
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          const n = Number(display);
          onChange(isNaN(n) ? 0 : n);
          setDisplay(String(isNaN(n) ? 0 : n));
          (e.target as HTMLInputElement).blur();
        }
      },
    };
  }

  const hpCurrentInput = useNumberInput(character.hp_current, (n) =>
    update({ hp_current: clamp(n, 0, character.hp_max) }),
  );
  const hpMaxInput = useNumberInput(character.hp_max, (n) =>
    update({ hp_max: Math.max(n, 1) }),
  );
  const tempHpInput = useNumberInput(character.temp_hp, (n) =>
    update({ temp_hp: Math.max(n, 0) }),
  );
  const stressInput = useNumberInput(character.stress, (n) =>
    update({ stress: clamp(n, 0, 200) }),
  );

  function update(fields: Partial<Character>) {
    onUpdate({ ...character, ...fields });
  }

  function adjustStat(
    field: "hp_current" | "hp_max" | "temp_hp" | "stress",
    delta: number,
  ) {
    let next = character[field] + delta;
    if (field === "hp_current") next = clamp(next, 0, character.hp_max);
    if (field === "hp_max") next = Math.max(next, 1);
    if (field === "temp_hp") next = Math.max(next, 0);
    if (field === "stress") next = clamp(next, 0, 200);
    update({ [field]: next });
  }

  function addEffect(name: string) {
    const existing = character.conditions.find((e) => e.name === name);
    if (!existing) {
      update({ conditions: [...character.conditions, { name, count: 1 }] });
      return;
    }
    const max = MAX_STACKS[name];
    if (max && existing.count >= max) return;
    update({
      conditions: character.conditions.map((e) =>
        e.name === name ? { ...e, count: e.count + 1 } : e,
      ),
    });
  }

  function adjustEffect(name: string, delta: number) {
    update({
      conditions: character.conditions
        .map((e) => {
          if (e.name !== name) return e;
          const next = e.count + delta;
          if (MAX_STACKS[name] && next > MAX_STACKS[name]) return e;
          return { ...e, count: next };
        })
        .filter((e) => e.count > 0),
    });
  }

  function removeEffect(name: string) {
    update({ conditions: character.conditions.filter((e) => e.name !== name) });
  }

  const justClosedRef = useRef(false);

  function openTrait() {
    if (justClosedRef.current) {
      setTimeout(() => {
        justClosedRef.current = false;
      }, 0);
      return;
    }
    if (traitBtnRef.current) {
      const rect = traitBtnRef.current.getBoundingClientRect();
      setTraitPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setTraitOpen(true);
  }

  return (
    <div className="detail-view">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div style={{ textAlign: "center" }}>
          <div className="detail-player-name">{playerName}</div>
          {editingName ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "center",
              }}
            >
              <input
                autoFocus
                className="name-edit-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    update({ name: editedName.trim() || character.name });
                    setEditingName(false);
                  }
                  if (e.key === "Escape") {
                    setEditedName(character.name);
                    setEditingName(false);
                  }
                }}
              />
              <button
                className="edit-btn"
                onClick={() => {
                  update({ name: editedName.trim() || character.name });
                  setEditingName(false);
                }}
              >
                Save
              </button>
              <button
                className="edit-btn"
                onClick={() => {
                  setEditedName(character.name);
                  setEditingName(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              className="detail-name"
              onClick={() => setEditingName(true)}
              style={{ cursor: "pointer" }}
            >
              {character.name}{" "}
              <span
                style={{
                  fontSize: 14,
                  color: "var(--color-text-tertiary, #aaa)",
                }}
              >
                ✎
              </span>
            </h1>
          )}
        </div>
        <button
          className="delete-btn"
          style={{ marginLeft: "auto" }}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, overflow: "hidden" }}>
        <div className="stat-card" style={{ flex: 2 }}>
          <div className="stat-label">Hit points</div>
          <div className="hp-bar-track">
            <div
              className="hp-bar-fill"
              style={{ width: `${hpPct}%`, background: hpBarColor }}
            />
          </div>
          <div className="stat-row">
            <button
              className="adj-btn"
              onClick={() =>
                adjustStat(hpFocus === "current" ? "hp_current" : "hp_max", -1)
              }
              style={{
                color:
                  (hpFocus === "current" && character.hp_current <= 0) ||
                  (hpFocus === "max" && character.hp_max <= 1)
                    ? "#ccc"
                    : undefined,
              }}
            >
              −
            </button>
            <div className="stat-value-group">
              <input
                type="number"
                readOnly={hpFocus !== "current"}
                className={`stat-input ${hpFocus === "current" ? "stat-input-active" : "stat-input-inactive"}`}
                onClick={() => setHpFocus("current")}
                {...hpCurrentInput}
              />
              <span className="stat-divider">/</span>
              <input
                type="number"
                readOnly={hpFocus !== "max"}
                className={`stat-input ${hpFocus === "max" ? "stat-input-active" : "stat-input-inactive"}`}
                onClick={() => setHpFocus("max")}
                {...hpMaxInput}
              />
            </div>
            <button
              className="adj-btn"
              onClick={() =>
                adjustStat(hpFocus === "current" ? "hp_current" : "hp_max", 1)
              }
              style={{
                color:
                  hpFocus === "current" &&
                  character.hp_current >= character.hp_max
                    ? "#ccc"
                    : undefined,
              }}
            >
              +
            </button>
          </div>
          <div className="stat-hint">
            {hpFocus === "current" ? "editing current HP" : "editing max HP"} ·
            tap to switch
          </div>
        </div>

        <div className="stat-card" style={{ flex: 1, minWidth: 90 }}>
          <div className="stat-label">Temp HP</div>
          <div className="stat-card-centered">
            <div className="stat-row">
              <button
                className="adj-btn"
                onClick={() => adjustStat("temp_hp", -1)}
                style={{ color: character.temp_hp <= 0 ? "#ccc" : undefined }}
              >
                −
              </button>
              <input type="number" className="stat-input" {...tempHpInput} />
              <button
                className="adj-btn"
                onClick={() => adjustStat("temp_hp", 1)}
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Stress</div>
        <div className="hp-bar-track">
          <div
            className="hp-bar-fill"
            style={{ width: `${stressPct}%`, background: stressBarColor }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            className="stat-row"
            style={{ justifyContent: "flex-start", flex: "none" }}
          >
            <button
              className="adj-btn"
              onClick={() => adjustStat("stress", -1)}
              style={{ color: character.stress <= 0 ? "#ccc" : undefined }}
            >
              −
            </button>
            <input type="number" className="stat-input" {...stressInput} />
            <button
              className="adj-btn"
              onClick={() => adjustStat("stress", 1)}
              style={{ color: character.stress >= 200 ? "#ccc" : undefined }}
            >
              +
            </button>
          </div>

          <div style={{ position: "relative", flex: 1 }}>
            <button
              ref={traitBtnRef}
              className="trait-btn"
              style={{
                borderColor: selectedTrait
                  ? selectedTrait.type === "affliction"
                    ? "#fca5a5"
                    : "#86efac"
                  : undefined,
                color: selectedTrait
                  ? selectedTrait.type === "affliction"
                    ? "#991b1b"
                    : "#166534"
                  : undefined,
                background: selectedTrait
                  ? selectedTrait.type === "affliction"
                    ? "#fee2e2"
                    : "#dcfce7"
                  : undefined,
              }}
              onClick={() => {
                openTrait();
              }}
            >
              {selectedTrait ? selectedTrait.name : "No trait"} ▾
            </button>

            {traitOpen && (
              <div
                className="trait-dropdown"
                style={{
                  top: traitPos.top,
                  left: traitPos.left,
                  width: traitPos.width,
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <div className="trait-section-label">Afflictions</div>
                {AFFLICTIONS.map((name) => (
                  <button
                    key={name}
                    className={`trait-option trait-option-affliction ${selectedTrait?.name === name ? "trait-option-active" : ""}`}
                    onClick={() => {
                      update({
                        trait: selectedTrait?.name === name ? null : name,
                      });
                      setTraitOpen(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
                <div className="trait-section-label" style={{ marginTop: 6 }}>
                  Virtues
                </div>
                {VIRTUES.map((name) => (
                  <button
                    key={name}
                    className={`trait-option trait-option-virtue ${selectedTrait?.name === name ? "trait-option-active" : ""}`}
                    onClick={() => {
                      update({
                        trait: selectedTrait?.name === name ? null : name,
                      });
                      setTraitOpen(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedTrait && (
            <button
              className="remove-btn"
              style={{ flexShrink: 0 }}
              onClick={() => update({ trait: null })}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="stat-card">
        <div
          className="stat-label-row"
          onClick={() => setConditionsExpanded((prev) => !prev)}
        >
          <span className="stat-label">Conditions</span>
          {!conditionsExpanded &&
            (regularConditions.length ? (
              <div
                style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 4 }}
              >
                {regularConditions.map((condition) => (
                  <span key={condition.name} className="condition-pill">
                    {conditionLabel(condition.name, condition.count)}
                  </span>
                ))}
              </div>
            ) : (
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: "var(--color-text-tertiary, #aaa)",
                }}
              >
                No conditions
              </span>
            ))}
          <span className="chevron">{conditionsExpanded ? "▲" : "▼"}</span>
        </div>

        {conditionsExpanded && (
          <>
            {regularConditions.length > 0 && (
              <div className="active-effects">
                {regularConditions.map((effect) => (
                  <div key={effect.name} className="effect-row">
                    <span className="effect-name">{effect.name}</span>
                    <div className="effect-controls">
                      <button
                        className="remove-btn"
                        onClick={() => removeEffect(effect.name)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="effect-presets">
              {PRESET_EFFECTS.filter((e) => !activeEffectNames.has(e)).map(
                (effect) => (
                  <button
                    key={effect}
                    className="preset-btn"
                    onClick={() => addEffect(effect)}
                  >
                    + {effect}
                  </button>
                ),
              )}
            </div>
          </>
        )}
      </div>

      <div className="stat-card">
        <div
          className="stat-label-row"
          onClick={() => setSpecialExpanded((prev) => !prev)}
        >
          <span className="stat-label">Special conditions</span>
          {!specialExpanded &&
            (specialConditions.length ? (
              <div
                style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 4 }}
              >
                {specialConditions.map((condition) => (
                  <span key={condition.name} className="special-pill">
                    {conditionLabel(condition.name, condition.count)}
                  </span>
                ))}
              </div>
            ) : (
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: "var(--color-text-tertiary, #aaa)",
                }}
              >
                None
              </span>
            ))}
          <span className="chevron">{specialExpanded ? "▲" : "▼"}</span>
        </div>

        {specialExpanded && (
          <>
            {specialConditions.length > 0 && (
              <div className="active-effects">
                {specialConditions.map((effect) => (
                  <div
                    key={effect.name}
                    className="effect-row effect-row-special"
                  >
                    <span className="effect-name-special">{effect.name}</span>
                    <div className="effect-controls">
                      <button
                        className="adj-btn small"
                        style={{
                          color: effect.count <= 1 ? "#ccc" : undefined,
                        }}
                        onClick={() => adjustEffect(effect.name, -1)}
                      >
                        −
                      </button>
                      <span className="effect-count-special">
                        ×{effect.count}
                      </span>
                      <button
                        className="adj-btn small"
                        style={{
                          color:
                            MAX_STACKS[effect.name] &&
                            effect.count >= MAX_STACKS[effect.name]
                              ? "#ccc"
                              : undefined,
                        }}
                        onClick={() => adjustEffect(effect.name, 1)}
                      >
                        +
                      </button>
                      <button
                        className="remove-btn"
                        onClick={() => removeEffect(effect.name)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="effect-presets">
              {SPECIAL_EFFECTS.filter((e) => !activeEffectNames.has(e)).map(
                (effect) => (
                  <button
                    key={effect}
                    className="preset-btn preset-btn-special"
                    onClick={() => addEffect(effect)}
                  >
                    + {effect}
                  </button>
                ),
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
