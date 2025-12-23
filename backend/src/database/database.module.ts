import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StateMachine } from '../state-machine/entities/state-machine.entity';
import { Execution } from '../state-machine/entities/execution.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Support both connection string and individual parameters
        const databaseUrl = configService.get<string>('DATABASE_URL');

        if (databaseUrl) {
          // Use connection string (e.g., from Neon, Railway, etc.)
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [StateMachine, Execution],
            migrations: ['dist/database/migrations/*.js'],
            migrationsTableName: 'migrations',
            synchronize: false, // Always false - use migrations instead
            logging: configService.get<string>('NODE_ENV') === 'development',
            ssl: databaseUrl.includes('sslmode=require')
              ? { rejectUnauthorized: false }
              : false,
          };
        }

        // Fallback to individual parameters
        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'flow_builder'),
          entities: [StateMachine, Execution],
          migrations: ['dist/database/migrations/*.js'],
          migrationsTableName: 'migrations',
          synchronize: false, // Always false - use migrations instead
          logging: configService.get<string>('NODE_ENV') === 'development',
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
