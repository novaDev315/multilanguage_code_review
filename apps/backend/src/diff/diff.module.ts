import { Module } from '@nestjs/common';
import { DiffService } from './diff.service';
import { DiffController } from './diff.controller';

@Module({
  providers: [DiffService],
  controllers: [DiffController],
  exports: [DiffService],
})
export class DiffModule {}
