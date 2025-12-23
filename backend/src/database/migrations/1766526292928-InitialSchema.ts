import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1766526292928 implements MigrationInterface {
    name = 'InitialSchema1766526292928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "executions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "aws_execution_arn" character varying(500) NOT NULL, "aws_state_machine_arn" character varying(500) NOT NULL, "name" character varying(255), "status" character varying(50) NOT NULL, "input" jsonb, "output" jsonb, "error" text, "cause" text, "aws_start_date" TIMESTAMP, "aws_stop_date" TIMESTAMP, "trace_header" character varying(500), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "state_machine_id" uuid, CONSTRAINT "UQ_97a0bd36f65bfde3553138fade3" UNIQUE ("aws_execution_arn"), CONSTRAINT "PK_703e64e0ef651986191844b7b8b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "state_machines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "aws_arn" text, "definition" jsonb NOT NULL, "role_arn" character varying(500), "type" character varying(50) NOT NULL DEFAULT 'STANDARD', "status" character varying(20) NOT NULL DEFAULT 'ACTIVE', "aws_creation_date" TIMESTAMP, "logging_configuration" jsonb, "tracing_configuration" jsonb, "tags" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d55b5eece4cbb154455a23fc3c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "executions" ADD CONSTRAINT "FK_8def041265f8e94bc60c3d3a1d7" FOREIGN KEY ("state_machine_id") REFERENCES "state_machines"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "executions" DROP CONSTRAINT "FK_8def041265f8e94bc60c3d3a1d7"`);
        await queryRunner.query(`DROP TABLE "state_machines"`);
        await queryRunner.query(`DROP TABLE "executions"`);
    }

}
