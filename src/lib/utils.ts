import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

let idCounters: Record<string, number> = {};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const formatted = amount.toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });
  return `₹${formatted}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateId(prefix: string): string {
  if (!(prefix in idCounters)) {
    idCounters[prefix] = 0;
  }
  idCounters[prefix]++;
  const num = String(idCounters[prefix]).padStart(3, "0");
  return `${prefix}-${num}`;
}

export function daysBetween(date1: Date, date2: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.floor(Math.abs(utc2 - utc1) / msPerDay);
}
