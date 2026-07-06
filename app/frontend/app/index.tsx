import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

// -------------------- CONFIG --------------------
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const PLAY_WIDTH = Math.min(SCREEN_WIDTH, 480);
const PLAY_HEIGHT = Math.min(SCREEN_HEIGHT * 0.6, 560);

const SHIP_WIDTH = 52;
const SHIP_HEIGHT = 56;
const SHIP_STEP = 24;
const SHIP_Y = PLAY_HEIGHT - SHIP_HEIGHT - 16;

const ASTEROID_SIZE = 40;
const ASTEROID_STEP = 6;
const TICK_MS = 30;

type Asteroid = { x: number; y: number };
type ScoreEntry = { id: string; player_name: string; score: number };

export default function SpaceEscapeRunner() {
  const insets = useSafeAreaInsets();

  const [playerName, setPlayerName] = useState("Pilot");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [savingScore, setSavingScore] = useState(false);

  const [shipX, setShipX] = useState((PLAY_WIDTH - SHIP_WIDTH) / 2);

  const [asteroid, setAsteroid] = useState<Asteroid>({
    x: Math.random() * (PLAY_WIDTH - ASTEROID_SIZE),
    y: -ASTEROID_SIZE,
  });

  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const shipXRef = useRef(shipX);
  const asteroidRef = useRef(asteroid);
  const scoreRef = useRef(score);
  useEffect(() => { shipXRef.current = shipX; }, [shipX]);
  useEffect(() => { asteroidRef.current = asteroid; }, [asteroid]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const fetchLeaderboard = useCallback(async () => {
    if (!BACKEND_URL) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/scores/top?limit=5`);
      if (!res.ok) return;
      const data: ScoreEntry[] = await res.json();
      setLeaderboard(data);
      if (data.length > 0) {
        const top = Math.max(...data.map((d) => d.score));
        setBestScore((b) => Math.max(b, top));
      }
    } catch { /* offline is fine */ }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const submitScore = useCallback(async (finalScore: number) => {
    if (!BACKEND_URL || finalScore <= 0) return;
    setSavingScore(true);
    try {
      await fetch(`${BACKEND_URL}/api/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_name: playerName.trim() || "Pilot",
          score: finalScore,
        }),
      });
      await fetchLeaderboard();
    } catch { /* offline */ } finally {
      setSavingScore(false);
    }
  }, [playerName, fetchLeaderboard]);

  const stopLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const endGame = useCallback((finalScore: number) => {
    stopLoop();
    setIsPlaying(false);
    setIsGameOver(true);
    setBestScore((b) => Math.max(b, finalScore));
    submitScore(finalScore);
  }, [stopLoop, submitScore]);

  const tick = useCallback(() => {
    const currentAst = asteroidRef.current;
    const currentShipX = shipXRef.current;

    let nextY = currentAst.y + ASTEROID_STEP;
    let nextX = currentAst.x;

    if (nextY >= PLAY_HEIGHT) {
      nextY = -ASTEROID_SIZE;
      nextX = Math.random() * (PLAY_WIDTH - ASTEROID_SIZE);
      setScore((s) => s + 1);
    }

    const shipLeft = currentShipX;
    const shipRight = currentShipX + SHIP_WIDTH;
    const shipTop = SHIP_Y;
    const shipBottom = SHIP_Y + SHIP_HEIGHT;
    const astLeft = nextX;
    const astRight = nextX + ASTEROID_SIZE;
    const astTop = nextY;
    const astBottom = nextY + ASTEROID_SIZE;

    const collided =
      shipLeft < astRight &&
      shipRight > astLeft &&
      shipTop < astBottom &&
      shipBottom > astTop;

    setAsteroid({ x: nextX, y: nextY });
    if (collided) endGame(scoreRef.current);
  }, [endGame]);

  const moveLeft = useCallback(() => {
    setShipX((x) => Math.max(0, x - SHIP_STEP));
  }, []);
  const moveRight = useCallback(() => {
    setShipX((x) => Math.min(PLAY_WIDTH - SHIP_WIDTH, x + SHIP_STEP));
  }, []);

  const startGame = useCallback(() => {
    stopLoop();
    setScore(0);
    setIsGameOver(false);
    setShipX((PLAY_WIDTH - SHIP_WIDTH) / 2);
    setAsteroid({
      x: Math.random() * (PLAY_WIDTH - ASTEROID_SIZE),
      y: -ASTEROID_SIZE,
    });
    setIsPlaying(true);
  }, [stopLoop]);

  useEffect(() => {
    if (isPlaying) loopRef.current = setInterval(tick, TICK_MS);
    else stopLoop();
    return () => stopLoop();
  }, [isPlaying, tick, stopLoop]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if (!isPlaying) return;
      if (e.key === "ArrowLeft" || e.key === "a") moveLeft();
      if (e.key === "ArrowRight" || e.key === "d") moveRight();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isPlaying, moveLeft, moveRight]);

  const stars = useMemo(
    () => Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * PLAY_WIDTH,
      top: Math.random() * PLAY_HEIGHT,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.6 + 0.2,
    })), []
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#050716", "#0b1030", "#1a0b3a"]}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header} testID="game-header">
          <Text style={styles.title} testID="game-title">SPACE ESCAPE</Text>
          <Text style={styles.subtitle}>RUNNER</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard} testID="score-card">
            <Text style={styles.statLabel}>SCORE</Text>
            <Text style={styles.statValue} testID="current-score-value">{score}</Text>
          </View>
          <View style={styles.statCard} testID="best-score-card">
            <Text style={styles.statLabel}>BEST</Text>
            <Text style={[styles.statValue, { color: "#ffd166" }]}>{bestScore}</Text>
          </View>
        </View>

        {!isPlaying && (
          <View style={styles.nameRow}>
            <Text style={styles.nameLabel}>PILOT NAME</Text>
            <TextInput
              testID="player-name-input"
              value={playerName}
              onChangeText={setPlayerName}
              maxLength={20}
              placeholder="Pilot"
              placeholderTextColor="#5a5f7d"
              style={styles.nameInput}
              autoCorrect={false}
            />
          </View>
        )}

        <View style={[styles.playArea, { width: PLAY_WIDTH, height: PLAY_HEIGHT }]} testID="play-area">
          {stars.map((s) => (
            <View key={s.id} style={{
              position: "absolute", left: s.left, top: s.top,
              width: s.size, height: s.size, borderRadius: s.size,
              backgroundColor: "#ffffff", opacity: s.opacity,
            }} />
          ))}

          {(isPlaying || isGameOver) && (
            <View testID="asteroid" style={[styles.asteroid, { left: asteroid.x, top: asteroid.y }]}>
              <View style={styles.asteroidCrater1} />
              <View style={styles.asteroidCrater2} />
            </View>
          )}

          <View testID="spaceship" style={[styles.ship, { left: shipX, top: SHIP_Y }]}>
            <View style={styles.shipBody} />
            <View style={styles.shipCockpit} />
            <View style={styles.shipWingLeft} />
            <View style={styles.shipWingRight} />
            <View style={styles.shipFlame} />
          </View>

          {isGameOver && (
            <View style={styles.overlay} testID="game-over-overlay">
              <Text style={styles.overOopsText}>GAME OVER</Text>
              <Text style={styles.overScoreText}>
                Final Score: <Text style={{ color: "#ffd166" }}>{score}</Text>
              </Text>
              {savingScore && <Text style={styles.savingText}>Saving score…</Text>}
            </View>
          )}

          {!isPlaying && !isGameOver && (
            <View style={styles.overlay} testID="pre-start-overlay">
              <Text style={styles.readyText}>READY?</Text>
              <Text style={styles.hintText}>Dodge the asteroids. Survive as long as you can.</Text>
            </View>
          )}
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            testID="move-left-button"
            onPress={moveLeft}
            disabled={!isPlaying}
            style={({ pressed }) => [
              styles.moveBtn,
              !isPlaying && styles.moveBtnDisabled,
              pressed && isPlaying && styles.moveBtnPressed,
            ]}
          ><Text style={styles.moveBtnText}>◀  LEFT</Text></Pressable>
          <Pressable
            testID="move-right-button"
            onPress={moveRight}
            disabled={!isPlaying}
            style={({ pressed }) => [
              styles.moveBtn,
              !isPlaying && styles.moveBtnDisabled,
              pressed && isPlaying && styles.moveBtnPressed,
            ]}
          ><Text style={styles.moveBtnText}>RIGHT  ▶</Text></Pressable>
        </View>

        <Pressable
          testID={isGameOver ? "restart-game-button" : "start-game-button"}
          onPress={startGame}
          style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
        >
          <LinearGradient
            colors={["#7b2ff7", "#f107a3"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.startBtnGradient}
          >
            <Text style={styles.startBtnText}>
              {isGameOver ? "PLAY AGAIN" : isPlaying ? "RUNNING…" : "START GAME"}
            </Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.leaderboardCard} testID="leaderboard-card">
          <Text style={styles.leaderboardTitle}>TOP PILOTS</Text>
          {leaderboard.length === 0 ? (
            <Text style={styles.leaderboardEmpty} testID="leaderboard-empty">
              No scores yet. Be the first!
            </Text>
          ) : leaderboard.map((entry, idx) => (
            <View key={entry.id} style={styles.leaderboardRow} testID={`leaderboard-row-${idx}`}>
              <Text style={styles.leaderboardRank}>#{idx + 1}</Text>
              <Text style={styles.leaderboardName} numberOfLines={1}>{entry.player_name}</Text>
              <Text style={styles.leaderboardScore}>{entry.score}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050716" },
  scroll: { alignItems: "center", paddingHorizontal: 16, paddingTop: 8 },
  header: { alignItems: "center", marginTop: 8, marginBottom: 16 },
  title: { color: "#ffffff", fontSize: 30, fontWeight: "900", letterSpacing: 4 },
  subtitle: { color: "#8a5cf6", fontSize: 16, fontWeight: "700", letterSpacing: 8, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, width: "100%", maxWidth: PLAY_WIDTH, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)" },
  statLabel: { color: "#a5a8c1", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  statValue: { color: "#ffffff", fontSize: 28, fontWeight: "900", marginTop: 2 },
  nameRow: { width: "100%", maxWidth: PLAY_WIDTH, marginBottom: 12 },
  nameLabel: { color: "#a5a8c1", fontSize: 11, fontWeight: "700", letterSpacing: 2, marginBottom: 6 },
  nameInput: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: "#ffffff", borderWidth: 1, borderColor: "rgba(139,92,246,0.35)", fontSize: 15 },
  playArea: { backgroundColor: "rgba(5,7,22,0.6)", borderRadius: 20, borderWidth: 1, borderColor: "rgba(139,92,246,0.35)", overflow: "hidden", position: "relative" },
  ship: { position: "absolute", width: SHIP_WIDTH, height: SHIP_HEIGHT, alignItems: "center", justifyContent: "flex-start" },
  shipBody: { position: "absolute", top: 8, width: 20, height: 40, backgroundColor: "#e2e8f0", borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  shipCockpit: { position: "absolute", top: 16, width: 12, height: 12, borderRadius: 6, backgroundColor: "#3ee6ff" },
  shipWingLeft: { position: "absolute", left: 2, top: 22, width: 16, height: 22, backgroundColor: "#8a5cf6", borderTopLeftRadius: 10, borderBottomLeftRadius: 4, transform: [{ skewY: "15deg" }] },
  shipWingRight: { position: "absolute", right: 2, top: 22, width: 16, height: 22, backgroundColor: "#8a5cf6", borderTopRightRadius: 10, borderBottomRightRadius: 4, transform: [{ skewY: "-15deg" }] },
  shipFlame: { position: "absolute", bottom: 0, width: 10, height: 12, backgroundColor: "#ff7a2d", borderBottomLeftRadius: 6, borderBottomRightRadius: 6, opacity: 0.9 },
  asteroid: { position: "absolute", width: ASTEROID_SIZE, height: ASTEROID_SIZE, borderRadius: ASTEROID_SIZE / 2, backgroundColor: "#7a6a55", borderWidth: 2, borderColor: "#5a4a3a" },
  asteroidCrater1: { position: "absolute", top: 8, left: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: "#5a4a3a" },
  asteroidCrater2: { position: "absolute", bottom: 8, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: "#5a4a3a" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,7,22,0.55)", paddingHorizontal: 20 },
  overOopsText: { color: "#ff4d6d", fontSize: 34, fontWeight: "900", letterSpacing: 3 },
  overScoreText: { color: "#ffffff", fontSize: 18, marginTop: 8, fontWeight: "600" },
  savingText: { color: "#a5a8c1", fontSize: 12, marginTop: 10 },
  readyText: { color: "#ffffff", fontSize: 30, fontWeight: "900", letterSpacing: 4 },
  hintText: { color: "#a5a8c1", fontSize: 13, marginTop: 8, textAlign: "center", maxWidth: 260 },
  controlsRow: { flexDirection: "row", gap: 12, marginTop: 16, width: "100%", maxWidth: PLAY_WIDTH },
  moveBtn: { flex: 1, height: 56, borderRadius: 14, backgroundColor: "rgba(139,92,246,0.2)", borderWidth: 1, borderColor: "rgba(139,92,246,0.6)", alignItems: "center", justifyContent: "center" },
  moveBtnDisabled: { opacity: 0.4 },
  moveBtnPressed: { backgroundColor: "rgba(139,92,246,0.4)", transform: [{ scale: 0.98 }] },
  moveBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "800", letterSpacing: 2 },
  startBtn: { marginTop: 16, width: "100%", maxWidth: PLAY_WIDTH, borderRadius: 16, overflow: "hidden" },
  startBtnPressed: { transform: [{ scale: 0.98 }] },
  startBtnGradient: { height: 58, alignItems: "center", justifyContent: "center" },
  startBtnText: { color: "#ffffff", fontSize: 17, fontWeight: "900", letterSpacing: 3 },
  leaderboardCard: { marginTop: 20, width: "100%", maxWidth: PLAY_WIDTH, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(139,92,246,0.3)", padding: 16 },
  leaderboardTitle: { color: "#ffffff", fontSize: 14, fontWeight: "900", letterSpacing: 3, marginBottom: 10 },
  leaderboardEmpty: { color: "#a5a8c1", fontSize: 13, fontStyle: "italic" },
  leaderboardRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  leaderboardRank: { color: "#8a5cf6", fontSize: 14, fontWeight: "900", width: 32 },
  leaderboardName: { flex: 1, color: "#ffffff", fontSize: 14, fontWeight: "600" },
  leaderboardScore: { color: "#ffd166", fontSize: 15, fontWeight: "900" },
});
