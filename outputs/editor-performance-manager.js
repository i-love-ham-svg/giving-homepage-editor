(function () {
  "use strict";

  function resolveFrameApi(frameApi = {}) {
    const source = frameApi.requestAnimationFrame ? frameApi : window;
    return {
      requestAnimationFrame: source.requestAnimationFrame.bind(source),
      cancelAnimationFrame: source.cancelAnimationFrame.bind(source)
    };
  }

  function createFrameScheduler(callback, frameApi = {}) {
    const api = resolveFrameApi(frameApi);
    let frameId = null;
    let lastArgs = [];

    const run = () => {
      const args = lastArgs;
      frameId = null;
      lastArgs = [];
      callback(...args);
    };

    return Object.freeze({
      schedule(...args) {
        lastArgs = args;
        if (frameId !== null) return frameId;
        frameId = api.requestAnimationFrame(run);
        return frameId;
      },
      cancel() {
        if (frameId === null) return false;
        api.cancelAnimationFrame(frameId);
        frameId = null;
        lastArgs = [];
        return true;
      },
      flush() {
        if (frameId === null) return false;
        api.cancelAnimationFrame(frameId);
        run();
        return true;
      },
      get pending() {
        return frameId !== null;
      }
    });
  }

  function createTaskRegistry(frameApi = {}) {
    const tasks = new Map();

    function getTask(name) {
      const task = tasks.get(name);
      if (!task) throw new Error(`Unknown frame task: ${name}`);
      return task;
    }

    return Object.freeze({
      register(name, callback) {
        if (!name || typeof callback !== "function") {
          throw new TypeError("A task name and callback are required");
        }
        if (tasks.has(name)) return tasks.get(name);
        const task = createFrameScheduler(callback, frameApi);
        tasks.set(name, task);
        return task;
      },
      has(name) {
        return tasks.has(name);
      },
      schedule(name, ...args) {
        return getTask(name).schedule(...args);
      },
      cancel(name) {
        return getTask(name).cancel();
      },
      flush(name) {
        return getTask(name).flush();
      },
      cancelAll() {
        let cancelled = 0;
        tasks.forEach((task) => {
          if (task.cancel()) cancelled += 1;
        });
        return cancelled;
      },
      get pending() {
        return Array.from(tasks.values()).some((task) => task.pending);
      }
    });
  }

  window.EditorPerformanceManager = Object.freeze({
    createFrameScheduler,
    createTaskRegistry
  });
})();
