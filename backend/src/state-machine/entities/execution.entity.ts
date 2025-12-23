import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StateMachine } from './state-machine.entity';

@Entity('executions')
export class Execution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500, name: 'aws_execution_arn', unique: true })
  awsExecutionArn: string;

  @Column({ type: 'varchar', length: 500, name: 'aws_state_machine_arn' })
  awsStateMachineArn: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'text', nullable: true })
  cause: string | null;

  @Column({ type: 'timestamp', name: 'aws_start_date', nullable: true })
  awsStartDate: Date | null;

  @Column({ type: 'timestamp', name: 'aws_stop_date', nullable: true })
  awsStopDate: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'trace_header' })
  traceHeader: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => StateMachine, (stateMachine) => stateMachine.executions, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'state_machine_id' })
  stateMachine: StateMachine | null;

  @Column({ type: 'uuid', nullable: true, name: 'state_machine_id' })
  stateMachineId: string | null;
}

