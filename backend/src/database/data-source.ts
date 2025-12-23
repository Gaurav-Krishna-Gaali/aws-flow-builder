import { DataSource, DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import { StateMachine } from '../state-machine/entities/state-machine.entity';
import { Execution } from '../state-machine/entities/execution.entity';

// Load environment variables
config();

// Support both connection string and individual parameters
const databaseUrl = process.env.DATABASE_URL;
const nodeEnv = process.env.NODE_ENV || 'development';

const dataSourceOptions: DataSourceOptions = databaseUrl
  ? {
      type: 'postgres',
      url: databaseUrl,
      entities: [StateMachine, Execution],
      migrations: ['dist/database/migrations/*.js'],
      migrationsTableName: 'migrations',
      synchronize: false, // Always false, use migrations
      logging: nodeEnv === 'development',
      ssl: databaseUrl.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false,
    }
  : {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'flow_builder',
      entities: [StateMachine, Execution],
      migrations: ['dist/database/migrations/*.js'],
      migrationsTableName: 'migrations',
      synchronize: false, // Always false, use migrations
      logging: nodeEnv === 'development',
    };

export const AppDataSource = new DataSource(dataSourceOptions);

