import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import morgan, { StreamOptions } from 'morgan';
import { Request, Response } from 'express';

@Module({})
export class LoggerModule implements NestModule {
  private readonly logger = new Logger('HTTP');

  configure(consumer: MiddlewareConsumer) {
    const stream: StreamOptions = {
      write: (message: string) => {
        this.logger.log(message.trim());
      },
    };

    const morganMiddleware = morgan('combined', { stream });

    consumer
      // Apply to all routes; adjust if you want to scope it
      .apply((req: Request, res: Response, next: () => void) =>
        morganMiddleware(req, res, next),
      )
      .forRoutes('*');
  }
}
