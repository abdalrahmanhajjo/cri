/**
 * Run async tasks with a concurrency limit. Prevents overwhelming APIs while
 * running multiple requests in parallel. Professional implementation.
 * @param {number} concurrency - Max number of tasks running at once
 * @param {Array<() => Promise<T>>} tasks - Array of functions that return promises
 * @param {(err: Error) => void} onError - Optional callback for per-task errors (task still counts as done)
 * @returns {Promise<T[]>} Resolved values in same order as tasks; failed tasks yield undefined at that index
 */
export async function asyncPool(concurrency, tasks, onError) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError('concurrency must be a positive integer');
  }
  if (!Array.isArray(tasks)) return [];
  const results = [];
  const executing = new Set();
  let index = 0;

  async function runNext() {
    if (index >= tasks.length) return;
    const i = index++;
    const fn = tasks[i];
    const p = Promise.resolve(typeof fn === 'function' ? fn() : fn)
      .then((value) => {
        results[i] = value;
        return value;
      })
      .catch((err) => {
        if (typeof onError === 'function') onError(err);
        results[i] = undefined;
        return undefined;
      });
    executing.add(p);
    await p;
    executing.delete(p);
    if (index < tasks.length) await runNext();
  }

  const workers = [];
  for (let k = 0; k < Math.min(concurrency, tasks.length); k++) {
    workers.push(runNext());
  }
  await Promise.all(workers);
  return results;
}

export default asyncPool;
