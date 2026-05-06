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
        const results = new Array(tasks.length);
        let nextIndex = 0;

        const runTask = async (task, index) => {
            try {
                const result = await task.run(context);
                results[index] = { name: task.name, ...result };
            } catch (error) {
                results[index] = {
                    name: task.name,
                    success: false,
                    message: error.message,
                    error: error
                };
            }
        };

        const worker = async () => {
            while (nextIndex < tasks.length) {
                const index = nextIndex;
                nextIndex += 1;
                await runTask(tasks[index], index);
            }
        };

        const workerCount = Math.min(this.concurrency, tasks.length);
        const workers = Array.from({ length: workerCount }, () => worker());
        await Promise.all(workers);

        return results;
    }
}
