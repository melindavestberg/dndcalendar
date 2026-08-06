import { ColorCountRow } from './types';

export const USER_COLOR_PALETTE = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#84cc16',
  '#14d3cd',
  '#e14963',
  '#a855f7',
  '#d946ef',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#f472b6',
  '#0891b2',
  '#ea580c',
  '#16a34a'
];

export const pickLeastUsedColor = (colorCounts: ColorCountRow[]): string => {
  const counts = new Map<string, number>();

  USER_COLOR_PALETTE.forEach((color) => counts.set(color, 0));

  colorCounts.forEach((entry) => {
    if (counts.has(entry._id)) {
      counts.set(entry._id, entry.count);
    }
  });

  return [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
};
