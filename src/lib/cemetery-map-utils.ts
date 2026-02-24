/**
 * Utilities for Cemetery Map: status colors, demo data, section type labels.
 * Mirrors the HTML Map Manager's UTILS and computeStatus.
 */

export const MAP_STORAGE_KEY = (park: "east" | "west") =>
  `dmp_sections_${park}`;

export const THRESHOLDS = { full: 0.95, busy: 0.75 };

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    Available: "#10b981",
    "Low Stock": "#f59e0b",
    Full: "#ef4444",
    Special: "#64748b",
  };
  return map[status] ?? "#94a3b8";
}

export function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    standard: "Standard Burial",
    garden: "Named Garden",
    mausoleum: "Mausoleum",
    special: "Special / Infrastructure",
  };
  return labels[type] ?? type ?? "Unknown";
}

export function computeStatus(props: {
  capacity?: number;
  occupied?: number;
  type?: string;
}): string {
  if (
    !props.capacity ||
    props.type === "special" ||
    props.type === "mausoleum"
  ) {
    return "Special";
  }
  const ratio = (props.occupied ?? 0) / props.capacity;
  if (ratio >= THRESHOLDS.full) return "Full";
  if (ratio >= THRESHOLDS.busy) return "Low Stock";
  return "Available";
}

export interface DemoWorkOrder {
  id: string;
  description: string;
  open: boolean;
}

export function generateDemoWorkOrders(sectionId: string): DemoWorkOrder[] {
  const hash = sectionId
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  if (hash % 3 === 0) return [];
  const types = [
    "Foundation/marker leveling",
    "Seasonal grounds maintenance",
    "Monument cleaning",
    "Drainage inspection",
    "Tree trimming",
  ];
  const result: DemoWorkOrder[] = [
    {
      id: `WO-2026-${((hash * 7) % 9000) + 1000}`,
      description: types[hash % types.length],
      open: true,
    },
  ];
  if (hash % 2 === 0) {
    result.push({
      id: `WO-2025-${((hash * 3) % 9000) + 1000}`,
      description: types[(hash + 2) % types.length],
      open: false,
    });
  }
  return result;
}

export interface DemoBurial {
  name: string;
  date: string;
  plot: string;
}

export function generateDemoBurials(sectionId: string): DemoBurial[] {
  const lastNames = [
    "Johnson",
    "Williams",
    "Brown",
    "Davis",
    "Wilson",
    "Moore",
    "Taylor",
    "Anderson",
    "Thomas",
    "Jackson",
    "Hughes",
    "Wright",
    "Martin",
    "Robinson",
    "Lewis",
    "Harris",
    "Walker",
    "Hall",
    "Allen",
    "Young",
  ];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hash = sectionId
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const count = (hash % 4) + 1;
  const suffix = sectionId.split("-").pop() ?? "0";
  return Array.from({ length: count }, (_, i) => {
    const nameIdx = (hash + i * 3) % lastNames.length;
    const monthIdx = (hash + i * 7) % 12;
    const day = ((hash + i * 11) % 28) + 1;
    const year = 2025 + ((hash + i) % 2);
    const plotNum = ((hash * 13 + i * 17) % 400) + 1;
    return {
      name: lastNames[nameIdx],
      date: `${months[monthIdx]} ${day}, ${year}`,
      plot: `${suffix}-${plotNum}`,
    };
  });
}

export interface SectionProperties {
  id: string;
  name: string;
  type: string;
  capacity: number;
  occupied: number;
  park: string;
}
