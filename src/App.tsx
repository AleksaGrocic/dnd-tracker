import { useEffect, useState } from "react";
import "./App.css";

import PlayerRow from "./components/PlayerRow";
import CharacterDetail from "./components/CharacterDetail";

import { supabase } from "./lib/supabase";
import { hashPassword } from "./lib/auth";

import type { Player, Character } from "./types";

const PASSWORD_HASH = import.meta.env.VITE_PASSWORD_HASH as string;
const INLINE_DETAIL = true;

export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => localStorage.getItem("dnd-unlocked") === "true",
  );

  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);

  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  const [detailCharacterId, setDetailCharacterId] = useState<string | null>(
    null,
  );

  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  const detailCharacter =
    characters.find((c) => c.id === detailCharacterId) ?? null;

  async function fetchPlayers() {
    const { data } = await supabase.from("players").select("*").order("name");

    if (data) {
      setPlayers(data);
    }
  }

  async function fetchCharacters() {
    const { data } = await supabase
      .from("characters")
      .select("*")
      .order("position");

    if (data) {
      setCharacters(data);
    }
  }

  async function handleUnlock() {
    const hash = await hashPassword(input);

    if (hash === PASSWORD_HASH) {
      localStorage.setItem("dnd-unlocked", "true");
      setUnlocked(true);
      return;
    }

    setError(true);
    setInput("");
  }

  async function addPlayer() {
    const name = newPlayerName.trim();

    if (!name) return;

    await supabase.from("players").insert({
      name,
      active_character_id: null,
    });

    setNewPlayerName("");
    setAddingPlayer(false);
  }

  async function renamePlayer(playerId: string, name: string) {
    await supabase.from("players").update({ name }).eq("id", playerId);
  }

  async function deletePlayer(playerId: string) {
    if (!confirm("Remove this player and all their characters?")) {
      return;
    }

    await supabase.from("players").delete().eq("id", playerId);
  }

  async function setActiveCharacter(
    playerId: string,
    characterId: string | null,
  ) {
    await supabase
      .from("players")
      .update({ active_character_id: characterId })
      .eq("id", playerId);
  }

  async function updateCharacter(updated: Character) {
    setCharacters((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c)),
    );

    await supabase.from("characters").update(updated).eq("id", updated.id);
  }

  async function deleteCharacter(characterId: string) {
    if (!confirm("Remove this character?")) {
      return;
    }

    await supabase.from("characters").delete().eq("id", characterId);

    setDetailCharacterId(null);
  }

  async function addCharacter(playerId: string, name: string) {
    const playerCharacters = characters.filter((c) => c.player_id === playerId);

    await supabase.from("characters").insert({
      player_id: playerId,
      name,
      hp_current: 10,
      hp_max: 10,
      temp_hp: 0,
      stress: 0,
      conditions: [],
      position: playerCharacters.length,
    });
  }

  async function reorderCharacters(reordered: Character[]) {
    setCharacters((prev) => {
      const reorderedIds = new Set(reordered.map((c) => c.id));

      return [
        ...prev.filter((c) => !reorderedIds.has(c.id)),
        ...reordered,
      ].sort((a, b) => a.position - b.position);
    });

    await Promise.all(
      reordered.map((character) =>
        supabase
          .from("characters")
          .update({ position: character.position })
          .eq("id", character.id),
      ),
    );
  }

  useEffect(() => {
    if (!unlocked) {
      return;
    }

    queueMicrotask(() => {
      void Promise.all([fetchPlayers(), fetchCharacters()]);
    });

    const channel = supabase
      .channel("realtime-changes")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
        },
        fetchPlayers,
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "characters",
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Character;

            setCharacters((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            );

            return;
          }

          fetchCharacters();
        },
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <h2 className="lock-title">Enter password</h2>

          <input
            className="lock-input"
            type="password"
            placeholder="Password"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleUnlock();
              }
            }}
          />

          {error && <div className="lock-error">Incorrect password</div>}

          <button
            type="button"
            className="lock-btn"
            onClick={() => void handleUnlock()}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  if (!INLINE_DETAIL && detailCharacter) {
    const playerName =
      players.find((p) => p.id === detailCharacter.player_id)?.name ?? "";

    return (
      <CharacterDetail
        character={detailCharacter}
        playerName={playerName}
        onUpdate={updateCharacter}
        onBack={() => setDetailCharacterId(null)}
        onDelete={() => deleteCharacter(detailCharacter.id)}
      />
    );
  }

  return (
    <div className="app">
      <div className="player-list">
        {players.map((player) => {
          const playerCharacters = characters.filter(
            (c) => c.player_id === player.id,
          );

          const inlineDetailCharacter = INLINE_DETAIL
            ? (playerCharacters.find((c) => c.id === detailCharacterId) ?? null)
            : null;

          if (inlineDetailCharacter) {
            return (
              <div key={player.id} className="player-row">
                <CharacterDetail
                  character={inlineDetailCharacter}
                  playerName={player.name}
                  onUpdate={updateCharacter}
                  onBack={() => setDetailCharacterId(null)}
                  onDelete={() => deleteCharacter(inlineDetailCharacter.id)}
                />
              </div>
            );
          }

          return (
            <PlayerRow
              key={player.id}
              player={player}
              characters={playerCharacters}
              isExpanded={expandedPlayerId === player.id}
              onToggleExpand={() =>
                setExpandedPlayerId((prev) =>
                  prev === player.id ? null : player.id,
                )
              }
              onSelectCharacter={(charId) =>
                setActiveCharacter(player.id, charId)
              }
              onEditCharacter={setDetailCharacterId}
              onAddCharacter={(name) => addCharacter(player.id, name)}
              onDeletePlayer={() => deletePlayer(player.id)}
              onRenamePlayer={(name) => renamePlayer(player.id, name)}
              onReorderCharacters={reorderCharacters}
            />
          );
        })}

        {addingPlayer ? (
          <div className="add-char-form">
            <input
              autoFocus
              placeholder="Player name"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addPlayer();
                }
              }}
            />

            <button onClick={addPlayer}>Add</button>

            <button
              onClick={() => {
                setAddingPlayer(false);
                setNewPlayerName("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button className="add-btn" onClick={() => setAddingPlayer(true)}>
            + Add player
          </button>
        )}
      </div>
    </div>
  );
}
