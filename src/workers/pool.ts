import { availableParallelism } from 'node:os';

export interface WorkerJob<T> {
  id: string;
  run: () => Promise<T>;
}

export class WorkerPool {
  private queue: Array<WorkerJob<unknown>> = [];
  private active = 0;
  private readonly concurrency: number;

  constructor(concurrency = availableParallelism()) {
    this.concurrency = Math.max(1, concurrency);
  }

  enqueue<T>(job: WorkerJob<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: job.id,
        run: async () => {
          try {
            const result = await job.run();
            resolve(result);
            return result;
          } catch (error) {
            reject(error);
            throw error;
          }
        },
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) return;
      this.active++;
      job
        .run()
        .catch(() => undefined)
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}
