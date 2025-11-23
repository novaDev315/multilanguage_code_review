import { Module } from '@nestjs/common';
import { DependencyScannerService } from './dependency-scanner.service';

@Module({
  providers: [DependencyScannerService],
  exports: [DependencyScannerService],
})
export class SecurityModule {}
