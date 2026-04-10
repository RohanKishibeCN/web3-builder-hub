import { pgTable, serial, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull().unique(),
  summary: text('summary'),
  source: text('source'),
  discoveredAt: timestamp('discovered_at', { withTimezone: false }).defaultNow(),
  deadline: timestamp('deadline', { withTimezone: false }),
  prizePool: text('prize_pool'),
  status: text('status').default('new'),
  retryCount: integer('retry_count').default(0),
  score: jsonb('score'),
  deepDiveResult: jsonb('deep_dive_result'),
  createdAt: timestamp('created_at', { withTimezone: false }).defaultNow(),
}, (table) => {
  return {
    statusIdx: index('idx_projects_status').on(table.status),
    discoveredAtIdx: index('idx_projects_discovered_at').on(table.discoveredAt),
  };
});

export const apiLogs = pgTable('api_logs', {
  id: serial('id').primaryKey(),
  apiName: text('api_name').notNull(),
  status: text('status').notNull(),
  durationMs: integer('duration_ms'),
  found: integer('found').default(0),
  inserted: integer('inserted').default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: false }).defaultNow(),
}, (table) => {
  return {
    apiNameIdx: index('idx_api_logs_api_name').on(table.apiName),
    createdAtIdx: index('idx_api_logs_created_at').on(table.createdAt),
  };
});
