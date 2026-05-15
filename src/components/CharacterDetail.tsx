import { useState } from "react";
import type { Character } from "../types";

const PRESET_EFFECTS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Diseased",
  "Exhausted",
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

function progressColor(value: number, high: number, mid: number) {
  if (value > high) return "#4ade80";
  if (value > mid) return "#facc15";
  return "#f87171";
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

  const hpPct = clamp((character.hp_current / character.hp_max) * 100, 0, 100);

  const stressPct = clamp((character.stress / 200) * 100, 0, 100);

  const activeEffectNames = new Set(character.conditions.map((c) => c.name));

  function update(fields: Partial<Character>) {
    onUpdate({
      ...character,
      ...fields,
    });
  }

  function adjustStat(
    field: "hp_current" | "hp_max" | "temp_hp" | "stress",
    delta: number,
  ) {
    let next = character[field] + delta;

    if (field === "hp_current") {
      next = Math.min(next, character.hp_max);
    }

    if (field === "hp_max") {
      next = Math.max(next, 1);
    }

    if (field === "temp_hp") {
      next = Math.max(next, 0);
    }

    if (field === "stress") {
      next = clamp(next, 0, 200);
    }

    update({ [field]: next });
  }

  function addEffect(name: string) {
    const existing = character.conditions.find(
      (effect) => effect.name === name,
    );

    if (!existing) {
      update({
        conditions: [...character.conditions, { name, count: 1 }],
      });

      return;
    }

    const max = MAX_STACKS[name];

    if (max && existing.count >= max) return;

    update({
      conditions: character.conditions.map((effect) =>
        effect.name === name ? { ...effect, count: effect.count + 1 } : effect,
      ),
    });
  }

  function adjustEffect(name: string, delta: number) {
    update({
      conditions: character.conditions
        .map((effect) => {
          if (effect.name !== name) return effect;

          const next = effect.count + delta;

          if (MAX_STACKS[name] && next > MAX_STACKS[name]) {
            return effect;
          }

          return {
            ...effect,
            count: next,
          };
        })
        .filter((effect) => effect.count > 0),
    });
  }

  function removeEffect(name: string) {
    update({
      conditions: character.conditions.filter((effect) => effect.name !== name),
    });
  }

  return (
    <div className="detail-view">
      <div className="detail-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>

        <div style={{ textAlign: "center" }}>
          <div className="detail-player-name">{playerName}</div>

          <h1 className="detail-name">{character.name}</h1>
        </div>

        <button
          className="delete-btn"
          style={{ marginLeft: "auto" }}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>

      <div className="stat-card">
        <div className="stat-label">Hit points</div>

        <div className="hp-bar-track">
          <div
            className="hp-bar-fill"
            style={{
              width: `${hpPct}%`,
              background: progressColor(hpPct, 50, 25),
            }}
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
              value={character.hp_current}
              readOnly={hpFocus !== "current"}
              className={`stat-input ${
                hpFocus === "current"
                  ? "stat-input-active"
                  : "stat-input-inactive"
              }`}
              onClick={() => setHpFocus("current")}
              onChange={(e) =>
                update({
                  hp_current: Number(e.target.value),
                })
              }
            />

            <span className="stat-divider">/</span>

            <input
              type="number"
              value={character.hp_max}
              readOnly={hpFocus !== "max"}
              className={`stat-input ${
                hpFocus === "max" ? "stat-input-active" : "stat-input-inactive"
              }`}
              onClick={() => setHpFocus("max")}
              onChange={(e) =>
                update({
                  hp_max: Number(e.target.value),
                })
              }
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

      <div className="stat-card">
        <div className="stat-label">Temporary HP</div>

        <div className="stat-row">
          <button className="adj-btn" onClick={() => adjustStat("temp_hp", -1)}>
            −
          </button>

          <input
            type="number"
            className="stat-input"
            value={character.temp_hp}
            onChange={(e) =>
              update({
                temp_hp: Math.max(0, Number(e.target.value)),
              })
            }
          />

          <button className="adj-btn" onClick={() => adjustStat("temp_hp", 1)}>
            +
          </button>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Stress</div>

        <div className="hp-bar-track">
          <div
            className="hp-bar-fill"
            style={{
              width: `${stressPct}%`,
              background: progressColor(200 - character.stress, 100, 50),
            }}
          />
        </div>

        <div className="stat-row">
          <button
            className="adj-btn"
            style={{
              color: character.stress <= 0 ? "#ccc" : undefined,
            }}
            onClick={() => adjustStat("stress", -1)}
          >
            −
          </button>

          <input
            type="number"
            className="stat-input"
            value={character.stress}
            onChange={(e) =>
              update({
                stress: Math.max(0, Number(e.target.value)),
              })
            }
          />

          <button
            className="adj-btn"
            style={{
              color: character.stress >= 200 ? "#ccc" : undefined,
            }}
            onClick={() => adjustStat("stress", 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="stat-card">
        <div
          className="stat-label-row"
          onClick={() => setConditionsExpanded((prev) => !prev)}
        >
          <span className="stat-label">Conditions</span>

          {!conditionsExpanded &&
            (character.conditions.length ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                {character.conditions.map((condition) => (
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
            {character.conditions.length > 0 && (
              <div className="active-effects">
                {character.conditions.map((effect) => (
                  <div key={effect.name} className="effect-row">
                    <span className="effect-name">{effect.name}</span>

                    <div className="effect-controls">
                      {(effect.name === "Exhausted" ||
                        effect.name === "Diseased") && (
                        <>
                          <button
                            className="adj-btn small"
                            style={{
                              color: effect.count <= 1 ? "#ccc" : undefined,
                            }}
                            onClick={() => adjustEffect(effect.name, -1)}
                          >
                            −
                          </button>

                          <span className="effect-count">×{effect.count}</span>

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
                        </>
                      )}

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
              {PRESET_EFFECTS.filter(
                (effect) => !activeEffectNames.has(effect),
              ).map((effect) => (
                <button
                  key={effect}
                  className="preset-btn"
                  onClick={() => addEffect(effect)}
                >
                  + {effect}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
