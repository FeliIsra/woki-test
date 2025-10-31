import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApprovalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const approver = request.headers['x-woki-approver'];
    if (!approver) {
      throw new ForbiddenException('Approval requires manager context');
    }
    return true;
  }
}
