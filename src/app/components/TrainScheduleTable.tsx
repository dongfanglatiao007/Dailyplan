import {
  Clock,
  Plus,
  Trash2,
  X,
  Download,
  Zap,
  FileText,
  Check,
  ChevronDown,
  Users,
} from "lucide-react";
import { useState, useRef, Fragment, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  activityType: string;
  carriageNo?: string;
  equipmentNo?: string;
  team?: string;
  shift?: string;
  requirement?: string[];
  remarks?: string;
}

interface ScheduleEntry {
  id: number;
  trainNo: string;
  timeRange?: string;
  trainPath: string[];
  pmPeak?: "Y" | "N";
  activities: Activity[];
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

let actIdCounter = 100;
function genActId() {
  return "act-" + actIdCounter++;
}

const scheduleData: ScheduleEntry[] = [
  {
    id: 1,
    trainNo: "AEL01",
    timeRange: "08:00-09:00",
    trainPath: ["31"],
    pmPeak: "Y",
    activities: [
      { id: genActId(), activityType: "T1", team: "MB", shift: "Day", requirement: ["HMT"], remarks: "備註1" },
      { id: genActId(), activityType: "Axle NDT", carriageNo: "V101", equipmentNo: "A123456", team: "MA", shift: "Night", requirement: ["RMT"], remarks: "備註2" },
    ],
  },
  {
    id: 2,
    trainNo: "AEL02",
    timeRange: "",
    trainPath: [],
    activities: [
      { id: genActId(), activityType: "Depot" },
    ],
  },
  {
    id: 3,
    trainNo: "TCL01",
    timeRange: "10:00-15:30",
    trainPath: ["30"],
    pmPeak: "N",
    activities: [
      { id: genActId(), activityType: "設備修", carriageNo: "X610", equipmentNo: "A001", team: "MA", shift: "Early", requirement: ["RMT"] },
      { id: genActId(), activityType: "設備修", carriageNo: "W710", equipmentNo: "A002", team: "HM", shift: "Early", requirement: ["RMT"] },
    ],
  },
  {
    id: 4,
    trainNo: "TCL05",
    timeRange: "09:00-14:00",
    trainPath: ["31"],
    activities: [
      { id: genActId(), activityType: "Spare" },
    ],
  },
  {
    id: 5,
    trainNo: "AEL05",
    timeRange: "",
    trainPath: ["3"],
    pmPeak: "Y",
    activities: [
      { id: genActId(), activityType: "Depot" },
      { id: genActId(), activityType: "設備修", carriageNo: "H101", equipmentNo: "C001", team: "SC", shift: "Day", requirement: ["HMT"], remarks: "輪對檢測" },
    ],
  },
];

// ─── Constants ──────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  { value: "設備修", label: "設備修" },
  { value: "Depot", label: "Depot" },
  { value: "Spare", label: "Spare" },
  { value: "T1", label: "T1" },
  { value: "Axle NDT", label: "Axle NDT" },
  { value: "常規檢修", label: "常規檢修" },
  { value: "臨時維護", label: "臨時維護" },
  { value: "Save mileage", label: "Save mileage" },
  { value: "Stop", label: "Stop" },
];

const REQUIREMENTS = [
  { value: "RMT", label: "RMT" },
  { value: "HMT", label: "HMT" },
  { value: "HCT", label: "HCT" },
  { value: "PCT", label: "PCT" },
  { value: "WCT", label: "WCT" },
];

const CARRIAGE_OPTIONS = [
  "H101", "H102", "H201", "H202",
  "V101", "V102", "V201", "V202",
  "V812", "V912", "X610", "W710",
];

const EQUIPMENT_OPTIONS = [
  "A001", "A002", "A123456", "B012", "B013",
  "C001", "C002", "D001", "D002",
  "E001", "F001",
];

const TEAM_OPTIONS = ["MA", "MB", "HM", "MC", "SC", "Support A", "Support B", "Support C"];

const SHIFT_OPTIONS = ["Early", "Day", "Night"];

const TRAIN_NO_OPTIONS = ["TCL01", "TCL02", "TCL03", "TCL05", "AEL01", "AEL02", "AEL05", "AEL11", "TS01"];

const TRAIN_PATH_OPTIONS = [
  ...Array.from({ length: 9 }, (_, i) => String(i + 1)),
  ...Array.from({ length: 30 }, (_, i) => String(i + 21)),
];

// ─── Sorting Helper ─────────────────────────────────────────────────────────

const PREFIX_ORDER = ["TCL", "AEL", "DRL", "TS"];

function trainNoSortKey(trainNo: string): [number, number] {
  const prefix = trainNo.replace(/\d+$/, "");
  const num = parseInt(trainNo.replace(/\D+/g, ""), 10) || 0;
  const prefixIdx = PREFIX_ORDER.indexOf(prefix);
  return [prefixIdx >= 0 ? prefixIdx : PREFIX_ORDER.length, num];
}

function sortEntries(list: ScheduleEntry[]): ScheduleEntry[] {
  return [...list].sort((a, b) => {
    const [ap, an] = trainNoSortKey(a.trainNo);
    const [bp, bn] = trainNoSortKey(b.trainNo);
    return ap !== bp ? ap - bp : an - bn;
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTechColorByName(name: string) {
  const map: Record<string, string> = {
    MA: "#3b82f6", MB: "#6366f1", HM: "#00bcd4", MC: "#9c27b0", SC: "#10b981",
    "Support A": "#f59e0b", "Support B": "#ff6900", "Support C": "#ef4444",
  };
  return map[name] || "#64748b";
}

function getShiftStyle(shift?: string) {
  switch (shift) {
    case "Early": return "bg-[#dff2fe] text-[#0069a8]";
    case "Day": return "bg-[#fef3c6] text-[#bb4d00]";
    case "Night": return "bg-[#ede9fe] text-[#7c3aed]";
    default: return "bg-[#f1f5f9] text-[#64748b]";
  }
}

function getReqStyle(req?: string) {
  switch (req) {
    case "RMT": return "bg-[#ecfdf5] text-[#059669]";
    case "HMT": return "bg-[#fef3c6] text-[#d97706]";
    case "HCT": return "bg-[#dff2fe] text-[#0284c7]";
    case "PCT": return "bg-[#fce7f3] text-[#db2777]";
    case "WCT": return "bg-[#ede9fe] text-[#7c3aed]";
    default: return "bg-[#f1f5f9] text-[#64748b]";
  }
}

// ─── Inline Select Component ────────────────────────────────────────────────

function InlineSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
  mono,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-2 py-1 bg-transparent border border-transparent rounded text-xs text-[#1e293b] focus:outline-none focus:border-[#3b82f6]/40 hover:border-[#d1d5db] hover:bg-[#f9fafb] transition-colors appearance-none cursor-pointer ${className || ""}`}
      style={mono ? { fontFamily: "JetBrains Mono, monospace" } : {}}
    >
      <option value="">{placeholder || "—"}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Filterable Select Component ────────────────────────────────────────────

function FilterableSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
  mono,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const displayLabel = options.find((o) => o.value === value)?.label || "";

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    setHighlightIdx(0);
  }, [search, open]);

  // scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  // Check space and determine drop direction
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 250; // Approximate height of dropdown
      
      // If not enough space below but more space above, drop up
      setDropUp(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setSearch("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIdx]) {
        handleSelect(filtered[highlightIdx].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  const fontStyle = mono ? { fontFamily: "JetBrains Mono, monospace" } : {};

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1 bg-transparent border border-transparent rounded text-xs text-[#1e293b] hover:border-[#d1d5db] hover:bg-[#f9fafb] transition-colors cursor-pointer w-full text-left"
        style={fontStyle}
      >
        <span className={`flex-1 truncate ${!value ? "text-[#94a3b8]" : ""}`}>
          {displayLabel || placeholder || "—"}
        </span>
        <ChevronDown className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div 
          className={`fixed z-[100] min-w-[160px] bg-white rounded-lg border border-[#e2e8f0] shadow-lg overflow-hidden`}
          style={{
            left: containerRef.current ? `${containerRef.current.getBoundingClientRect().left}px` : 0,
            top: dropUp 
              ? containerRef.current ? `${containerRef.current.getBoundingClientRect().top - 250}px` : 0
              : containerRef.current ? `${containerRef.current.getBoundingClientRect().bottom + 4}px` : 0,
          }}
        >
          {/* Search input */}
          <div className="p-1.5 border-b border-[#f1f5f9]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入篩選..."
              className="w-full px-2 py-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-xs text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white"
              style={fontStyle}
            />
          </div>

          {/* Options list */}
          <div ref={listRef} className="max-h-[200px] overflow-y-auto py-1">
            {/* Clear option */}
            <div
              onClick={() => handleSelect("")}
              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors text-[#94a3b8] hover:bg-[#f1f5f9]`}
            >
              {placeholder || "—"}
            </div>
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#94a3b8] text-center">無匹配項</div>
            ) : (
              filtered.map((o, idx) => (
                <div
                  key={o.value}
                  onClick={() => handleSelect(o.value)}
                  className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                    idx === highlightIdx ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#1e293b] hover:bg-[#f8fafc]"
                  } ${o.value === value ? "bg-[#f0f9ff]" : ""}`}
                  style={fontStyle}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Multi-Select Component ─────────────────────────────────────────────────

function MultiSelect({
  values,
  options,
  onChange,
  placeholder,
}: {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const displayLabels = values.map((v) => options.find((o) => o.value === v)?.label || "").join(", ");

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    setHighlightIdx(0);
  }, [search, open]);

  // scroll highlighted item into view
  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightIdx] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  // Check space and determine drop direction
  useEffect(() => {
    if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 250; // Approximate height of dropdown
      
      // If not enough space below but more space above, drop up
      setDropUp(spaceBelow < dropdownHeight && spaceAbove > spaceBelow);
    }
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setSearch("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = (v: string) => {
    const newValues = values.includes(v) ? values.filter((val) => val !== v) : [...values, v];
    onChange(newValues);
    // Keep dropdown open for multiple selections
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIdx]) {
        handleSelect(filtered[highlightIdx].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  const fontStyle = { fontFamily: "JetBrains Mono, monospace" };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1 bg-transparent border border-transparent rounded text-xs text-[#1e293b] hover:border-[#d1d5db] hover:bg-[#f9fafb] transition-colors cursor-pointer w-full text-left"
      >
        <span className={`flex-1 truncate ${!values.length ? "text-[#94a3b8]" : ""}`}>
          {displayLabels || placeholder || "—"}
        </span>
        <ChevronDown className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div 
          className={`fixed z-[100] min-w-[160px] bg-white rounded-lg border border-[#e2e8f0] shadow-lg overflow-hidden`}
          style={{
            left: containerRef.current ? `${containerRef.current.getBoundingClientRect().left}px` : 0,
            top: dropUp 
              ? containerRef.current ? `${containerRef.current.getBoundingClientRect().top - 250}px` : 0
              : containerRef.current ? `${containerRef.current.getBoundingClientRect().bottom + 4}px` : 0,
          }}
        >
          {/* Search input */}
          <div className="p-1.5 border-b border-[#f1f5f9]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="輸入篩選..."
              className="w-full px-2 py-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-xs text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white"
            />
          </div>

          {/* Options list */}
          <div ref={listRef} className="max-h-[200px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#94a3b8] text-center">無匹配項</div>
            ) : (
              filtered.map((o, idx) => {
                const isSelected = values.includes(o.value);
                return (
                  <div
                    key={o.value}
                    onClick={() => handleSelect(o.value)}
                    className={`flex items-center px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                      idx === highlightIdx ? "bg-[#eff6ff] text-[#2563eb]" : "text-[#1e293b] hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border mr-2 flex items-center justify-center ${
                        isSelected ? "bg-[#3b82f6] border-[#3b82f6]" : "border-[#cbd5e1]"
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                    </div>
                    {o.label}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TrainScheduleTable() {
  const [entries, setEntries] = useState<ScheduleEntry[]>(sortEntries(scheduleData));
  const [addingTrainId, setAddingTrainId] = useState<number | null>(null);
  const [showStaffSchedule, setShowStaffSchedule] = useState(false);
  const [teamShiftMap, setTeamShiftMap] = useState<Record<string, string>>({
    MA: "Early",
    MB: "Day",
    HM: "Early",
    MC: "Night",
    SC: "Day",
    "Support A": "Day",
    "Support B": "Night",
    "Support C": "Early",
  });
  const tableRef = useRef<HTMLDivElement>(null);

  // ── Entry-level updates ──
  const updateEntry = (id: number, field: keyof ScheduleEntry, value: any) => {
    setEntries((prev) => {
      // When changing trainNo, check if that train already exists
      if (field === "trainNo" && value) {
        const existing = prev.find((e) => e.trainNo === value && e.id !== id);
        if (existing) {
          // Merge: move all activities from current entry into the existing one
          const current = prev.find((e) => e.id === id);
          if (current) {
            return sortEntries(
              prev
                .map((e) => {
                  if (e.id === existing.id) {
                    return { ...e, activities: [...e.activities, ...current.activities] };
                  }
                  return e;
                })
                .filter((e) => e.id !== id)
            );
          }
        }
      }
      const updated = prev.map((e) => (e.id === id ? { ...e, [field]: value } : e));
      return field === "trainNo" ? sortEntries(updated) : updated;
    });
  };

  const deleteEntry = (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const addEntry = () => {
    const newEntry: ScheduleEntry = {
      id: Date.now(),
      trainNo: "",
      timeRange: "",
      trainPath: [],
      activities: [{ id: genActId(), activityType: "", team: "", shift: "", requirement: [] }],
    };
    setEntries((prev) => [...prev, newEntry]);
  };

  // ── Activity-level updates ──
  const updateActivity = (entryId: number, actId: string, field: keyof Activity, value: string) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          activities: e.activities.map((a) => {
            if (a.id !== actId) return a;
            const updated = { ...a, [field]: value || undefined };
            
            // Clear carriage/equipment if not 設備修
            if (field === "activityType" && value !== "設備修") {
              updated.carriageNo = undefined;
              updated.equipmentNo = undefined;
            }
            
            // Clear team/shift/requirement for specific activity types
            if (field === "activityType" && ["Depot", "Spare", "Save mileage", "Stop"].includes(value)) {
              updated.team = undefined;
              updated.shift = undefined;
              updated.requirement = undefined;
            }
            
            return updated;
          }),
        };
      })
    );
  };

  const updateActivityArray = (entryId: number, actId: string, field: keyof Activity, value: string[]) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          activities: e.activities.map((a) => {
            if (a.id !== actId) return a;
            return { ...a, [field]: value.length > 0 ? value : undefined };
          }),
        };
      })
    );
  };

  const deleteActivity = (entryId: number, actId: string) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        const newActs = e.activities.filter((a) => a.id !== actId);
        return { ...e, activities: newActs };
      }).filter((e) => e.activities.length > 0)
    );
  };

  const addActivity = (entryId: number) => {
    setEntries((prev) =>
      prev.map((e) => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          activities: [
            ...e.activities,
            { id: genActId(), activityType: "", team: "", shift: "", requirement: [] },
          ],
        };
      })
    );
    setAddingTrainId(entryId);
  };

  // ── Cell styles ──
  const cellBase = "px-3 py-2.5 text-xs text-[#1e293b]";
  const cellBorder = "border-b border-[#f1f5f9]";
  const spanCellBorder = "border-b border-[#e2e8f0]";

  return (
    <div className="w-full min-h-screen bg-[#f8fafc] p-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="max-w-[1500px] mx-auto">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] text-xs uppercase tracking-wider">檢修日期</span>
              <span className="text-[#1e293b] text-sm" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                2026/10/03
              </span>
            </div>
            <div className="h-4 w-px bg-[#e2e8f0]" />
            <div className="flex items-center gap-2">
              <span className="text-[#94a3b8] text-xs uppercase tracking-wider">運行圖</span>
              <span className="text-[#1e293b] text-sm" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                LAR401+DRL138N
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStaffSchedule(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e2e8f0] rounded-lg text-[#64748b] text-xs hover:bg-[#f1f5f9] transition-colors shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              人員排班表
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e2e8f0] rounded-lg text-[#64748b] text-xs hover:bg-[#f1f5f9] transition-colors shadow-sm">
              <Download className="w-3.5 h-3.5" />
              導出
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#e2e8f0] rounded-lg text-[#64748b] text-xs hover:bg-[#f1f5f9] transition-colors shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              一鍵編制
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1e293b] rounded-lg text-white text-xs hover:bg-[#0f172a] transition-colors shadow-sm">
              <FileText className="w-3.5 h-3.5" />
              查看明細
            </button>
          </div>
        </div>

        {/* ─── Table ─── */}
        <div ref={tableRef} className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  {[
                    { label: "列車編號", w: "w-[100px]" },
                    { label: "起止時間", w: "w-[160px]" },
                    { label: "指定車次", w: "w-[80px]" },
                    { label: "晚高峰", w: "w-[64px]" },
                    { label: "作業內容", w: "w-[120px]" },
                    { label: "車廂編號", w: "w-[100px]" },
                    { label: "設備編號", w: "w-[110px]" },
                    { label: "作業班組", w: "w-[90px]" },
                    { label: "班次", w: "w-[80px]" },
                    { label: "作業需求", w: "w-[90px]" },
                    { label: "備註", w: "min-w-[100px]" },
                    { label: "", w: "w-[80px]" },
                  ].map((h, i) => (
                    <th key={i} className={`px-3 py-3 text-left ${h.w}`}>
                      <span className="text-[#94a3b8] text-[10px] uppercase tracking-widest">{h.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const rowCount = Math.max(entry.activities.length, 1);
                  return (
                    <Fragment key={entry.id}>
                      {entry.activities.map((act, actIdx) => {
                        const isFirst = actIdx === 0;
                        const isDevice = act.activityType === "設備修";
                        return (
                          <tr
                            key={act.id}
                            className={`${actIdx < rowCount - 1 ? cellBorder : spanCellBorder} hover:bg-[#fafbfc] transition-colors`}
                          >
                            {/* ── Train-level cells (rowSpan on first row) ── */}
                            {isFirst && (
                              <>
                                {/* 列車編號 */}
                                <td className={`${cellBase} ${spanCellBorder} align-top`} rowSpan={rowCount}>
                                  <FilterableSelect
                                    value={entry.trainNo}
                                    options={TRAIN_NO_OPTIONS.map((t) => ({ value: t, label: t }))}
                                    onChange={(v) => updateEntry(entry.id, "trainNo", v)}
                                    placeholder="選擇"
                                    mono
                                    className="bg-[#f1f5f9] rounded-md"
                                  />
                                </td>

                                {/* 起止時間 */}
                                <td className={`${cellBase} ${spanCellBorder} align-top`} rowSpan={rowCount}>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-[#94a3b8] flex-shrink-0" />
                                    <input
                                      type="time"
                                      value={entry.timeRange?.split("-")[0] || ""}
                                      onChange={(e) => {
                                        const end = entry.timeRange?.split("-")[1] || "";
                                        updateEntry(entry.id, "timeRange", e.target.value + "-" + end);
                                      }}
                                      className="w-[72px] px-1 py-0.5 bg-transparent border border-transparent rounded text-xs text-[#1e293b] focus:outline-none focus:border-[#3b82f6]/40 hover:border-[#d1d5db] transition-colors"
                                    />
                                    <span className="text-[#94a3b8] text-xs flex-shrink-0">–</span>
                                    <input
                                      type="time"
                                      value={entry.timeRange?.split("-")[1] || ""}
                                      onChange={(e) => {
                                        const start = entry.timeRange?.split("-")[0] || "";
                                        updateEntry(entry.id, "timeRange", start + "-" + e.target.value);
                                      }}
                                      className="w-[72px] px-1 py-0.5 bg-transparent border border-transparent rounded text-xs text-[#1e293b] focus:outline-none focus:border-[#3b82f6]/40 hover:border-[#d1d5db] transition-colors"
                                    />
                                  </div>
                                </td>

                                {/* 指定車次 */}
                                <td className={`${cellBase} ${spanCellBorder} align-top`} rowSpan={rowCount}>
                                  <FilterableSelect
                                    value={entry.trainPath[0] || ""}
                                    options={TRAIN_PATH_OPTIONS.map((p) => ({ value: p, label: p }))}
                                    onChange={(v) => updateEntry(entry.id, "trainPath", v ? [v] : [])}
                                    placeholder="—"
                                    mono
                                    className="bg-[#ecfdf5] rounded-full"
                                  />
                                </td>

                                {/* 晚高峰 */}
                                <td className={`${cellBase} ${spanCellBorder} align-top text-center`} rowSpan={rowCount}>
                                  <button
                                    onClick={() => {
                                      updateEntry(entry.id, "pmPeak", entry.pmPeak === "Y" ? "N" : "Y");
                                    }}
                                    className={`inline-flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                                      entry.pmPeak === "Y"
                                        ? "bg-[#059669] border-[#059669]"
                                        : "bg-white border-[#d1d5db] hover:border-[#94a3b8]"
                                    }`}
                                  >
                                    {entry.pmPeak === "Y" && (
                                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                    )}
                                  </button>
                                </td>
                              </>
                            )}

                            {/* ── Activity-level cells (per row) ── */}

                            {/* 作業內容 */}
                            <td className={cellBase}>
                              <FilterableSelect
                                value={act.activityType || ""}
                                options={ACTIVITY_TYPES}
                                onChange={(v) => updateActivity(entry.id, act.id, "activityType", v)}
                                placeholder="選擇類型"
                              />
                            </td>

                            {/* 車廂編號 */}
                            <td className={cellBase}>
                              {isDevice ? (
                                <FilterableSelect
                                  value={act.carriageNo || ""}
                                  options={CARRIAGE_OPTIONS.map((c) => ({ value: c, label: c }))}
                                  onChange={(v) => updateActivity(entry.id, act.id, "carriageNo", v)}
                                  placeholder="選擇"
                                  mono
                                />
                              ) : (
                                <span className="text-[#cbd5e1] px-2">—</span>
                              )}
                            </td>

                            {/* 設備編號 */}
                            <td className={cellBase}>
                              {isDevice ? (
                                <FilterableSelect
                                  value={act.equipmentNo || ""}
                                  options={EQUIPMENT_OPTIONS.map((e) => ({ value: e, label: e }))}
                                  onChange={(v) => updateActivity(entry.id, act.id, "equipmentNo", v)}
                                  placeholder="選擇"
                                  mono
                                />
                              ) : (
                                <span className="text-[#cbd5e1] px-2">—</span>
                              )}
                            </td>

                            {/* 作業班組 */}
                            <td className={cellBase}>
                              {["Depot", "Spare", "Save mileage", "Stop"].includes(act.activityType || "") ? (
                                <span className="text-[#cbd5e1] px-2">—</span>
                              ) : (
                                <FilterableSelect
                                  value={act.team || ""}
                                  options={TEAM_OPTIONS.map((t) => ({ value: t, label: t }))}
                                  onChange={(v) => {
                                    updateActivity(entry.id, act.id, "team", v);
                                    // Auto-fill shift from teamShiftMap
                                    const autoShift = teamShiftMap[v];
                                    if (autoShift) {
                                      updateActivity(entry.id, act.id, "shift", autoShift);
                                    }
                                  }}
                                  placeholder="選擇"
                                />
                              )}
                            </td>

                            {/* 班次 */}
                            <td className={cellBase}>
                              {["Depot", "Spare", "Save mileage", "Stop"].includes(act.activityType || "") ? (
                                <span className="text-[#cbd5e1] px-2">—</span>
                              ) : (
                                <FilterableSelect
                                  value={act.shift || ""}
                                  options={SHIFT_OPTIONS.map((s) => ({ value: s, label: s }))}
                                  onChange={(v) => updateActivity(entry.id, act.id, "shift", v)}
                                  placeholder="選擇"
                                />
                              )}
                            </td>

                            {/* 作業需求 */}
                            <td className={cellBase}>
                              {["Depot", "Spare", "Save mileage", "Stop"].includes(act.activityType || "") ? (
                                <span className="text-[#cbd5e1] px-2">—</span>
                              ) : (
                                <MultiSelect
                                  values={act.requirement || []}
                                  options={REQUIREMENTS}
                                  onChange={(v) => updateActivityArray(entry.id, act.id, "requirement", v)}
                                  placeholder="選擇"
                                />
                              )}
                            </td>

                            {/* 備註 */}
                            <td className={cellBase}>
                              <input
                                type="text"
                                value={act.remarks || ""}
                                onChange={(e) => updateActivity(entry.id, act.id, "remarks", e.target.value)}
                                placeholder="—"
                                className="w-full px-2 py-1 bg-transparent border border-transparent rounded text-xs text-[#64748b] placeholder:text-[#cbd5e1] focus:outline-none focus:border-[#3b82f6]/40 hover:border-[#d1d5db] hover:bg-[#f9fafb] transition-colors"
                              />
                            </td>

                            {/* 操作 */}
                            <td className={cellBase}>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => addActivity(entry.id)}
                                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#eff6ff] transition-colors group"
                                  title="添加作業"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#cbd5e1] group-hover:text-[#3b82f6]" />
                                </button>
                                <button
                                  onClick={() => deleteActivity(entry.id, act.id)}
                                  className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#fef2f2] transition-colors group"
                                  title="刪除作業"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-[#cbd5e1] group-hover:text-[#ef4444]" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ─── Add Train Button ─── */}
          <div className="border-t border-[#f1f5f9] px-4 py-3">
            <button
              onClick={addEntry}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-[#64748b] text-xs bg-[#f8fafc] border border-dashed border-[#cbd5e1] hover:border-[#94a3b8] hover:bg-[#f1f5f9] transition-all w-full justify-center"
            >
              <Plus className="w-4 h-4" />
              添加維護記錄
            </button>
          </div>
        </div>
      </div>

      {/* ─── Staff Schedule Modal ─── */}
      {showStaffSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0]">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#3b82f6]" />
                <h2 className="text-base font-semibold text-[#1e293b]">人員排班表</h2>
              </div>
              <button
                onClick={() => setShowStaffSchedule(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f1f5f9] transition-colors"
              >
                <X className="w-4 h-4 text-[#64748b]" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <p className="text-xs text-[#64748b] mb-4">
                配置各班組的默認班次，選擇班組後將自動填充對應的班次。
              </p>
              <div className="space-y-3">
                {TEAM_OPTIONS.map((team) => (
                  <div
                    key={team}
                    className="flex items-center justify-between p-3 bg-[#f8fafc] rounded-lg border border-[#e2e8f0] hover:border-[#cbd5e1] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-flex items-center justify-center w-16 text-[11px] text-white px-3 py-1 rounded-full"
                        style={{ backgroundColor: getTechColorByName(team) }}
                      >
                        {team}
                      </span>
                      <span className="text-xs text-[#64748b]">默認班次</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {SHIFT_OPTIONS.map((shift) => (
                        <button
                          key={shift}
                          onClick={() =>
                            setTeamShiftMap((prev) => ({ ...prev, [team]: shift }))
                          }
                          className={`px-3 py-1.5 rounded-md text-[11px] transition-all ${
                            teamShiftMap[team] === shift
                              ? getShiftStyle(shift)
                              : "bg-white border border-[#e2e8f0] text-[#94a3b8] hover:border-[#cbd5e1]"
                          }`}
                        >
                          {shift}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e2e8f0] bg-[#f8fafc]">
              <button
                onClick={() => setShowStaffSchedule(false)}
                className="px-4 py-2 rounded-lg text-xs text-[#64748b] hover:bg-[#e2e8f0] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => setShowStaffSchedule(false)}
                className="px-4 py-2 rounded-lg text-xs bg-[#3b82f6] text-white hover:bg-[#2563eb] transition-colors"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}