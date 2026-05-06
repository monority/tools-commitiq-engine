export class TaskRunner {
    constructor(concurrency = 4) {
        this.concurrency = concurrency;
    }

    /**
     * Executes a set of tasks with a concurrency limit.
     * @param {Array<{run: Function}>} tasks - List of checkers to run.
     * @param {Object} context - The project context to pass to each run method.
     * @returns {Promise<Array<Object>>} Results of all executions.
     */
    async execute(tasks, context) {
        const results = [];
        const queue = [...tasks];
        const activePromises = [];

        while (queue.length > 0 || activePromises.length > 0) {
            // Fill the active pipeline up to the concurrency limit
            while (queue.length > 0 && activePromises.length < this.concurrency) {
                const task = queue.shift();
                const promise = (async () => {
                    try {
                        const result = await task.run(context);
                        return { name: task.name, ...result };
                    } catch (error) {
                        return {
                            name: task.name,
                            success: false,
                            message: error.message,
                            error: error
                        };
                    } finally {
                        // Remove itself from activePromises when done
                        activePromises.splice(activePromises.indexOf(promise), 1);
                    }
                })();
                activePromises.push(promise);
            }

            // Wait for the first task in the current batch to complete
            if (activePromises.length > 0) {
                const completed = await Promise.race(activePromises);
                results.push(completed);
            }
        }

        return results;
    }
}