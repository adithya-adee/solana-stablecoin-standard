import chalk from 'chalk';

const SERVICES = [
  { name: 'API Gateway', url: 'http://localhost:3000/health' },
  { name: 'Mint Service', url: 'http://localhost:3001/health' },
  { name: 'Event Listener', url: 'http://localhost:3002/health' },
  { name: 'Compliance Service', url: 'http://localhost:3003/health' },
  { name: 'Webhook Service', url: 'http://localhost:3004/health' },
];

async function runHealthCheck() {
  console.log(chalk.blue.bold('\n🚀 Starting Backend Health Check...\n'));

  for (const service of SERVICES) {
    try {
      const start = Date.now();
      const response = await fetch(service.url);
      const duration = Date.now() - start;

      if (response.ok) {
        const data = await response.json();
        console.log(
          `${chalk.green('✔')} ${chalk.bold(service.name.padEnd(20))} ${chalk.gray(
            `(${duration}ms)`,
          )} - ${chalk.cyan(JSON.stringify(data))}`,
        );
      } else {
        console.log(
          `${chalk.red('✘')} ${chalk.bold(service.name.padEnd(20))} - ${chalk.red(
            `Error: ${response.status} ${response.statusText}`,
          )}`,
        );
      }
    } catch (error: any) {
      console.log(
        `${chalk.red('✘')} ${chalk.bold(service.name.padEnd(20))} - ${chalk.red(
          `Failed to connect: ${error.message}`,
        )}`,
      );
    }
  }

  console.log(chalk.blue.bold('\n✨ Health Check Complete.\n'));
}

runHealthCheck().catch((err) => {
  console.error(chalk.red('Fatal error during health check:'), err);
  process.exit(1);
});
