import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { PressableScale } from '../components/anim';
import { Banner, Button, card } from '../components/DebugUI';
import { useTheme } from '../components/theme';
import {
  Layout,
  Placement,
  createLayout,
  getLayout,
  getScan,
  listLayouts,
  listScans,
  saveLayout,
} from '../lib/api';
import { fitPieceToRect } from '../lib/roomFit';
import {
  RoomPiece,
  buildPiece,
  exposedEdges,
  roomNameOf,
  rotatedCells,
  rotatedSize,
} from '../lib/roomPiece';

const GRID_PRESETS = [24, 32, 48];

export default function HomeScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [pieces, setPieces] = useState<Map<string, RoomPiece>>(new Map());
  const [placements, setPlacements] = useState<Map<string, Placement>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dragging, setDragging] = useState(false);

  const cols = layout?.cols ?? 32;
  const rows = layout?.rows ?? 32;
  const boardPx = width - 40;
  const cellPx = boardPx / cols;

  // Refs so PanResponders (created once per piece) read fresh state.
  const placementsRef = useRef(placements);
  placementsRef.current = placements;
  const layoutRef = useRef({ cols, rows });
  layoutRef.current = { cols, rows };

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorText(null);
    try {
      // v1: one board — use the newest layout or create it.
      const summaries = await listLayouts();
      const lay =
        summaries.length > 0 ? await getLayout(summaries[0].id) : await createLayout('My home', 32, 32);

      const scans = await listScans(); // newest first
      const details = (await Promise.all(scans.map((s) => getScan(s.id)))).filter(
        (d) => d.measurements.length > 0
      );

      // One piece per room name — the NEWEST scan of a room replaces older
      // ones in the tray, and placements of superseded scans are remapped so
      // a re-scanned room keeps its position on the board.
      const scanRoomKey = new Map<string, string>();
      const latestByRoom = new Map<string, (typeof details)[number]>();
      for (const d of details) {
        const key = roomNameOf(d) ?? d.id;
        scanRoomKey.set(d.id, key);
        if (!latestByRoom.has(key)) latestByRoom.set(key, d);
      }

      const pieceMap = new Map<string, RoomPiece>();
      const latestScanIdByRoom = new Map<string, string>();
      for (const [key, d] of latestByRoom) {
        const name = roomNameOf(d) ?? d.ssid ?? 'Room';
        const piece =
          d.shapeW != null && d.shapeH != null
            ? fitPieceToRect(d.measurements, d.shapeW, d.shapeH, d.id, name)
            : buildPiece(d);
        pieceMap.set(d.id, piece);
        latestScanIdByRoom.set(key, d.id);
      }

      const placementMap = new Map<string, Placement>();
      for (const p of lay.placements) {
        const key = scanRoomKey.get(p.scanId);
        const latestId = key ? latestScanIdByRoom.get(key) : undefined;
        if (latestId && pieceMap.has(latestId) && !placementMap.has(latestId)) {
          placementMap.set(latestId, { ...p, scanId: latestId });
        }
      }

      setLayout(lay);
      setPieces(pieceMap);
      setPlacements(placementMap);
      setStatus('ready');
    } catch (e) {
      setErrorText(String(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addToBoard = useCallback((piece: RoomPiece) => {
    const { cols: c, rows: r } = layoutRef.current;
    const size = rotatedSize(piece, 0);
    const col = Math.max(0, Math.floor((c - size.w) / 2));
    const row = Math.max(0, Math.floor((r - size.h) / 2));
    setPlacements((map) => new Map(map).set(piece.scanId, { scanId: piece.scanId, col, row, rotation: 0 }));
    setSelected(piece.scanId);
  }, []);

  const removeFromBoard = useCallback((scanId: string) => {
    setPlacements((map) => {
      const next = new Map(map);
      next.delete(scanId);
      return next;
    });
    setSelected(null);
  }, []);

  const rotateSelected = useCallback(() => {
    if (!selected) return;
    setPlacements((map) => {
      const p = map.get(selected);
      const piece = pieces.get(selected);
      if (!p || !piece) return map;
      const rotation = (p.rotation + 1) % 4;
      const size = rotatedSize(piece, rotation);
      const { cols: c, rows: r } = layoutRef.current;
      // Keep the piece on the board after rotating: clamp into bounds.
      const col = Math.min(p.col, Math.max(0, c - size.w));
      const row = Math.min(p.row, Math.max(0, r - size.h));
      return new Map(map).set(selected, { ...p, rotation, col, row });
    });
  }, [selected, pieces]);

  const resizeGrid = useCallback((newCols: number, newRows: number) => {
    setLayout((l) => (l ? { ...l, cols: newCols, rows: newRows } : l));
    // Pieces that no longer fit bounce back to the tray.
    setPlacements((map) => {
      const next = new Map<string, Placement>();
      for (const [id, p] of map) {
        const piece = pieces.get(id);
        if (!piece) continue;
        const size = rotatedSize(piece, p.rotation);
        if (p.col + size.w <= newCols && p.row + size.h <= newRows) next.set(id, p);
      }
      return next;
    });
  }, [pieces]);

  const save = useCallback(async () => {
    if (!layout) return;
    setSaving(true);
    setErrorText(null);
    try {
      await saveLayout(layout.id, {
        cols,
        rows,
        placements: Array.from(placements.values()),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (e) {
      setErrorText(String(e));
    } finally {
      setSaving(false);
    }
  }, [layout, cols, rows, placements]);

  // Occupancy for overlap warnings.
  const overlapKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of placements.values()) {
      const piece = pieces.get(p.scanId);
      if (!piece) continue;
      for (const c of rotatedCells(piece, p.rotation)) {
        const key = `${p.col + c.dx},${p.row + c.dz}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([k]) => k));
  }, [placements, pieces]);

  const trayPieces = Array.from(pieces.values()).filter((p) => !placements.has(p.scanId));

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <ScrollView contentContainerStyle={styles.scroll}>
        <Banner color={theme.danger} text={errorText ?? 'Could not load'} />
        <Button label="Retry" onPress={load} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={!dragging}>
      {errorText && <Banner color={theme.danger} text={errorText} />}
      {savedFlash && <Banner color={theme.success} text="Home map saved ✓" />}

      {/* The board */}
      <View
        style={[
          styles.board,
          {
            width: boardPx,
            height: (boardPx / cols) * rows,
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        {/* Grid lines */}
        {Array.from({ length: cols - 1 }, (_, i) => (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              left: (i + 1) * cellPx,
              top: 0,
              bottom: 0,
              width: StyleSheet.hairlineWidth,
              backgroundColor: theme.border,
            }}
          />
        ))}
        {Array.from({ length: rows - 1 }, (_, i) => (
          <View
            key={`h${i}`}
            style={{
              position: 'absolute',
              top: (i + 1) * cellPx,
              left: 0,
              right: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.border,
            }}
          />
        ))}

        {Array.from(placements.values()).map((p) => {
          const piece = pieces.get(p.scanId);
          if (!piece) return null;
          return (
            <PlacedPiece
              key={p.scanId}
              piece={piece}
              placement={p}
              cellPx={cellPx}
              selected={selected === p.scanId}
              overlapKeys={overlapKeys}
              onSelect={() => setSelected(p.scanId)}
              onDragState={setDragging}
              onMove={(col, row) =>
                setPlacements((map) =>
                  new Map(map).set(p.scanId, { ...placementsRef.current.get(p.scanId)!, col, row })
                )
              }
              boardCols={cols}
              boardRows={rows}
            />
          );
        })}
      </View>

      {/* Selected piece actions */}
      {selected && placements.has(selected) && (
        <View style={styles.pieceActions}>
          <Button label="⟳ Rotate" onPress={rotateSelected} />
          <Button label="Remove from board" variant="ghost" onPress={() => removeFromBoard(selected)} />
        </View>
      )}

      {/* Grid size */}
      <View style={card(theme)}>
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>Grid size</Text>
        <View style={styles.presetRow}>
          {GRID_PRESETS.map((n) => (
            <PressableScale
              key={n}
              onPress={() => resizeGrid(n, n)}
              style={[
                styles.preset,
                { backgroundColor: cols === n && rows === n ? theme.primary : theme.inputBg },
              ]}
            >
              <Text style={{ color: cols === n && rows === n ? '#fff' : theme.muted, fontWeight: '600' }}>
                {n}×{n}
              </Text>
            </PressableScale>
          ))}
          <PressableScale
            onPress={() => resizeGrid(cols + 8, rows + 8)}
            style={[styles.preset, { backgroundColor: theme.inputBg }]}
          >
            <Text style={{ color: theme.muted, fontWeight: '600' }}>+8</Text>
          </PressableScale>
        </View>
      </View>

      {/* Tray */}
      <View style={card(theme)}>
        <Text style={[styles.sectionTitle, { color: theme.muted }]}>
          Rooms — tap to place on the board
        </Text>
        {trayPieces.length === 0 && (
          <Text style={{ color: theme.muted, fontSize: 13 }}>
            All rooms are placed. Scan more rooms from the Measure tab.
          </Text>
        )}
        <View style={styles.tray}>
          {trayPieces.map((piece) => (
            <PressableScale key={piece.scanId} onPress={() => addToBoard(piece)} style={styles.trayItem}>
              <MiniPiece piece={piece} />
              <Text style={[styles.trayName, { color: theme.text }]} numberOfLines={1}>
                {piece.name}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>

      <Button label="Save home map" loading={saving} onPress={save} />
    </ScrollView>
  );
}

/** A placed room on the board: draggable (snaps to cells), bordered, labeled. */
function PlacedPiece({
  piece,
  placement,
  cellPx,
  selected,
  overlapKeys,
  onSelect,
  onMove,
  onDragState,
  boardCols,
  boardRows,
}: {
  piece: RoomPiece;
  placement: { col: number; row: number; rotation: number };
  cellPx: number;
  selected: boolean;
  overlapKeys: Set<string>;
  onSelect: () => void;
  onMove: (col: number, row: number) => void;
  onDragState: (d: boolean) => void;
  boardCols: number;
  boardRows: number;
}) {
  const startRef = useRef({ col: placement.col, row: placement.row });
  const liveRef = useRef({ col: placement.col, row: placement.row });
  const propsRef = useRef({ placement, cellPx, boardCols, boardRows, piece });
  propsRef.current = { placement, cellPx, boardCols, boardRows, piece };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        const { placement } = propsRef.current;
        startRef.current = { col: placement.col, row: placement.row };
        liveRef.current = startRef.current;
        onSelect();
        onDragState(true);
      },
      onPanResponderMove: (_e, g) => {
        const { cellPx, boardCols, boardRows, piece, placement } = propsRef.current;
        const size = rotatedSize(piece, placement.rotation);
        const col = Math.min(
          Math.max(0, startRef.current.col + Math.round(g.dx / cellPx)),
          boardCols - size.w
        );
        const row = Math.min(
          Math.max(0, startRef.current.row + Math.round(g.dy / cellPx)),
          boardRows - size.h
        );
        if (col !== liveRef.current.col || row !== liveRef.current.row) {
          liveRef.current = { col, row };
          onMove(col, row);
        }
      },
      onPanResponderRelease: () => onDragState(false),
      onPanResponderTerminate: () => onDragState(false),
    })
  ).current;

  const cells = rotatedCells(piece, placement.rotation);
  const size = rotatedSize(piece, placement.rotation);
  const edges = exposedEdges(cells);

  return (
    <View
      {...pan.panHandlers}
      style={{
        position: 'absolute',
        left: placement.col * cellPx,
        top: placement.row * cellPx,
        width: size.w * cellPx,
        height: size.h * cellPx,
      }}
    >
      {edges.map(({ cell, top, bottom, left, right }) => {
        const overlapping = overlapKeys.has(
          `${placement.col + cell.dx},${placement.row + cell.dz}`
        );
        return (
          <View
            key={`${cell.dx},${cell.dz}`}
            style={{
              position: 'absolute',
              left: cell.dx * cellPx,
              top: cell.dz * cellPx,
              width: cellPx,
              height: cellPx,
              backgroundColor: overlapping ? '#EF4444' : cell.color,
              opacity: overlapping ? 0.8 : cell.interpolated ? 0.45 : selected ? 1 : 0.9,
              borderTopWidth: top ? 2 : 0,
              borderBottomWidth: bottom ? 2 : 0,
              borderLeftWidth: left ? 2 : 0,
              borderRightWidth: right ? 2 : 0,
              borderColor: selected ? '#ffffff' : 'rgba(0,0,0,0.55)',
            }}
          />
        );
      })}
      <Text style={styles.pieceLabel} numberOfLines={1}>
        {piece.name}
      </Text>
    </View>
  );
}

/** Small preview of a piece for the tray. */
function MiniPiece({ piece }: { piece: RoomPiece }) {
  const maxPx = 56;
  const px = Math.max(3, Math.floor(maxPx / Math.max(piece.w, piece.h)));
  return (
    <View style={{ width: piece.w * px, height: piece.h * px }}>
      {piece.cells.map((c) => (
        <View
          key={`${c.dx},${c.dz}`}
          style={{
            position: 'absolute',
            left: c.dx * px,
            top: c.dz * px,
            width: px - 0.5,
            height: px - 0.5,
            backgroundColor: c.color,
            opacity: c.interpolated ? 0.45 : 1,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  board: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  pieceActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  preset: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  trayItem: {
    alignItems: 'center',
    gap: 4,
    maxWidth: 80,
  },
  trayName: {
    fontSize: 11,
  },
  pieceLabel: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textShadowColor: '#000000',
    textShadowRadius: 3,
  },
});
