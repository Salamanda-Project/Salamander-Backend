// src/schedulers/priceUpdateScheduler.js
const schedule = require('node-schedule');
const dexService = require('../services/dex');
const cexService = require('../services/cex');
const priceComparisonEngine = require('../services/priceComparisonEngine');
const tokenCategorizer = require('../services/tokenCategorizer');
const logger = require('../utils/logger');

/**
 * PriceUpdateScheduler - Schedules various price update tasks
 */
class PriceUpdateScheduler {
  constructor() {
    this.scheduledJobs = {};
  }

  /**
   * Start a job to update DEX prices
   * @param {string} cronExpression - Cron expression for scheduling
   * @returns {object} Scheduled job
   */
  startDEXPriceUpdates(cronExpression = '*/5 * * * *') { // Every 5 minutes by default
    const jobName = 'dex-price-updates';
    
    // Cancel existing job if any
    if (this.scheduledJobs[jobName]) {
      this.scheduledJobs[jobName].cancel();
    }
    
    // Schedule new job
    const job = schedule.scheduleJob(jobName, cronExpression, async () => {
      logger.info('Running scheduled DEX price update job');
      try {
        const results = await dexService.updateAllPrices();
        logger.info('DEX price update completed', { results });
      } catch (error) {
        logger.error('DEX price update job failed:', error);
      }
    });
    
    this.scheduledJobs[jobName] = job;
    logger.info(`Scheduled DEX price update job with cron: ${cronExpression}`);
    return job;
  }

  /**
   * Start a job to update CEX prices
   * @param {string} cronExpression - Cron expression for scheduling
   * @returns {object} Scheduled job
   */
  startCEXPriceUpdates(cronExpression = '*/3 * * * *') { // Every 3 minutes by default
    const jobName = 'cex-price-updates';
    
    // Cancel existing job if any
    if (this.scheduledJobs[jobName]) {
      this.scheduledJobs[jobName].cancel();
    }
    
    // Schedule new job
    const job = schedule.scheduleJob(jobName, cronExpression, async () => {
      logger.info('Running scheduled CEX price update job');
      try {
        const results = await cexService.updateAllPrices();
        logger.info('CEX price update completed', { results });
      } catch (error) {
        logger.error('CEX price update job failed:', error);
      }
    });
    
    this.scheduledJobs[jobName] = job;
    logger.info(`Scheduled CEX price update job with cron: ${cronExpression}`);
    return job;
  }

  /**
   * Start a job to look for arbitrage opportunities
   * @param {string} cronExpression - Cron expression for scheduling
   * @returns {object} Scheduled job
   */
  startArbitrageDetection(cronExpression = '*/2 * * * *') { // Every 2 minutes by default
    const jobName = 'arbitrage-detection';
    
    // Cancel existing job if any
    if (this.scheduledJobs[jobName]) {
      this.scheduledJobs[jobName].cancel();
    }
    
    // Schedule new job
    const job = schedule.scheduleJob(jobName, cronExpression, async () => {
      logger.info('Running scheduled arbitrage detection job');
      try {
        const opportunities = await priceComparisonEngine.compareAllPopularPairs();
        logger.info(`Found ${opportunities.length} arbitrage opportunities`);
      } catch (error) {
        logger.error('Arbitrage detection job failed:', error);
      }
    });
    
    this.scheduledJobs[jobName] = job;
    logger.info(`Scheduled arbitrage detection job with cron: ${cronExpression}`);
    return job;
  }

  /**
   * Start a job to update token categories
   * @param {string} cronExpression - Cron expression for scheduling
   * @returns {object} Scheduled job
   */
  startTokenCategoryUpdates(cronExpression = '0 */12 * * *') { // Every 12 hours by default
    const jobName = 'token-category-updates';
    
    // Cancel existing job if any
    if (this.scheduledJobs[jobName]) {
      this.scheduledJobs[jobName].cancel();
    }
    
    // Schedule new job
    const job = schedule.scheduleJob(jobName, cronExpression, async () => {
      logger.info('Running scheduled token category update job');
      try {
        const updatedCount = await tokenCategorizer.updateAllTokenCategories();
        logger.info(`Updated categories for ${updatedCount} tokens`);
      } catch (error) {
        logger.error('Token category update job failed:', error);
      }
    });
    
    this.scheduledJobs[jobName] = job;
    logger.info(`Scheduled token category update job with cron: ${cronExpression}`);
    return job;
  }

  /**
   * Start all scheduled jobs
   */
  startAllJobs() {
    this.startDEXPriceUpdates();
    this.startCEXPriceUpdates();
    this.startArbitrageDetection();
    this.startTokenCategoryUpdates();
    logger.info('All scheduled jobs started');
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    Object.values(this.scheduledJobs).forEach(job => job.cancel());
    this.scheduledJobs = {};
    logger.info('All scheduled jobs stopped');
  }
}

module.exports = new PriceUpdateScheduler();