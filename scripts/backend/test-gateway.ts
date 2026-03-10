import chalk from 'chalk';

const GATEWAY_URL = 'http://localhost:3000';

async function testGateway() {
  console.log(chalk.magenta.bold('\n🔍 Testing API Gateway Routing...\n'));

  const tests = [
    {
      name: 'Gateway Status',
      path: '/api/status',
      method: 'GET',
    },
    {
      name: 'Mint Service Proxy (Health)',
      path: '/api/mint/health',
      method: 'GET',
    },
    {
      name: 'Compliance Service Proxy (Health)',
      path: '/api/compliance/health',
      method: 'GET',
    },
    {
      name: 'Webhook Service Proxy (Health)',
      path: '/api/webhooks/health',
      method: 'GET',
    },
  ];

  for (const test of tests) {
    try {
      const response = await fetch(`${GATEWAY_URL}${test.path}`, {
        method: test.method,
      });

      if (response.ok) {
        const data = await response.json();
        console.log(
          `${chalk.green('✔')} ${chalk.bold(test.name.padEnd(30))} - ${chalk.cyan(
            JSON.stringify(data),
          )}`,
        );
      } else {
        console.log(
          `${chalk.red('✘')} ${chalk.bold(test.name.padEnd(30))} - ${chalk.red(
            `Status: ${response.status}`,
          )}`,
        );
      }
    } catch (error: any) {
      console.log(
        `${chalk.red('✘')} ${chalk.bold(test.name.padEnd(30))} - ${chalk.red(
          `Error: ${error.message}`,
        )}`,
      );
    }
  }

  // Test 404
  console.log(chalk.gray('\nTesting 404...'));
  try {
    const res = await fetch(`${GATEWAY_URL}/api/invalid-route`);
    console.log(
      res.status === 404
        ? `${chalk.green('✔')} Correctly handled 404 for invalid route`
        : `${chalk.red('✘')} Failed to handle 404 properly (Status: ${res.status})`,
    );
  } catch (e: any) {
    console.log(`${chalk.red('✘')} Error testing 404: ${e.message}`);
  }

  console.log(chalk.magenta.bold('\n✅ Gateway test complete.\n'));
}

testGateway().catch(console.error);
