import chalk from "chalk";

/**
 * Logging Utilities
 */
export const icons = {
  rocket: "🚀",
  key: "🔑",
  link: "🔗",
  folder: "📁",
  checkmark: "✔",
  cross: "✖",
  arrow: "→",
  dot: "•",
  sparkle: "✨",
  warning: "⚠",
  info: "🛈",
  clock: "⏱",
  skull: "💀",
};

export function logHeader(title: string): void {
  console.log();
  console.log(
    chalk.magentaBright(`  ${icons.sparkle} `) +
      chalk.bold.white(title)
  );
  console.log(chalk.gray(`  ${"─".repeat(45)}`));
  console.log();
}

export function logSection(title: string): void {
  console.log();
  console.log(chalk.cyan.bold(`  ${icons.dot} ${title}`));
  console.log(chalk.gray(`  ${"─".repeat(45)}`));
}

export function logEntry(label: string, value: string, icon?: string): void {
  const iconStr = icon !== undefined ? `${icon} ` : "   ";
  console.log(
    chalk.gray(`  ${iconStr}`) +
      chalk.white(`${label}: `) +
      chalk.yellowBright(value)
  );
}

export function logSuccess(message: string): void {
  console.log();
  console.log(
    chalk.greenBright(`  ${icons.checkmark} `) + chalk.green.bold(message)
  );
}

export function logError(message: string, error?: any): void {
  console.log();
  console.error(chalk.redBright(`  ${icons.cross} `) + chalk.red.bold(message));
  
  if (error) {
    if (error instanceof Error) {
        console.log(chalk.gray(`    ${error.message}`));
        if (error.stack) {
            console.log(chalk.gray(error.stack));
        }
    } else {
        console.log(chalk.gray(`    ${String(error)}`));
    }
  }
}

export function logWarning(message: string): void {
  console.log(
    chalk.yellowBright(`  ${icons.warning} `) + chalk.yellow(message)
  );
}

export function logInfo(message: string): void {
  console.log(chalk.blueBright(`  ${icons.info} `) + chalk.blue(message));
}

export function logDivider(): void {
  console.log();
}

// Legacy support (to be deprecated or mapped)
export function log(message: string, ...args: any[]): void {
   console.log(chalk.gray(`  ${message}`), ...args);
}
export function logField(label: string, value: string): void {
    logEntry(label, value);
}
