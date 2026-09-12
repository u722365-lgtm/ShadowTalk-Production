import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type TaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface QueuedTask {
  id: string;
  type: string;
  payload: any;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
}

interface OfflineQueueDB extends DBSchema {
  tasks: {
    key: string;
    value: QueuedTask;
    indexes: { 'by-status': string };
  };
}

export class OfflineQueue {
  private dbPromise: Promise<IDBPDatabase<OfflineQueueDB>>;

  constructor() {
    this.dbPromise = openDB<OfflineQueueDB>('shadowtalk-offline-queue', 1, {
      upgrade(db) {
        const store = db.createObjectStore('tasks', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
      },
    });
  }

  async addTask(type: string, payload: any): Promise<string> {
    const db = await this.dbPromise;
    const task: QueuedTask = {
      id: crypto.randomUUID(),
      type,
      payload,
      status: 'QUEUED',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.put('tasks', task);
    return task.id;
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    const db = await this.dbPromise;
    const task = await db.get('tasks', id);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      await db.put('tasks', task);
    }
  }

  async getPendingTasks(): Promise<QueuedTask[]> {
    const db = await this.dbPromise;
    return await db.getAllFromIndex('tasks', 'by-status', 'QUEUED');
  }
}

export const offlineQueue = new OfflineQueue();
