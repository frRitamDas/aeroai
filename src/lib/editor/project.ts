"use client";

import type { Page } from "./types";
import { uid } from "@/lib/utils";

export interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  pageCount: number;
  thumbnail?: string;
  pages: Page[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  pageCount: number;
  thumbnail?: string;
}

const DB_NAME = "aerotext-studio";
const DB_VERSION = 1;
const STORE = "projects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open project storage."));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Storage error"));
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function saveProject(
  name: string,
  pages: Page[],
  thumbnail?: string,
  id?: string,
): Promise<ProjectRecord> {
  const record: ProjectRecord = {
    id: id ?? uid("proj"),
    name: name.trim() || "Untitled project",
    updatedAt: Date.now(),
    pageCount: pages.length,
    thumbnail,
    pages,
  };
  await tx("readwrite", (store) => store.put(record) as IDBRequest<IDBValidKey>);
  return record;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const all = await tx<ProjectRecord[]>("readonly", (store) => store.getAll() as IDBRequest<ProjectRecord[]>);
  return all
    .map(({ pages, ...rest }) => ({ ...rest, pageCount: pages.length }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<ProjectRecord | null> {
  const record = await tx<ProjectRecord | undefined>("readonly", (store) => store.get(id) as IDBRequest<ProjectRecord | undefined>);
  return record ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id) as IDBRequest<undefined>);
}

/** Export the whole document as a portable JSON project file. */
export function projectToJson(name: string, pages: Page[]): Blob {
  const payload = {
    format: "aerotext-project",
    version: 1,
    name,
    exportedAt: new Date().toISOString(),
    pages,
  };
  return new Blob([JSON.stringify(payload)], { type: "application/json" });
}

export interface ParsedProject {
  name: string;
  pages: Page[];
}

export async function jsonToProject(file: File): Promise<ParsedProject> {
  const text = await file.text();
  const parsed = JSON.parse(text) as { pages?: Page[]; name?: string };
  if (!parsed.pages || !Array.isArray(parsed.pages)) {
    throw new Error("This file is not an AeroText project (no pages found).");
  }
  const pages = parsed.pages.map((page) => ({
    ...page,
    id: page.id ?? uid("page"),
    layers: page.layers ?? [],
    brushBatches: page.brushBatches ?? [],
  }));
  return { name: parsed.name ?? file.name.replace(/\.json$/i, ""), pages };
}
