import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Execution } from './execution.entity';

@Entity('state_machines')
export class StateMachine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', name: 'aws_arn', nullable: true })
  awsArn: string | null;

  @Column({ type: 'jsonb' })
  definition: Record<string, unknown>;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'role_arn' })
  roleArn: string | null;

  @Column({ type: 'varchar', length: 50, default: 'STANDARD' })
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'timestamp', nullable: true, name: 'aws_creation_date' })
  awsCreationDate: Date | null;

  @Column({ type: 'jsonb', nullable: true, name: 'logging_configuration' })
  loggingConfiguration: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'tracing_configuration' })
  tracingConfiguration: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  tags: Record<string, string> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Execution, (execution) => execution.stateMachine)
  executions: Execution[];
}

