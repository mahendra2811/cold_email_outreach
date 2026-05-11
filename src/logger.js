import chalk from 'chalk';

/** @param {string} msg */
export const info = (msg) => console.log(chalk.cyan(msg));
/** @param {string} msg */
export const ok = (msg) => console.log(chalk.green(msg));
/** @param {string} msg */
export const warn = (msg) => console.log(chalk.yellow(msg));
/** @param {string} msg */
export const err = (msg) => console.log(chalk.red(msg));
/** @param {string} msg */
export const dim = (msg) => console.log(chalk.gray(msg));
/** @param {string} msg */
export const heading = (msg) => console.log(chalk.bold.white(msg));
/** @param {string} msg */
export const raw = (msg) => console.log(msg);
