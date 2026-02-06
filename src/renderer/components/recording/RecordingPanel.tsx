/**
 * RecordingPanel - Floating draggable recording control panel
 *
 * Features:
 * - Draggable via mouse events
 * - Minimized state shows only mic icon with pulsing red dot when recording
 * - Expanded state shows level meters, duration, controls, and candidate select
 * - Accessible from any wheel section (rendered in ProjectLayout)
 */
import { useState, useEffect, useRef } from "react";
import { Mic, Square, X, Minimize2, Maximize2, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useRecordingStore } from "../../stores/recordingStore";
import { WaveformMeter } from "./WaveformMeter";
import { CandidateSelect } from "./CandidateSelect";
import { cn } from "../../lib/utils";

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ============================================================================
// Component
// ============================================================================

export function RecordingPanel() {
  const {
    state,
    isPanelExpanded,
    micLevel,
    systemLevel,
    durationMs,
    startRecording,
    stopRecording,
    attachToCandidate,
    discardRecording,
    togglePanel,
    updateDuration,
  } = useRecordingStore();

  // Dragging state
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const isRecording = state === "recording";
  const isStopped = state === "stopped";
  const isAttaching = state === "attaching";

  // Update duration every 100ms while recording
  useEffect(() => {
    if (state !== "recording") return;

    const interval = setInterval(() => {
      updateDuration();
    }, 100);

    return () => clearInterval(interval);
  }, [state, updateDuration]);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag on buttons or interactive elements
    if ((e.target as HTMLElement).closest("button, input, [role=button]")) {
      return;
    }

    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  // Handle drag move and end
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      // Calculate new position
      let newX = e.clientX - dragOffset.current.x;
      let newY = e.clientY - dragOffset.current.y;

      // Keep panel within viewport bounds
      const panelWidth = isPanelExpanded ? 320 : 48;
      const panelHeight = isPanelExpanded ? 400 : 48;

      newX = Math.max(0, Math.min(window.innerWidth - panelWidth, newX));
      newY = Math.max(0, Math.min(window.innerHeight - panelHeight, newY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isPanelExpanded]);

  // Minimized tray view
  if (!isPanelExpanded) {
    return (
      <div
        className={cn("fixed z-50 cursor-move", isRecording && "animate-pulse")}
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
      >
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-12 w-12 rounded-full shadow-lg border-2",
            isRecording &&
              "bg-red-500 text-white border-red-500 hover:bg-red-600",
            isStopped && "border-amber-500",
          )}
          onClick={togglePanel}
        >
          {isRecording ? (
            <div className="relative">
              <Mic className="h-5 w-5" />
              <div className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-white rounded-full animate-pulse" />
            </div>
          ) : isStopped ? (
            <div className="relative">
              <Mic className="h-5 w-5" />
              <div className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-amber-500 rounded-full" />
            </div>
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>
    );
  }

  // Expanded panel view
  return (
    <Card
      className={cn(
        "fixed z-50 w-80 shadow-xl cursor-move select-none",
        isDragging && "opacity-90 shadow-2xl",
      )}
      style={{ left: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mic className="h-4 w-4" />
          Call Recording
          {isRecording && (
            <span className="flex items-center gap-1 text-red-500 ml-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-normal">REC</span>
            </span>
          )}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={togglePanel}
        >
          <Minimize2 className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Level Meters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14">System</span>
            <WaveformMeter level={systemLevel} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14">Mic</span>
            <WaveformMeter level={micLevel} />
          </div>
        </div>

        {/* Duration */}
        {(isRecording || isStopped) && (
          <div className="text-center text-2xl font-mono">
            {formatDuration(durationMs)}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-2">
          {state === "idle" && (
            <Button
              onClick={startRecording}
              className="bg-red-500 hover:bg-red-600"
            >
              <Mic className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <Button onClick={stopRecording} variant="outline">
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}

          {isStopped && (
            <Button
              onClick={discardRecording}
              variant="outline"
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Discard
            </Button>
          )}

          {isAttaching && (
            <Button disabled variant="outline">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Attaching...
            </Button>
          )}
        </div>

        {/* Candidate Selection (when stopped) */}
        {isStopped && (
          <CandidateSelect
            onSelect={attachToCandidate}
            disabled={isAttaching}
          />
        )}

        {/* Help text */}
        {state === "idle" && (
          <p className="text-xs text-muted-foreground text-center">
            Records system audio (remote party) and microphone
          </p>
        )}
      </CardContent>
    </Card>
  );
}
